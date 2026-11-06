import type { Graffiti } from '@graffiti-garden/api';
import { parseEvent, MusicEvent, type EventRecord, type EventValue, type EventRemovalValue } from '../domain/events';
import type { EventReader, EventWriter, Session, SourceListener } from '../application/ports';
import { GraffitiObservation, browserPolling, type PollEnvironment } from './observation';

export const eventChannel = (actor: string) => `music-venues:v1:events:${encodeURIComponent(actor)}`;
// Filtering handles version/type; domain constructors validate the full union.
export const eventSchema = { type: 'object', required: ['value'], properties: { value: {
  type: 'object', required: ['type', 'schemaVersion', 'eventId', 'venueActor', 'revision', 'published'],
  properties: { type: { enum: ['MusicEvent', 'EventRemoval'] }, schemaVersion: { const: 1 }, eventId: { type: 'string' }, venueActor: { type: 'string' }, revision: { type: 'integer', minimum: 1 }, published: { type: 'integer', minimum: 0 } },
} } } as const;
export class GraffitiEventRepository implements EventReader, EventWriter {
  constructor(private readonly client: Graffiti, private readonly environment: PollEnvironment = browserPolling) {}
  observeEvents(actors: readonly string[], listener: SourceListener<EventRecord>) {
    if (!actors.length) throw new Error('At least one venue actor is required.');
    return new GraffitiObservation(this.client, [...new Set(actors)].map(eventChannel), eventSchema, raw => parseEvent(raw, raw.value), `events:${[...actors].sort().join(',')}`, listener, this.environment);
  }
  async publishEvent(value: Readonly<EventValue>, session: Session) {
    const object = await this.client.post<{}>({ value, channels: [eventChannel(value.venueActor)] }, session);
    return new MusicEvent(object, object.value);
  }
  async removeEvent(value: Readonly<EventRemovalValue>, session: Session): Promise<readonly string[]> {
    // Publish the terminal marker first. It is never removed by this workflow.
    // Even a partial historical cleanup cannot re-activate the event.
    await this.client.post<{}>({ value, channels: [eventChannel(value.venueActor)] }, session);
    const warnings: string[] = [], targets: string[] = [];
    try {
      for await (const result of this.client.discover([eventChannel(value.venueActor)], eventSchema, session)) {
        if (result.error) { warnings.push(result.error.message); continue; }
        if (!result.tombstone && result.object.actor === session.actor) {
          const record = parseEvent(result.object, result.object.value);
          if (record instanceof MusicEvent && record.eventId === value.eventId) targets.push(record.url);
        }
      }
      for (const url of targets) try { await this.client.delete(url, session); } catch { warnings.push(`Historical revision could not be removed: ${url}`); }
    } catch { warnings.push('Some event history could not be inspected for cleanup. The event remains withdrawn.'); }
    return Object.freeze(warnings);
  }
}
