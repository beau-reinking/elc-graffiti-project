import { mode, loadGraffitiFactory } from './infrastructure/client';
import { seedCommunity } from './infrastructure/community-seeder';
import { seedSandbox } from './infrastructure/sandbox-seeder';
import { sandboxVenues } from './venue-catalog';
import { required, safeError } from './presentation/dom';
import './presentation/styles.css';
const button = required<HTMLButtonElement>(document, '#seed'), status = required(document, '#seed-status');
button.disabled = mode !== 'local';
if (mode !== 'local') status.textContent = 'Run npm run dev:sandbox for the local demo. Demo identities are never used online.';
button.addEventListener('click', async () => {
  button.disabled = true; status.textContent = 'Creating four demo venues and their events through Graffiti…';
  try {
    if (mode !== 'local') throw new Error('Demo fixtures are restricted to local mode.');
    const factory = await loadGraffitiFactory(), client = factory(), written = await seedSandbox(client, sandboxVenues) + await seedCommunity(client,sandboxVenues);
    status.textContent = `Ready: ${written} new or refreshed records. Open OurScene to explore the event map. Community demo handles: river_notes, milo_live, sky_sounds. Existing records were kept without duplication.`;
  } catch (error) { status.textContent = safeError(error); }
  finally { button.disabled = false; }
});
