import type { Announcement, VenueProfile } from '../domain/models';
import type { EligibilityDecision, EligibilityPolicy, EndorsementReader } from './ports';

export class VenueOwnedPolicy implements EligibilityPolicy {
  async evaluate(post: Announcement, venue: VenueProfile): Promise<EligibilityDecision> {
    const accepted = post.actor === venue.actor && post.venueActor === venue.actor;
    return { accepted, reason: accepted ? 'Published by this venue identity' : 'Author does not match the claimed venue' };
  }
}

/** Opt-in future policy. Production composition currently uses VenueOwnedPolicy. */
export class VenueEndorsedPolicy implements EligibilityPolicy {
  constructor(private readonly endorsements: EndorsementReader) {}
  async evaluate(post: Announcement, venue: VenueProfile): Promise<EligibilityDecision> {
    const owned = await new VenueOwnedPolicy().evaluate(post, venue);
    if (owned.accepted) return owned;
    if (post.venueActor !== venue.actor) return { accepted: false, reason: 'Wrong target venue' };
    const records = await this.endorsements.findEndorsements(post.url, venue.actor);
    const endorsement = records.find(e => e.actor === venue.actor && e.value.venueActor === venue.actor && e.value.targetUrl === post.url);
    return { accepted: !!endorsement, reason: endorsement ? 'Endorsed by this venue identity' : 'No valid venue endorsement', ...(endorsement ? { endorsement } : {}) };
  }
}
