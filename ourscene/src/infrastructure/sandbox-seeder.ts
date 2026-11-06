import type { Graffiti } from '@graffiti-garden/api';
import type { VenueConfig } from '../application/ports';
import { VenueProfile } from '../domain/models';
import { MusicEvent, resolveEvents, parseEvent, EventRemoval, type EventRecord, type EventInput } from '../domain/events';
import { addDays, localToInstant, todayIn } from '../domain/schedule';
import { directoryChannel } from './schemas';
import { eventChannel, eventSchema } from './event-repository';

/** Uses only known fictional local identities. Callers must enforce local mode. */
export async function seedSandbox(client: Graffiti, configs: readonly VenueConfig[], now = Date.now()): Promise<number> {
  if (configs.some(config => !config.venueActor.startsWith('did:local:') || !config.testHandle)) throw new Error('Demo fixtures require local sandbox identities.');
  let written = 0;
  for (const [index, config] of configs.entries()) {
    const session = { actor: config.venueActor }, profiles: VenueProfile[] = [];
    for await (const result of client.discover([directoryChannel], {})) {
      if (result.error) throw result.error;
      if (!result.tombstone && result.object.actor === session.actor) try { profiles.push(new VenueProfile(result.object, result.object.value)); } catch { /* Ignore unsupported directory records. */ }
    }
    profiles.sort((a, b) => b.published - a.published || (a.url < b.url ? 1 : -1));
    const previous = profiles[0];
    if (!previous || !previous.location || previous.value.address?.startsWith('Demo site ')) {
      const value = VenueProfile.draft({ name: previous?.name ?? config.brandName, ...(previous?.value.appUrl ? { appUrl: previous.value.appUrl } : {}), ...(previous?.value.website ? { website: previous.value.website } : {}), address: previous?.value.address?.startsWith('Demo site ') ? config.defaultAddress : previous?.value.address ?? config.defaultAddress,
        ...(config.defaultLocation ? { location: config.defaultLocation } : {}),
      }, Math.max(now, (previous?.published ?? 0) + 1));
      await client.post<{}>({ channels: [directoryChannel], value }, session); written++;
    }
    const records: EventRecord[] = [];
    for await (const result of client.discover([eventChannel(session.actor)], eventSchema)) {
      if (result.error) throw result.error;
      if (!result.tombstone) try { records.push(parseEvent(result.object, result.object.value)); } catch { /* Invalid records cannot become fixtures. */ }
    }
    const current = resolveEvents(records, session.actor), zone = config.defaultTimeZone ?? 'America/New_York', today = todayIn(zone, now);
    for (let slot = 0; slot < 3; slot++) {
      const eventId = `sandbox-v2:${config.id}:${slot}`;
      // A user's explicit demo deletion is respected on later loader runs.
      if (records.some(record => record instanceof EventRemoval && record.actor === session.actor && record.venueActor === session.actor && record.eventId === eventId)) continue;
      const existing = current.find(event => event.eventId === eventId);
      if (existing && existing.value.endsAt > now && existing.value.demoArtworkKey && existing.value.genres?.length) continue;
      const upgradeOnly = !!existing && existing.value.endsAt > now;
      const startsAt = slot === 0 ? Math.ceil((now + 2 * 3600_000) / 3600_000) * 3600_000
        : localToInstant(`${addDays(today, slot === 1 ? 1 : 5)}T${slot === 1 && index === 1 ? '23:00' : '19:00'}`, zone);
      const titles = [
        ['After Hours Quartet', 'Blue Hour Sessions', 'An Evening of Improvisation'],
        ['Independent Music Lives Here', 'Red Room After Midnight', 'The Next Wave'],
        ['Songwriters by Lantern Light', 'Acoustic Stories', 'Sunday Folk Circle'],
        ['Find Your Frequency', 'Signals After Dark', 'Experimental Futures'],
      ];
      const free = index === 2 && slot === 0, soldOut = index === 0 && slot === 1, cancelled = index === 3 && slot === 2;
      let input: EventInput = {
        title: titles[index % titles.length][slot], description: `${config.brandName} invites you into the room for an independent live music experience. This fictional sandbox event is for exploring schedules, map pins, and ticket states.`,
        startsAt, endsAt: startsAt + (slot === 1 && index === 1 ? 3 : 2) * 3600_000, doorsAt: startsAt - 30 * 60_000, timeZone: zone,
        performers: [`${config.brandName} Residents`, slot === 0 ? 'Special guests' : 'Independent artists'], ageRestriction: index === 3 ? '21+' : 'All ages',
        tickets: { kind: free ? 'free' : 'paid', availability: soldOut ? 'sold-out' : 'available', url: `https://example.com/demo-tickets/${config.id}/${slot}`, demo: true, ...(free ? {} : { price: 15 + index * 5, currency: 'USD' }) },
      };
      if (upgradeOnly && existing) input = { ...existing.value };
      input = { ...input, demoArtworkKey: `artist-${String(index*3+slot+1).padStart(2,'0')}`, imageAlt: ['Fictional jazz and soul performers live on stage','Fictional indie and blues performers live on stage','Fictional folk and acoustic performers live on stage','Fictional electronic and experimental performers live on stage'][index], genres: ([['Jazz','R&B/Soul'],['Indie','Rock','Blues'],['Folk','Country'],['Electronic','Experimental']] as const)[index] };
      const value = MusicEvent.draft(input, session.actor, eventId, (existing?.value.revision ?? 0) + 1, Math.max(now, (existing?.published ?? 0) + 1), upgradeOnly && existing ? existing.value.status : cancelled ? 'cancelled' : 'scheduled');
      await client.post<{}>({ channels: [eventChannel(session.actor)], value }, session); written++;
    }
  }
  return written;
}
