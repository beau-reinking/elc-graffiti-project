import type { LocationGroup } from '../application/event-explorer';
import type { EventMapAdapter } from './map-adapter';

export class MapFeedView {
  constructor(private readonly adapter: EventMapAdapter, private readonly select: (group: LocationGroup) => void) {}
  render(groups: readonly LocationGroup[]) { this.adapter.setLocations(groups, this.select); }
  resize() { this.adapter.resize(); }
  fitAll() { this.adapter.fitAll(); }
  dispose() { this.adapter.dispose(); }
}
