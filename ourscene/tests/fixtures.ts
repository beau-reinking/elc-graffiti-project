import { Graffiti, GraffitiErrorForbidden, GraffitiErrorNotFound, type JSONSchema, type GraffitiObject, type GraffitiObjectBase, type GraffitiObjectStream } from '@graffiti-garden/api';
import { Announcement, VenueProfile } from '../src/domain/models';
import type { IdentityPort, Session, VenueConfig } from '../src/application/ports';
import type { PollEnvironment } from '../src/infrastructure/observation';

export const actorA = 'did:test:blue', actorB = 'did:test:red';
export const venueConfig = (actor = actorA): VenueConfig => ({ id: actor, venueActor: actor, brandName: actor, tagline: '', description: '', theme: { accent: '#fff', background: '#000' } });
export const profile = (actor = actorA, published = 1, name = 'Blue Hour', url = `profile:${actor}:${published}`) => new VenueProfile({ actor, url }, { type: 'VenueProfile', schemaVersion: 1, name, published });
export const announcement = (actor = actorA, venueActor = actorA, published = 1, url = `post:${actor}:${published}`) => new Announcement({ actor, url }, { type: 'Announcement', schemaVersion: 1, venueActor, body: 'Hello from the venue', published });
export function identity(actor = actorA): IdentityPort {
  let session: Session | undefined = { actor };
  return { currentSession: () => session, login: async () => {}, logout: async () => { session = undefined; }, subscribe: listener => { listener({ initialized: true, session }); return () => {}; } };
}
export class FakeEnvironment implements PollEnvironment {
  isVisible = true;
  now = () => 1000;
  timers = new Set<() => void>();
  visibility = new Set<() => void>();
  visible = () => this.isVisible;
  every(callback: () => void) { this.timers.add(callback); return () => { this.timers.delete(callback); }; }
  onVisibilityChange(callback: () => void) { this.visibility.add(callback); return () => { this.visibility.delete(callback); }; }
  changeVisibility(visible: boolean) { this.isVisible = visible; for (const callback of this.visibility) callback(); }
}
type Stored = GraffitiObjectBase;
type Change = { object: Stored; deleted: boolean };
export class MemoryDatabase {
  records = new Map<string, Stored>();
  log: Change[] = [];
  sequence = 0;
}
/** Test transport only. Production always uses the actual Graffiti packages. */
export class MemoryGraffiti extends Graffiti {
  sessionEvents = new EventTarget();
  discoverCalls = 0;
  continueCalls = 0;
  failNext?: Error;
  partialNext = false;
  holdNext?: Promise<void>;
  constructor(readonly database = new MemoryDatabase()) { super(); }
  post: Graffiti['post'] = async (partial, session) => {
    const object = { ...partial, actor: session.actor, url: `graffiti:test:${++this.database.sequence}` } as Stored;
    this.database.records.set(object.url, object); this.database.log.push({ object, deleted: false });
    return object as never;
  };
  get: Graffiti['get'] = async url => {
    const object = this.database.records.get(typeof url === 'string' ? url : url.url);
    if (!object) throw new GraffitiErrorNotFound('Not found');
    return object as never;
  };
  delete: Graffiti['delete'] = async (url, session) => {
    const object = await this.get(url, {});
    if (object.actor !== session.actor) throw new GraffitiErrorForbidden('Wrong actor');
    this.database.records.delete(object.url); this.database.log.push({ object, deleted: true }); return object;
  };
  private async prepare() {
    const held = this.holdNext; this.holdNext = undefined; if (held) await held;
    const error = this.failNext; this.failNext = undefined; if (error) throw error;
  }
  async *discover<Schema extends JSONSchema>(channels: string[], _schema: Schema): GraffitiObjectStream<Schema> {
    this.discoverCalls++; await this.prepare();
    for (const object of this.database.records.values()) if (object.channels.some(channel => channels.includes(channel))) yield { object: object as GraffitiObject<Schema> };
    if (this.partialNext) { this.partialNext = false; yield { error: new Error('One source failed'), origin: 'test-source' }; }
    return { cursor: JSON.stringify({ channels, index: this.database.log.length }) };
  }
  async *continueDiscover<Schema extends JSONSchema>(cursor: string): GraffitiObjectStream<Schema> {
    this.continueCalls++; await this.prepare();
    const { channels, index } = JSON.parse(cursor) as { channels: string[]; index: number };
    for (const { object, deleted } of this.database.log.slice(index)) if (object.channels.some(channel => channels.includes(channel))) {
      if (deleted) yield { tombstone: true, object: { url: object.url, value: {}, channels: object.channels, actor: object.actor } }; else yield { object: object as GraffitiObject<Schema> };
    }
    if (this.partialNext) { this.partialNext = false; yield { error: new Error('One source failed'), origin: 'test-source' }; }
    return { cursor: JSON.stringify({ channels, index: this.database.log.length }) };
  }
  login: Graffiti['login'] = async () => {};
  logout: Graffiti['logout'] = async () => {};
  actorToHandle: Graffiti['actorToHandle'] = async actor => actor;
  handleToActor: Graffiti['handleToActor'] = async handle => handle;
  postMedia: Graffiti['postMedia'] = async () => { throw new Error('Not used in this test transport'); };
  deleteMedia: Graffiti['deleteMedia'] = async () => { throw new Error('Not used in this test transport'); };
  getMedia: Graffiti['getMedia'] = async () => { throw new Error('Not used in this test transport'); };
}
