import type { VenueProfileInput } from '../domain/models';
import type { EventInput, MusicEvent } from '../domain/events';
import { addDays, instantToLocal, localToInstant, todayIn } from '../domain/schedule';
import type { FeedSnapshot, FeedView, IdentityState, VenueConfig } from '../application/ports';
import { EventExplorerView } from './event-explorer-view';
import { ListFeedView } from './list-feed-view';
import { GENRES, type Genre } from '../domain/genres';
import { required } from './dom';

export interface VenueActions { login(): void; logout(): void; register(): void; publish(): void; remove(event: MusicEvent): void; cancel(event: MusicEvent): void; refresh(): void; discussionUrl?(item: import('../application/ports').EventFeedItem): string | undefined }
export interface VenueScreen extends FeedView {
  bind(actions: VenueActions): void; readProfile(): VenueProfileInput; readEvent(): EventInput; editingEvent(): MusicEvent | undefined;
  setIdentity(state: IdentityState): void; setBusy(busy: boolean): void; notify(message: string, error?: boolean): void; clearEventForm(): void;
}
export class DomVenueView implements VenueScreen {
  private state: IdentityState = { initialized: false };
  private busy = false; private registered = false; private hydrated = false; private dirtyProfile = false;
  private snapshot?: FeedSnapshot; private editing?: MusicEvent;
  private feed?: EventExplorerView; private legacy: ListFeedView;
  private cleanups: (() => void)[] = [];
  constructor(private readonly root: HTMLElement, private readonly config: VenueConfig) {
    root.innerHTML = `<section class="venue-intro"><p class="eyebrow">INDEPENDENT VENUE · LIVE MUSIC</p><h1></h1><p class="venue-tagline"></p><p class="venue-description"></p></section><section class="workspace"><div class="workspace-heading"><div><p class="eyebrow">VENUE DESK</p><h2>Put your next event on the map.</h2></div><div class="identity-actions"><button type="button" data-action="login">Sign in</button><button type="button" class="secondary" data-action="logout" hidden>Sign out</button></div></div><p class="identity-state" role="status"></p><p class="setup-note"></p><div class="event-workspace"><form id="profile-form"><h3>Venue profile</h3><p class="muted">Register once. Coordinates place your events on the map.</p><label>Venue name<input name="name" required maxlength="120"></label><label>Website <span class="optional">optional</span><input name="website" type="url" placeholder="https://…"></label><label>Venue app URL <span class="optional">HTTPS deployment URL</span><input name="appUrl" type="url" placeholder="https://…"></label><label>Address<input name="address" maxlength="300"></label><div class="coordinate-fields"><label>Latitude<input name="latitude" type="number" step="any" min="-90" max="90"></label><label>Longitude<input name="longitude" type="number" step="any" min="-180" max="180"></label></div><p class="muted">Coordinates are optional; events without them remain in the list.</p><button type="submit">Register venue ↗</button></form><form id="event-form"><h3 id="event-form-heading">Publish an event</h3><p class="event-editing-note muted"></p><label>Event title<input name="title" required maxlength="140" placeholder="Something worth hearing"></label><label>Description<textarea name="description" required maxlength="8000" rows="4"></textarea></label><label>Genres<select name="genres" multiple aria-label="Event genres"></select></label><label>Venue timezone<input name="timeZone" required placeholder="America/New_York"></label><div class="event-form-grid"><label>Starts<input name="startsAt" type="datetime-local" required></label><label>Ends<input name="endsAt" type="datetime-local" required></label><label>Doors <span class="optional">optional</span><input name="doorsAt" type="datetime-local"></label><label>Age restrictions <span class="optional">optional</span><input name="ageRestriction" maxlength="100" placeholder="All ages / 18+ / 21+"></label></div><label>Performers <span class="optional">one per line, optional</span><textarea name="performers" rows="2"></textarea></label><details><summary>Artwork and additional links</summary><label>Artwork URL <span class="optional">HTTPS, optional</span><input name="imageUrl" type="url" placeholder="https://…"></label><label>Artwork description<input name="imageAlt" maxlength="300"></label><label>Additional links <span class="optional">one HTTPS URL per line, up to five</span><textarea name="links" rows="2"></textarea></label></details><div class="event-form-grid"><label>Ticket type<select name="ticketKind"><option value="paid">Paid</option><option value="free">Free</option><option value="door">At the door</option></select></label><label>Availability<select name="availability"><option value="available">Available</option><option value="sold-out">Sold out</option></select></label><label>Price <span class="optional">optional</span><input name="price" type="number" step="0.01" min="0"></label><label>Currency<input name="currency" maxlength="3" value="USD"></label></div><label>Ticket or registration URL <span class="optional">HTTPS, optional</span><input name="ticketUrl" type="url" placeholder="https://…"></label><p class="muted">Ticket sales happen on the linked provider’s site. Prices and availability are venue-supplied.</p><div class="event-form-buttons"><button type="submit">Publish event ↗</button><button type="button" class="secondary" data-action="clear-edit" hidden>Stop editing</button></div></form></div><p class="action-status" role="status" aria-live="polite"></p></section><section class="board-section"><div class="section-heading"><div><p class="eyebrow">COMING TO THIS ROOM</p><h2>Events at this venue</h2></div><button type="button" class="secondary" data-action="refresh">Refresh</button></div><div id="venue-events"></div></section><details class="legacy-announcements"><summary>Legacy announcements (not scheduled events)</summary><p class="muted">These older posts have no dates. They are not shown on the event map or matched by its date filters.</p><div id="venue-legacy"></div></details>`;
    const genreSelect = required<HTMLSelectElement>(root, '[name=genres]');
    for (const genre of GENRES) { const option = document.createElement('option'); option.value = option.textContent = genre; genreSelect.append(option); }
    const workspace = required(root,'.workspace'); workspace.classList.add('owner-workspace');
    const moderation = document.createElement('button'); moderation.type = 'button'; moderation.className = 'secondary'; moderation.textContent = 'Moderate community'; moderation.addEventListener('click',() => this.showPage('community')); workspace.prepend(moderation);
    const publicEvents = required(root,'.board-section'); publicEvents.dataset.venuePage = 'events';
    const nav = document.createElement('nav'); nav.className = 'venue-page-nav'; nav.setAttribute('aria-label','Venue sections');
    for (const [id,label] of [['events','Events'],['community','Community'],['owner','Owner area']]) { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.dataset.venueTab = id; button.addEventListener('click',() => this.showPage(id)); nav.append(button); }
    root.insertBefore(nav, workspace);
    const community = document.createElement('section'); community.id = 'venue-community'; community.dataset.venuePage = 'community'; root.append(community);
    const initialView = new URL(location.href).searchParams.get('view'); this.showPage(initialView === 'community' || initialView === 'owner' ? initialView : 'events', true);
    required(root, 'h1').textContent = config.brandName; required(root, '.venue-tagline').textContent = config.tagline; required(root, '.venue-description').textContent = config.description;
    this.setValue('#profile-form', 'name', config.brandName); this.setValue('#profile-form', 'address', config.defaultAddress ?? '');
    if (config.defaultLocation) { this.setValue('#profile-form', 'latitude', String(config.defaultLocation.latitude)); this.setValue('#profile-form', 'longitude', String(config.defaultLocation.longitude)); }
    required(root, '.setup-note').textContent = config.testHandle ? `Sandbox username: ${config.testHandle}. These are fictional venues and demo locations.` : config.venueActor ? 'Sign in with the venue owner account to manage this venue.' : 'Venue ownership must be configured before publishing.';
    this.legacy = new ListFeedView(required(root, '#venue-legacy'), { venueActor: config.venueActor || 'unconfigured' });
    const profile = required(root, '#profile-form'), dirty = () => { this.dirtyProfile = true; };
    profile.addEventListener('input', dirty); this.cleanups.push(() => profile.removeEventListener('input', dirty));
    this.clearEventForm(); this.updateControls();
  }
  private page = 'events';
  private showPage(page: string, preserveEvent = false) { this.page = page;
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-venue-page]')) el.hidden = el.dataset.venuePage !== page;
    const owner = this.root.querySelector<HTMLElement>('.owner-workspace'); if (owner) owner.hidden = page !== 'owner' || this.state.session?.actor !== this.config.venueActor;
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('[data-venue-tab]')) b.setAttribute('aria-pressed',String(b.dataset.venueTab === page));
    const url = new URL(location.href); url.searchParams.set('view',page); if (page !== 'community' && !preserveEvent) url.searchParams.delete('event'); history.replaceState(null,'',url);
  }
  private setValue(form: string, name: string, value: string) { required<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(this.root, `${form} [name="${name}"]`).value = value; }
  bind(actions: VenueActions) {
    this.feed = new EventExplorerView(required(this.root, '#venue-events'), { owner: true, initialEventId: new URL(location.href).searchParams.get('view') === 'events' ? new URL(location.href).searchParams.get('event') ?? undefined : undefined, discussionUrl: actions.discussionUrl, currentActor: () => this.state.session?.actor,
      edit: event => this.beginEdit(event), cancel: actions.cancel, remove: actions.remove });
    const bind = (selector: string, event: string, action: () => void) => {
      const target = required(this.root, selector), handler = (event: Event) => { event.preventDefault(); action(); };
      target.addEventListener(event, handler); this.cleanups.push(() => target.removeEventListener(event, handler));
    };
    bind('[data-action="login"]', 'click', actions.login); bind('[data-action="logout"]', 'click', actions.logout);
    bind('[data-action="refresh"]', 'click', actions.refresh); bind('#profile-form', 'submit', actions.register); bind('#event-form', 'submit', actions.publish); bind('[data-action="clear-edit"]', 'click', () => this.clearEventForm());
  }
  readProfile(): VenueProfileInput {
    const data = new FormData(required<HTMLFormElement>(this.root, '#profile-form')), get = (key: string) => String(data.get(key) ?? '').trim();
    const latitude = get('latitude'), longitude = get('longitude');
    if (!!latitude !== !!longitude) throw new Error('Provide both latitude and longitude, or leave both empty.');
    return { ...(get('appUrl') ? { appUrl: get('appUrl') } : {}), name: get('name'), ...(get('website') ? { website: get('website') } : {}), ...(get('address') ? { address: get('address') } : {}), ...(latitude ? { location: { latitude: Number(latitude), longitude: Number(longitude) } } : {}) };
  }
  readEvent(): EventInput {
    const data = new FormData(required<HTMLFormElement>(this.root, '#event-form')), get = (key: string) => String(data.get(key) ?? '').trim();
    const zone = get('timeZone'), lines = (key: string) => get(key).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const kind = get('ticketKind') as 'paid' | 'free' | 'door';
    return { genres: data.getAll('genres') as Genre[], ...(this.editing?.value.demoArtworkKey ? { demoArtworkKey: this.editing.value.demoArtworkKey } : {}), title: get('title'), description: get('description'), timeZone: zone, startsAt: localToInstant(get('startsAt'), zone), endsAt: localToInstant(get('endsAt'), zone),
      ...(get('doorsAt') ? { doorsAt: localToInstant(get('doorsAt'), zone) } : {}), ...(get('ageRestriction') ? { ageRestriction: get('ageRestriction') } : {}),
      ...(lines('performers').length ? { performers: lines('performers') } : {}), ...(get('imageUrl') ? { imageUrl: get('imageUrl') } : {}), ...(get('imageAlt') ? { imageAlt: get('imageAlt') } : {}), ...(lines('links').length ? { links: lines('links') } : {}),
      tickets: { kind, availability: get('availability') as 'available' | 'sold-out', ...(get('ticketUrl') ? { url: get('ticketUrl') } : {}),
        ...(get('price') ? { price: Number(get('price')), currency: get('currency').toUpperCase() } : {}), ...(this.config.testHandle || this.editing?.value.tickets?.demo ? { demo: true } : {}),
      },
    };
  }
  editingEvent() { return this.editing; }
  private beginEdit(event: MusicEvent) {
    if (this.busy) return;
    this.showPage('owner'); this.editing = event; const value = event.value;
    for (const option of required<HTMLSelectElement>(this.root,'[name=genres]').options) option.selected = !!value.genres?.includes(option.value as Genre);
    for (const key of ['title', 'description', 'timeZone', 'ageRestriction', 'imageUrl', 'imageAlt'] as const) this.setValue('#event-form', key, value[key] ?? '');
    for (const key of ['startsAt', 'endsAt', 'doorsAt'] as const) this.setValue('#event-form', key, value[key] === undefined ? '' : instantToLocal(value[key], value.timeZone));
    this.setValue('#event-form', 'performers', value.performers?.join('\n') ?? ''); this.setValue('#event-form', 'links', value.links?.join('\n') ?? '');
    this.setValue('#event-form', 'ticketKind', value.tickets?.kind ?? 'paid'); this.setValue('#event-form', 'availability', value.tickets?.availability ?? 'available');
    this.setValue('#event-form', 'ticketUrl', value.tickets?.url ?? ''); this.setValue('#event-form', 'price', value.tickets?.price === undefined ? '' : String(value.tickets.price)); this.setValue('#event-form', 'currency', value.tickets?.currency ?? 'USD');
    required(this.root, '#event-form-heading').textContent = 'Edit event'; required(this.root, '.event-editing-note').textContent = `Editing revision ${value.revision}. Saving publishes a new revision.${value.status === 'cancelled' ? ' This event will remain cancelled.' : ''}`;
    required(this.root, '[data-action="clear-edit"]').hidden = false; this.updateControls();
    required(this.root, '#event-form').scrollIntoView({ behavior: 'smooth', block: 'start' }); required<HTMLInputElement>(this.root, '#event-form [name="title"]').focus({ preventScroll: true });
  }
  clearEventForm() {
    this.editing = undefined; required<HTMLFormElement>(this.root, '#event-form').reset();
    const zone = this.config.defaultTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone, tomorrow = addDays(todayIn(zone), 1);
    this.setValue('#event-form', 'timeZone', zone); this.setValue('#event-form', 'startsAt', `${tomorrow}T19:00`); this.setValue('#event-form', 'endsAt', `${tomorrow}T22:00`);
    required(this.root, '#event-form-heading').textContent = 'Publish an event'; required(this.root, '.event-editing-note').textContent = 'Required: title, description, timezone, start, and end.';
    required(this.root, '[data-action="clear-edit"]').hidden = true; this.updateControls();
  }
  setIdentity(state: IdentityState) { this.state = state; this.updateControls(); if (this.snapshot) this.feed?.render(this.snapshot); }
  setBusy(busy: boolean) { this.busy = busy; this.updateControls(); }
  private updateControls() {
    const ownIdentity = !!this.config.venueActor && this.state.session?.actor === this.config.venueActor;
    required(this.root,'.owner-workspace').hidden = !ownIdentity || this.page !== 'owner';
    required<HTMLButtonElement>(this.root,'[data-venue-tab=owner]').hidden = !ownIdentity;
    const login = required<HTMLButtonElement>(this.root, '[data-action="login"]'), logout = required<HTMLButtonElement>(this.root, '[data-action="logout"]');
    login.hidden = ownIdentity; logout.hidden = !this.state.session; login.disabled = logout.disabled = this.busy || !this.state.initialized;
    required<HTMLButtonElement>(this.root, '[data-action="refresh"]').disabled = this.busy;
    required(this.root, '.identity-state').textContent = this.state.error ?? (!this.state.initialized ? 'Restoring identity…' : this.state.session ? ownIdentity ? 'Signed in as venue owner.' : 'Signed in as a visitor.' : 'Sign in with the venue identity to publish.');
    for (const selector of ['#profile-form', '#event-form']) {
      const allowed = ownIdentity && this.state.initialized && !this.busy && (selector === '#profile-form' || this.registered);
      required(this.root, selector).querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement>('input,textarea,select,button').forEach(control => { control.disabled = !allowed; });
    }
    required<HTMLButtonElement>(this.root, '#profile-form button').textContent = this.registered ? 'Update venue profile ↗' : 'Register venue ↗';
    required<HTMLButtonElement>(this.root, '#event-form [type="submit"]').textContent = this.editing ? 'Save event revision ↗' : 'Publish event ↗';
  }
  notify(message: string, error = false) { const status = required(this.root, '.action-status'); status.textContent = message; status.classList.toggle('error', error); }
  render(snapshot: FeedSnapshot) {
    this.snapshot = snapshot;
    const venue = snapshot.venues.find(v => v.actor === this.config.venueActor); this.registered = !!venue;
    if (venue && !this.hydrated && !this.dirtyProfile) {
      for (const key of ['name', 'address', 'website', 'appUrl'] as const) this.setValue('#profile-form', key, venue.value[key] ?? '');
      if (venue.location) { this.setValue('#profile-form', 'latitude', String(venue.location.latitude)); this.setValue('#profile-form', 'longitude', String(venue.location.longitude)); }
      this.hydrated = true;
    }
    if (this.editing && !snapshot.events.some(item => item.event.eventId === this.editing?.eventId && item.event.actor === this.editing.actor)) this.clearEventForm();
    this.feed?.render(snapshot); this.legacy.render(snapshot); this.updateControls();
  }
  dispose() { for (const cleanup of this.cleanups) cleanup(); this.feed?.dispose(); this.legacy.dispose(); this.root.replaceChildren(); }
}
