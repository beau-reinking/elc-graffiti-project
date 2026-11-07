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

## macOS staging run — 2026-11-06 (in progress)

Tested hosted commit `57492e0` on Mac15,13 / Apple M3 / 16 GB RAM. Generated source: 300 seconds, 1920×1080, 30 fps, H.264/AAC, 72,590,917 bytes, with visible source timecode. All six outputs were playable 60-second MP4 files, approximately 28.1 MB.

| Browser | Version | 0–60 s | 120–180 s | 240–300 s |
|---|---|---:|---:|---:|
| Chrome | 156.0.8078.81 | 54.5 s | 41.2 s | 49.4 s |
| Firefox | 158.0.1 | 50.5 s | 101.8 s | 63.1 s |

Both browsers remained responsive, cancelled an active encode, and retained the selection. Chrome retry passed in 39.7 seconds; Firefox retry passed in 89.0 seconds. Firefox required one manual source selection after its initial screen-capture failure; native controls subsequently recovered. Chrome login cancellation showed a retryable error; retry returned to provider login, and a user-created dedicated identity returned to the initiating Sylt route. Its Sylt profile saved successfully. A real private-audio save exposed a CSP incompatibility with Graffiti’s AJV runtime schema compilation. The take remained available for retry. Publishing the proposed policy fix is awaiting explicit approval after automatic review rejected the security relaxation. A successful hosted save retry remains unverified. Real-account media, privacy, matching, and moderation acceptance remain in progress. Windows remains unverified.

Findings fixed locally: cancellation was misleadingly labeled FAIL in the staging aid; old preview URLs were retained; Edge was misclassified as supported Chrome; release/venue validation wrongly required HTTPS instead of canonical Graffiti DIDs. The reviewer DID was resolved and reciprocally verified through the pinned SDK. The stable reviewer remains the project owner's account.

Regression checks: workspace 21, Yudo 10, Sylt 11, OurScene 86, static-site 11 tests passed (139 total), plus OurScene TypeScript. A moderation integration test exceeded its five-second limit during concurrent encoding; all 86 OurScene tests passed on a one-worker rerun, and a subsequent complete default-worker run passed all 139 tests. Staging build passed its static-asset checks. Native code is unchanged; prior 14 Swift results remain applicable. Encoder license/source distribution and provider quotas are still release gates. Production remains unpromoted.
