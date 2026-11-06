# Browser playtest — November 6, 2026

## Fixes

1. Shared-client media uploads now normalize app-frame Blob/File objects into the parent client's Blob context. Reproduced the exact invalid_type / expected Blob error through Sylt's upload UI before the fix; the same generated WAV saves successfully afterward.
2. Shared-client media reads return Blobs in the requesting app's context. Reproduced “This recording is unavailable” for a saved recording before the fix. Afterward, playback reports advancing currentTime, no media error, and the expected duration. Bytes, MIME type, authorship, and audience are preserved. Disposed clients reject late upload completions.
3. Session restoration no longer writes a stale login return route, and startup uses the SDK-restored current URL. A direct /sylt/?qa=route-check URL remained on Sylt after initialization. Excerpt query links also select Sylt.

## Browser checks completed

The full workflow below used the isolated local workspace demo in the available built-in browser. Synthetic audio only; “publication” here stays in the local Graffiti database.

- Generated five-second WAV: upload, preview, private save, success dialog, library entry.
- Existing 72-second audio: open and play; confirmed paused=false, advancing currentTime, duration=72, no media error.
- Clip editor: reject a 65-second selection; export interval 5–65; verify actual excerpt duration=60; prevent adding before preview; play prepared output; transfer to a private Yudo draft.
- Yudo: retain unsaved preference text while switching apps; review disclosure; publish the demo profile with two excerpts; resolve and play the public excerpt; confirm duration=60 and playback pauses across app switching.
- Discovery: a single like advances to the next card; Connections remains at zero without reciprocal interest. Keyboard navigation works. Two-account chat was covered by automated tests, not this browser session.
- OurScene: 11 events / four venue map pins; filter to Blue Hour's three events; list view; event details; enter the corresponding venue community; shared account is present; choose a username; publish a local demo post and reply.
- Browser console reported no errors in the demo inspection.

## Real-account checks and limits

- Native desktop controls reached the existing Firefox workspace. A separate test tab restored the user's real Graffiti session and loaded the existing Sylt profile.
- The native file picker selected the generated WAV but kept Open disabled; desktop control also timed out during path entry. The real-backend save could not be completed through that picker. Cancelled the picker, closed the empty test recorder and extra tab, and left the original recording tab unchanged.
- Chrome extension background control was unavailable. At the user's request, existing desktop controls were used instead of requiring extension setup.
- No real public profile, recording, or community post was created or changed. Microphone/camera capture, two real accounts, real-backend media upload/playback, and full login/logout/account-switch sequences remain manual acceptance checks.

## Automated checks

- Workspace: 17 tests pass, including media contexts, rejected fake Blob input, stale upload completion, access rules, real FFmpeg exports, cancellation, malformed media, and clip publication/removal.
- Sylt: 11 tests pass, including production-encoder profile publication regression and private/public media access.
- Yudo: 10 tests pass, including reciprocal likes, restricted messages, closures, media permissions, and retries.
- OurScene: 82 tests pass; TypeScript check passes.
- Total: 120 JavaScript tests. No native source changed in this phase; the previous 14 Swift tests remain the last native test run.

See PLAYTEST-Yudo.png for the tested 60-second excerpt player. The rebuilt app retains local FFmpeg processing; no web deployment was made.
