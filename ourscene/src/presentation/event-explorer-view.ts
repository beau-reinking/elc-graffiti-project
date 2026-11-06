import type { FeedSnapshot, FeedView } from '../application/ports';
import { EventExplorerState } from '../application/event-explorer';
import { GENRES, type Genre } from '../domain/genres';
import { eventKey } from '../domain/events';
import { datePreset } from '../domain/schedule';
import { EventDetailView, type EventActions } from './event-detail-view';
import { eventCard, eventThumbnail } from './event-components';
import { MapFeedView } from './map-feed-view';
import { createLeafletMap } from './map-adapter';
import { node, required, safeError } from './dom';

interface ExplorerOptions extends EventActions { owner?: boolean; initialEventId?: string }
export class EventExplorerView implements FeedView {
  readonly state = new EventExplorerState();
  private readonly details: EventDetailView;
  private readonly unsubscribe: () => void;
  private map?: MapFeedView;
  private disposed = false;
  private mode: 'map' | 'list';
  private cleanups: (() => void)[] = [];
  private ticker: number;
  private lastSnapshot?: FeedSnapshot;
  private listSignature?: string;
  private panelSignature?: string;
  private mapStarted = false;
  private filterDraft = false;
  private initialEventId?: string;
  constructor(private readonly root: HTMLElement, options: ExplorerOptions = {}) {
    this.initialEventId = options.initialEventId;
    this.mode = options.owner ? 'list' : 'map';
    if (options.owner) this.state.setFilters({ mode: 'all', includeCancelled: true });
    root.innerHTML = `<div class="event-explorer-toolbar"><div class="view-switch" role="group" aria-label="Event presentation"><button type="button" data-view="map">Map</button><button type="button" data-view="list">List</button></div><label>Search events<input type="search" data-filter="query" placeholder="An artist, a venue, a sound…"></label><label>Venue<select data-filter="venue" aria-label="Filter events by venue"><option value="">All venues</option></select></label></div><div class="date-toolbar"><div class="date-presets" role="group" aria-label="Date shortcuts"><button type="button" class="secondary" data-preset="today">Today</button><button type="button" class="secondary" data-preset="tomorrow">Tomorrow</button><button type="button" class="secondary" data-preset="weekend">This weekend</button><button type="button" class="secondary" data-preset="all">All dates</button></div><form class="date-range-form"><label>From<input type="date" name="from" required aria-label="Start date"></label><label>Through<input type="date" name="through" required aria-label="End date"></label><button type="submit" class="secondary">Apply dates</button></form><button type="button" class="text-button" data-reset>Reset filters</button><label class="cancelled-toggle"><input type="checkbox" data-cancelled>Include cancelled</label></div><form class="discovery-filters"><label class="free-filter"><input type="checkbox" name="freeOnly">Free only</label><label>Maximum price<input name="maxPrice" type="number" min="0" step="0.01" placeholder="Any price"></label><label>Currency<input name="currency" value="USD" maxlength="3" pattern="[A-Za-z]{3}" required></label><details class="genre-picker"><summary>Genres <span data-genre-count></span></summary><div class="genre-options"></div></details><button class="secondary" type="submit">Apply filters</button></form><p class="filter-timezone"></p><p class="filter-error error" role="alert"></p><p class="event-results" role="status" aria-live="polite"></p><p class="event-source-health" role="status"></p><div class="map-stage"><div class="event-map" aria-label="Interactive event map"></div><button class="map-fit secondary" type="button">Fit event pins</button><div class="location-panel" hidden></div></div><p class="map-warning" role="status"></p><div class="event-list"></div>`;
    required(root, '.filter-timezone').textContent = `Calendar dates use ${this.state.filters.timeZone}. Event details show each venue’s local timezone.`;
    const genreOptions = required(root, '.genre-options');
    for (const genre of GENRES) { const label = node('label'); const input = node('input'); input.type = 'checkbox'; input.name = 'genre'; input.value = genre; input.setAttribute('aria-label',genre); label.append(input, document.createTextNode(genre)); genreOptions.append(label); }
    required(root, '.discovery-filters').addEventListener('input',() => { this.filterDraft = true; });
    required(root, '.discovery-filters').addEventListener('submit', event => {
      event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement);
      try { this.filterDraft = false; this.state.setFilters({ freeOnly: data.has('freeOnly'), maxPrice: String(data.get('maxPrice')).trim() ? Number(data.get('maxPrice')) : undefined, currency: String(data.get('currency')).toUpperCase(), genres: data.getAll('genre') as Genre[] }); required<HTMLDetailsElement>(root,'.genre-picker').open = false; required(root, '.filter-error').textContent = ''; } catch (error) { this.filterDraft = true; required(root, '.filter-error').textContent = safeError(error); }
    });
    this.details = new EventDetailView(root, () => this.state.selectEvent(undefined), options);
    this.unsubscribe = this.state.subscribe(() => this.draw());
    const listen = (target: HTMLElement, event: string, callback: (event: Event) => void) => { target.addEventListener(event, callback); this.cleanups.push(() => target.removeEventListener(event, callback)); };
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-view]')) listen(button, 'click', () => { this.mode = button.dataset.view as 'map' | 'list'; this.draw(); });
    listen(required(root, '[data-filter="query"]'), 'input', event => this.state.setFilters({ query: (event.target as HTMLInputElement).value }));
    listen(required(root, '[data-filter="venue"]'), 'change', event => this.state.setFilters({ venueActor: (event.target as HTMLSelectElement).value }));
    listen(required(root, '[data-cancelled]'), 'change', event => this.state.setFilters({ includeCancelled: (event.target as HTMLInputElement).checked }));
    listen(required(root, '[data-reset]'), 'click', () => { this.filterDraft = false; required<HTMLInputElement>(root, '[data-filter="query"]').value = ''; this.state.resetFilters(); required(root, '.filter-error').textContent = ''; this.syncDates(); });
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-preset]')) listen(button, 'click', () => {
      if (button.dataset.preset === 'all') this.state.setFilters({ mode: 'all', from: '', through: '' });
      else { const dates = datePreset(button.dataset.preset as 'today' | 'tomorrow' | 'weekend', this.state.filters.timeZone); this.state.setFilters({ mode: 'range', ...dates }); }
      required(root, '.filter-error').textContent = ''; this.syncDates();
    });
    listen(required(root, '.date-range-form'), 'submit', event => {
      event.preventDefault();
      const from = required<HTMLInputElement>(root, '[name="from"]').value, through = required<HTMLInputElement>(root, '[name="through"]').value;
      try { this.state.setFilters({ mode: 'range', from, through }); required(root, '.filter-error').textContent = ''; }
      catch (error) { required(root, '.filter-error').textContent = safeError(error); }
    });
    listen(required(root, '.map-fit'), 'click', () => this.map?.fitAll());
    this.ticker = window.setInterval(() => { if (document.visibilityState === 'visible') this.draw(); }, 60_000);
    this.draw();
  }
  private async initializeMap() {
    try {
      const adapter = await createLeafletMap(required(this.root, '.event-map'), message => { if (!this.disposed) required(this.root, '.map-warning').textContent = message; });
      if (this.disposed) { adapter.dispose(); return; }
      this.map = new MapFeedView(adapter, group => {
        this.state.selectLocation(group.items.length > 1 ? group.key : undefined);
        if (group.items.length === 1) this.state.selectEvent(eventKey(group.items[0].event.actor, group.items[0].event.eventId));
      }); this.draw();
    } catch (error) {
      if (this.disposed) return;
      required(this.root, '.map-warning').textContent = `Map unavailable: ${safeError(error)}. Showing the accessible event list.`;
      required<HTMLButtonElement>(this.root, '[data-view="map"]').disabled = true;
      this.mode = 'list'; this.draw();
    }
  }
  private syncDates() { for (const name of ['from', 'through'] as const) required<HTMLInputElement>(this.root, `[name="${name}"]`).value = this.state.filters[name]; }
  render(snapshot: FeedSnapshot) {
    this.lastSnapshot = snapshot;
    const select = required<HTMLSelectElement>(this.root, '[data-filter="venue"]');
    const value = this.state.filters.venueActor;
    select.replaceChildren(node('option', '', 'All venues')); select.options[0].value = '';
    for (const venue of snapshot.venues) { const option = node('option', '', venue.name); option.value = venue.actor; select.append(option); }
    select.value = value;
    this.state.update(snapshot);
    if (this.initialEventId) { const item = snapshot.events.find(i => i.event.eventId === this.initialEventId); if (item) { this.initialEventId = undefined; this.state.selectEvent(eventKey(item.event.actor,item.event.eventId)); } }
  }
  private draw() {
    if (this.disposed) return;
    const projection = this.state.project();
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === this.mode));
    required<HTMLInputElement>(this.root, '[data-cancelled]').checked = this.state.filters.includeCancelled;
    required<HTMLSelectElement>(this.root, '[data-filter="venue"]').value = this.state.filters.venueActor;
    if (!this.filterDraft) {
    required<HTMLInputElement>(this.root, '[name=freeOnly]').checked = this.state.filters.freeOnly;
    required<HTMLInputElement>(this.root, '[name=maxPrice]').value = this.state.filters.maxPrice === undefined ? '' : String(this.state.filters.maxPrice);
    required<HTMLInputElement>(this.root, '[name=currency]').value = this.state.filters.currency;
    this.root.querySelectorAll<HTMLInputElement>('[name=genre]').forEach(input => { input.checked = this.state.filters.genres.includes(input.value as Genre); });
    }
    required(this.root, '[data-genre-count]').textContent = this.state.filters.genres.length ? `(${this.state.filters.genres.length})` : '(all)';
    const stage = required(this.root, '.map-stage'), list = required(this.root, '.event-list');
    stage.hidden = this.mode !== 'map'; list.hidden = this.mode !== 'list';
    if (this.mode === 'map' && !this.mapStarted) { this.mapStarted = true; void this.initializeMap(); }
    required(this.root, '.event-results').textContent = `${projection.items.length} matching event${projection.items.length === 1 ? '' : 's'} · ${projection.groups.length} location${projection.groups.length === 1 ? '' : 's'}${projection.missingLocations ? ` · ${projection.missingLocations} event(s) have no coordinates and are available in List view` : ''}${!projection.items.length ? ' · Try another date or choose All dates.' : ''}`;
    const sources = this.lastSnapshot?.sources ?? [], stale = sources.filter(source => source.stale).length;
    required(this.root, '.event-source-health').textContent = stale ? `${stale} source(s) unavailable. Showing cached records; try Refresh.` : sources.length ? 'Synced · updates every 30 seconds while visible' : 'Discovering events…';
    this.map?.render(projection.groups);
    if (this.mode === 'map') this.map?.resize();
    const listSignature = JSON.stringify(projection.items.map(item => [item.event.url, item.venue.url]));
    if (listSignature !== this.listSignature) {
      this.listSignature = listSignature; list.replaceChildren();
      for (const item of projection.items) list.append(eventCard(item, () => this.state.selectEvent(eventKey(item.event.actor, item.event.eventId))));
      if (!projection.items.length) list.append(node('p', 'empty-state', 'No events match these filters. Try a different date range or clear the filters.'));
    }
    const panel = required(this.root, '.location-panel'); panel.hidden = !projection.selectedGroup;
    const panelSignature = JSON.stringify(projection.selectedGroup ? [projection.selectedGroup.key, projection.selectedGroup.items.map(item => [item.event.url, item.venue.url])] : null);
    if (panelSignature !== this.panelSignature) { panel.replaceChildren(); this.panelSignature = panelSignature;
    if (projection.selectedGroup) {
      const group = projection.selectedGroup, heading = node('div', 'location-panel-heading');
      const close = node('button', 'secondary', 'Close location ×'); close.type = 'button'; close.addEventListener('click', () => this.state.selectLocation(undefined));
      heading.append(node('h3', '', `${group.items.length} events at this location`), close); panel.append(heading);
      for (const item of group.items) panel.append(eventThumbnail(item, () => this.state.selectEvent(eventKey(item.event.actor, item.event.eventId))));
      if (window.matchMedia('(max-width:600px)').matches) panel.scrollIntoView({ block:'nearest',behavior:'smooth' });
    }
    }
    this.details.render(projection.selectedEvent);
  }
  dispose() { this.disposed = true; window.clearInterval(this.ticker); this.unsubscribe(); for (const cleanup of this.cleanups) cleanup(); this.map?.dispose(); this.details.dispose(); this.root.replaceChildren(); }
}
