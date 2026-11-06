import type { VenueProfile } from '../domain/models';
import { resolveEvents, type EventRecord } from '../domain/events';
import type { EligibleAnnouncement, FeedSnapshot, SourceHealth } from './ports';

export class FeedStore {
  private venues = new Map<string, VenueProfile>();
  private posts = new Map<string, readonly EligibleAnnouncement[]>();
  private eventSources = new Map<string, readonly EventRecord[]>();
  private health = new Map<string, SourceHealth>();
  private listeners = new Set<(snapshot: FeedSnapshot) => void>();
  replaceVenues(records: readonly VenueProfile[], health: SourceHealth) {
    const current = new Map<string, VenueProfile>();
    for (const venue of records) {
      const previous = current.get(venue.actor);
      if (!previous || venue.published > previous.published || (venue.published === previous.published && venue.url > previous.url)) current.set(venue.actor, venue);
    }
    this.venues = current;
    for (const actor of this.posts.keys()) if (!current.has(actor)) this.posts.delete(actor);
    for (const actor of this.eventSources.keys()) if (!current.has(actor)) this.eventSources.delete(actor);
    this.health.set(health.source, health);
    this.emit();
  }
  replaceAnnouncements(actor: string, records: readonly EligibleAnnouncement[], health: SourceHealth) {
    if (!this.venues.has(actor)) return;
    this.posts.set(actor, records);
    this.health.set(health.source, health);
    this.emit();
  }
  removeSource(source: string) { this.health.delete(source); this.emit(); }
  replaceEvents(actor: string, records: readonly EventRecord[], health: SourceHealth) {
    if (!this.venues.has(actor)) return;
    this.eventSources.set(actor, records); this.health.set(health.source, health); this.emit();
  }
  snapshot(): FeedSnapshot {
    const items = new Map<string, FeedSnapshot['items'][number]>();
    for (const [actor, records] of this.posts) {
      const venue = this.venues.get(actor);
      if (venue) for (const entry of records) items.set(entry.announcement.url, Object.freeze({ ...entry, venue }));
    }
    return Object.freeze({
      venues: Object.freeze([...this.venues.values()].sort((a, b) => a.name.localeCompare(b.name) || a.actor.localeCompare(b.actor))),
      items: Object.freeze([...items.values()].sort((a, b) => b.announcement.published - a.announcement.published || (a.announcement.url < b.announcement.url ? -1 : a.announcement.url > b.announcement.url ? 1 : 0))),
      events: Object.freeze([...this.eventSources].flatMap(([actor, records]) => {
        const venue = this.venues.get(actor);
        return venue ? resolveEvents(records, actor).map(event => Object.freeze({ event, venue })) : [];
      }).sort((a, b) => a.event.value.startsAt - b.event.value.startsAt || (a.event.url < b.event.url ? -1 : a.event.url > b.event.url ? 1 : 0))),
      sources: Object.freeze([...this.health.values()].map(h => Object.freeze({ ...h, warnings: Object.freeze([...h.warnings]) }))),
    });
  }
  subscribe(listener: (snapshot: FeedSnapshot) => void) {
    this.listeners.add(listener); listener(this.snapshot());
    return () => { this.listeners.delete(listener); };
  }
  private emit() { const snapshot = this.snapshot(); for (const listener of this.listeners) listener(snapshot); }
}
