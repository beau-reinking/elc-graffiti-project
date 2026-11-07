# OurScene · OurScene, V3

This app is also available inside **GTGraffitiLauncher** through the shared local workspace. See `../GTGraffitiLauncher/workspace/README.md`. Its original Graffiti namespace is retained for compatibility.


Four independently branded venue apps and one event aggregator, sharing a TypeScript/Graffiti core. The aggregator has an ordinary interactive map, grouped event pins, thumbnail selection, full event details, and date/range, genre and price filters, and direct links to each event’s venue discussion. Venue communities support usernames, posts, optional photo links, nested replies, author deletion and venue moderation. Venue operators can register profiles, publish events, correct them, cancel them, and delete them.

## Run the complete local sandbox

Open **this `music-venues` folder**, containing `package.json`, in VS Code. Requires Node.js **22.12 or newer**.

```sh
npm install
npm run dev:sandbox
```

Open **http://localhost:5173/** and select **Load venues, events & community**. Then open OurScene. If port 5173 is already serving this project, use the existing server; otherwise stop the old process before starting another.

The loader creates 12 event records at four fictional New York demo sites. One is cancelled and hidden by default, so the normal initial map has **11 events**. Each numbered pin opens separate event thumbnails; a single-event pin opens its event directly. Pan, zoom, switch Map/List, try date shortcuts or inclusive ranges, and open ticket details. The basemap needs internet access; the event list remains usable when it fails.

| Venue app | Local test username | Independent dev / preview port |
| --- | --- | --- |
| Blue Hour | `blue-hour-demo` | 5174 / 4174 |
| Red Room | `red-room-demo` | 5175 / 4175 |
| The Lantern | `lantern-demo` | 5176 / 4176 |
| Signal Yard | `signal-yard-demo` | 5177 / 4177 |

Open a venue’s **Community** tab and use **Venue owner sign in** with its test handle. The **Owner area** tab appears only for its owner. Register its profile if needed, then publish an event. Open one of its event cards for **Edit event**, **Cancel event**, and **Delete event**. Refresh OurScene to discover changes immediately, or wait for its visible-page poll. Wrong identities cannot publish for another venue.

Local mode uses the actual Graffiti local implementation, IndexedDB, and localStorage; it is not the automated test transport. Local login is intentionally insecure. Storage is shared only within the same browser profile and origin. All venues, map sites and seeded ticket offers are fictional; demo ticket links are labeled. Re-running the loader preserves upgraded upcoming fixtures without duplicates, refreshes expired schedules with revisions, and respects explicitly removed demo events.

Older Sprint 1 announcements remain readable in the separate **Legacy announcements** section. They do not appear as dated events. Existing local data needs no destructive reset; the loader upgrades demo addresses, genres and artwork through revisions, adds missing communities, and preserves user deletions.

## V3 community walkthrough

Use **Visitor sign in** in any venue’s Community tab. Sandbox demo handles are `river_notes`, `milo_live`, and `sky_sounds`; each already has a username claim. A new handle must choose an available public username before posting or replying. Switch restored accounts with **Active account**. Only actor selection is remembered in session storage; authentication sessions remain managed by Graffiti.

Create a text post with an optional HTTPS photo link and optional event tag. Replies can target posts or other replies. Deeper conversations expand after three visual levels. **All posts** shows the venue feed; select an event for its collection. Tags open the event details. OurScene’s **Join the conversation** action opens that same event collection in its venue app, including after reload or event revision.

Authors can delete their own content. A deleted item with surviving replies becomes a content-free placeholder. Venue owners can hide or restore a subtree in their app; hiding does not remove public Graffiti data. The seeded hidden example is visible to its venue owner. Editing, bans, approval queues, uploads, private messages and notifications are outside V3.

Usernames use 3–24 letters, digits or underscores and are case-insensitive. There is no central account authority. Discovery checks availability; conflicting claims resolve by the smallest Graffiti object URL after choosing each actor’s latest claim. Losing claimants choose another name before publishing. Name claims cannot be created when username discovery is stale. Identifiers are not shown in the UI, but underlying public Graffiti authorship remains inspectable: this is not anonymity.

For independently hosted apps, publish each venue’s **Venue app URL** in its profile as a full HTTPS app entry URL. This discovered address powers OurScene discussion links; the venue website is separate. Unknown venues without an app URL remain discoverable but have no conversation link. Hosts must serve the app entry URL with its query string intact; no rewritten path routes are required.

## V3 filters and demo artwork

Free only matches explicit free tickets. Maximum price includes free events and known prices in the selected currency at or below the limit; it excludes unknown and other-currency prices. There is no conversion. With no price limit, all prices remain eligible. Selected genres match **any** chosen genre and combine with dates, search and venue filters. Older unclassified events work normally until a genre filter is selected.

Twelve distinct generated photographs of fictional adult performers ship as optimized WebP files (about 736 KB total) with descriptive alternatives and visible demo labels. They resolve through a local-only allowlisted manifest; external images continue to require HTTPS and fall back if unavailable. Demo locations have complete but fictional addresses, not real businesses.

## Online mode and separate deployments

Copy `.env.example` to `.env`, keep `VITE_GRAFFITI_MODE=decentralized`, and configure the four actual venue actor IDs. These are Graffiti actors, not handles. Obtain the actor IDs from your Graffiti identity provider/account tooling; the public interface intentionally does not display them. Publishing stays disabled until the signed-in owner matches the configured identity. Restart Vite after configuration changes.

Optional deployment URL settings enable navigation between hosted apps. `VITE_` settings are public: do not put authentication tokens or private credentials in them. Graffiti handles authentication sessions.

