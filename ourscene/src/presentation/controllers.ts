import type { FeedView, IdentityPort } from '../application/ports';
import { FeedService } from '../application/feed-service';
import { FeedStore } from '../application/feed-store';
import { VenuePublishingService } from '../application/publishing';
import { EventPublishingService } from '../application/event-publishing';
import type { MusicEvent } from '../domain/events';
import type { VenueScreen } from './venue-view';
import { safeError } from './dom';

export class AggregatorController {
  private unsubscribe?: () => void;
  constructor(private readonly feed: FeedService, private readonly store: FeedStore, private readonly view: FeedView) {}
  async start() { if (this.unsubscribe) return; this.unsubscribe = this.store.subscribe(snapshot => this.view.render(snapshot)); await this.feed.start(); }
  refresh() { return this.feed.refresh(); }
  stop() { this.feed.stop(); this.unsubscribe?.(); this.unsubscribe = undefined; }
  dispose() { this.stop(); this.view.dispose(); }
}
export class VenueAppController {
  private readonly feedController: AggregatorController;
  private unsubscribe?: () => void;
  private busy = false;
  constructor(private readonly service: VenuePublishingService, private readonly identity: IdentityPort, feed: FeedService, store: FeedStore, private readonly view: VenueScreen, private readonly events: EventPublishingService, discussionUrl?: import('./event-detail-view').EventActions['discussionUrl']) {
    this.feedController = new AggregatorController(feed, store, view);
    view.bind({ discussionUrl, login: () => { void this.execute(() => identity.login()); }, logout: () => { void this.execute(() => identity.logout()); },
      register: () => { void this.registerVenue(); }, publish: () => { void this.publishEvent(); }, remove: event => { void this.deleteEvent(event); }, cancel: event => { void this.cancelEvent(event); }, refresh: () => { void this.execute(() => this.feedController.refresh()); } });
  }
  async start() { this.unsubscribe = this.identity.subscribe(state => this.view.setIdentity(state)); await this.feedController.start(); }
  private async execute(action: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true;
    try {
      // Invoke before disabling controls: form values must be read while enabled,
      // and login/logout retain the originating browser user gesture.
      const pending = action();
      this.view.setBusy(true);
      await pending;
    } catch (error) { this.view.notify(safeError(error), true); }
    finally { this.busy = false; this.view.setBusy(false); }
  }
  registerVenue() { return this.execute(async () => {
    const input = this.view.readProfile(); await this.service.registerVenue(input);
    await this.feedController.refresh(); this.view.notify('Venue profile published. The aggregator can now discover you.');
  }); }
  publishEvent() { return this.execute(async () => {
    const input = this.view.readEvent(), editing = this.view.editingEvent();
    if (editing) await this.events.revise(editing, input); else await this.events.publish(input);
    this.view.clearEventForm(); await this.feedController.refresh(); this.view.notify(editing ? 'Event revision published.' : 'Event published. OurScene can now discover it.');
  }); }
  deleteEvent(event: MusicEvent) { return this.execute(async () => {
    const warnings = await this.events.remove(event); await this.feedController.refresh();
    this.view.notify(warnings.length ? `Event withdrawn. Some historical data could not be cleaned up: ${warnings.join(' ')}` : 'Event deleted. Its removal marker prevents older revisions from reappearing.', warnings.length > 0);
  }); }
  cancelEvent(event: MusicEvent) { return this.execute(async () => { await this.events.cancel(event); await this.feedController.refresh(); this.view.notify('Event cancelled. Ticket sales are disabled and it is excluded from default discovery.'); }); }
  dispose() { this.unsubscribe?.(); this.feedController.dispose(); }
}
