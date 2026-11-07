import type { EventFeedItem } from '../application/ports';
import { httpsLink } from '../domain/models';
import { mode } from './client';
import { sandboxVenues } from '../venue-catalog';
export function discussionUrl(item: EventFeedItem): string | undefined {
  if(typeof window!=='undefined' && window.parent!==window){const base=new URL('/apps/ourscene/venue/',location.origin);base.searchParams.set('actor',item.venue.actor);base.searchParams.set('view','community');base.searchParams.set('event',item.event.eventId);return base.href;}
  const local = mode === 'local' ? sandboxVenues.find(v => v.venueActor === item.venue.actor) : undefined;
  const base = local ? new URL(`${typeof window!=='undefined'&&window.parent!==window?'/apps/ourscene':'/apps'}/${local.id}/`, location.origin) : item.venue.value.appUrl ? new URL(httpsLink(item.venue.value.appUrl)) : undefined;
  if (!base) return;
  base.hash = ''; base.searchParams.set('view', 'community'); base.searchParams.set('event', item.event.eventId); return base.href;
}
