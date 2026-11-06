import { describe, expect, it } from 'vitest';
import { EventExplorerState, groupLocations } from '../src/application/event-explorer';
import { FeedStore } from '../src/application/feed-store';
import { MusicEvent, eventKey } from '../src/domain/events';
import { VenueProfile } from '../src/domain/models';
import type { EventFeedItem } from '../src/application/ports';
import { actorA, actorB, profile } from './fixtures';

const item = (id: string, actor = actorA, location: { latitude: number; longitude: number } | undefined = { latitude: 40.7, longitude: -74 }, status = 'scheduled'): EventFeedItem => ({
  venue: new VenueProfile({ actor, url: `profile:${actor}` }, { ...profile(actor).value, ...(location ? { location } : {}) }),
  event: new MusicEvent({ actor, url: `event:${actor}:${id}` }, { type: 'MusicEvent', schemaVersion: 1, eventId: id, venueActor: actor, revision: 1, published: 1, status,
    title: `Event ${id}`, description: 'Live music', startsAt: Date.parse('2026-10-27T01:00:00Z'), endsAt: Date.parse('2026-10-27T04:00:00Z'), timeZone: 'America/New_York' }),
});
function stateWith(items: readonly EventFeedItem[]) {
  const state = new EventExplorerState('America/New_York', () => Date.parse('2026-10-26T12:00:00Z'));
  state.update({ ...new FeedStore().snapshot(), venues: items.map(item => item.venue), events: items }); return state;
}
describe('Event grouping and shared discovery state', () => {
  it('groups coincident locations across venues while keeping nearby sites separate', () => {
    const groups = groupLocations([item('one'), item('two', actorB), item('three', actorB, { latitude: 40.701, longitude: -74 })]);
    expect(groups).toHaveLength(2); expect(groups[0].items).toHaveLength(2);
  });
  it('keeps unlocated events in the list and outside map pin counts', () => {
    const state = stateWith([item('one'), item('two', actorB, undefined)]);
    // Explicitly construct a coordinate-free venue: default arguments do not remove location.
    const unlocated = { ...item('three', actorB), venue: profile(actorB) };
    state.update({ ...new FeedStore().snapshot(), venues: [profile(), unlocated.venue], events: [item('one'), unlocated] });
    expect(state.project().items).toHaveLength(2); expect(state.project().groups).toHaveLength(1); expect(state.project().missingLocations).toBe(1);
  });
  it('updates pin counts and closes filtered-away selections using the same filter state', () => {
    const a = item('one'), b = item('two'), state = stateWith([a, b]);
    state.selectLocation(state.project().groups[0].key); state.selectEvent(eventKey(a.event.actor, a.event.eventId));
    expect(state.project().selectedEvent?.event.eventId).toBe('one');
    state.setFilters({ query: 'two' });
    expect(state.project().selectedEvent).toBeUndefined(); expect(state.project().groups[0].items).toHaveLength(1); expect(state.project().selectedGroup?.items).toHaveLength(1);
  });
  it('filters by schedule rather than publication and includes overnight events', () => {
    const state = stateWith([item('one')]);
    state.setFilters({ mode: 'range', from: '2026-10-26', through: '2026-10-26' }); expect(state.project().items).toHaveLength(1);
    state.setFilters({ mode: 'range', from: '2026-10-28', through: '2026-10-28' }); expect(state.project().items).toHaveLength(0);
  });
  it('excludes cancelled events by default and supports an explicit include toggle', () => {
    const state = stateWith([item('one'), item('cancelled', actorA, { latitude: 40.7, longitude: -74 }, 'cancelled')]);
    expect(state.project().items).toHaveLength(1); state.setFilters({ includeCancelled: true }); expect(state.project().groups[0].items).toHaveLength(2);
  });
  it('does not apply invalid ranges and can explicitly browse past dates', () => {
    const state = stateWith([item('one')]);
    expect(() => state.setFilters({ mode: 'range', from: '2026-10-28', through: '2026-10-26' })).toThrow(); expect(state.filters.mode).toBe('upcoming');
    state.setFilters({ mode: 'range', from: '2020-01-01', through: '2020-01-02' }); expect(state.project().items).toHaveLength(0);
  });
});
