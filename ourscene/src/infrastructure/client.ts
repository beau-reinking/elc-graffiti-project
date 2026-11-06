import type { Graffiti } from '@graffiti-garden/api';

export const mode = typeof window !== 'undefined' && (window.parent as unknown as {gtWorkspace?:{demo:boolean}}).gtWorkspace?.demo ? 'local' : import.meta.env.VITE_GRAFFITI_MODE?.trim() || 'decentralized';

/** Load the constructor first, then construct and attach identity listeners in
 * the same synchronous turn. Returning an instance through await could miss
 * the local implementation's restored-session microtask. */
export async function loadGraffitiFactory(): Promise<() => Graffiti> {
  const shared = typeof window === 'undefined' ? undefined : (window.parent as unknown as { gtWorkspace?: { createClient(options?: {owner?:boolean;personalFirst?:boolean;blobConstructor?:typeof Blob}): Graffiti } }).gtWorkspace;
  if(shared && typeof window !== 'undefined' && window.parent !== window) return () => shared.createClient({owner:true,personalFirst:true,blobConstructor:Blob});
  if (mode === 'local') {
    const { GraffitiLocal } = await import('@graffiti-garden/implementation-local');
    return () => new GraffitiLocal({ pouchDBOptions: { name: 'music-venues-v1' } });
  }
  if (mode === 'decentralized') {
    const { GraffitiDecentralized } = await import('@graffiti-garden/implementation-decentralized');
    return () => new GraffitiDecentralized();
  }
  throw new Error('VITE_GRAFFITI_MODE must be local or decentralized.');
}
