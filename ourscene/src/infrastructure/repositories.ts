import type { Graffiti } from '@graffiti-garden/api';
import { Announcement, VenueProfile, type AnnouncementValue, type VenueProfileValue } from '../domain/models';
import type { AnnouncementReader, AnnouncementWriter, Session, SourceListener, VenueDirectoryReader, VenueProfileWriter } from '../application/ports';
import { GraffitiObservation, browserPolling, type PollEnvironment } from './observation';
import { announcementChannel, announcementSchema, directoryChannel, profileSchema } from './schemas';

export class GraffitiVenueRepository implements VenueDirectoryReader, VenueProfileWriter {
  constructor(private readonly client: Graffiti, private readonly environment: PollEnvironment = browserPolling) {}
  observeVenues(listener: SourceListener<VenueProfile>) {
    return new GraffitiObservation(this.client, [directoryChannel], profileSchema, object => new VenueProfile(object, object.value), 'directory', listener, this.environment);
  }
  async publishProfile(value: Readonly<VenueProfileValue>, session: Session) {
    const object = await this.client.post<{}>({ value, channels: [directoryChannel] }, session);
    return new VenueProfile(object, object.value);
  }
}
export class GraffitiAnnouncementRepository implements AnnouncementReader, AnnouncementWriter {
  constructor(private readonly client: Graffiti, private readonly environment: PollEnvironment = browserPolling) {}
  observeAnnouncements(venueActors: readonly string[], listener: SourceListener<Announcement>) {
    const actors = [...new Set(venueActors)].sort();
    if (!actors.length) throw new Error('At least one venue actor is required.');
    return new GraffitiObservation(this.client, actors.map(announcementChannel), announcementSchema, object => new Announcement(object, object.value), `announcements:${actors.join(',')}`, listener, this.environment);
  }
  async publishAnnouncement(value: Readonly<AnnouncementValue>, session: Session) {
    const object = await this.client.post<{}>({ value, channels: [announcementChannel(value.venueActor)] }, session);
    return new Announcement(object, object.value);
  }
  async remove(url: string, session: Session) { await this.client.delete(url, session); }
}
