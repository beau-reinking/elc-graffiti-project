import type { AnnouncementReader, EligibilityPolicy, Observation, VenueDirectoryReader, SourceUpdate, EventReader } from './ports';
import type { Announcement } from '../domain/models';
import { FeedStore } from './feed-store';

export class FeedService {
  private directory?: Observation;
  private sources = new Map<string, { observation: Observation; revision: number; source?: string }>();
  private running = false;
  private eventSources = new Map<string, { observation: Observation; source?: string }>();
  constructor(private readonly venues: VenueDirectoryReader, private readonly posts: AnnouncementReader, private readonly policy: EligibilityPolicy, private readonly store: FeedStore, private readonly events?: EventReader) {}
  async start() {
    if (this.running) return;
    this.running = true;
    this.directory = this.venues.observeVenues(update => {
      if (!this.running) return;
      this.store.replaceVenues(update.records, update.health);
      const current = new Set(this.store.snapshot().venues.map(v => v.actor));
      for (const [actor, source] of this.eventSources) if (!current.has(actor)) {
        source.observation.stop(); if (source.source) this.store.removeSource(source.source); this.eventSources.delete(actor);
      }
      for (const [actor, source] of this.sources) if (!current.has(actor)) {
        source.observation.stop();
        if (source.source) this.store.removeSource(source.source);
        this.sources.delete(actor);
      }
      for (const actor of current) if (!this.sources.has(actor)) {
        // Observation callbacks are asynchronous by contract, after construction.
        const entry = { observation: undefined as unknown as Observation, revision: 0, source: undefined as string | undefined };
        this.sources.set(actor, entry);
        entry.observation = this.posts.observeAnnouncements([actor], update => this.receive(actor, entry, update));
      }
      if (this.events) for (const actor of current) if (!this.eventSources.has(actor)) {
        const entry = { observation: undefined as unknown as Observation, source: undefined as string | undefined };
        this.eventSources.set(actor, entry);
        entry.observation = this.events.observeEvents([actor], update => {
          if (!this.running || this.eventSources.get(actor) !== entry) return;
          entry.source = update.health.source; this.store.replaceEvents(actor, update.records, update.health);
        });
      }
    });
    await this.refresh();
  }
  private async receive(actor: string, entry: { observation: Observation; revision: number; source?: string }, update: SourceUpdate<Announcement>) {
    if (!this.running || this.sources.get(actor) !== entry) return;
    const revision = ++entry.revision;
    entry.source = update.health.source;
    const venue = this.store.snapshot().venues.find(v => v.actor === actor);
    if (!venue) return;
    const evaluated = await Promise.all(update.records.map(async announcement => ({ announcement, decision: await this.policy.evaluate(announcement, venue) })));
    // Async policies must never resurrect a removed venue or superseded snapshot.
    if (!this.running || this.sources.get(actor) !== entry || revision !== entry.revision) return;
    const accepted = evaluated.filter(e => e.decision.accepted).map(e => ({ announcement: e.announcement, endorsement: e.decision.endorsement }));
    this.store.replaceAnnouncements(actor, accepted, update.health);
  }
  async refresh() {
    if (!this.running) return;
    await this.directory?.refresh();
    await Promise.all([...this.sources.values()].map(source => source.observation.refresh()));
    await Promise.all([...this.eventSources.values()].map(source => source.observation.refresh()));
  }
  stop() {
    this.running = false;
    this.directory?.stop(); this.directory = undefined;
    for (const source of this.sources.values()) source.observation.stop();
    this.sources.clear();
    for (const source of this.eventSources.values()) source.observation.stop(); this.eventSources.clear();
  }
}
