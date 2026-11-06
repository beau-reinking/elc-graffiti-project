import { describe, expect, it, vi } from 'vitest';
import { GraffitiLocalIdentity } from '@graffiti-garden/implementation-local/identity';
import { seedSandbox } from '../src/infrastructure/sandbox-seeder';
import { GraffitiEventRepository } from '../src/infrastructure/event-repository';
import { GraffitiAnnouncementRepository, GraffitiVenueRepository } from '../src/infrastructure/repositories';
import { FeedService } from '../src/application/feed-service';
import { FeedStore } from '../src/application/feed-store';
import { VenueOwnedPolicy } from '../src/application/policies';
import { EventRemoval, MusicEvent } from '../src/domain/events';
import { FakeEnvironment, MemoryGraffiti } from './fixtures';

describe('Four-venue sandbox and event reader contract', () => {
  it('checks all actor IDs against Graffiti and seeds four venues without duplication', async () => {
    vi.stubEnv('VITE_GRAFFITI_MODE', 'local'); vi.resetModules();
    try {
      const { sandboxVenues } = await import('../src/venue-catalog');
      expect(sandboxVenues).toHaveLength(4); const local = new GraffitiLocalIdentity();
      for (const venue of sandboxVenues) expect(venue.venueActor).toBe(await local.handleToActor(venue.testHandle!));
      const client = new MemoryGraffiti(), now = Date.parse('2026-10-26T12:00:00Z');
      expect(await seedSandbox(client, sandboxVenues, now)).toBe(16); expect(await seedSandbox(client, sandboxVenues, now)).toBe(0);
      const env = new FakeEnvironment(), store = new FeedStore(), events = new GraffitiEventRepository(client, env);
      const feed = new FeedService(new GraffitiVenueRepository(client, env), new GraffitiAnnouncementRepository(client, env), new VenueOwnedPolicy(), store, events);
      try {
        await feed.start(); expect(store.snapshot().venues).toHaveLength(4); expect(store.snapshot().events).toHaveLength(12);
        expect(store.snapshot().events.filter(item => item.event.value.status === 'cancelled')).toHaveLength(1);
        expect(store.snapshot().events.some(item => item.event.value.tickets?.kind === 'free')).toBe(true);
        expect(store.snapshot().events.some(item => item.event.value.tickets?.availability === 'sold-out')).toBe(true);
        const selected = store.snapshot().events[0].event;
        await events.removeEvent(new EventRemoval({ actor: selected.actor, url: 'draft:removal' }, { type: 'EventRemoval', schemaVersion: 1, venueActor: selected.actor, eventId: selected.eventId, revision: 2, published: now + 1 }).value, { actor: selected.actor });
        await feed.refresh(); expect(store.snapshot().events).toHaveLength(11);
        expect(await seedSandbox(client, sandboxVenues, now)).toBe(0);
        client.failNext = new Error('Temporary network failure'); await feed.refresh(); expect(store.snapshot().events).toHaveLength(11);
      } finally { feed.stop(); }
      expect(env.timers.size).toBe(0); expect(env.visibility.size).toBe(0);
    } finally { vi.unstubAllEnvs(); vi.resetModules(); }
  });
  it('refreshes expired fixture schedules with revisions instead of new event IDs', async () => {
    vi.stubEnv('VITE_GRAFFITI_MODE', 'local'); vi.resetModules();
    try {
      const { sandboxVenues } = await import('../src/venue-catalog'); const client = new MemoryGraffiti();
      const first = Date.parse('2026-10-26T12:00:00Z'); await seedSandbox(client, sandboxVenues, first);
      expect(await seedSandbox(client, sandboxVenues, first + 30 * 86400_000)).toBe(12);
      const env = new FakeEnvironment(), events = new GraffitiEventRepository(client, env), records: (MusicEvent | EventRemoval)[] = [];
      const observation = events.observeEvents([sandboxVenues[0].venueActor], update => { records.splice(0, records.length, ...update.records); });
      try { await observation.refresh(); expect(records.filter(record => record instanceof MusicEvent)).toHaveLength(6); }
      finally { observation.stop(); }
    } finally { vi.unstubAllEnvs(); vi.resetModules(); }
  });
});
