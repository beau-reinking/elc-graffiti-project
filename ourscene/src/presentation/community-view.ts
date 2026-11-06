import type { CommunityService } from '../application/community-service';
import type { SessionIdentityPort } from '../application/community-ports';
import type { IdentityState, VenueConfig } from '../application/ports';
import { contentKey, type ContentRef, type ThreadNode } from '../domain/community';
import { node, required, safeError } from './dom';
export class CommunityView {
  private identityState: IdentityState = { initialized: false }; private unsubscribers: (() => void)[] = []; private busy = false;
  private filter = new URL(location.href).searchParams.get('event') ?? ''; private signature = ''; private editingName = false; private replying?: { root: ContentRef; parent: ContentRef };
  constructor(private readonly root: HTMLElement, private readonly config: VenueConfig, private readonly service: CommunityService, identity: SessionIdentityPort) {
    root.innerHTML = `<section class="community-account"><h2>Your community</h2><div class="community-signin"><button type="button" data-visitor-login>Visitor sign in</button><button type="button" class="secondary" data-owner-login>Venue owner sign in</button><button type="button" class="secondary" data-signout hidden>Sign out</button><label>Active account<select data-session aria-label="Active account"></select></label></div><p data-account-state role="status"></p><form data-username-form hidden><label>Choose a username<input name="username" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" required autocomplete="username"></label><p class="muted">Your posts and underlying Graffiti authorship are public. Identifiers are hidden in this interface, but this does not make you anonymous. Username claims are decentralized and can conflict later.</p><button type="submit">Save username</button></form><button type="button" class="text-button" data-change-name hidden>Change username</button></section><section class="community-board"><div class="section-heading"><h2>Community</h2><button class="secondary" type="button" data-community-refresh>Refresh community</button></div><label>Show posts<select data-event-filter aria-label="Community event filter"></select></label><p data-event-context></p><p data-community-health role="status"></p><form data-post-form><h3>Start a conversation</h3><label>Your post<textarea name="body" required maxlength="4000" rows="3"></textarea></label><label>Photo URL <span class="optional">optional, HTTPS</span><input name="imageUrl" type="url" placeholder="https://…"></label><label>About an event <span class="optional">optional</span><select name="eventId" aria-label="Tag an event"></select></label><button type="submit">Publish post</button></form><p data-community-status role="status" aria-live="polite"></p><div data-community-posts></div><form data-reply-form hidden><h3>Write a reply</h3><label>Reply<textarea name="reply" required maxlength="2000" rows="3"></textarea></label><button type="submit">Publish reply</button><button type="button" class="secondary" data-cancel-reply>Cancel reply</button></form></section>`;
    const bind = (selector: string, event: string, callback: (e: Event) => void) => { const el = required(root,selector); el.addEventListener(event, callback); this.unsubscribers.push(() => el.removeEventListener(event,callback)); };
    bind('[data-visitor-login]','click',() => void this.run(() => identity.loginVisitor()));
    bind('[data-owner-login]','click',() => void this.run(() => identity.loginOwner()));
    bind('[data-signout]','click',() => void this.run(() => identity.logout()));
    bind('[data-session]','change',e => { identity.selectSession((e.target as HTMLSelectElement).value); });
    bind('[data-change-name]','click',() => { this.editingName = true; required(root,'[data-username-form]').hidden = false; required<HTMLInputElement>(root,'[name=username]').focus(); });
    bind('[data-username-form]','submit',e => { e.preventDefault(); void this.run(async () => { await service.claimName(required<HTMLInputElement>(root,'[name=username]').value); this.editingName = false; required(root,'[data-username-form]').hidden = true; this.notify('Username saved.'); }); });
    bind('[data-community-refresh]','click',() => void this.run(() => service.refresh()));
    bind('[data-event-filter]','change',e => { this.filter = (e.target as HTMLSelectElement).value; this.replying = undefined; this.setRoute(); this.draw(); });
    bind('[data-post-form]','submit',e => { e.preventDefault(); const form = e.currentTarget as HTMLFormElement, data = new FormData(form); void this.run(async () => { await service.post(String(data.get('body')), String(data.get('imageUrl') ?? ''), String(data.get('eventId') ?? '')); form.reset(); this.notify('Post published.'); }); });
    bind('[data-reply-form]','submit',e => { e.preventDefault(); const draft = this.replying, form = e.currentTarget as HTMLFormElement, data = new FormData(form); if (draft) void this.run(async () => { await service.reply(String(data.get('reply')), draft.root, draft.parent); this.replying = undefined; form.reset(); this.notify('Reply published.'); }); });
    bind('[data-cancel-reply]','click',() => { this.replying = undefined; this.draw(); });
    this.unsubscribers.push(identity.subscribe(state => { this.identityState = state; this.draw(); }));
    this.unsubscribers.push(service.subscribe(() => this.draw()));
    service.start();
  }
  private setRoute() { const url = new URL(location.href); url.searchParams.set('view','community'); if (this.filter) url.searchParams.set('event',this.filter); else url.searchParams.delete('event'); history.replaceState(null,'',url); }
  private notify(message: string, error = false) { const el = required(this.root,'[data-community-status]'); el.textContent = message; el.classList.toggle('error',error); }
  private async run(action: () => Promise<unknown>) { if (this.busy) return; this.busy = true; try { const pending = action(); this.draw(); await pending; } catch (error) { this.notify(safeError(error),true); } finally { this.busy = false; this.draw(); } }
  private draw() {
    const state = this.service.snapshot(), session = this.identityState.session, owner = session?.actor === this.config.venueActor;
    const accounts = required<HTMLSelectElement>(this.root,'[data-session]'); accounts.replaceChildren();
    for (const [index, account] of (this.identityState.sessions ?? []).entries()) { const option = node('option','',state.names.get(account.actor) ?? (account.actor === this.config.venueActor ? 'Venue owner' : `Account ${index+1} · choose username`)); option.value = account.actor; accounts.append(option); }
    accounts.value = session?.actor ?? ''; accounts.disabled = this.busy || !accounts.options.length;
    required(this.root,'[data-account-state]').textContent = this.identityState.error ?? (!this.identityState.initialized ? 'Restoring accounts…' : session ? state.username ? `Signed in as @${state.username}${owner ? ' · Venue owner' : ''}` : 'Choose an available username to post or reply.' : 'Browse freely. Sign in to post and reply.');
    required(this.root,'[data-signout]').hidden = !session;
    required(this.root,'[data-change-name]').hidden = !session || !state.username;
    required(this.root,'[data-username-form]').hidden = !session || (!!state.username && !this.editingName);
    const filterSelect = required<HTMLSelectElement>(this.root,'[data-event-filter]'), tag = required<HTMLSelectElement>(this.root,'[name=eventId]'), tagValue = tag.value;
    filterSelect.replaceChildren(); const all = node('option','','All posts'); all.value = ''; filterSelect.append(all);
    tag.replaceChildren(); const none = node('option','','No event tag'); none.value = ''; tag.append(none);
    const events = new Map(state.events.map(item => [item.event.eventId,item.event]));
    const referenced = new Set(state.posts.map(n => n.eventId).filter((id): id is string => !!id)); if (this.filter) referenced.add(this.filter);
    for (const event of events.values()) { const option = node('option','',event.value.title + (event.value.status === 'cancelled' ? ' · Cancelled' : '')); option.value = event.eventId; filterSelect.append(option); tag.append(option.cloneNode(true)); referenced.delete(event.eventId); }
    for (const id of referenced) { const option = node('option','','Withdrawn or unavailable event'); option.value = id; filterSelect.append(option); }
    filterSelect.value = this.filter; tag.value = events.has(tagValue) ? tagValue : events.has(this.filter) ? this.filter : '';
    const selected = events.get(this.filter);
    required(this.root,'[data-event-context]').textContent = !this.filter ? 'Conversations from this venue’s community.' : !state.eventsReady ? 'Loading this event…' : selected ? `${selected.value.title}${selected.value.status === 'cancelled' ? ' · Cancelled — the conversation stays open.' : ''}` : 'This event is withdrawn or unavailable. Existing conversations remain readable; new event tags are disabled.';
    required(this.root,'[data-community-health]').textContent = state.sources.some(s => s.stale) ? 'A source is unavailable. Showing cached conversations.' : state.sources.length < 2 || state.sources.some(s => s.loading) ? 'Discovering conversations…' : state.diagnostics.length ? `${state.diagnostics.length} malformed conversation record(s) ignored.` : 'Synced · public community';
    for (const form of this.root.querySelectorAll<HTMLFormElement>('[data-post-form],[data-reply-form]')) for (const input of form.querySelectorAll<HTMLInputElement>('input,textarea,select,button')) input.disabled = this.busy || !session || !state.username;
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-visitor-login],[data-owner-login],[data-signout],[data-username-form] button')) button.disabled = this.busy || !this.identityState.initialized;
    const signature = JSON.stringify([state.posts, state.sources.map(s => [s.source,!!s.lastSuccess]), state.events.map(i => i.event.url), [...state.names], session?.actor, this.filter, this.busy]);
    if (signature !== this.signature) {
      this.signature = signature; const feed = required(this.root,'[data-community-posts]'); feed.replaceChildren();
      const posts = state.posts.filter(n => !this.filter || n.eventId === this.filter);
      for (const post of posts) feed.append(this.thread(post,post.ref,0,state.names,owner));
      if (!posts.length) feed.append(node('p','empty-state',state.sources.some(s => s.source.startsWith('community:') && !!s.lastSuccess) ? 'No posts here yet. Start the conversation.' : 'Discovering conversations…'));
    }
    required(this.root,'[data-reply-form]').hidden = !this.replying;
  }
  private thread(current: ThreadNode, root: ContentRef, depth: number, names: Map<string,string>, owner: boolean): HTMLElement {
    const article = node('article',`community-thread${depth ? ' reply-thread' : ''}${current.hidden ? ' moderated-thread' : ''}`); article.style.setProperty('--reply-depth',String(Math.min(depth,3)));
    const record = current.record, value = record?.value;
    article.append(node('strong','community-author',current.removed ? 'Deleted content' : `@${names.get(current.ref.actor) ?? 'username_unavailable'}`));
    if (current.hidden) article.append(node('span','moderation-label','Hidden by venue · public storage may retain this content'));
    if (value && (value.type === 'CommunityPost' || value.type === 'CommunityReply')) {
      article.append(node('time','muted',new Date(value.published).toLocaleString()),node('p','post-body',value.body));
      if (value.type === 'CommunityPost') {
        if (value.eventId) { const event = this.service.snapshot().events.find(i => i.event.eventId === value.eventId)?.event; const link = node('a','event-tag',event?.value.title ?? 'Withdrawn or unavailable event'); const url = new URL(location.href); url.searchParams.set('view',event ? 'events' : 'community'); url.searchParams.set('event',value.eventId); link.href = url.href; article.append(link); }
        if (value.imageUrl) { const image = node('img','post-image'); image.src = value.imageUrl; image.alt = 'Photo shared by the post author'; image.loading = 'lazy'; image.addEventListener('error',() => image.replaceWith(node('p','muted','Photo unavailable')),{ once:true }); article.append(image); }
      }
    } else article.append(node('p','muted','The author removed this content. Replies are preserved.'));
    const actions = node('div','community-actions');
    const button = (label: string, action: () => void) => { const b = node('button','text-button',label); b.type = 'button'; b.disabled = this.busy; b.addEventListener('click',action); actions.append(b); };
    if (this.service.snapshot().username && !current.hidden) button('Reply',() => { this.replying = { root, parent: current.ref }; required(this.root,'[data-reply-form]').hidden = false; required(this.root,'[data-reply-form]').scrollIntoView({ behavior:'smooth',block:'center' }); required<HTMLTextAreaElement>(this.root,'[name=reply]').focus(); });
    if (record && record.actor === this.identityState.session?.actor) button('Delete my content',() => void this.run(async () => { const warnings = await this.service.remove(record); this.notify(warnings.length ? warnings.join(' ') : 'Your content was deleted.'); }));
    if (owner) button(current.ownHidden ? 'Restore in venue app' : 'Hide in venue app',() => void this.run(() => this.service.moderate(current.ref,!current.ownHidden)));
    article.append(actions);
    if (current.children.length) {
      const nested = node('div','thread-children'); for (const child of current.children) nested.append(this.thread(child,root,depth+1,names,owner));
      if (depth >= 3) { const details = node('details','deeper-replies'); details.append(node('summary','',`${current.children.length} deeper repl${current.children.length === 1 ? 'y' : 'ies'}`),nested); article.append(details); } else article.append(nested);
    }
    article.dataset.contentKey = contentKey(current.ref); return article;
  }
  dispose() { for (const off of this.unsubscribers) off(); this.service.stop(); this.root.replaceChildren(); }
}
