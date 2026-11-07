import { Announcement, VenueProfile, type AnnouncementInput, type VenueProfileInput } from '../domain/models';
import type { IdentityPort, VenueConfig, VenueProfileWriter, AnnouncementWriter } from './ports';

export class VenuePublishingService {
  constructor(
    private readonly config: VenueConfig,
    private readonly identity: IdentityPort,
    private readonly profiles: VenueProfileWriter,
    private readonly announcements: AnnouncementWriter,
    private readonly now: () => number = Date.now,
  ) {}
  private requireSession() {
    const session = this.identity.currentSession();
    if (!this.config.venueActor) throw new Error('Configure this venue’s Graffiti actor before publishing.');
    if (!session || session.actor !== this.config.venueActor) throw new Error('Sign in with this venue’s configured identity before publishing.');
    return session;
  }
  async registerVenue(input: VenueProfileInput): Promise<VenueProfile> {
    const session = this.requireSession();
    return this.profiles.publishProfile(VenueProfile.draft(input, this.now()), session);
  }
  async publish(input: AnnouncementInput): Promise<Announcement> {
    const session = this.requireSession();
    return this.announcements.publishAnnouncement(Announcement.draft(input, this.config.venueActor, this.now()), session);
  }
  async remove(url: string): Promise<void> {
    const session = this.requireSession();
    if (!url.trim()) throw new Error('An announcement URL is required.');
    await this.announcements.remove(url, session);
  }
}
