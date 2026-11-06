# Sprint 2 brief: event discovery on an interactive map

## Goal

Turn OurScene into an event discovery experience: visitors explore venues on a familiar interactive map, find events by date, and open event details and ticket links. Expand the sandbox from two to four independently branded venue apps.

This brief defines the Sprint 2 scope. Its implementation is delivered in this project; see [Sprint 2 release notes](sprint-2-release-notes.md) for behavior, decisions, and remaining deployment verification.

## 1. Interactive event map

Add a **Map / List** switch to OurScene. Both views use the same events, filters, and selection state. Open the map by default, initially fitting the venues with matching events. Keep the list available as an accessible alternative and when map loading fails.

### Navigation and pins

- Support ordinary map interactions: drag to pan, scroll/pinch to zoom, zoom buttons, and keyboard navigation. Do not request the visitor’s location automatically.
- Show prominent, easy-to-click event pins at their venues’ coordinates. Use a minimum 44 × 44 CSS-pixel interaction target on touch screens.
- One matching event at a location shows a single event pin. Selecting it opens that event’s details.
- Multiple matching events at the same location show **one large pin with the event count**. Count only events remaining after the active filters.
- Selecting a numbered pin opens an anchored, scrollable thumbnail panel containing one card per event, ordered by start time. Each card shows an image or fallback artwork, title, venue, and date/time. Selecting a card opens the individual event details.
- Use a bottom sheet on small screens. Visitors can close the panel or details and return to their previous map position and zoom. Switching views also preserves filters and the selected event.
- Group events sharing the same physical site, including separate venues with coincident coordinates. Keep this grouping separate from optional zoom-dependent clustering of nearby locations: nearby venues are not automatically the same site.
- Events without usable venue coordinates remain in the list. Explain their absence from the map rather than inventing a location.

### Event details

Display the event artwork, title, description, performers if provided, venue, address, event date, doors/start/end times, timezone, ticket availability, price information, and external ticket action. Preserve the venue’s **unverified** label and access to the original Graffiti attribution.

### Date filtering

- Offer **Today**, **Tomorrow**, **This weekend**, a specific date, and a custom date range, plus a clear/reset action. Define the weekend as Saturday and Sunday.
- Default to upcoming and currently running events. Explicit selection of a past date can show past events.
- Interpret selected calendar dates in the visitor’s displayed timezone, initially the browser timezone. Show that timezone beside the controls. Event details also identify the venue’s local timezone.
- Treat the selected end date as inclusive: internally query from the first day’s start through the start of the day after the last selected date. Use timezone-aware boundaries across daylight-saving changes.
- Include an event when its start/end interval overlaps the selected interval. This includes overnight and multi-day events; do not filter by publication time.
- Apply filters consistently to list cards, map pins, grouped counts, and thumbnail panels. If filtering removes the selected event, close its details and show the remaining results.
- Reject reversed date ranges with an inline message. Provide clear empty-result and missing-location states.

## 2. Upgrade announcements to full events

Replace the venue announcement composer with an event publishing form. Keep the existing one-actor-per-venue publishing rule and independently verify authorship in the aggregator.

### Event content

Required fields: **title, description, venue actor, start time, end time, and venue timezone**. Keep the Graffiti-assigned author and object URL, schema version, and publication timestamp.

Optional fields: **performers/lineup, doors time, event image, ticket URL, price/currency, age restrictions, and additional HTTPS links**. Events inherit their venue’s address and coordinates in this sprint.

- Store scheduled instants in UTC and retain an IANA venue timezone for correct display and editing. End must follow start; doors time, when supplied, must not follow start. Explain ambiguous or nonexistent local times during daylight-saving transitions.
- Support scheduled/cancelled event status and available/sold-out ticket status. Free events have a clear free label and may have an external registration link.
- Ticket buttons open an external HTTPS sales or registration page. Sold-out and cancelled events show their status without an active purchase button. Show price as venue-supplied information, not live inventory.
- Use optional HTTPS image URLs with useful alternative text and fallback artwork if missing or unavailable. Image upload tooling is outside this sprint.
- Allow owners to publish corrections, cancel, or delete events. Graffiti objects remain immutable: use a stable event ID and owner-authored revision records for corrections/cancellations. Resolve to the newest valid revision with a deterministic tie-breaker, preserving the event ID across changes.
- Cancelling an event keeps a clearly marked detail record but excludes it from discovery results by default. Deleting an event must not reveal an older revision as a newly active event; the event-level removal workflow must account for its revision history.

