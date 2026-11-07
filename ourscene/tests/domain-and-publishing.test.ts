import { describe, expect, it } from 'vitest';
import { Announcement, GeoPoint, VenueEndorsement, VenueProfile } from '../src/domain/models';
import { VenueOwnedPolicy, VenueEndorsedPolicy } from '../src/application/policies';
import { VenuePublishingService } from '../src/application/publishing';
import { GraffitiAnnouncementRepository, GraffitiVenueRepository } from '../src/infrastructure/repositories';
import { actorA, actorB, announcement, profile, identity, venueConfig, FakeEnvironment, MemoryGraffiti } from './fixtures';

describe('Domain validation and attribution', () => {
  it('rejects invalid coordinates and retains optional location', () => {
    expect(() => new GeoPoint({ latitude: 91, longitude: 0 })).toThrow();
    expect(() => new GeoPoint({ latitude: 0, longitude: Infinity })).toThrow();
    const draft = VenueProfile.draft({ name: 'A venue', location: { latitude: 0, longitude: 0 } }, 10);
    expect(draft.location).toEqual({ latitude: 0, longitude: 0 });
    expect(Object.isFrozen(draft.location)).toBe(true);
  });
  it('accepts coordinate-free venues', () => { expect(profile().location).toBeUndefined(); });
  it('rejects empty text, unsupported versions, oversized bodies and unsafe links', () => {
    expect(() => Announcement.draft({ body: ' ' }, actorA, 1)).toThrow();
    expect(() => Announcement.draft({ body: 'x'.repeat(4001) }, actorA, 1)).toThrow();
    for (const link of ['javascript:alert(1)', 'http://example.com', 'https://user:secret@example.com']) expect(() => Announcement.draft({ body: 'hello', links: [link] }, actorA, 1)).toThrow();
    expect(() => new VenueProfile({ actor: actorA, url: 'profile:bad' }, { ...profile().value, schemaVersion: 2 })).toThrow('Unsupported');
  });
  it('provides immutable announcement data', () => {
    const post = Announcement.draft({ body: ' Hello ', links: ['https://example.com'] }, actorA, 1);
    expect(post.body).toBe('Hello'); expect(Object.isFrozen(post)).toBe(true); expect(Object.isFrozen(post.links)).toBe(true);
  });
  it('rejects impersonation even when a post claims a venue and uses its channel', async () => {
    expect((await new VenueOwnedPolicy().evaluate(announcement(actorB, actorA), profile())).accepted).toBe(false);
    expect((await new VenueOwnedPolicy().evaluate(announcement(actorA, actorB), profile())).accepted).toBe(false);
    expect((await new VenueOwnedPolicy().evaluate(announcement(), profile())).accepted).toBe(true);
  });
});

describe('Publishing boundary', () => {
  function setup(actor = actorA, configuredActor = actorA) {
    const client = new MemoryGraffiti(), environment = new FakeEnvironment();
    return { client, service: new VenuePublishingService(venueConfig(configuredActor), identity(actor), new GraffitiVenueRepository(client, environment), new GraffitiAnnouncementRepository(client, environment), () => 100) };
  }
  it('publishes validated public records with metadata supplied by Graffiti', async () => {
    const { client, service } = setup();
    const venue = await service.registerVenue({ name: 'Blue Hour' });
    const post = await service.publish({ body: 'Hello', links: ['https://example.com'] });
    expect(venue.actor).toBe(actorA); expect(post.actor).toBe(actorA); expect(post.published).toBe(100);
    expect(client.database.records.get(post.url)?.allowed).toBeUndefined();
    expect(client.database.records.get(post.url)?.channels).toEqual([`music-venues:v1:announcements:${encodeURIComponent(actorA)}`]);
    await service.remove(post.url); expect(client.database.records.has(post.url)).toBe(false);
  });
  it('rejects the wrong session and a missing configured identity before writing', async () => {
    const wrong = setup(actorB), missing = setup(actorA, '');
    await expect(wrong.service.registerVenue({ name: 'Impersonation' })).rejects.toThrow('configured identity');
    await expect(wrong.service.publish({ body: 'Impersonation' })).rejects.toThrow();
    await expect(missing.service.publish({ body: 'Hello' })).rejects.toThrow('Configure');
    expect(wrong.client.database.records.size + missing.client.database.records.size).toBe(0);
  });
  it('rejects an invalid announcement before invoking persistence', async () => {
    const { client, service } = setup(); await expect(service.publish({ body: '' })).rejects.toThrow(); expect(client.database.records.size).toBe(0);
  });
  it('cannot delete another actor’s announcement', async () => {
    const { client, service } = setup();
    const post = await client.post<{}>({ value: {}, channels: [] }, { actor: actorB });
    await expect(service.remove(post.url)).rejects.toThrow('Wrong actor');
    expect(client.database.records.has(post.url)).toBe(true);
  });
});

describe('Future opt-in endorsement policy', () => {
  const userPost = announcement('did:test:fan', actorA);
  const endorsement = (actor: string, targetUrl = userPost.url) => new VenueEndorsement({ actor, url: 'endorsement:one' }, { type: 'VenueEndorsement', schemaVersion: 1, venueActor: actorA, targetUrl, published: 2 });
  it('accepts a venue-authored endorsement and preserves the original author', async () => {
    const policy = new VenueEndorsedPolicy({ findEndorsements: async () => [endorsement(actorA)] });
    const decision = await policy.evaluate(userPost, profile());
    expect(decision.accepted).toBe(true); expect(decision.endorsement?.actor).toBe(actorA); expect(userPost.actor).toBe('did:test:fan');
  });
  it('rejects forged endorsements and endorsements of another target', async () => {
    for (const record of [endorsement(actorB), endorsement(actorA, 'another:post')]) {
      expect((await new VenueEndorsedPolicy({ findEndorsements: async () => [record] }).evaluate(userPost, profile())).accepted).toBe(false);
    }
  });
});
