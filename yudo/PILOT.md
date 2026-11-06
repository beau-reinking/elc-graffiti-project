# Pilot verification

## Before inviting anyone

1. Configure the real moderator actor and rebuild; verify a report reaches that account and an exclusion affects discovery.
2. Give each participant a local copy. Run `npm ci` once and `npm start`, then open http://127.0.0.1:5178. Each computer has its own loopback server; Graffiti connects the accounts. No ChatGPT sign-in or Sites deployment is used.
3. Recruit consenting adults; explain public profile/sample visibility and restricted interaction data.

## Two real accounts in full browsers

- Sign in via Continue with Graffiti. Check provider sign-in/account selection, cancelled login, session restoration, logout, and account switching. Do not enter Graffiti passwords into Yudo.
- Build a private draft; verify account B cannot retrieve account A's draft, settings, pass, or block records or private media.
- Publish with explicit consent; retrieve the public profile/sample without an authenticated session. Confirm exact device location was never stored.
- Confirm one like does not enable chat and two likes create a connection. Account C must not retrieve their likes/messages/media restricted to those participants.
- Exchange messages; check badges/alerts while open. Turn notifications off. Confirm there are no background notifications.
- Unmatch, block, and retry with old connection references. Confirm old messages remain excluded. Check that a block does not claim to revoke public data outside the app.
- Interrupt connectivity during upload, publish, messaging, and cleanup. Retry; check for duplicates and orphan cleanup. Confirm drafts/text survive failures.
- Remove app data, retry partial failures, and verify own public objects/media are removed. Confirm other people's records and the Graffiti identity remain separate.

## Devices and accessibility

- Check iOS Safari and Android Chrome on physical phones, desktop Safari and Chromium, permission denial, and return from provider authentication.
- Test playable MP3/M4A/WAV/MP4/WebM clips, unsupported codecs, oversize files, clips longer than 60 seconds, and removed media. Codec support depends on the browser; do not promise automatic transcoding.
- Check keyboard-only operation, visible focus, dialog focus containment, screen-reader labels, 200% text zoom, reduced motion, and swipe/button equivalence.

## Observed during this build

Automated tests use the actual Graffiti local implementation for permissions. Browser QA uses the isolated local demo, including reciprocal matching, messaging, mobile draft editing, and uploading a generated one-second WAV fixture. Provider-backed two-account interactions and physical-device checks remain manual release gates; no real musician profile or message was published during build QA.
