import type { Graffiti, GraffitiLoginEvent, GraffitiLogoutEvent, GraffitiSessionInitializedEvent } from '@graffiti-garden/api';
import type { IdentityPort, IdentityState, Session } from '../application/ports';

export class GraffitiIdentityAdapter implements IdentityPort {
  private state: IdentityState = { initialized: false };
  private selecting = false;
  private manualSelection = false;
  private desiredActor?: string;
  private loginIntent?: string;
  private preferenceKey: string;
  private persist(actor?: string, intent?: string) {
    try { if (typeof sessionStorage !== 'undefined') { if (actor) sessionStorage.setItem(this.preferenceKey,actor); if (intent) sessionStorage.setItem(this.preferenceKey+':intent',intent); else sessionStorage.removeItem(this.preferenceKey+':intent'); } } catch { /* Storage can be disabled; the account selector still works. */ }
  }
  private sessions = new Map<string, Session>();
  private listeners = new Set<(state: IdentityState) => void>();
  private cleanups: (() => void)[] = [];
  constructor(private readonly client: Graffiti, private readonly preferredActor?: string) {
    this.preferenceKey = `music-venues:active:${preferredActor ?? 'visitor'}`;
    try { if (typeof sessionStorage !== 'undefined') { this.desiredActor = sessionStorage.getItem(this.preferenceKey) ?? undefined; this.loginIntent = sessionStorage.getItem(this.preferenceKey+':intent') ?? undefined; } } catch { /* Optional preference storage. */ }
    this.listen('login', event => {
      const { detail } = event as GraffitiLoginEvent;
      if (detail.error) { this.selecting = false; this.persist(); this.update({ error: detail.error.message }); return; }
      this.sessions.set(detail.session.actor, detail.session);
      // Multiple restored sessions must not hide the configured venue's session.
      const session = this.selecting ? detail.session : (this.manualSelection ? this.state.session : this.sessions.get(this.preferredActor ?? '') ?? this.state.session) ?? detail.session;
      if (this.selecting) this.manualSelection = true;
      this.selecting = false;
      this.update({ session, error: undefined });
    });
    this.listen('logout', event => {
      const { detail } = event as GraffitiLogoutEvent;
      if (detail.error) { this.selecting = false; this.persist(); this.update({ error: detail.error.message }); return; }
      this.sessions.delete(detail.actor);
      const session = this.sessions.get(this.preferredActor ?? '') ?? this.sessions.values().next().value;
      this.update({ session, error: undefined });
    });
    this.listen('initialized', event => {
      const { detail } = event as GraffitiSessionInitializedEvent;
      const restored = this.loginIntent === 'visitor' ? [...this.sessions.values()].at(-1) : this.sessions.get(this.desiredActor ?? '');
      if (restored) { this.manualSelection = true; this.update({ session:restored }); this.persist(restored.actor); }
      this.update({ initialized: true, error: detail?.error?.message });
    });
  }
  private listen(type: string, handler: EventListener) {
    this.client.sessionEvents.addEventListener(type, handler);
    this.cleanups.push(() => this.client.sessionEvents.removeEventListener(type, handler));
  }
  private update(change: Partial<IdentityState>) {
    this.state = { ...this.state, ...change, sessions: Object.freeze([...this.sessions.values()]) };
    for (const listener of this.listeners) listener(this.state);
  }
  currentSession() { return this.state.session; }
  // Called directly from UI gestures; the session arrives via the event above.
  login() { return this.client.login(this.preferredActor ? {actor:this.preferredActor} : undefined); }
  loginVisitor() { this.persist(undefined,'visitor'); this.selecting = true; return this.client.login(); }
  loginOwner() { this.persist(this.preferredActor,'owner'); this.selecting = true; return this.client.login(this.preferredActor ? {actor:this.preferredActor} : undefined); }
  selectSession(actor: string) { this.manualSelection = true; const session = this.sessions.get(actor); if (!session) throw new Error('Session is unavailable.'); this.persist(actor); this.update({ session, error: undefined }); }
  async logout() { const session = this.currentSession(); if (session) await this.client.logout(session); }
  subscribe(listener: (state: IdentityState) => void) { this.listeners.add(listener); listener(this.state); return () => { this.listeners.delete(listener); }; }
  dispose() { for (const cleanup of this.cleanups) cleanup(); this.cleanups = []; this.listeners.clear(); }
}
