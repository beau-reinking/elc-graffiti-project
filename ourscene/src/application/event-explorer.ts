import type { EventFeedItem, FeedSnapshot } from './ports';
import { genres as validateGenres, type Genre } from '../domain/genres';
import { eventKey } from '../domain/events';
import { dateRange, overlaps, type DateRange } from '../domain/schedule';

export interface EventFilters { mode: 'upcoming' | 'all' | 'range'; from: string; through: string; timeZone: string; query: string; venueActor: string; includeCancelled: boolean; freeOnly: boolean; maxPrice?: number; currency: string; genres: readonly Genre[] }
export interface LocationGroup { readonly key: string; readonly latitude: number; readonly longitude: number; readonly items: readonly EventFeedItem[] }
export function groupLocations(items: readonly EventFeedItem[]): readonly LocationGroup[] {
  const groups = new Map<string, { key: string; latitude: number; longitude: number; items: EventFeedItem[] }>();
  for (const item of items) {
    const location = item.venue.location; if (!location) continue;
    const key = `${location.latitude.toFixed(6)},${location.longitude.toFixed(6)}`;
    let group = groups.get(key);
    if (!group) { group = { key, ...location, items: [] }; groups.set(key, group); }
    group.items.push(item);
  }
  return Object.freeze([...groups.values()].map(group => Object.freeze({ ...group, items: Object.freeze(group.items.sort((a, b) => a.event.value.startsAt - b.event.value.startsAt || a.event.eventId.localeCompare(b.event.eventId))) })));
}
export class EventExplorerState {
  private snapshot?: FeedSnapshot;
  private selected?: string;
  private location?: string;
  private listeners = new Set<() => void>();
  filters: Readonly<EventFilters>;
  constructor(zone = Intl.DateTimeFormat().resolvedOptions().timeZone, private readonly now = Date.now) {
    this.filters = Object.freeze({ mode: 'upcoming', from: '', through: '', timeZone: zone, query: '', venueActor: '', includeCancelled: false, freeOnly: false, maxPrice: undefined, currency: 'USD', genres: Object.freeze([]) });
  }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private emit() {
    const projection = this.project();
    if (this.selected && !projection.items.some(item => eventKey(item.event.actor, item.event.eventId) === this.selected)) this.selected = undefined;
    if (this.location && !projection.groups.some(group => group.key === this.location)) this.location = undefined;
    for (const listener of this.listeners) listener();
  }
  update(snapshot: FeedSnapshot) { this.snapshot = snapshot; this.emit(); }
  setFilters(change: Partial<EventFilters>) {
    const next = { ...this.filters, ...change };
    if (next.maxPrice !== undefined && (!Number.isFinite(next.maxPrice) || next.maxPrice < 0)) throw new Error('Maximum price must be zero or greater.');
    if (!/^[A-Z]{3}$/.test(next.currency)) throw new Error('Choose a three-letter currency.');
    next.genres = validateGenres(next.genres);
    if (next.mode === 'range') dateRange(next.from, next.through, next.timeZone);
    this.filters = Object.freeze(next); this.emit();
  }
  resetFilters() { this.filters = Object.freeze({ ...this.filters, mode: 'upcoming', from: '', through: '', query: '', venueActor: '', includeCancelled: false, freeOnly: false, maxPrice: undefined, currency: 'USD', genres: Object.freeze([]) }); this.emit(); }
  selectEvent(key?: string) { this.selected = key; this.emit(); }
  selectLocation(key?: string) { this.location = key; this.selected = undefined; this.emit(); }
  project() {
    const filters = this.filters;
    const range: DateRange | undefined = filters.mode === 'range' ? dateRange(filters.from, filters.through, filters.timeZone) : undefined;
    const now = this.now(), query = filters.query.trim().toLowerCase();
    const items = (this.snapshot?.events ?? []).filter(({ event, venue }) =>
      (!filters.genres.length || filters.genres.some(g => event.value.genres?.includes(g)))
      && (!filters.freeOnly || event.value.tickets?.kind === 'free')
      && (filters.maxPrice === undefined || event.value.tickets?.kind === 'free' || (event.value.tickets?.price !== undefined && event.value.tickets.currency === filters.currency && event.value.tickets.price <= filters.maxPrice))
      && (filters.includeCancelled || event.value.status !== 'cancelled') && (!filters.venueActor || venue.actor === filters.venueActor)
      && (!query || `${event.value.title} ${event.value.description} ${(event.value.performers ?? []).join(' ')} ${venue.name}`.toLowerCase().includes(query))
      && (range ? overlaps(event.value.startsAt, event.value.endsAt, range) : filters.mode === 'all' || event.value.endsAt > now));
    const groups = groupLocations(items);
    return { items, groups, missingLocations: items.filter(item => !item.venue.location).length,
      selectedEvent: items.find(item => eventKey(item.event.actor, item.event.eventId) === this.selected),
      selectedGroup: groups.find(group => group.key === this.location), snapshot: this.snapshot };
  }
}
