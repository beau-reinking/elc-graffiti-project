# Implementation verification — November 6, 2026

## Completed locally

- Clean `npm ci` installations from all four lockfiles on Node 24.15.0.
- 136 JavaScript tests pass: workspace 21, Yudo 10, Sylt 11, OurScene 85, release/static tests 9. OurScene TypeScript check passes.
- 14 Swift tests pass, including readiness, destination routing and owned process behavior.
- Production static build passes; preview-only QA page is absent from that profile. Preview build also passes. Both validate assets, worker, encoder manifest, notices, file count and native API exclusion.
- The pinned WASM core exports beginning/middle/end audio intervals from a five-minute source. Actual duration, size and AAC codec are checked.
- Browser UI in the built-in browser: parent/app Blob upload and playback conversion; cancellation before preparation; exactly 60 seconds of audio exported and opened as AAC M4A; browser-recorded silent WebM exported as playable two-second MP4. These are synthetic fixtures, not real Graffiti publications. Audio processing was about 0.7 seconds for a low-resolution generated tone; video about 0.6 seconds for a 320×240 generated source. These timings do **not** establish 1080p feasibility.
- Full workspace UI: public OurScene starts without fictional navigation; explicit local demo restores the shared actor; pending event stays out of the feed, approval appears after reconciliation, withdrawal removes it. No fabricated event was published to production Graffiti.
- Browser testing caught and fixed core ffprobe's successful `-1` return, restored-session listener ordering in the demo, overlapping event refreshes that duplicated inbox cards, and stale encoder manifests after a build update. Manifests now revalidate while checksum-versioned encoder assets remain cacheable.
- Existing remote repository history and GPL-3.0 license preserved. User requested the existing public visibility, replacing the private-source default.
- Native bundle builds and is ad-hoc signed and verified. Its tools are bundled without Homebrew runtime lookup. The original delivered application remains unchanged.

## Hosted staging

https://gt-graffiti-workspace-staging.pages.dev/ is deployed through Cloudflare Git integration from `web-launch`. Downloaded encoder integrity passes: 10,257,774 compressed bytes, 32,232,419 decompressed bytes, SHA-256 matches the manifest. No HTTP content-encoding is applied to the `.bin` payload. Required security headers are present and global cross-origin isolation is absent. A hosted synthetic 60-second AAC export passed in the built-in browser (about 2.2 seconds including first encoder loading); this is not the four-platform performance gate.

The first hosted smoke test found app-route refreshes returning 404 despite working local previews. The release build now emits real workspace documents at the three canonical app routes; `verify:host` asserts actual HTTPS responses rather than assuming the host matches the preview server.

## Not yet passed

- Production deployment; hosted real-provider authentication/callback and account-isolation checks.
- Current full Chrome and Firefox on both macOS and Windows; reference 8 GB laptop, five-minute 1080p source, three consecutive 60-second exports under ten minutes, active-worker cancellation and memory stress.
- Hosted real two-account musician flow and third-account isolation; report delivery and reviewer identity match; event review delivery on the real backend.
- Complete encoder corresponding-source distribution review and provider storage/limits confirmation.
- Production smoke test and rollback rehearsal.

Do not promote a production release on the strength of the local tests alone. The staging URL above is real; no production release is claimed. `release:check` remains blocked without genuine evidence.

## Dependency advisory review

The workspace audit reports three moderate entries in the local-demo dependency chain (GraffitiLocal → PouchDB → uuid), and no high/critical entries. The specific advisory concerns caller-supplied buffer bounds in uuid v3/v5/v6. The app does not call those UUID APIs with supplied buffers; production decentralized records are separate from the explicit local demo. The pinned Graffiti dependencies have not been silently upgraded. Reassess the dependency chain before a broader release. This is a limited review, not a claim that every dependency is vulnerability-free.