### Compatibility

Introduce an explicit versioned event record and event-specific schema. Existing version-1 announcements lack schedule information and must not silently acquire invented dates. Retain them in a clearly separated legacy announcements section; map/date controls apply only to events. Venue operators may manually republish an old announcement as an event.

## 3. Two additional sandbox venues

Add these fictional venues using the existing configuration/composition pattern:

| Venue | Identity in the sandbox | Positioning | Visual direction |
| --- | --- | --- | --- |
| **The Lantern** | `lantern-demo` | Acoustic, folk, and intimate songwriter performances | Warm amber and charcoal |
| **Signal Yard** | `signal-yard-demo` | Electronic music, DJs, and experimental live sets | Violet and deep navy |

Provide their own app entries, themes, local identities, optional online actor settings, navigation links, and independent production builds. OurScene must discover their profiles without adding a venue allowlist. Derive/check local actor IDs against Graffiti’s actual handle conversion.

Update the sandbox loader to provide all four venues with explicit synthetic demo locations and at least **three events per venue**. Generate dates relative to the day the fixtures are created so the demo remains useful. Include multiple events at one location, an overnight event, a free event, a sold-out event, a cancelled event, and an event without an image. Ticket destinations must be clearly labeled demo links, not real purchase offers. Re-running the loader must not duplicate existing fixtures.

## Architecture and implementation boundaries

Preserve the existing GRASP/SOLID separation:

- **Domain:** add validated event, schedule, ticket, and revision concepts. Keep business rules independent of Graffiti and map libraries.
- **Application:** add event read/write ports, event publishing, date filtering, and shared event selection. Evolve the feed projection to include resolved events and venue locations.
- **Presentation:** implement `MapFeedView`, event list/detail components, grouped-pin thumbnail panels, and a shared filter toolbar. Keep map SDK operations behind a small adapter owned by the map module.
- **Infrastructure:** add Graffiti event schemas, revision resolution, and synchronization using the existing cursor/error-handling pattern. Retain stale-data behavior, confirmed deletions, and cleanup on navigation.
- **Composition:** wire both feed presentations and the four venue configurations. Select a map provider during implementation setup, recording attribution, key requirements, deployment-origin restrictions, and usage costs in the README. Never commit private credentials.

External ticket checkout, payment processing, live ticket inventory, recurring-event series, attendee accounts, venue verification, and user-post endorsement interfaces remain outside this sprint.

## Acceptance criteria and handoff

1. All four venue apps publish events that OurScene discovers with correct author attribution and unverified labels.
2. Visitors can pan/zoom the map, open a single event, and open a numbered pin containing separately selectable event thumbnails.
3. Pins at a shared location count matching events correctly and update immediately when filters change. Closing details preserves the map viewport.
4. Calendar-day and range filtering work across list/map views, including overnight events, inclusive end dates, daylight-saving boundaries, empty results, and invalid ranges.
5. Event pages show correct local times, ticket details, free/sold-out/cancelled states, and safe external links. Failed images use fallback artwork.
6. Publishing corrections does not duplicate an event; cancellation and deletion cannot accidentally reactivate an older revision. Forged authors and invalid schedules are rejected.
7. Keyboard and mobile users can access pin groups, event details, and the list alternative. Failed map/network loading provides useful fallback and stale-data messaging.
8. Existing tests remain green. Add domain/revision tests, date-boundary tests, grouping/count tests, reader lifecycle tests, and a browser walkthrough covering all four venues.
9. Deliver updated class and sequence diagrams, setup/deployment instructions, refreshed sandbox fixtures, and independently buildable app outputs. Document map-provider setup and verification limits.

**Demo walkthrough:** load the sandbox → open OurScene’s map → choose a date range → select a numbered pin → choose one thumbnail → inspect event/ticket details → switch to the list with the same filters → publish a new event from The Lantern or Signal Yard and discover it in OurScene.
