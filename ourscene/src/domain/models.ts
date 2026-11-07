export interface Metadata { readonly url: string; readonly actor: string }
export interface GeoPointInput { latitude: number; longitude: number }
export interface VenueProfileInput { name: string; appUrl?: string; website?: string; address?: string; location?: GeoPointInput }
export interface AnnouncementInput { body: string; title?: string; links?: readonly string[] }
export interface VenueProfileValue extends VenueProfileInput { type: 'VenueProfile'; schemaVersion: 1; published: number }
export interface AnnouncementValue extends AnnouncementInput { type: 'Announcement'; schemaVersion: 1; venueActor: string; published: number }
export interface EndorsementValue { type: 'VenueEndorsement'; schemaVersion: 1; venueActor: string; targetUrl: string; published: number }

export function text(value: unknown, name: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(`${name} must contain 1–${max} characters.`);
  return value.trim();
}
export function httpsLink(value: unknown): string {
  const raw = text(value, 'Link', 2048);
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('Links must be valid HTTPS URLs.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Links must use HTTPS without embedded credentials.');
  return url.href;
}
export function timestamp(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 8640000000000000) throw new Error('Invalid publication timestamp.');
  return value;
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.');
  return value as Record<string, unknown>;
}
function version(value: Record<string, unknown>, type: string) {
  if (value.type !== type || value.schemaVersion !== 1) throw new Error(`Unsupported ${type} schema version.`);
}
function metadata(value: Metadata): Metadata {
  return { url: text(value.url, 'Object URL', 4096), actor: text(value.actor, 'Actor', 2048) };
}

export class GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
  constructor(input: GeoPointInput) {
    const { latitude, longitude } = input;
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('Coordinates must be valid latitude and longitude.');
    this.latitude = latitude; this.longitude = longitude;
    Object.freeze(this);
  }
}

export class VenueProfile implements Metadata {
  readonly url: string;
  readonly actor: string;
  readonly value: Readonly<VenueProfileValue>;
  constructor(meta: Metadata, input: unknown) {
    const m = metadata(meta), v = object(input);
    version(v, 'VenueProfile');
    this.url = m.url; this.actor = m.actor;
    const location = v.location === undefined ? undefined : new GeoPoint(object(v.location) as unknown as GeoPointInput);
    this.value = Object.freeze({ type: 'VenueProfile', schemaVersion: 1, name: text(v.name, 'Venue name', 120), published: timestamp(v.published),
      ...(v.appUrl === undefined ? {} : { appUrl: httpsLink(v.appUrl) }),
      ...(v.website === undefined ? {} : { website: httpsLink(v.website) }),
      ...(v.address === undefined ? {} : { address: text(v.address, 'Address', 300) }),
      ...(location ? { location } : {}),
    });
    Object.freeze(this);
  }
  get name() { return this.value.name; }
  get published() { return this.value.published; }
  get location() { return this.value.location; }
  static draft(input: VenueProfileInput, now: number): Readonly<VenueProfileValue> {
    return new VenueProfile({ actor: 'draft:actor', url: 'draft:profile' }, { ...input, type: 'VenueProfile', schemaVersion: 1, published: now }).value;
  }
}

export class Announcement implements Metadata {
  readonly url: string;
  readonly actor: string;
  readonly value: Readonly<AnnouncementValue>;
  constructor(meta: Metadata, input: unknown) {
    const m = metadata(meta), v = object(input);
    version(v, 'Announcement');
    this.url = m.url; this.actor = m.actor;
    if (v.links !== undefined && (!Array.isArray(v.links) || v.links.length > 5)) throw new Error('Include at most five links.');
    const links = v.links === undefined ? undefined : Object.freeze((v.links as unknown[]).map(httpsLink));
    this.value = Object.freeze({ type: 'Announcement', schemaVersion: 1, venueActor: text(v.venueActor, 'Venue actor', 2048), body: text(v.body, 'Announcement', 4000), published: timestamp(v.published),
      ...(v.title === undefined ? {} : { title: text(v.title, 'Title', 140) }), ...(links ? { links } : {}),
    });
    Object.freeze(this);
  }
  get venueActor() { return this.value.venueActor; }
  get published() { return this.value.published; }
  static draft(input: AnnouncementInput, venueActor: string, now: number): Readonly<AnnouncementValue> {
    return new Announcement({ actor: venueActor, url: 'draft:announcement' }, { ...input, type: 'Announcement', schemaVersion: 1, venueActor, published: now }).value;
  }
}

/** Future endorsement records preserve the target announcement's original author. */
export class VenueEndorsement implements Metadata {
  readonly url: string;
  readonly actor: string;
  readonly value: Readonly<EndorsementValue>;
  constructor(meta: Metadata, input: unknown) {
    const m = metadata(meta), v = object(input);
    version(v, 'VenueEndorsement');
    this.url = m.url; this.actor = m.actor;
    this.value = Object.freeze({ type: 'VenueEndorsement', schemaVersion: 1, venueActor: text(v.venueActor, 'Venue actor', 2048), targetUrl: text(v.targetUrl, 'Target URL', 4096), published: timestamp(v.published) });
    Object.freeze(this);
  }
}
