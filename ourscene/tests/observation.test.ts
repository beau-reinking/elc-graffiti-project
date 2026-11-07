import { afterEach, describe, expect, it, vi } from 'vitest';
import { GraffitiErrorCursorExpired, type JSONSchema, type GraffitiObjectStream } from '@graffiti-garden/api';
import { GraffitiObservation } from '../src/infrastructure/observation';
import { profileSchema, directoryChannel } from '../src/infrastructure/schemas';
import { VenueProfile } from '../src/domain/models';
import type { Observation, SourceUpdate } from '../src/application/ports';
import { FakeEnvironment, MemoryGraffiti, actorA, profile } from './fixtures';

const active: Observation[] = [];
afterEach(() => { active.splice(0).forEach(source => source.stop()); });
function setup() {
  const client = new MemoryGraffiti(), environment = new FakeEnvironment(), updates: SourceUpdate<VenueProfile>[] = [];
  const observation = new GraffitiObservation(client, [directoryChannel], profileSchema, object => new VenueProfile(object, object.value), 'directory', update => { updates.push(update); }, environment);
  active.push(observation);
  const add = (published = 1) => client.post<{}>({ channels: [directoryChannel], value: profile(actorA, published).value }, { actor: actorA });
  return { client, environment, updates, observation, add };
}

describe('Graffiti reader contract', () => {
  it('captures the initial cursor, continues and applies confirmed tombstones', async () => {
    const { add, observation, updates, client } = setup();
    const object = await add(); await observation.refresh();
    expect(updates.at(-1)?.records.length).toBe(1);
    await client.delete(object.url, { actor: actorA }); await observation.refresh();
    expect(updates.at(-1)?.records.length).toBe(0); expect(client.continueCalls).toBeGreaterThan(0);
  });
  it('retains cached data when a source fails and recovers on refresh', async () => {
    const { add, observation, updates, client } = setup(); await add(); await observation.refresh();
    client.failNext = new Error('Network unavailable'); await observation.refresh();
    expect(updates.at(-1)?.records.length).toBe(1); expect(updates.at(-1)?.health.stale).toBe(true);
    await observation.refresh(); expect(updates.at(-1)?.health.stale).toBe(false);
  });
  it('recovers an expired cursor and replaces membership only after a successful fresh snapshot', async () => {
    const { add, observation, updates, client } = setup(); const object = await add(); await observation.refresh();
    client.database.records.delete(object.url); // simulate an expired cursor whose history was compacted
    client.failNext = new GraffitiErrorCursorExpired('Expired'); await observation.refresh();
    expect(client.discoverCalls).toBe(2); expect(updates.at(-1)?.records.length).toBe(0); expect(updates.at(-1)?.health.stale).toBe(false);
  });
  it('never interprets absence in a partial fresh snapshot as deletion', async () => {
    const { add, observation, updates, client } = setup(); const object = await add(); await observation.refresh();
    client.failNext = new Error('Failure'); await observation.refresh(); // force rediscovery
    client.database.records.delete(object.url); client.partialNext = true; await observation.refresh();
    expect(updates.at(-1)?.records.map(v => v.url)).toContain(object.url); expect(updates.at(-1)?.health.stale).toBe(true);
    await observation.refresh(); expect(updates.at(-1)?.records.length).toBe(0);
  });
  it('retains a confirmed deletion even if cursor recovery produces a partial snapshot', async () => {
    const { add, observation, updates, client } = setup(); const object = await add(); await observation.refresh();
    client.database.records.delete(object.url); client.partialNext = true;
    client.continueDiscover = async function* <Schema extends JSONSchema>(): GraffitiObjectStream<Schema> {
      yield { tombstone: true, object: { url: object.url, value: {}, channels: object.channels, actor: object.actor } };
      throw new GraffitiErrorCursorExpired('Expired after deletion');
    };
    await observation.refresh();
    expect(updates.at(-1)?.health.stale).toBe(true); expect(updates.at(-1)?.records).toEqual([]);
  });
  it('skips malformed, unsupported and restricted records with diagnostics', async () => {
    const { observation, client, updates } = setup();
    await client.post<{}>({ channels: [directoryChannel], value: { ...profile().value, schemaVersion: 9 } }, { actor: actorA });
    await client.post<{}>({ channels: [directoryChannel], value: { ...profile().value, name: '' } }, { actor: actorA });
    await client.post<{}>({ channels: [directoryChannel], value: profile().value, allowed: [actorA] }, { actor: actorA });
    await observation.refresh(); expect(updates.at(-1)?.records).toEqual([]); expect(updates.at(-1)?.health.warnings.length).toBe(2);
  });
  it('coalesces simultaneous refresh calls and suppresses late results after stop', async () => {
    const { client, observation, updates, environment } = setup();
    let release!: () => void; client.holdNext = new Promise(resolve => { release = resolve; });
    const first = observation.refresh(), second = observation.refresh(); expect(first).toBe(second);
    observation.stop(); release(); await first;
    expect(updates).toEqual([]); expect(environment.timers.size).toBe(0); expect(environment.visibility.size).toBe(0);
  });
  it('pauses timers while hidden and resumes synchronization when visible', async () => {
    const { environment, observation } = setup(); await observation.refresh();
    expect(environment.timers.size).toBe(1); environment.changeVisibility(false); expect(environment.timers.size).toBe(0);
    environment.changeVisibility(true); expect(environment.timers.size).toBe(1); await observation.refresh();
  });
  it('polls on a 30 second interval', () => {
    const environment = new FakeEnvironment(), every = vi.spyOn(environment, 'every');
    const observation = new GraffitiObservation(new MemoryGraffiti(), [], {}, object => object, 'test', () => {}, environment);
    active.push(observation); expect(every).toHaveBeenCalledWith(expect.any(Function), 30_000);
  });
});
