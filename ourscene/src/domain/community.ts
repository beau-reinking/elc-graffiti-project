import { object, text, timestamp, httpsLink, type Metadata } from './models';
export interface ContentRef { readonly actor: string; readonly id: string }
export const contentKey = (ref: ContentRef) => JSON.stringify([ref.actor, ref.id]);
function reference(value: unknown): ContentRef { const v = object(value); return Object.freeze({ actor: text(v.actor, 'Reference author', 2048), id: text(v.id, 'Reference ID', 200) }); }
export function username(input: unknown): string { const name = text(input, 'Username', 24).toLowerCase(); if (!/^[a-z0-9_]{3,24}$/.test(name)) throw new Error('Use 3–24 letters, digits or underscores.'); return name; }
export interface UsernameValue { type: 'UsernameClaim'; schemaVersion: 1; username: string; published: number }
export class UsernameClaim implements Metadata {
  readonly url: string; readonly actor: string; readonly value: Readonly<UsernameValue>;
  constructor(meta: Metadata, value: unknown) { const v = object(value); if (v.type !== 'UsernameClaim' || v.schemaVersion !== 1) throw new Error('Unsupported username claim.'); this.url = text(meta.url, 'URL', 4096); this.actor = text(meta.actor, 'Author', 2048); this.value = Object.freeze({ type: 'UsernameClaim', schemaVersion: 1, username: username(v.username), published: timestamp(v.published) }); Object.freeze(this); }
}
/** One current claim per actor, then the smallest URL wins each name. */
export function resolveUsernames(claims: readonly UsernameClaim[]) {
  const current = new Map<string, UsernameClaim>();
  for (const claim of claims) { const old = current.get(claim.actor); if (!old || claim.value.published > old.value.published || (claim.value.published === old.value.published && claim.url < old.url)) current.set(claim.actor, claim); }
  const names = new Map<string, UsernameClaim>();
  for (const claim of current.values()) { const old = names.get(claim.value.username); if (!old || claim.url < old.url) names.set(claim.value.username, claim); }
  const actors = new Map<string, string>(); for (const [name, claim] of names) actors.set(claim.actor, name);
  return { names, actors };
}
interface BaseValue { schemaVersion: 1; id: string; venueActor: string; published: number }
export interface PostValue extends BaseValue { type: 'CommunityPost'; body: string; imageUrl?: string; eventId?: string }
export interface ReplyValue extends BaseValue { type: 'CommunityReply'; body: string; root: ContentRef; parent: ContentRef }
export interface RemovalValue extends BaseValue { type: 'CommunityRemoval'; targetId: string; contentPublished: number; eventId?: string; root?: ContentRef; parent?: ContentRef }
export interface ModerationValue extends BaseValue { type: 'CommunityModeration'; target: ContentRef; hidden: boolean }
export type CommunityValue = PostValue | ReplyValue | RemovalValue | ModerationValue;
export class CommunityRecord implements Metadata {
  readonly url: string; readonly actor: string; readonly value: Readonly<CommunityValue>;
  constructor(meta: Metadata, input: unknown) {
    this.url = text(meta.url, 'URL', 4096); this.actor = text(meta.actor, 'Author', 2048); const v = object(input);
    if (v.schemaVersion !== 1) throw new Error('Unsupported community schema version.');
    const base = { schemaVersion: 1 as const, id: text(v.id, 'Content ID', 200), venueActor: text(v.venueActor, 'Venue', 2048), published: timestamp(v.published) };
    switch (v.type) {
      case 'CommunityPost': this.value = Object.freeze({ ...base, type: v.type, body: text(v.body, 'Post', 4000), ...(v.imageUrl === undefined ? {} : { imageUrl: httpsLink(v.imageUrl) }), ...(v.eventId === undefined ? {} : { eventId: text(v.eventId, 'Event ID', 200) }) }); break;
      case 'CommunityReply': this.value = Object.freeze({ ...base, type: v.type, body: text(v.body, 'Reply', 2000), root: reference(v.root), parent: reference(v.parent) }); break;
      case 'CommunityRemoval': this.value = Object.freeze({ ...base, type: v.type, targetId: text(v.targetId, 'Target ID', 200), contentPublished: timestamp(v.contentPublished), ...(v.eventId === undefined ? {} : { eventId: text(v.eventId,'Event ID',200) }), ...(v.root === undefined ? {} : { root: reference(v.root) }), ...(v.parent === undefined ? {} : { parent: reference(v.parent) }) }); break;
      case 'CommunityModeration': if (typeof v.hidden !== 'boolean') throw new Error('Invalid moderation action.'); this.value = Object.freeze({ ...base, type: v.type, target: reference(v.target), hidden: v.hidden }); break;
      default: throw new Error('Unsupported community record.');
    }
    Object.freeze(this);
  }
  get ref(): ContentRef { return { actor: this.actor, id: this.value.id }; }
}
export interface ThreadNode { readonly ref: ContentRef; readonly record?: CommunityRecord; readonly eventId?: string; readonly removed: boolean; readonly hidden: boolean; readonly ownHidden: boolean; readonly children: readonly ThreadNode[] }
export interface CommunityProjection { readonly posts: readonly ThreadNode[]; readonly diagnostics: readonly string[] }
export function projectCommunity(records: readonly CommunityRecord[], venueActor: string, owner = false): CommunityProjection {
  const content = new Map<string, CommunityRecord>(), removals = new Map<string, CommunityRecord>(), moderation = new Map<string, CommunityRecord>(), diagnostics: string[] = [];
  const newer = (a: CommunityRecord,b: CommunityRecord) => a.value.published > b.value.published || (a.value.published === b.value.published && a.url > b.url);
  for (const record of records) {
    const v = record.value; if (v.venueActor !== venueActor) continue;
    if (v.type === 'CommunityRemoval') { const key = contentKey({ actor: record.actor,id: v.targetId }); const old = removals.get(key); if (!old || newer(record,old)) removals.set(key,record); continue; }
    if (v.type === 'CommunityModeration') {
      if (record.actor !== venueActor) { diagnostics.push('Ignored unauthorized moderation.'); continue; }
      const key = contentKey(v.target), old = moderation.get(key); if (!old || newer(record,old)) moderation.set(key,record); continue;
    }
    const key = contentKey(record.ref), old = content.get(key); if (!old || record.url < old.url) content.set(key,record);
  }
  const contexts = new Map<string,{ root?: ContentRef; parent?: ContentRef; eventId?: string; published: number }>();
  for (const [key,record] of content) {
    const v = record.value;
    if (v.type === 'CommunityPost') contexts.set(key,{ eventId:v.eventId,published:v.published });
    if (v.type === 'CommunityReply') contexts.set(key,{ root:v.root,parent:v.parent,published:v.published });
  }
  for (const [key,record] of removals) if (record.value.type === 'CommunityRemoval') { const v = record.value; contexts.set(key,{ root:v.root,parent:v.parent,eventId:v.eventId,published:v.contentPublished }); }
  const valid = new Set<string>();
  function validate(key: string,path = new Set<string>()): boolean {
    if (valid.has(key)) return true;
    const current = contexts.get(key); if (!current || path.has(key)) return false;
    if (!current.root && !current.parent) { valid.add(key); return true; }
    if (!current.root || !current.parent) return false;
    const rootKey = contentKey(current.root), parentKey = contentKey(current.parent), root = contexts.get(rootKey), parent = contexts.get(parentKey);
    if (!root || root.root || root.parent || !parent) return false;
    if (parent.root ? contentKey(parent.root) !== rootKey : parentKey !== rootKey) return false;
    const next = new Set(path); next.add(key); if (!validate(parentKey,next)) return false;
    valid.add(key); return true;
  }
  const children = new Map<string,string[]>(), roots: string[] = [];
  for (const [key,context] of contexts) {
    if (!validate(key)) { diagnostics.push('Ignored a reply with missing, cyclic or inconsistent ancestry.'); continue; }
    if (!context.parent) roots.push(key);
    else { const parent = contentKey(context.parent), list = children.get(parent) ?? []; list.push(key); children.set(parent,list); }
  }
  const compare = (a: string,b: string) => (contexts.get(a)?.published ?? 0) - (contexts.get(b)?.published ?? 0) || a.localeCompare(b);
  function build(key: string,inherited = false): ThreadNode | undefined {
    const action = moderation.get(key)?.value, ownHidden = action?.type === 'CommunityModeration' && action.hidden, hidden = inherited || ownHidden;
    if (hidden && !owner) return;
    const isRemoved = removals.has(key), nested = [...(children.get(key) ?? [])].sort(compare).map(child => build(child,hidden)).filter((n): n is ThreadNode => !!n);
    if (isRemoved && !nested.length) return;
    const [actor,id] = JSON.parse(key) as [string,string];
    return Object.freeze({ ref:Object.freeze({ actor,id }), record:isRemoved ? undefined : content.get(key), eventId:contexts.get(key)?.eventId, removed:isRemoved,hidden,ownHidden,children:Object.freeze(nested) });
  }
  return { posts: roots.sort((a,b) => -compare(a,b)).map(key => build(key)).filter((n): n is ThreadNode => !!n), diagnostics };
}
