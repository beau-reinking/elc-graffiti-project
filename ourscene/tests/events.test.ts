import { describe, expect, it } from 'vitest';
import { MusicEvent, EventRemoval, resolveEvents, type EventInput } from '../src/domain/events';
import { localToInstant, dateRange, overlaps, datePreset, instantToLocal } from '../src/domain/schedule';
import { EventPublishingService } from '../src/application/event-publishing';
import { GraffitiEventRepository } from '../src/infrastructure/event-repository';
import { actorA, actorB, identity, venueConfig, FakeEnvironment, MemoryGraffiti } from './fixtures';

export const eventInput = (change: Partial<EventInput> = {}): EventInput => ({ title: 'Live at the venue', description: 'An independent live set.', startsAt: Date.parse('2026-11-01T23:00:00Z'), endsAt: Date.parse('2026-11-02T02:00:00Z'), timeZone: 'America/New_York', ...change });
const event = (revision = 1, published = 1, actor = actorA) => new MusicEvent({ actor, url: `event:${actor}:${revision}:${published}` }, MusicEvent.draft(eventInput(), actorA, 'stable-event', revision, published));
const removal = (actor = actorA) => new EventRemoval({ actor, url: 'removal:1' }, { type: 'EventRemoval', schemaVersion: 1, eventId: 'stable-event', venueActor: actorA, revision: 3, published: 3 });

describe('Event domain and revision resolution', () => {
  it('validates immutable schedule, ticket and artwork data', () => {
    const value = MusicEvent.draft(eventInput({ tickets: { kind: 'paid', availability: 'available', price: 25, currency: 'USD', url: 'https://example.com/tickets' }, performers: ['A quartet'] }), actorA, 'id', 1, 10);
    expect(Object.isFrozen(value)).toBe(true); expect(Object.isFrozen(value.tickets)).toBe(true); expect(Object.isFrozen(value.performers)).toBe(true);
  });
  it('rejects invalid scheduling and unsafe URLs', () => {
    for (const input of [eventInput({ endsAt: eventInput().startsAt }), eventInput({ doorsAt: eventInput().startsAt + 1 }), eventInput({ timeZone: 'Not/A_Zone' }), eventInput({ imageUrl: 'javascript:alert(1)' }), eventInput({ tickets: { kind: 'paid', availability: 'available', url: 'http://example.com' } })]) expect(() => MusicEvent.draft(input, actorA, 'id', 1, 10)).toThrow();
  });
  it('rejects contradictory prices, missing currency and unsupported schemas', () => {
    expect(() => MusicEvent.draft(eventInput({ tickets: { kind: 'free', availability: 'available', price: 10 } }), actorA, 'id', 1, 10)).toThrow();
    expect(() => MusicEvent.draft(eventInput({ tickets: { kind: 'paid', availability: 'available', price: 10 } }), actorA, 'id', 1, 10)).toThrow();
    expect(() => new MusicEvent({ actor: actorA, url: 'event:bad' }, { ...event().value, schemaVersion: 9 })).toThrow('Unsupported');
  });
  it('resolves revisions deterministically without duplicating an event', () => {
    const events = resolveEvents([event(1, 1), event(2, 2), event(2, 3), event(2, 3)], actorA);
    expect(events).toHaveLength(1); expect(events[0].published).toBe(3); expect(events[0].eventId).toBe('stable-event');
  });
  it('rejects forged authors even if they claim the correct venue and event ID', () => {
    expect(resolveEvents([event(100, 100, actorB), event(1)], actorA)[0].value.revision).toBe(1);
    expect(resolveEvents([event(), removal(actorB)], actorA)).toHaveLength(1);
  });
  it('never reactivates a removed event from older or later-arriving revisions', () => {
    expect(resolveEvents([event(), removal(), event(100, 100)], actorA)).toEqual([]);
    expect(Object.keys(removal().value)).not.toContain('description');
  });
});

