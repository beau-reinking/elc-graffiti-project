# Yudo

This app is also available inside **GTGraffitiLauncher** through the shared local workspace. See `../GTGraffitiLauncher/workspace/README.md`. Its original Graffiti namespace is retained for compatibility.


A mobile-first musician matching app using Graffiti identity, objects, discovery, permissions, and media. Its namespace is `urn:soundcheck:musicians:v1`, separate from Sylt.

## Run

Yudo runs on your computer at **http://127.0.0.1:5178**. It does not use ChatGPT Sites or require ChatGPT sign-in. Graffiti handles musician-account login and real account data.

Use Node 22 or newer. Double-click **Start Yudo.command** to build and serve the app. Keep its Terminal window open while using Yudo; press Control-C to stop it. If dependencies are missing, the launcher installs the pinned versions first.

Alternatively, open this folder in Terminal, run `npm ci` once, then `npm start`. The start command builds the latest source before serving it on loopback only. Open http://127.0.0.1:5178 in a full browser. For development with live reload, use `npm run dev` instead; the two commands use the same port and must not run at the same time.

`npm test` runs domain, session-event, and real Graffiti local-implementation permission tests. `npm run build` creates `dist/`. No deployment service or hosting manifest is needed.

Local hosting does not make Graffiti accounts offline: real sign-in, discovery, messaging, and uploaded media still use Graffiti. The demo stores fictional records locally. Demo data and restored sessions are scoped to the browser origin, so use the same URL consistently; data from the former hosted origin is not automatically copied.

## What works

- Graffiti-managed login/logout and restored sessions; no app password collection.
- Six-step private draft onboarding with explicit adult/publication consent.
- City selection, geolocation rounded to 0.1 degrees, radius and discovery preferences.
- Global city lookup through Open-Meteo/GeoNames; only the typed city query is sent. Common cities work without this service. Commercial use requires reviewing Open-Meteo's licensing and paid service requirements.
- Profile image and up to three audio/video samples, file validation and featured sample selection. Draft uploads are private; publishing creates separate public media copies.
- Instrument/intent ranking and filters, swipe or button pass/like, reciprocal matches, text conversations tied to the exact pair of likes.
- Unmatch, private blocks, restricted reports, moderator report review and discovery exclusions, app-data removal with partial-failure retry.
- Continuation polling, tombstones, cursor restart, operation identifiers and retry reconciliation.

## Moderator setup before a pilot

Copy `.env.example` to `.env.local`, set `VITE_MODERATOR_ACTOR` to the actual moderator's Graffiti actor URI, and restart with `npm start`. Never place a password or token here. Sign in as that actor and open Profile → Review reports. The reviewer checks the referenced profile/media/message and can exclude a musician from this app's discovery. Reports do not automatically remove content. The owner must name a reviewer, agree a review schedule and escalation channel, and test a report before inviting participants. Reporting is visibly unavailable until configured; this local build intentionally does not invent a moderator identity.

## Access and data behavior

Published profiles, city/coarse location, images, and samples are publicly accessible through Graffiti, including outside Yudo. The UI login is not a privacy boundary for public data. Drafts/settings/passes/blocks/assets are owner-only; likes/messages/connection closures permit the two actors; reports permit the reporter and moderator. Channels organize discovery and do not provide permissions. Media permissions are applied separately. Never advertise chats as end-to-end encrypted.

Matching and blocking are application behavior. Another client can write participant-addressed records; Yudo validates authorship and refuses to display messages without a current reciprocal connection. Blocking does not revoke access to public profiles. Unmatching closes the old pair of likes, preventing stale messages from reopening after a future match. Removal deletes the user's authored app data and uploaded media, not their Graffiti identity, other actors' records, or downloaded copies.

Immutable profile/settings records use authored revisions and URL tie-breaking. Replacement saves first, then cleans up older records. Concurrent edits on multiple devices can resolve to one winner; refresh before editing on another device. Distributed writes are not transactional and retries are not a guarantee of exactly-once storage under prolonged delayed discovery. Failed cleanup retains private asset records for later retry. An upload whose inventory record cannot be created is immediately removed on a best-effort basis; simultaneous storage failure at both steps can require provider-side cleanup.

## Demo

Explore the demo uses a separate IndexedDB database containing clearly labeled fictional musicians. It never writes to Graffiti or contacts a moderator. Demo likes/messages/profiles persist only in this browser. One existing fictional connection is seeded, and Jules has already liked the demo user so a reciprocal match can be reviewed. Demo users do not autonomously reply. Real sessions never receive seeded profiles. The demo has no seeded performance recordings.

## Release checks

The local server listens only on this computer. Each pilot participant should run their own local copy and sign in with their own Graffiti account. Do not share a loopback URL as a remote invitation. Graffiti's object permissions govern account data independently of local hosting. Two real Graffiti accounts and physical-device checks remain required before a multi-user pilot; see `PILOT.md`.

No behavioral analytics, message-content tracking, or recording telemetry is sent. Pilot metrics should use aggregate, consented observation: onboarding completion, sample publication, time to match, match-to-two-way-conversation rate, empty results, and report handling. Do not count time spent swiping as the primary outcome.

The Graffiti local implementation's PouchDB development dependencies have upstream moderate advisories. They are excluded from the production browser bundle; review them before using the local implementation in a server. Production uses the decentralized implementation.
