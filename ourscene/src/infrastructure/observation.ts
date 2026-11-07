import type { Graffiti, GraffitiObjectStream, JSONSchema } from '@graffiti-garden/api';
import type { Observation, SourceListener } from '../application/ports';

export interface PollEnvironment {
  visible(): boolean;
  every(callback: () => void, milliseconds: number): () => void;
  onVisibilityChange(callback: () => void): () => void;
  now(): number;
}
export const browserPolling: PollEnvironment = {
  visible: () => document.visibilityState === 'visible',
  every(callback, milliseconds) { const id = window.setInterval(callback, milliseconds); return () => window.clearInterval(id); },
  onVisibilityChange(callback) { document.addEventListener('visibilitychange', callback); return () => document.removeEventListener('visibilitychange', callback); },
  now: Date.now,
};
export type DiscoveryClient = Pick<Graffiti, 'discover' | 'continueDiscover'>;
export interface RawObject { url: string; actor: string; value: unknown; allowed?: readonly string[] | null }
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

/** Owns SDK cursors, finite-stream reconciliation, polling and cancellation. */
export class GraffitiObservation<T extends { readonly url: string }> implements Observation {
  private records = new Map<string, T>();
  private cursor?: string;
  private stopped = false;
  private pending?: Promise<void>;
  private iterator?: GraffitiObjectStream<JSONSchema>;
  private cancelTimer?: () => void;
  private readonly cancelVisibility: () => void;
  private lastSuccess?: number;
  constructor(
    private readonly client: DiscoveryClient,
    private readonly channels: string[],
    private readonly schema: JSONSchema,
    private readonly parse: (object: RawObject) => T,
    private readonly source: string,
    private readonly listener: SourceListener<T>,
    private readonly environment: PollEnvironment = browserPolling,
  ) {
    this.cancelVisibility = environment.onVisibilityChange(() => this.schedule(true));
    this.schedule(false);
    queueMicrotask(() => { if (!this.stopped) void this.refresh(); });
  }
  private schedule(refresh: boolean) {
    this.cancelTimer?.(); this.cancelTimer = undefined;
    if (this.stopped || !this.environment.visible()) return;
    this.cancelTimer = this.environment.every(() => { void this.refresh(); }, 30_000);
    if (refresh) void this.refresh();
  }
  refresh(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    // Polls, visibility changes and manual refresh share one in-flight query.
    if (!this.pending) this.pending = this.synchronize().finally(() => { this.pending = undefined; });
    return this.pending;
  }
  private async synchronize(recovered = false): Promise<void> {
    const fresh = !this.cursor;
    const staged = fresh ? new Map<string, T>() : new Map(this.records);
    const removed = new Set<string>();
    const warnings: string[] = [];
    let failed = false;
    let nextCursor: string | undefined;
    let ownedIterator: GraffitiObjectStream<JSONSchema> | undefined;
    try {
      const iterator = this.cursor
        ? this.client.continueDiscover<JSONSchema>(this.cursor)
        : this.client.discover(this.channels, this.schema);
      this.iterator = iterator; ownedIterator = iterator;
      while (!this.stopped) {
        const step = await iterator.next();
        if (this.stopped) return;
        if (step.done) { nextCursor = step.value.cursor; break; }
        const result = step.value;
        if (result.error) { failed = true; warnings.push(`${result.origin}: ${message(result.error)}`); }
        else if (result.tombstone) {
          staged.delete(result.object.url); removed.add(result.object.url);
          // A later expired-cursor recovery must not resurrect a deletion that
          // was already confirmed in this stream.
          this.records.delete(result.object.url);
        }
        else {
          try {
            // Public feeds never admit restricted objects, even if a test client
            // or a future authenticated reader accidentally returns one.
            if (result.object.allowed != null) continue;
            const record = this.parse(result.object);
            staged.set(record.url, record);
          } catch (error) { warnings.push(`Ignored ${result.object.url}: ${message(error)}`); }
        }
      }
    } catch (error) {
      if (this.stopped) return;
      if (!recovered && error instanceof Error && error.name === 'GraffitiErrorCursorExpired') {
        this.cursor = undefined;
        return this.synchronize(true);
      }
      failed = true; warnings.push(message(error));
    } finally { if (this.iterator === ownedIterator) this.iterator = undefined; }
    if (this.stopped) return;
    // Failed fresh snapshots are additive; absence is not proof of deletion.
    if (failed) {
      for (const [url, value] of staged) this.records.set(url, value);
      for (const url of removed) this.records.delete(url);
      this.cursor = undefined; // retry a complete snapshot next time
    } else {
      this.records = staged; this.cursor = nextCursor;
      this.lastSuccess = this.environment.now();
    }
    for (const warning of warnings) console.warn(`[${this.source}] ${warning}`);
    try {
      await this.listener({ records: Object.freeze([...this.records.values()]), health: Object.freeze({ source: this.source, stale: failed, loading: false, warnings: Object.freeze(warnings), lastSuccess: this.lastSuccess }) });
    } catch (error) { console.error(`Feed observer failed for ${this.source}`, error); }
  }
  stop() {
    this.stopped = true;
    this.cancelTimer?.(); this.cancelTimer = undefined;
    this.cancelVisibility();
    // The SDK exposes no AbortSignal. Suppress late results and request generator
    // completion; an already pending SDK network request may still finish.
    void this.iterator?.return({ cursor: this.cursor ?? '' }).catch(() => {});
  }
}
