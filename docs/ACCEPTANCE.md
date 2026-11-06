# Release gates — record evidence, do not assume success

A preview build may run without credentials. It is not a production release. Use real browser observations and designated test accounts; do not fabricate real-account results or venue data.

## A. Browser encoder

On current Chrome and Firefox, on both Windows and macOS, use a documented laptop with at least 8 GB RAM. Prepare a full 60-second excerpt from a representative five-minute 1080p source in under ten minutes. Repeat three times, test responsive controls and cancel during encoding, and check the compressed encoder response from the actual staging host. Record OS, browser/version, machine/RAM, source dimensions/duration/bytes, interval, elapsed time, consecutive runs, cancellation and asset checksum.

Test MP4/WebM, portrait, variable frame rate, silent video, audio, browser-recorded WebM without a duration header, start/middle/end intervals, exactly 60 seconds, invalid/overlong/out-of-bounds intervals, malformed/unsupported files and memory failure. Verify no source content outside the selected interval, actual duration/size, no upscaling, playable output and zeroed timeline. Do not silently replace failed browser processing with a paid backend.

`/qa.html` exists only in staging and preview builds. It tests same-origin parent/child Blob conversions, pre-cancellation, exact-60-second audio and browser-recorded WebM → MP4. It is a narrow engineering aid, not the four-platform feasibility gate.

## B. Regression

Run `npm test`: existing workspace, Yudo, Sylt and OurScene suites plus new core/contract/privacy/routing/moderation tests and OurScene type checking. Native: `swift test --package-path GTGraffitiLauncher --disable-sandbox`.

In the full workspace verify drafts and navigation, back/forward, direct links/aliases with query parameters, refresh and callbacks, keyboard labels, playback pausing and recording leave prompts. Test real parent/app frames for uploaded and recorded audio/video, playback conversion, replacement and failed save retention. Confirm web network traffic never calls localhost, `/api/session`, `/api/clips`, or a native bridge. Missing `.js`, worker and `.bin` URLs must return 404.

## C. Hosted Graffiti accounts

Use two musician accounts and a third account for isolation, in both browsers. People complete passkey prompts themselves. Test new/restored login, cancellation/retry, logout, switching, and return routes. Save a Sylt profile/private recording. Select, prepare, preview, privately save and consent to publish only the excerpt. The second account plays only that excerpt; the third cannot read original, draft, lineage, likes, messages or other restricted records. Match reciprocally, chat, block/unmatch, report, remove an excerpt and retry partial app-data cleanup. Verify report delivery under the configured reviewer actor, with no silent actor-URI mismatch.

Updated event gate: one account submits an upcoming event; public and third-account reads cannot see the pending submission. Reviewer approves it; it appears in the map/list with accurate date, timezone, address and approval disclosure. A non-reviewer approval is ignored. Reject another privately, withdraw an approved listing, and verify it disappears after refresh. Existing venue-owner authorization/discussions remain available for actual discovered venue accounts; genuine venue-owner recruitment is deferred by the project owner.

Clean up designated test records using their author accounts. Do not publish fabricated events to production. A static rollback cannot recall already public Graffiti copies.

## Evidence

Copy `release-evidence.example.json` to ignored `release-evidence.json`. Fill actual outcomes, not anticipated ones. The checker binds evidence to HEAD. Keep sensitive screenshots, actor identifiers and private URLs out of the repository and diagnostic summaries. Check Cloudflare build quota and Graffiti provider terms/storage limits before promotion. Review encoder source distribution.
