# Extending the Sprint 2 apps

## Another independently branded venue

Create `apps/<slug>/index.html`, `main.ts`, and `config.ts` using The Lantern or Signal Yard as a small entry-point example. Call `configuredVenue()` with its brand, theme, online actor variable and an optional local demo handle. Local demo locations/handles are stripped from online configuration. `mountVenue(config)` composes the shared domain, publishing services, adapters and screen; do not copy these implementations.

The build runner automatically discovers entries containing `index.html`. Run `node scripts/run.mjs build <slug>` and host its own `dist/<slug>/` directory. Assign a port if you want a stable development address, and add package scripts/navigation/fixture catalog entries for convenience. Register the venue through its own app. Aggregator discovery needs no venue allowlist change.

## Map providers and additional presentations

The map is implemented. `EventExplorerView` implements `FeedView`, consuming the same `FeedSnapshot` contract as a replacement view. It shares `EventExplorerState` across map/list modes. `MapFeedView` consumes filtered location groups and delegates SDK operations to `EventMapAdapter`.

To replace Leaflet, supply another `EventMapAdapter` with `setLocations`, `resize`, `fitAll`, and `dispose`. Keep its viewport, marker lifecycle, attribution and provider errors inside that module. Ordinary tile-provider changes require only the environment settings described in the README.

Do not move date filtering or author checks into the map SDK. Group by shared physical coordinates, not event title or venue name. A future shared site ID or geocoding service can extend location resolution, but ambiguous addresses must not silently produce invented coordinates. The current six-decimal coordinate grouping is explicit and tested.

## Event schema evolution

Events use `MusicEvent` version 1 and a separate event channel. Existing announcement records remain untouched. Add explicit new schema versions when semantics change, and decide compatibility in the reader boundary rather than silently reinterpreting old fields.

Use a stable event ID across revisions. Only owner-authored records can revise that owner's event; resolution is deterministic. A retained `EventRemoval` is terminal for the ID. Do not implement deletion by removing only the latest revision or by deleting its removal marker, since that can reveal older data.

Future recurrence should create explicit occurrences or another versioned contract rather than treating publication dates as event dates. Per-occurrence IDs, cancellation and timezone rules need a separate design.

## User submissions and venue endorsements

The previous optional `VenueEndorsedPolicy`, `VenueEndorsement`, and `EndorsementReader` strategy remains implemented/tested for legacy announcement objects, not enabled for events. A future sprint must add event-specific submission/endorsement contracts and lifecycle handling before broadening the default venue-owned eligibility rules.

Preserve the user's actual Graffiti actor as author. Endorsement must reference an exact immutable target and be authored by the referenced venue. It supplies separate venue attribution, not a replacement author or verified business ownership. Define whether an endorsement binds a particular event revision or an event identity; do not carry an endorsement to a materially changed event implicitly. Add synchronization tests for endorsement arrival, withdrawal, revision and deletion.

## Larger networks

The design targets tens of venues and uses source-specific cursors. For larger networks, add an indexed reader behind the same narrow ports and design pagination, moderation, retention and abuse controls. Preserve independent provenance validation and truthful stale-source state even if an index prefilters records. Staff delegation, real-world venue verification and payments are separate capabilities.

## V3 community extension points

Community contracts are separate from legacy announcements and venue-authored events. Add future editing, notifications, uploads or endorsement policies behind new narrow ports; preserve original authorship. Username claims are intentionally decentralized, not global reservations. Central registration would be a new service and migration decision. Discussion URL construction is injected at composition and uses discovered `appUrl`, not a hard-coded venue registry online.

