import type { LocationGroup } from '../application/event-explorer';

export interface EventMapAdapter {
  setLocations(groups: readonly LocationGroup[], select: (group: LocationGroup) => void): void;
  resize(): void;
  fitAll(): void;
  dispose(): void;
}

/** Presentation-only seam; domain and feed code do not depend on Leaflet. */
export async function createLeafletMap(root: HTMLElement, report: (message: string) => void): Promise<EventMapAdapter> {
  const L = await import('leaflet');
  await import('leaflet/dist/leaflet.css');
  if (!root.isConnected) throw new Error('Map container was disposed before initialization.');
  const url = import.meta.env.VITE_MAP_TILE_URL?.trim() || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  if (!url.startsWith('https://') || !['{z}', '{x}', '{y}'].every(token => url.includes(token))) throw new Error('Configure an HTTPS map tile URL containing {z}, {x}, and {y}.');
  const attributionUrl = import.meta.env.VITE_MAP_ATTRIBUTION_URL?.trim() || 'https://www.openstreetmap.org/copyright';
  if (new URL(attributionUrl).protocol !== 'https:') throw new Error('Map attribution must link to HTTPS.');
  const credit = document.createElement('a'); credit.href = attributionUrl; credit.target = '_blank'; credit.rel = 'noopener noreferrer';
  credit.textContent = import.meta.env.VITE_MAP_ATTRIBUTION_TEXT?.trim() || '© OpenStreetMap contributors';
  const map = L.map(root, { center: [40.731, -73.99], zoom: 13, minZoom: 2, maxZoom: 19, scrollWheelZoom: true, keyboard: true });
  const markers = L.featureGroup().addTo(map);
  let failed = 0, loaded = 0, navigated = false, programmatic = false;
  const layer = L.tileLayer(url, { maxZoom: 19, attribution: credit.outerHTML }).addTo(map);
  const timeout = window.setTimeout(() => { if (!loaded) report('The basemap is taking too long to load. Event pins and the List view are still available.'); }, 12_000);
  layer.on('tileerror', () => { if (++failed >= 3) report('Some map tiles could not load. Use the List view if the map is unavailable.'); });
  layer.on('tileload', () => { loaded++; window.clearTimeout(timeout); if (failed < 3) report(''); });
  map.on('dragstart', () => { navigated = true; });
  map.on('zoomstart', () => { if (!programmatic) navigated = true; });
  let signature = '', current: readonly LocationGroup[] = [];
  const fit = () => {
    if (!current.length || !root.clientWidth || !root.clientHeight) return;
    programmatic = true;
    map.fitBounds(current.map(group => [group.latitude, group.longitude] as [number, number]), { padding: [70, 70], maxZoom: 15, animate: false });
    programmatic = false;
  };
  return {
    setLocations(groups, select) {
      current = groups;
      const next = JSON.stringify(groups.map(group => [group.key, group.items.length, group.items.map(item => item.venue.name)]));
      if (next === signature) return;
      signature = next; markers.clearLayers();
      for (const group of groups) {
        const names = [...new Set(group.items.map(item => item.venue.name))].join(' / ');
        const label = `${group.items.length} event${group.items.length === 1 ? '' : 's'} at ${names}`;
        // Only a derived integer is inserted into marker HTML; titles remain text.
        const icon = L.divIcon({ className: 'event-map-marker', html: `<span class="pin-face"><strong>${group.items.length}</strong><small>${group.items.length === 1 ? 'event' : 'events'}</small></span>`, iconSize: [58, 68], iconAnchor: [29, 67] });
        const marker = L.marker([group.latitude, group.longitude], { icon, title: label, alt: label, keyboard: true }).addTo(markers);
        marker.on('click', () => select(group));
        const element = marker.getElement();
        element?.setAttribute('aria-label', label);
        element?.addEventListener('keydown', event => { if (event.key === ' ') { event.preventDefault(); select(group); } });
      }
      if (!navigated) fit();
    },
    resize() { map.invalidateSize({ pan: false }); if (!navigated) fit(); },
    fitAll() { fit(); },
    dispose() { window.clearTimeout(timeout); map.remove(); },
  };
}
