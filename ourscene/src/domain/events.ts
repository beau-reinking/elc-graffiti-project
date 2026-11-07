import { httpsLink, object, text, timestamp, type Metadata } from './models';
import { genres, type Genre } from './genres';
import { timeZone } from './schedule';

export interface TicketInput { kind: 'free' | 'paid' | 'door'; availability: 'available' | 'sold-out'; url?: string; price?: number; currency?: string; demo?: boolean }
export interface EventInput {
  title: string; description: string; startsAt: number; endsAt: number; timeZone: string;
  doorsAt?: number; performers?: readonly string[]; imageUrl?: string; imageAlt?: string;
  genres?: readonly Genre[]; demoArtworkKey?: string; tickets?: TicketInput; ageRestriction?: string; links?: readonly string[];
}
export interface EventValue extends EventInput {
  type: 'MusicEvent'; schemaVersion: 1; eventId: string; venueActor: string; revision: number; published: number; status: 'scheduled' | 'cancelled';
}
export interface EventRemovalValue { type: 'EventRemoval'; schemaVersion: 1; eventId: string; venueActor: string; revision: number; published: number }
function base(value: Record<string, unknown>) {
  if (value.schemaVersion !== 1) throw new Error('Unsupported event schema version.');
  if (!Number.isSafeInteger(value.revision) || (value.revision as number) < 1) throw new Error('Event revision must be a positive integer.');
  return { eventId: text(value.eventId, 'Event ID', 200), venueActor: text(value.venueActor, 'Venue actor', 2048), revision: value.revision as number, published: timestamp(value.published) };
}
function ticket(input: unknown): Readonly<TicketInput> {
  const v = object(input);
  if (!['free', 'paid', 'door'].includes(String(v.kind)) || !['available', 'sold-out'].includes(String(v.availability))) throw new Error('Choose valid ticket and availability options.');
  if (v.price !== undefined && (typeof v.price !== 'number' || !Number.isFinite(v.price) || v.price < 0)) throw new Error('Ticket price must be a nonnegative amount.');
  if (v.kind === 'free' && v.price !== undefined && v.price !== 0) throw new Error('A free event cannot have a ticket price.');
  if (v.price !== undefined && v.kind !== 'free' && (typeof v.currency !== 'string' || !/^[A-Z]{3}$/.test(v.currency))) throw new Error('Provide a three-letter currency code with the price.');
  if (v.demo !== undefined && typeof v.demo !== 'boolean') throw new Error('Invalid demo ticket flag.');
  return Object.freeze({ kind: v.kind as TicketInput['kind'], availability: v.availability as TicketInput['availability'],
    ...(v.url === undefined ? {} : { url: httpsLink(v.url) }), ...(v.price === undefined ? {} : { price: v.price as number }),
    ...(v.currency === undefined ? {} : { currency: text(v.currency, 'Currency', 3).toUpperCase() }), ...(v.demo === undefined ? {} : { demo: v.demo as boolean }),
  });
}
function strings(value: unknown, label: string, limit: number, parse: (value: unknown) => string): readonly string[] {
  if (!Array.isArray(value) || value.length > limit) throw new Error(`Include at most ${limit} ${label}.`);
  return Object.freeze(value.map(parse));
}
export class MusicEvent implements Metadata {
  readonly url: string; readonly actor: string; readonly value: Readonly<EventValue>;
  constructor(meta: Metadata, input: unknown) {
    this.url = text(meta.url, 'Object URL', 4096); this.actor = text(meta.actor, 'Actor', 2048);
    const v = object(input), common = base(v);
    if (v.type !== 'MusicEvent') throw new Error('Expected a MusicEvent record.');
    if (v.status !== 'scheduled' && v.status !== 'cancelled') throw new Error('Invalid event status.');
    const startsAt = timestamp(v.startsAt), endsAt = timestamp(v.endsAt);
    if (endsAt <= startsAt) throw new Error('The event end must follow its start.');
    const doorsAt = v.doorsAt === undefined ? undefined : timestamp(v.doorsAt);
    if (doorsAt !== undefined && doorsAt > startsAt) throw new Error('Doors time must be on or before the event start.');
    this.value = Object.freeze({ ...common, type: 'MusicEvent', schemaVersion: 1, title: text(v.title, 'Title', 140), description: text(v.description, 'Description', 8000),
      startsAt, endsAt, timeZone: timeZone(v.timeZone), status: v.status,
      ...(doorsAt === undefined ? {} : { doorsAt }), ...(v.performers === undefined ? {} : { performers: strings(v.performers, 'performers', 30, name => text(name, 'Performer', 120)) }),
      ...(v.imageUrl === undefined ? {} : { imageUrl: httpsLink(v.imageUrl) }), ...(v.imageAlt === undefined ? {} : { imageAlt: text(v.imageAlt, 'Image description', 300) }),
      ...(v.genres === undefined ? {} : { genres: genres(v.genres) }),
      ...(v.demoArtworkKey === undefined ? {} : { demoArtworkKey: text(v.demoArtworkKey, 'Demo artwork key', 80) }),
      ...(v.tickets === undefined ? {} : { tickets: ticket(v.tickets) }), ...(v.ageRestriction === undefined ? {} : { ageRestriction: text(v.ageRestriction, 'Age restriction', 100) }),
      ...(v.links === undefined ? {} : { links: strings(v.links, 'links', 5, httpsLink) }),
    });
    Object.freeze(this);
  }
  get eventId() { return this.value.eventId; }
  get venueActor() { return this.value.venueActor; }
  get published() { return this.value.published; }
  static draft(input: EventInput, venueActor: string, eventId: string, revision: number, published: number, status: EventValue['status'] = 'scheduled'): Readonly<EventValue> {
    return new MusicEvent({ actor: venueActor, url: 'draft:event' }, { ...input, type: 'MusicEvent', schemaVersion: 1, venueActor, eventId, revision, published, status }).value;
  }
}
export class EventRemoval implements Metadata {
  readonly url: string; readonly actor: string; readonly value: Readonly<EventRemovalValue>;
  constructor(meta: Metadata, input: unknown) {
    this.url = text(meta.url, 'Object URL', 4096); this.actor = text(meta.actor, 'Actor', 2048);
    const v = object(input); if (v.type !== 'EventRemoval') throw new Error('Expected an EventRemoval record.');
    this.value = Object.freeze({ ...base(v), type: 'EventRemoval', schemaVersion: 1 }); Object.freeze(this);
  }
  get eventId() { return this.value.eventId; }
  get venueActor() { return this.value.venueActor; }
}
export type EventRecord = MusicEvent | EventRemoval;
export function parseEvent(meta: Metadata, value: unknown): EventRecord { return object(value).type === 'EventRemoval' ? new EventRemoval(meta, value) : new MusicEvent(meta, value); }
export function eventKey(actor: string, eventId: string) { return JSON.stringify([actor, eventId]); }
export function resolveEvents(records: readonly EventRecord[], venueActor: string): readonly MusicEvent[] {
  const latest = new Map<string, MusicEvent>(), removed = new Set<string>();
  for (const record of records) {
    // Never trust the channel, ID or self-declared venue in place of actual author.
    if (record.actor !== venueActor || record.venueActor !== venueActor) continue;
    if (record instanceof EventRemoval) { removed.add(record.eventId); continue; }
    const previous = latest.get(record.eventId);
    if (!previous || record.value.revision > previous.value.revision || (record.value.revision === previous.value.revision && (record.published > previous.published || (record.published === previous.published && record.url > previous.url)))) latest.set(record.eventId, record);
  }
  return Object.freeze([...latest.values()].filter(event => !removed.has(event.eventId)).sort((a, b) => a.value.startsAt - b.value.startsAt || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0)));
}
