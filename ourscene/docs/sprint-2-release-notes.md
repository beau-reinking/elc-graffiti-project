# Sprint 2 delivery: events, maps, and four venue apps

## What is implemented

- OurScene opens on an interactive Leaflet map with drag/pinch/scroll navigation, keyboard controls, visible attribution, and large event pins.
- Coincident venue coordinates share a pin. Its count reflects the filtered event set. A single-event pin opens details directly; a numbered pin opens independently selectable event thumbnails.
- Map and List share search, venue, date/range, cancellation, and selected-event state. Closing details retains the map viewport. Missing coordinates remain available in List view.
- Date shortcuts, inclusive end dates, half-open overlap matching, timezone labels, and daylight-saving-aware day boundaries are implemented with Temporal. Nonexistent and ambiguous local input times are rejected rather than silently shifted.
- All four venue apps have full event forms, owner corrections, cancellation, and deletion. Event details include schedule, doors, lineup, imagery/fallback artwork, external ticket information, age restrictions and attribution.
- The Lantern and Signal Yard have their own themes, identities, app entries, online actor settings, and independent builds.
- The loader seeds four fictional locations and 12 event records, including free, sold-out, cancelled, overnight and missing-image examples. The normal aggregate view excludes the cancelled record, so the initial count is 11. Re-running the loader does not duplicate events; expired fixture schedules receive revisions. Explicitly deleted fixtures are not restored.
- Existing announcements are retained in a separate legacy section and never assigned invented event dates.

## Data and lifecycle decisions

`MusicEvent` version 1 records use stable `eventId`, owner `venueActor`, positive `revision`, UTC-millisecond schedule values, and an IANA timezone. The existing profile and announcement contracts stay at version 1. Events use separate channels: `music-venues:v1:events:<encoded actor>`.

The feed validates actual Graffiti author against the venue and resolves one current record per event ID. Highest revision wins, then publication time and URL. Corrections and cancellation publish new immutable records. Cancellation remains in the owner view and can be included explicitly in aggregate discovery; it disables the ticket action.

Deletion first publishes an `EventRemoval` containing only ID, venue, revision and timestamp. That marker is terminal and is retained. The repository then attempts to delete historical event-content records, reporting incomplete cleanup to the operator. A failed cleanup cannot reactivate the event. External deletion of the retained marker is outside this app's deletion contract. Graffiti cannot guarantee removal from third-party caches.

Location grouping normalizes coordinates to six decimal places; it does not merge nearby distinct venues or infer equivalence from their names. Events inherit the current venue profile's location; per-event location overrides and geocoding are outside this sprint.

## Map provider and configuration

The default is Leaflet 1.9.4 with the standard OpenStreetMap raster tile endpoint. No API key or paid account is needed for the default development setup. Attribution remains visible, and browser caching/referrer behavior is retained. There is no prefetch, bulk download or offline-tile feature. The map provider sees normal browser tile requests; Graffiti session credentials are never attached to them.

Configure `VITE_MAP_TILE_URL`, `VITE_MAP_ATTRIBUTION_TEXT`, and `VITE_MAP_ATTRIBUTION_URL` before starting/building to use a different HTTPS provider. The URL must contain `{z}`, `{x}`, and `{y}`. Provider settings are public. Never embed private keys; if a commercial provider uses a public browser token, restrict its deployment origins in that provider's dashboard.

Standard OSM tiles are a best-effort community service with no SLA and may block inappropriate load. Review its [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) before deployment and select a suitable commercial/self-hosted provider for traffic requiring guarantees; any plan charges or limits come from that provider. Leaflet itself is [provider independent](https://leafletjs.com/examples/quick-start/).

If tiles fail, a visible message points to the List alternative. If map initialization fails, the interface switches to List. The local event data remains usable without the basemap. No visitor geolocation permission is requested.

## Changes to the architecture

- `MusicEvent`, `EventRemoval`, schedule utilities, and revision resolution contain domain rules.
- `EventReader`, `EventWriter`, and `EventPublishingService` isolate event workflows from Graffiti and presentation.
- `EventExplorerState` owns filters, location grouping and selection; it has no DOM or map dependency.
- `EventExplorerView` implements `FeedView` and composes map, list cards, thumbnail panel and details. `MapFeedView` delegates SDK work through `EventMapAdapter`; the Leaflet adapter owns maps, markers, tile handling and cleanup.
- Existing feed/source lifecycle behavior is retained: finite discovery, cursors, confirmed tombstones, stale-data retention, and observation cancellation.

The class and sequence diagrams are updated for Sprint 2. Existing GRASP/SOLID separation is retained; map rendering, filtering, scheduling, persistence, and publication do not share business responsibilities.

## Verification and limits

All 50 automated tests pass, and all five independently configured apps build successfully. Desktop browser checks cover map pins and grouped thumbnails, shared date filters and selection, event creation/revision/cancellation/deletion, missing-image fallback, and automatic List fallback when map configuration fails.

The automated suite covers event validation, ownership, revisions, permanent withdrawal, historical cleanup, timezone/DST boundaries, interval overlap, filter/selection consistency, coincident versus nearby locations, four-venue fixtures, idempotence, expiry refresh, and the existing source/identity contracts.

Browser verification uses actual Graffiti local storage, not the test transport. Online authentication and posting require real venue actors and a separate deployment-specific smoke test. Ticket links are external links with venue-supplied pricing/availability; checkout, inventory synchronization and payments are not implemented. Demo links are labeled and lead to example.com rather than a real sales offer.
