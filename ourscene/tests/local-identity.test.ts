import { expect, it, vi } from 'vitest';
import { GraffitiLocalIdentity } from '@graffiti-garden/implementation-local/identity';

it('uses actual Graffiti local identities for both configured demo venues', async () => {
  vi.stubEnv('VITE_GRAFFITI_MODE', 'local');
  try {
    vi.resetModules();
    const { config: blue } = await import('../apps/blue-hour/config');
    const { config: red } = await import('../apps/red-room/config');
    const identity = new GraffitiLocalIdentity();
    for (const config of [blue, red]) expect(config.venueActor).toBe(await identity.handleToActor(config.testHandle!));
  } finally { vi.unstubAllEnvs(); vi.resetModules(); }
});
