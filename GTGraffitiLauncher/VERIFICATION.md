# Browser media fixes — November 6, 2026

See [PLAYTEST.md](PLAYTEST.md) for reproduced bugs, fixes, the 120 passing JavaScript tests, browser checks, and explicit real-account limitations.

---

# Sylt public-profile save fix — November 5, 2026

- Reproduced the reported null-to-object error using Graffiti decentralized 0.4.0's actual object encoder. Sylt passed `allowed: null` for public profiles; the encoder's undefined-cleaning routine calls Object.entries on null.
- Sylt now omits the access-list field for public records and public media. Owner-only defaults and explicit restricted audiences are retained.
- All 11 Sylt tests pass. New tests exercise the pinned production encoder for first-profile creation, public recording/media publication, and private defaults. Existing local access/deletion tests remain green.
- User confirmed successful passkey creation in the full browser. Live profile-save confirmation with the user's Graffiti account remains pending; tests do not write to that account.

---

# Browser authentication fix — November 5, 2026

- Unified workspace now opens in the default full browser after readiness. Native controls retain server status, logs, restart, and stop. Unrelated apps retain embedded views.
- Workspace: 13 tests pass, including login-event failure/retry, rejected login promises, restored sessions, actual FFmpeg exports, privacy, and local service restrictions.
- Native launcher: 14 tests pass, including delayed browser opening, latest requested route, already-running route changes, and cancelled startup.
- Existing Graffiti records, namespaces, and browser-storage keys are unchanged. Browser-only sessions/drafts are not copied from WKWebView.
- Rebuilt app and ZIP delivered; deep/strict code-signature validation passes. The updated app process and its bundled Node server are running, and `/health` returns the expected workspace identity.
- Native UI inspection could not finish: the desktop-control service failed to start after timeouts opening Chrome and the rebuilt launcher. No browser/passkey success is inferred from process/server health.
- New passkey creation, real-account restoration/logout/switching, and physical microphone/camera capture require manual verification with the user in Safari and Chrome. Automated checks do not establish those outcomes.

---

# Unified workspace verification — November 5, 2026

- Workspace: 10 tests pass, including real FFmpeg exports, selected-content validation, private/public Graffiti permissions, author isolation, source removal, account contexts, and local API restrictions.
- Yudo: 10 existing tests pass.
- Sylt: 8 existing tests pass, including the loopback static server.
- OurScene: strict TypeScript check and 82 existing tests pass after the Graffiti adapter upgrade.
- Native launcher: 12 Swift tests pass, including renamed-folder migration and server lifecycle.
- Media packaging: Node 24.15.0, FFmpeg/ffprobe 7.1 and 95 total executables/libraries relocated and smoke-tested with PATH restricted to system tools. This verifies executable/library relocation, not a physical clean-Mac installation.
- Browser demo QA: shared fictional personal identity; private 72-second generated audio; selection of seconds 5–65; actual 60-second export; preview gating; transfer into Yudo’s private draft; persistent view switching; OurScene map with 11 events and 4 venues; in-workspace venue/community navigation.
- Real-provider authentication, two real accounts, physical camera/microphone capture, and clean-Mac installation remain manual acceptance gates. No real musician profile, recording, or message was published for QA.

The application is ad hoc signed for local development. The source and built app are local outputs; no Sites deployment was made.

---

Earlier launcher verification follows for historical context.

# GT Graffiti Launcher verification

Build date: November 2, 2026. Apple Silicon, macOS 26.5.2, Apple Swift 6.3.2.

## Completed

- Final source: all 11 existing tests passed with zero failures after branding and setup changes.
- Coverage includes address restrictions, project detection, persistence and corruption preservation, output capture, process-group cleanup, two simultaneous HTTP apps, restart, occupied ports, missing folders, failed and unexpected exits, slow starts, cancellation, and timeout cleanup.
- Production arm64 executable built with deployment target macOS 14; ad hoc signature verified.
- Packaged application launched with a temporary library, separate from the normal library and Alcove.
- Light and dark appearances inspected: original GT artwork, full product name, native controls, empty library, app cards, and embedded workspace.
- Added two temporary projects using the project-path field and Detect; reviewed suggested name, description, and command, then supplied explicit Python HTTP server commands and addresses.
- Both apps launched concurrently. Entered “GT session preserved” into the first embedded page, switched to the second app, and returned: the note remained intact.
- Logs displayed server output. Favorites filtered to the starred app; searching for Wall filtered to that app.
- Stopped Wall and removed its library entry through the confirmation dialog. Its project files remained intact.
- Quit confirmation identified the remaining running app. Stop & Quit closed the launcher and released both test-server ports.
- Reopened the temporary library: the saved Ink entry and favorite restored, with status Stopped.
- Original process, readiness, persistence schema, and web-view behavior retained. Setup gained an editable project path and Detect fallback, an asynchronous folder picker, and an explicit folder filter. An optional environment override supports isolated appearance checks.

## Known limitation

The native folder picker displayed directories but kept Choose Project disabled in this environment, including after changing its modal presentation and folder filter. Paste a folder path into Project folder and click Detect instead; this route was verified end to end. The Choose button remains available for systems where the native picker works.

## Original files

The source ZIP and Alcove library were read only. Their SHA-256 hashes:

- Alcove.zip: `b276705c9852874bbbee53f1aef7da7aa8af0ef03426f9557d913b094221662f`
- Alcove/library.json: `7d63c085131f25c6c1d86a8999d2b6370d5feaa8de1a9bd20bcf5d1c4f8d0ffa`

## Distribution

Development build, ad hoc signed. Developer ID signing and notarization have not been performed. Intel and macOS 14–25 require device validation.
