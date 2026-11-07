import type { EventFeedItem } from '../application/ports';
import { demoArtwork, demoArtistDescription } from './demo-artwork';
import { node } from './dom';
import { eventKey } from '../domain/events';

export function eventArtwork(item: EventFeedItem, thumbnail = false): HTMLElement {
  const wrapper = node('div', `event-artwork${thumbnail ? ' thumbnail-art' : ''}`);
  const fallback = () => {
    const art = node('div', 'event-art-fallback');
    // Deterministic local cover artwork avoids requiring an image service.
    const hue = [...item.event.eventId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
    art.style.setProperty('--art-hue', String(hue));
    art.setAttribute('role', 'img'); art.setAttribute('aria-label', `Artwork placeholder for ${item.event.value.title}`);
    art.append(node('span', 'art-lines', '≋'), node('strong', '', item.venue.name), node('small', '', 'LIVE MUSIC'));
    return art;
  };
  const generated = !item.event.value.imageUrl ? demoArtwork(item.event.value.demoArtworkKey) : undefined;
  const imageUrl = item.event.value.imageUrl ?? generated;
  if (imageUrl) {
    const image = node('img'); image.src = imageUrl; image.alt = generated ? `${demoArtistDescription(item.event.value.demoArtworkKey!)} · generated demo artwork` : item.event.value.imageAlt ?? `${item.event.value.title} artwork`; image.loading = 'lazy';
    image.addEventListener('error', () => image.replaceWith(fallback()), { once: true }); wrapper.append(image);
    if (generated) wrapper.append(node('small','artwork-caption','Generated demo artist'));
  } else wrapper.append(fallback());
  return wrapper;
}
export function eventTime(item: EventFeedItem, zone = item.event.value.timeZone): string {
  return new Intl.DateTimeFormat(undefined, { timeZone: zone, dateStyle: 'medium', timeStyle: 'short' }).format(item.event.value.startsAt);
}
export function ticketLabel(item: EventFeedItem): string {
  const event = item.event.value, tickets = event.tickets;
  if (event.status === 'cancelled') return 'Cancelled';
  if (tickets?.availability === 'sold-out') return 'Sold out';
  if (tickets?.kind === 'free') return 'Free';
  if (tickets?.price !== undefined && tickets.currency) return new Intl.NumberFormat(undefined, { style: 'currency', currency: tickets.currency }).format(tickets.price);
  return tickets?.kind === 'door' ? 'Tickets at the door' : 'See ticket details';
}
export function eventThumbnail(item: EventFeedItem, select: () => void): HTMLButtonElement {
  const button = node('button', 'event-thumbnail'); button.type = 'button';
  button.dataset.eventKey = eventKey(item.event.actor, item.event.eventId);
  button.setAttribute('aria-label', `View ${item.event.value.title} · ${item.venue.name} · ${eventTime(item)}`);
  const text = node('span', 'thumbnail-copy');
  text.append(node('small', 'thumbnail-address', item.venue.value.address ?? 'Address not provided'));
  text.append(node('strong', '', item.event.value.title), node('span', '', item.venue.name), node('small', '', `${eventTime(item)} · ${item.event.value.timeZone}`), node('small', 'event-ticket-label', ticketLabel(item)));
  button.append(eventArtwork(item, true), text); button.addEventListener('click', select);
  return button;
}
export function eventCard(item: EventFeedItem, select: () => void): HTMLElement {
  const card = node('article', 'event-card');
  const button = node('button', 'event-card-open'); button.type = 'button';
  button.dataset.eventKey = eventKey(item.event.actor, item.event.eventId);
  button.setAttribute('aria-label', `View ${item.event.value.title} · ${item.venue.name} · ${eventTime(item)}`);
  const copy = node('div', 'event-card-copy');
  copy.append(node('span', 'eyebrow', item.venue.name), node('h3', '', item.event.value.title), node('p', '', `${eventTime(item)} · ${item.event.value.timeZone}`));
  copy.append(node('p', 'muted', item.venue.value.address ?? 'Address not provided'));
  if (item.event.value.genres?.length) copy.append(node('p', 'event-genres', item.event.value.genres.join(' · ')));
  copy.append(node('span', 'ticket-pill', ticketLabel(item)), node('span', 'unverified', 'Unverified venue'));
  button.append(eventArtwork(item), copy); button.addEventListener('click', select); card.append(button); return card;
}