describe('Timezone-aware scheduling and date filters', () => {
  it('rejects ambiguous and nonexistent local times at daylight-saving boundaries', () => {
    expect(() => localToInstant('2026-11-01T01:30', 'America/New_York')).toThrow('ambiguous');
    expect(() => localToInstant('2026-03-08T02:30', 'America/New_York')).toThrow('invalid');
    const instant = localToInstant('2026-11-01T03:30', 'America/New_York'); expect(instantToLocal(instant, 'America/New_York')).toBe('2026-11-01T03:30');
  });
  it('uses actual 23-hour and 25-hour calendar days', () => {
    const spring = dateRange('2026-03-08', '2026-03-08', 'America/New_York');
    const fall = dateRange('2026-11-01', '2026-11-01', 'America/New_York');
    expect(spring.until - spring.from).toBe(23 * 3600_000); expect(fall.until - fall.from).toBe(25 * 3600_000);
  });
  it('includes the selected end date, overnight overlap and excludes exact boundary touches', () => {
    const range = dateRange('2026-10-26', '2026-10-27', 'America/New_York');
    expect(overlaps(range.from - 3600_000, range.from + 3600_000, range)).toBe(true);
    expect(overlaps(range.until - 3600_000, range.until + 3600_000, range)).toBe(true);
    expect(overlaps(range.until, range.until + 3600_000, range)).toBe(false);
    expect(overlaps(range.from - 3600_000, range.from, range)).toBe(false);
  });
  it('rejects reversed or invalid ranges and makes weekend Saturday–Sunday', () => {
    expect(() => dateRange('2026-11-02', '2026-11-01', 'UTC')).toThrow('end date');
    expect(() => dateRange('', '', 'UTC')).toThrow('valid');
    expect(datePreset('weekend', 'UTC', Date.parse('2026-10-26T12:00:00Z'))).toEqual({ from: '2026-10-31', through: '2026-11-01' });
    expect(datePreset('weekend', 'UTC', Date.parse('2026-11-01T12:00:00Z'))).toEqual({ from: '2026-10-31', through: '2026-11-01' });
  });
});

describe('Event publishing and withdrawal', () => {
  function setup(actor = actorA) {
    const client = new MemoryGraffiti(), repo = new GraffitiEventRepository(client, new FakeEnvironment());
    const service = new EventPublishingService(venueConfig(), identity(actor), repo, () => 100, () => 'stable-event');
    return { client, repo, service };
  }
  it('creates, revises and cancels an event with a stable identity', async () => {
    const { service } = setup(); const first = await service.publish(eventInput());
    const second = await service.revise(first, eventInput({ title: 'Corrected title' })); const cancelled = await service.cancel(second);
    expect(first.eventId).toBe(second.eventId); expect(second.value.revision).toBe(2); expect(cancelled.value.revision).toBe(3); expect(cancelled.value.status).toBe('cancelled');
    expect((await service.revise(cancelled, eventInput())).value.status).toBe('cancelled');
  });
  it('prevents unauthorized publication and correction', async () => {
    await expect(setup(actorB).service.publish(eventInput())).rejects.toThrow('configured identity');
    await expect(setup().service.revise(event(1, 1, actorB), eventInput())).rejects.toThrow('Only');
  });
  it('retains a minimal terminal marker and purges historical event content', async () => {
    const { service, client, repo } = setup(); const first = await service.publish(eventInput()); const second = await service.revise(first, eventInput());
    expect(await service.remove(second)).toEqual([]);
    expect(client.database.records.has(first.url)).toBe(false); expect(client.database.records.has(second.url)).toBe(false);
    let records: readonly (MusicEvent | EventRemoval)[] = [];
    const observation = repo.observeEvents([actorA], update => { records = update.records; });
    try { await observation.refresh(); expect(records).toHaveLength(1); expect(records[0]).toBeInstanceOf(EventRemoval); expect(resolveEvents(records, actorA)).toEqual([]); }
    finally { observation.stop(); }
  });
});
