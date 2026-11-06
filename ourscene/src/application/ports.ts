import type { Announcement, AnnouncementValue, VenueProfile, VenueProfileValue, VenueEndorsement } from '../domain/models';
import type { EventRecord, EventValue, EventRemovalValue, MusicEvent } from '../domain/events';

// The opaque object is passed through unchanged; only the identity adapter knows
// its implementation-specific authentication fields. Never persist it ourselves.
export interface Session { readonly actor: string }
export interface IdentityState { readonly initialized: boolean; readonly session?: Session; readonly sessions?: readonly Session[]; readonly error?: string }
export interface IdentityPort {
  currentSession(): Session | undefined;
  login(): Promise<void>;
  logout(): Promise<void>;
  subscribe(listener: (state: IdentityState) => void): () => void;
}
export interface VenueProfileWriter { publishProfile(value: Readonly<VenueProfileValue>, session: Session): Promise<VenueProfile> }
export interface AnnouncementWriter {
  publishAnnouncement(value: Readonly<AnnouncementValue>, session: Session): Promise<Announcement>;
  remove(url: string, session: Session): Promise<void>;
}
export interface SourceHealth {
  readonly source: string;
  readonly stale: boolean;
  readonly loading: boolean;
  readonly warnings: readonly string[];
  readonly lastSuccess?: number;
}
/** A reconciled domain snapshot plus source health. No SDK cursors escape here. */
export interface SourceUpdate<T> { readonly records: readonly T[]; readonly health: SourceHealth }
export type SourceListener<T> = (update: SourceUpdate<T>) => void | Promise<void>;
/** Observers deliver asynchronously after observe* returns; refresh resolves
 * after delivery, overlapping refreshes coalesce, and stop suppresses delivery. */
export interface Observation { refresh(): Promise<void>; stop(): void }
export interface VenueDirectoryReader { observeVenues(listener: SourceListener<VenueProfile>): Observation }
export interface AnnouncementReader { observeAnnouncements(venueActors: readonly string[], listener: SourceListener<Announcement>): Observation }
export interface EventReader { observeEvents(venueActors: readonly string[], listener: SourceListener<EventRecord>): Observation }
export interface EventWriter {
  publishEvent(value: Readonly<EventValue>, session: Session): Promise<MusicEvent>;
  removeEvent(value: Readonly<EventRemovalValue>, session: Session): Promise<readonly string[]>;
}
export interface EligibilityDecision { readonly accepted: boolean; readonly reason: string; readonly endorsement?: VenueEndorsement }
export interface EligibilityPolicy { evaluate(announcement: Announcement, venue: VenueProfile): Promise<EligibilityDecision> }
export interface EndorsementReader { findEndorsements(targetUrl: string, venueActor: string): Promise<readonly VenueEndorsement[]> }
export interface VenueConfig {
  readonly id: string;
  readonly venueActor: string;
  readonly brandName: string;
  readonly tagline: string;
  readonly description: string;
  readonly theme: { readonly accent: string; readonly background: string };
  readonly testHandle?: string;
  readonly defaultAddress?: string;
  readonly defaultLocation?: { readonly latitude: number; readonly longitude: number };
  readonly defaultTimeZone?: string;
}
export interface EligibleAnnouncement { readonly announcement: Announcement; readonly endorsement?: VenueEndorsement }
export interface FeedItem extends EligibleAnnouncement { readonly venue: VenueProfile }
export interface EventFeedItem { readonly event: MusicEvent; readonly venue: VenueProfile }
export interface FeedSnapshot { readonly venues: readonly VenueProfile[]; readonly items: readonly FeedItem[]; readonly events: readonly EventFeedItem[]; readonly sources: readonly SourceHealth[] }
export interface FeedView { render(snapshot: FeedSnapshot): void; dispose(): void }