```sh
npm run dev:all         # five independent servers, OurScene at :5173
npm run dev             # OurScene only
npm run dev:blue-hour
npm run dev:red-room
npm run dev:lantern
npm run dev:signal-yard
npm run check
npm test
npm run build          # five independent static outputs
npm run preview        # OurScene at :4173
npm run preview:lantern # The Lantern at :4176; analogous scripts for other venues
```

Do not run the shared sandbox and independent servers on port 5173 simultaneously. Independently hosted origins must use decentralized Graffiti to share records; local sandbox identities/data do not transfer online.

Each app builds into its own `dist/<app-id>/` directory with relative assets. Upload each directory to its static host. Mode, actor IDs, URLs, and map settings are embedded at build time. No central application backend is required. The source ZIP excludes `node_modules` and `dist`; the install/build commands recreate them. No hosting service or paid account is configured by this delivery.

## Map provider

The default is **Leaflet 1.9.4 + standard OpenStreetMap tiles**, with visible attribution and normal browser caching. The default needs no API key; tile service is best effort, not an SLA. There is no tile prefetch, offline download, or automatic geolocation.

To change providers, set `VITE_MAP_TILE_URL` (HTTPS, with `{z}`, `{x}`, `{y}`), `VITE_MAP_ATTRIBUTION_TEXT`, and `VITE_MAP_ATTRIBUTION_URL` before building. Review provider traffic rules, public-token origin restrictions, and charges before deployment. See the [provider notes and OSM policy link](docs/sprint-2-release-notes.md).

## Stack and tools

| Technology / tool | Version | Responsibility |
| --- | --- | --- |
| TypeScript | 7.0.2 | Strict domain models, application ports/services, adapters and controllers |
| HTML / CSS / native DOM | Web standards | Responsive forms, accessible controls, thumbnail/detail views, local fallback artwork |
| Graffiti API | 1.3.0 | Identity, objects, discovery and deletion contracts |
| Graffiti local / decentralized implementations | 1.3.1 / 0.1.8 | Real local development and shared online storage |
| PouchDB | 9.0.0, via Graffiti | Browser-local IndexedDB persistence |
| Leaflet / Leaflet types | 1.9.4 / 1.9.22 | Map navigation, tiles, keyboard controls and event markers |
| Temporal polyfill | 0.5.1 | Timezone-aware schedules, DST validation and calendar-day boundaries |
| JSON Schema | Versioned application records | Discovery filtering plus domain validation |
| OpenAI imagegen / Pillow | Development tools | Fictional artist photo generation and WebP optimization; no runtime image-generation service |
| Vite | 8.3.5 | Development, hot updates and five separate static builds |
| Vitest | 4.0.17 | Domain, service, source-contract, filter/grouping and fixture tests |
| Node / npm | Created with 24.15.0 / 11.12.1 | Dependency management and orchestration |
| VS Code tasks / browser automation | Included tasks / development checks | Launching, building, testing and real local end-to-end verification |

## Architecture and behavior

- Domain rules live under `src/domain`; narrow ports and services under `src/application`; SDK adapters under `src/infrastructure`; DOM and map presentation under `src/presentation`. `src/composition.ts` wires each app's own Graffiti client.
- `EventExplorerState` owns common filters and selection. The map, list, pin counts and thumbnail panel use one projection. Events lacking venue coordinates remain in List view.
- Events have stable IDs and immutable versioned records. Latest valid revision wins; author must match the venue. Cancellation disables ticket actions and is excluded from default aggregate results.
- Deletion retains a minimal terminal marker before attempting to purge historical content. A partial cleanup cannot reactivate an old revision; failed cleanup is reported. Do not externally delete removal markers.
- Schedules are stored as UTC instants plus an IANA timezone. Date filters use the displayed visitor timezone, inclusive calendar end dates, and interval overlap. Ambiguous/nonexistent local form times are rejected. Filters never use publication dates.
- User-supplied images are optional HTTPS URLs; demo artist photos are bundled locally. Failed or missing images use local fallback artwork. Ticket actions link to external providers; prices and availability are venue-supplied, not live inventory. There is no payment processing.
- All venue claims remain **unverified**. Authentication establishes actor control, not ownership of a real venue. Channels organize discovery; they are not authorization or privacy boundaries.
- Finite discovery/cursors, partial-source stale-data retention, confirmed tombstones, visibility-aware 30-second polling and cleanup are retained from Sprint 1. Stopping observations suppresses late SDK results; the SDK cannot abort an already pending request.

Read the [architecture and diagrams](docs/architecture.md), [Sprint 2 delivery notes](docs/sprint-2-release-notes.md), [original sprint brief](docs/sprint-2-brief.md), and [extension guide](docs/extensions.md).

## Verification and limits

The suite covers event validation, ownership, revisions, permanent withdrawal, history cleanup, 23/25-hour DST days, overnight/date overlap, filter selection, coincident/nearby locations, source lifecycle, four-venue fixtures, idempotence and expiry refresh, alongside the previous tests. Browser checks use actual local Graffiti storage.

Online authentication and cross-origin posting still need a smoke test with real venue accounts. The decentralized package emits build warnings for its Node-only `readline`/`node:http` branches; builds succeed using the supplied browser bundles. No recurring series, media upload tools, checkout, staff roles, real-world verification, central index, or user-post endorsement UI is included. The optional legacy endorsement strategy remains tested but is not enabled for events.

Upstream packages include their own license notices. [Graffiti API documentation](https://api.graffiti.garden/classes/Graffiti.html) · [Leaflet documentation](https://leafletjs.com/reference.html) · [Temporal documentation](https://tc39.es/proposal-temporal/docs/).

V3 details: [release notes](docs/v3-release-notes.md), [setup guide](docs/setup-guide.md), [architecture](docs/architecture.md).
