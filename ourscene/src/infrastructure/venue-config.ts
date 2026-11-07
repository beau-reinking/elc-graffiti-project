import type { VenueConfig } from '../application/ports';
import { mode } from './client';
export function localActorForHandle(handle: string): string {
  const bytes = new TextEncoder().encode(handle);
  return `did:local:${btoa(String.fromCodePoint(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}
export function configuredVenue(input: Omit<VenueConfig, 'venueActor'> & { onlineActor?: string }): VenueConfig {
  const { onlineActor, ...config } = input;
  return Object.freeze({ ...config, venueActor: mode === 'local' && config.testHandle ? localActorForHandle(config.testHandle) : onlineActor?.trim() || '',
    ...(mode === 'local' ? {} : { testHandle: undefined, defaultAddress: undefined, defaultLocation: undefined }),
  });
}

export function isVenueActor(actor: string, local = false): boolean {
  return /^did:plc:[a-z2-7]{24}$/.test(actor) || /^did:web:[A-Za-z0-9._%+-]+(?::[A-Za-z0-9._%+-]+)*$/.test(actor) || (local && /^did:local:[A-Za-z0-9_-]+$/.test(actor));
}
