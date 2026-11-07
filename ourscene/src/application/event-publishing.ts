import { EventRemoval, MusicEvent, type EventInput } from '../domain/events';
import type { EventWriter, IdentityPort, VenueConfig } from './ports';

export class EventPublishingService {
  constructor(private readonly config: VenueConfig, private readonly identity: IdentityPort, private readonly writer: EventWriter,
    private readonly now = Date.now, private readonly newId = () => crypto.randomUUID() as string) {}
  private session(current?: MusicEvent) {
    const session = this.identity.currentSession();
    if (!this.config.venueActor || session?.actor !== this.config.venueActor) throw new Error('Sign in with this venue’s configured identity before publishing.');
    if (current && (current.actor !== session.actor || current.venueActor !== session.actor)) throw new Error('Only this event’s venue can change it.');
    return session;
  }
  async publish(input: EventInput) {
    const session = this.session();
    return this.writer.publishEvent(MusicEvent.draft(input, session.actor, this.newId(), 1, this.now()), session);
  }
  async revise(current: MusicEvent, input: EventInput) {
    const session = this.session(current);
    return this.writer.publishEvent(MusicEvent.draft(input, session.actor, current.eventId, current.value.revision + 1, Math.max(this.now(), current.published + 1), current.value.status), session);
  }
  async cancel(current: MusicEvent) {
    const session = this.session(current);
    return this.writer.publishEvent(MusicEvent.draft(current.value, session.actor, current.eventId, current.value.revision + 1, Math.max(this.now(), current.published + 1), 'cancelled'), session);
  }
  async remove(current: MusicEvent) {
    const session = this.session(current);
    const removal = new EventRemoval({ actor: session.actor, url: 'draft:removal' }, {
      type: 'EventRemoval', schemaVersion: 1, eventId: current.eventId, venueActor: session.actor,
      revision: current.value.revision + 1, published: Math.max(this.now(), current.published + 1),
    });
    return this.writer.removeEvent(removal.value, session);
  }
}
