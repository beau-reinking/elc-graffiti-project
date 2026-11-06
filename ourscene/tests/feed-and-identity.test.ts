import { describe, expect, it } from 'vitest';
import { FeedStore } from '../src/application/feed-store';
import { FeedService } from '../src/application/feed-service';
import { VenueOwnedPolicy } from '../src/application/policies';
import { VenuePublishingService } from '../src/application/publishing';
import { GraffitiIdentityAdapter } from '../src/infrastructure/identity';
import { GraffitiAnnouncementRepository, GraffitiVenueRepository } from '../src/infrastructure/repositories';
import { AggregatorController } from '../src/presentation/controllers';
import { actorA, actorB, announcement, FakeEnvironment, identity, MemoryDatabase, MemoryGraffiti, profile, venueConfig } from './fixtures';

describe('Multi-app aggregation', () => {
  function setup() {
    const database = new MemoryDatabase(), client = new MemoryGraffiti(database), environment = new FakeEnvironment();
    const profiles = new GraffitiVenueRepository(client, environment), posts = new GraffitiAnnouncementRepository(client, environment), store = new FeedStore();
    const feed = new FeedService(profiles, posts, new VenueOwnedPolicy(), store);
    const venue = (actor: string) => {
      const separateClient = new MemoryGraffiti(database);
      return new VenuePublishingService(venueConfig(actor), identity(actor), new GraffitiVenueRepository(separateClient, environment), new GraffitiAnnouncementRepository(separateClient, environment));
    };
    return { client, environment, store, feed, venue };
  }
  it('discovers a second independent venue without changing aggregator configuration', async () => {
    const { feed, store, venue, environment } = setup();
    try {
      await feed.start(); await venue(actorA).registerVenue({ name: 'Blue Hour' }); await venue(actorA).publish({ body: 'Blue announcement' }); await feed.refresh();
      expect(store.snapshot().venues.length).toBe(1); expect(store.snapshot().items.length).toBe(1);
      await venue(actorB).registerVenue({ name: 'Red Room' }); await venue(actorB).publish({ body: 'Red announcement' }); await feed.refresh();
      expect(store.snapshot().venues.length).toBe(2); expect(store.snapshot().items.length).toBe(2);
    } finally { feed.stop(); }
    expect(environment.timers.size).toBe(0); expect(environment.visibility.size).toBe(0);
  });
  it('filters forged authors and propagates deletion', async () => {
    const { feed, store, venue, client } = setup();
    try {
      await venue(actorA).registerVenue({ name: 'Blue Hour' }); const post = await venue(actorA).publish({ body: 'Legitimate' });
      await client.post<{}>({ channels: [`music-venues:v1:announcements:${encodeURIComponent(actorA)}`], value: announcement(actorB, actorA).value }, { actor: actorB });
      await feed.start(); expect(store.snapshot().items.map(i => i.announcement.url)).toEqual([post.url]);
      await venue(actorA).remove(post.url); await feed.refresh(); expect(store.snapshot().items).toEqual([]);
    } finally { feed.stop(); }
  });
  it('removes subscriptions and feed entries when the last venue profile disappears', async () => {
    const { feed, store, venue, client, environment } = setup();
    try {
      const registered = await venue(actorA).registerVenue({ name: 'Blue Hour' }); await venue(actorA).publish({ body: 'Hello' });
      await feed.start(); expect(environment.timers.size).toBe(2);
      await client.delete(registered.url, { actor: actorA }); await feed.refresh();
      expect(store.snapshot().venues).toEqual([]); expect(store.snapshot().items).toEqual([]); expect(environment.timers.size).toBe(1);
      expect(store.snapshot().sources.map(s => s.source)).toEqual(['directory']);
    } finally { feed.stop(); }
  });
  it('can replace the list renderer with another FeedView without changing retrieval', async () => {
    const { feed, store, venue } = setup(); const snapshots: number[] = [];
    const controller = new AggregatorController(feed, store, { render: snapshot => { snapshots.push(snapshot.items.length); }, dispose() {} });
    try { await venue(actorA).registerVenue({ name: 'Blue Hour' }); await venue(actorA).publish({ body: 'Hello' }); await controller.start(); expect(snapshots.at(-1)).toBe(1); }
    finally { controller.dispose(); }
  });
  it('suppresses an asynchronous eligibility result that finishes after stop', async () => {
    const client = new MemoryGraffiti(), environment = new FakeEnvironment();
    const profiles = new GraffitiVenueRepository(client, environment), posts = new GraffitiAnnouncementRepository(client, environment);
    await profiles.publishProfile(profile().value, { actor: actorA }); await posts.publishAnnouncement(announcement().value, { actor: actorA });
    let release!: () => void, entered!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
    const store = new FeedStore();
    const feed = new FeedService(profiles, posts, { evaluate: async () => { entered(); await held; return { accepted: true, reason: 'Accepted after delay' }; } }, store);
    const starting = feed.start(); await started; feed.stop(); release(); await starting;
    expect(store.snapshot().items).toEqual([]); expect(environment.timers.size).toBe(0);
  });
});

describe('Feed projections', () => {
  const health = { source: 'directory', stale: false, loading: false, warnings: [] };
  it('chooses the latest profile, with URL tie breaking and deterministic post ordering', () => {
    const store = new FeedStore();
    store.replaceVenues([profile(actorA, 1), profile(actorA, 2, 'Earlier tie', 'profile:a'), profile(actorA, 2, 'Chosen', 'profile:z')], health);
    store.replaceAnnouncements(actorA, [{ announcement: announcement(actorA, actorA, 10, 'post:z') }, { announcement: announcement(actorA, actorA, 10, 'post:a') }, { announcement: announcement(actorA, actorA, 10, 'post:a') }], { ...health, source: 'posts' });
    expect(store.snapshot().venues[0].name).toBe('Chosen'); expect(store.snapshot().items.map(i => i.announcement.url)).toEqual(['post:a', 'post:z']);
    expect(Object.isFrozen(store.snapshot())).toBe(true); expect(Object.isFrozen(store.snapshot().items)).toBe(true);
  });
});

describe('Identity event adapter', () => {
  it('receives restored sessions and prefers the configured venue among multiple actors', () => {
    const client = new MemoryGraffiti(), adapter = new GraffitiIdentityAdapter(client, actorA);
    const first = { actor: actorA, implementationToken: 'opaque-test-value' };
    client.sessionEvents.dispatchEvent(new CustomEvent('login', { detail: { session: first } }));
    client.sessionEvents.dispatchEvent(new CustomEvent('login', { detail: { session: { actor: actorB } } }));
    client.sessionEvents.dispatchEvent(new CustomEvent('initialized', { detail: {} }));
    let initialized = false; adapter.subscribe(state => { initialized = state.initialized; });
    expect(initialized).toBe(true); expect(adapter.currentSession()).toBe(first);
    client.sessionEvents.dispatchEvent(new CustomEvent('logout', { detail: { actor: actorA } })); expect(adapter.currentSession()?.actor).toBe(actorB);
    adapter.dispose();
  });
  it('removes event handlers during disposal', () => {
    const client = new MemoryGraffiti(), adapter = new GraffitiIdentityAdapter(client);
    adapter.dispose(); client.sessionEvents.dispatchEvent(new CustomEvent('login', { detail: { session: { actor: actorA } } }));
    expect(adapter.currentSession()).toBeUndefined();
  });
});
