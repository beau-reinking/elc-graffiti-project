import type { EventFeedItem } from '../application/ports';
import type { MusicEvent } from '../domain/events';
import { eventKey } from '../domain/events';
import { eventArtwork, ticketLabel } from './event-components';
import { node } from './dom';

export interface EventActions { discussionUrl?(item: EventFeedItem): string | undefined; edit?(event: MusicEvent): void; cancel?(event: MusicEvent): void; remove?(event: MusicEvent): void; currentActor?(): string | undefined }
export class EventDetailView {
  private readonly dialog = node('dialog', 'event-details-dialog');
  private signature?: string;
  private returnFocus?: HTMLElement;
  private returnKey?: string;
  constructor(private readonly root: HTMLElement, private readonly close: () => void, private readonly actions: EventActions = {}) {
    this.dialog.setAttribute('aria-label', 'Event information');
    this.dialog.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); this.close(); } });
    root.append(this.dialog);
  }
  render(item?: EventFeedItem) {
    if (!item) {
      if (this.dialog.open) {
        this.dialog.close();
        const target = this.returnFocus?.isConnected && this.returnFocus.getClientRects().length ? this.returnFocus : [...this.root.querySelectorAll<HTMLElement>('[data-event-key]')].find(element => element.dataset.eventKey === this.returnKey && element.getClientRects().length);
        target?.focus({ preventScroll: true });
      }
      this.signature = undefined; return;
    }
    const signature = `${item.event.url}|${item.venue.url}|${this.actions.currentActor?.()}`;
    if (signature === this.signature && this.dialog.open) return;
    this.signature = signature;
    const wasOpen = this.dialog.open;
    if (!wasOpen) { this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined; this.returnKey = this.returnFocus?.dataset.eventKey ?? eventKey(item.event.actor, item.event.eventId); }
    this.dialog.replaceChildren();
    const close = node('button', 'detail-close secondary', 'Close event ×'); close.type = 'button'; close.addEventListener('click', this.close);
    const event = item.event.value;
    const body = node('div', 'event-details-body');
    body.append(node('p', 'eyebrow', item.venue.name), node('h2', '', event.title), node('span', 'unverified', item.venue.name.startsWith('Community: ')?'Community submission · approved by project reviewer; venue unverified':'Unverified venue'), node('span', 'ticket-pill', ticketLabel(item)), node('p', 'event-description', event.description));
    const facts = node('dl', 'event-facts');
    const fact = (label: string, value: string) => { facts.append(node('dt', '', label), node('dd', '', value)); };
    const format = (instant: number) => new Intl.DateTimeFormat(undefined, { timeZone: event.timeZone, dateStyle: 'full', timeStyle: 'short' }).format(instant);
    fact('Starts', format(event.startsAt)); fact('Ends', format(event.endsAt)); fact('Timezone', event.timeZone);
    if (event.doorsAt !== undefined) fact('Doors', format(event.doorsAt));
    if (event.performers?.length) fact('Lineup', event.performers.join(' · '));
    if (event.genres?.length) fact('Genres', event.genres.join(' · '));
    fact('Location', item.venue.value.address ?? 'Address not provided');
    if (event.ageRestriction) fact('Age restrictions', event.ageRestriction);
    fact('Tickets', ticketLabel(item)); body.append(facts);
    if (event.tickets?.url && event.status !== 'cancelled' && event.tickets.availability !== 'sold-out') {
      const link = node('a', 'ticket-action', event.tickets.demo ? 'Demo ticket page ↗' : event.tickets.kind === 'free' ? 'Register externally ↗' : 'Get tickets ↗');
      link.href = event.tickets.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; body.append(link);
      body.append(node('p', 'muted', event.tickets.demo ? 'Demo link only — this is not a real ticket offer.' : 'External ticket provider · venue-supplied availability and pricing, not live inventory.'));
    } else body.append(node('p', 'muted', event.status === 'cancelled' ? 'This event is cancelled. Ticket sales are disabled.' : event.tickets?.availability === 'sold-out' ? 'This event is sold out.' : 'No external ticket link provided.'));
    for (const url of event.links ?? []) { const link = node('a', 'event-extra-link', `${new URL(url).hostname} ↗`); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; body.append(link); }
    const discussion = this.actions.discussionUrl?.(item);
    if (discussion) { const link = node('a', 'community-action secondary', `Join the conversation at ${item.venue.name}`); link.href = discussion; body.append(link); }
    body.append(node('p', 'muted', `Published by ${item.venue.name} · Revision ${event.revision}`));
    if (this.actions.currentActor?.() === item.event.actor && item.event.actor === item.venue.actor) {
      const controls = node('div', 'event-owner-actions');
      for (const [label, callback] of [['Edit event', this.actions.edit], ['Cancel event', event.status === 'cancelled' ? undefined : this.actions.cancel], ['Delete event', this.actions.remove]] as const) if (callback) {
        const button = node('button', label === 'Delete event' ? 'secondary danger' : 'secondary', label); button.type = 'button';
        button.addEventListener('click', () => { this.close(); callback(item.event); }); controls.append(button);
      }
      body.append(controls);
    }
    this.dialog.append(close, eventArtwork(item), body);
    if (!wasOpen) { this.dialog.show(); close.focus({ preventScroll: true }); }
  }
  dispose() { this.dialog.remove(); }
}
