import { CommunityRecord, contentKey, projectCommunity, resolveUsernames, username, type ContentRef, type UsernameClaim } from '../domain/community';
import type { FeedSnapshot, IdentityPort, Observation, SourceHealth } from './ports';
import type { CommunityReader, CommunityWriter, UsernameReader, UsernameWriter } from './community-ports';
export class CommunityService {
  private records: readonly CommunityRecord[] = []; private claims: readonly UsernameClaim[] = []; private sources: SourceHealth[] = [];
  private observations: Observation[] = []; private listeners = new Set<() => void>(); private events?: FeedSnapshot;
  constructor(readonly venueActor: string, private readonly identity: IdentityPort, private readonly reader: CommunityReader, private readonly writer: CommunityWriter,
    private readonly usernames: UsernameReader, private readonly usernameWriter: UsernameWriter, private readonly now = Date.now, private readonly id = () => crypto.randomUUID() as string) {}
  start() { if (this.observations.length) return; this.observations = [this.reader.observeCommunity(this.venueActor, update => { this.records = update.records; this.health(update.health); }), this.usernames.observeUsernames(update => { this.claims = update.records; this.health(update.health); })]; }
  private health(health: SourceHealth) { this.sources = [...this.sources.filter(s => s.source !== health.source), health]; this.emit(); }
  private emit() { for (const listener of this.listeners) listener(); }
  subscribe(listener: () => void) { this.listeners.add(listener); listener(); return () => { this.listeners.delete(listener); }; }
  setEvents(snapshot: FeedSnapshot) { this.events = snapshot; this.emit(); }
  snapshot() { const names = resolveUsernames(this.claims), session = this.identity.currentSession(); return { ...projectCommunity(this.records, this.venueActor, session?.actor === this.venueActor), names: names.actors, username: session ? names.actors.get(session.actor) : undefined, sources: this.sources, eventsReady: !!this.events?.sources.some(s => !!s.lastSuccess && (s.source.startsWith('events:') || (s.source === 'directory' && !this.events?.venues.length))), events: this.events?.events ?? [] }; }
  async refresh() { await Promise.all(this.observations.map(o => o.refresh())); }
  private session(requireName = true) { const session = this.identity.currentSession(); if (!session) throw new Error('Sign in before publishing.'); if (requireName && !resolveUsernames(this.claims).actors.has(session.actor)) throw new Error('Choose an available username before publishing.'); return session; }
  async claimName(input: string) {
    const session = this.session(false), name = username(input); await this.refresh();
    const source = this.sources.find(s => s.source === 'usernames'); if (!source?.lastSuccess || source.stale || source.loading) throw new Error('Username discovery is unavailable. Try again when connected.');
    const taken = resolveUsernames(this.claims).names.get(name); if (taken && taken.actor !== session.actor) throw new Error('That username is already claimed.');
    const last = this.claims.filter(c => c.actor === session.actor).reduce((max,c) => Math.max(max,c.value.published),0);
    await this.usernameWriter.claim({ type: 'UsernameClaim', schemaVersion: 1, username: name, published: Math.max(this.now(),last+1) }, session); await this.refresh();
    if (this.snapshot().username !== name) throw new Error('A conflicting username claim won. Choose another username.');
  }
  async post(body: string, imageUrl?: string, eventId?: string) {
    const session = this.session();
    if (eventId && !this.events?.events.some(item => item.event.venueActor === this.venueActor && item.event.eventId === eventId)) throw new Error('Choose an available event at this venue.');
    const value = new CommunityRecord({ actor: session.actor, url: 'draft:post' }, { type: 'CommunityPost', schemaVersion: 1, id: this.id(), venueActor: this.venueActor, published: this.now(), body, ...(imageUrl ? { imageUrl } : {}), ...(eventId ? { eventId } : {}) }).value;
    await this.writer.publish(value, session); await this.refresh();
  }
  async reply(body: string, root: ContentRef, parent: ContentRef) {
    const session = this.session(), projection = projectCommunity(this.records, this.venueActor);
    const rootNode = projection.posts.find(p => contentKey(p.ref) === contentKey(root));
    const find = (nodes: typeof projection.posts): boolean => nodes.some(n => contentKey(n.ref) === contentKey(parent) || find(n.children));
    if (!rootNode || !find([rootNode])) throw new Error('This conversation is no longer available.');
    const value = new CommunityRecord({ actor: session.actor, url: 'draft:reply' }, { type: 'CommunityReply', schemaVersion: 1, id: this.id(), venueActor: this.venueActor, published: this.now(), body, root, parent }).value;
    await this.writer.publish(value, session); await this.refresh();
  }
  async remove(record: CommunityRecord) {
    const session = this.session(false); if (session.actor !== record.actor || !['CommunityPost','CommunityReply'].includes(record.value.type)) throw new Error('Only the author can delete this content.');
    const marker = new CommunityRecord({ actor: session.actor, url: 'draft:removal' }, { type: 'CommunityRemoval', schemaVersion: 1, id: this.id(), targetId: record.value.id, contentPublished: record.value.published, ...(record.value.type === 'CommunityPost' ? { eventId: record.value.eventId } : record.value.type === 'CommunityReply' ? { root:record.value.root,parent:record.value.parent } : {}), venueActor: this.venueActor, published: this.now() }).value;
    const warnings = await this.writer.remove(record, marker, session); await this.refresh(); return warnings;
  }
  async moderate(target: ContentRef, hidden: boolean) {
    const session = this.session(false); if (session.actor !== this.venueActor) throw new Error('Only the venue owner can moderate this community.');
    const previous = this.records.filter(r => r.value.type === 'CommunityModeration').reduce((max,r) => Math.max(max,r.value.published),0);
    const value = new CommunityRecord({ actor: session.actor, url: 'draft:moderation' }, { type: 'CommunityModeration', schemaVersion: 1, id: this.id(), venueActor: this.venueActor, published: Math.max(this.now(),previous+1), target, hidden }).value;
    await this.writer.publish(value, session); await this.refresh();
  }
  stop() { for (const o of this.observations) o.stop(); this.observations = []; this.listeners.clear(); }
}
