import type { FeedSnapshot, FeedView } from '../application/ports';
import { node, required } from './dom';

interface ListOptions { venueActor?: string; currentActor?: () => string | undefined; onDelete?: (url: string) => void }
/** A replaceable presentation: filtering and card layout never drive discovery. */
export class ListFeedView implements FeedView {
  private snapshot?: FeedSnapshot;
  private query = '';
  private venue = '';
  private readonly cards: HTMLElement;
  private readonly select: HTMLSelectElement;
  private readonly search: HTMLInputElement;
  private readonly handleSearch = () => { this.query = this.search.value.toLowerCase(); this.renderItems(); };
  private readonly handleVenue = () => { this.venue = this.select.value; this.renderItems(); };
  constructor(private readonly root: HTMLElement, private readonly options: ListOptions = {}) {
    root.innerHTML = `<div class="feed-toolbar"><label class="search-field"><span>Search announcements</span><input type="search" placeholder="A venue, a sound, a little news…" aria-label="Search announcements"></label><label class="venue-filter"><span>Venue</span><select aria-label="Filter by venue"><option value="">All venues</option></select></label></div><p class="source-status" role="status" aria-live="polite"></p><div class="feed-cards"></div>`;
    this.cards = required(root, '.feed-cards'); this.select = required(root, 'select'); this.search = required(root, 'input');
    if (options.venueActor !== undefined) required<HTMLElement>(root, '.venue-filter').hidden = true;
    this.search.addEventListener('input', this.handleSearch); this.select.addEventListener('change', this.handleVenue);
  }
  render(snapshot: FeedSnapshot) {
    this.snapshot = snapshot;
    this.select.replaceChildren(node('option', '', 'All venues'));
    this.select.options[0].value = '';
    for (const venue of snapshot.venues) { const option = node('option', '', venue.name); option.value = venue.actor; this.select.append(option); }
    if (!snapshot.venues.some(v => v.actor === this.venue)) this.venue = '';
    this.select.value = this.venue;
    const stale = snapshot.sources.filter(s => s.stale).length;
    const warnings = snapshot.sources.reduce((sum, s) => sum + s.warnings.length, 0);
    const label = required(this.root, '.source-status');
    label.classList.toggle('stale', stale > 0);
    label.textContent = stale ? `${stale} source${stale === 1 ? '' : 's'} unavailable. Showing cached announcements; try Refresh.`
      : warnings ? `Synced with ${warnings} diagnostic warning${warnings === 1 ? '' : 's'}. See the browser console for details.`
        : snapshot.sources.length ? 'Connected · checks for updates every 30 seconds while this page is visible' : 'Discovering venues…';
    this.renderItems();
  }
  private renderItems() {
    if (!this.snapshot) return;
    const items = this.snapshot.items.filter(({ announcement: post, venue }) =>
      (!this.options.venueActor || venue.actor === this.options.venueActor) && (!this.venue || venue.actor === this.venue)
      && `${venue.name} ${post.value.title ?? ''} ${post.value.body}`.toLowerCase().includes(this.query));
    this.cards.replaceChildren();
    if (!items.length) {
      const empty = node('div', 'empty-state');
      empty.append(node('div', 'empty-icon', '↗'), node('h3', '', this.query || this.venue ? 'No matching announcements' : 'The next good thing starts here.'),
        node('p', '', this.query || this.venue ? 'Try a different search or venue.' : 'Registered venues and their announcements will appear here. Refresh after a venue publishes.'));
      this.cards.append(empty);
    }
    for (const { announcement: post, venue, endorsement } of items) {
      const card = node('article', 'announcement-card');
      const top = node('div', 'card-top');
      top.append(node('span', 'venue-monogram', venue.name.slice(0, 2).toUpperCase()), node('span', 'venue-name', venue.name), node('span', 'unverified', 'Unverified venue'));
      card.append(top);
      if (post.value.title) card.append(node('h3', '', post.value.title));
      card.append(node('p', 'announcement-body', post.value.body));
      if (post.value.links?.length) {
        const links = node('div', 'post-links');
        for (const url of post.value.links) { const link = node('a', '', `${new URL(url).hostname} ↗`); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; links.append(link); }
        card.append(links);
      }
      const bottom = node('div', 'card-bottom');
      const time = node('time', '', new Date(post.published).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }));
      time.dateTime = new Date(post.published).toISOString(); bottom.append(time);
      if (venue.value.address) bottom.append(node('span', '', venue.value.address));
      if (this.options.onDelete && this.options.currentActor?.() === post.actor && post.actor === venue.actor) {
        const button = node('button', 'text-button danger', 'Delete'); button.type = 'button';
        button.addEventListener('click', () => this.options.onDelete?.(post.url)); bottom.append(button);
      }
      card.append(bottom);
      const attribution = node('details', 'attribution');
      attribution.append(node('summary', '', 'Source & attribution'), node('p', '', `Published by ${venue.name}`));
      if (endorsement) attribution.append(node('p', '', 'Venue endorsement present; original authorship remains in the public Graffiti record.'));
      card.append(attribution); this.cards.append(card);
    }
  }
  dispose() { this.search.removeEventListener('input', this.handleSearch); this.select.removeEventListener('change', this.handleVenue); this.root.replaceChildren(); }
}
