# Implementation verification — November 6, 2026

## Completed locally

- Clean `npm ci` installations from all four lockfiles on Node 24.15.0.
- 136 JavaScript tests pass: workspace 21, Yudo 10, Sylt 11, OurScene 85, release/static tests 9. OurScene TypeScript check passes.
- 14 Swift tests pass, including readiness, destination routing and owned process behavior.
- Production static build passes; preview-only QA page is absent from that profile. Preview build also passes. Both validate assets, worker, encoder manifest, notices, file count and native API exclusion.
- The pinned WASM core exports beginning/middle/end audio intervals from a five-minute source. Actual duration, size and AAC codec are checked.
- Browser UI in the built-in browser: parent/app Blob upload and playback conversion; cancellation before preparation; exactly 60 seconds of audio exported and opened as AAC M4A; browser-recorded silent WebM exported as playable two-second MP4. These are synthetic fixtures, not real Graffiti publications. Audio processing was about 0.7 seconds for a low-resolution generated tone; video about 0.6 seconds for a 320×240 generated source. These timings do **not** establish 1080p feasibility.
- Full workspace UI: public OurScene starts without fictional navigation; explicit local demo restores the shared actor; pending event stays out of the feed, approval appears after reconciliation, withdrawal removes it. No fabricated event was published to production Graffiti.
- Browser testing caught and fixed core ffprobe's successful `-1` return, restored-session listener ordering in the demo, and overlapping event refreshes that duplicated inbox cards.
- Existing remote repository history and GPL-3.0 license preserved. User requested the existing public visibility, replacing the private-source default.
- Native bundle builds and is ad-hoc signed and verified. Its tools are bundled without Homebrew runtime lookup. The original delivered application remains unchanged.

## Not yet passed

- Staging/production Cloudflare deployment and actual hosted compressed-asset/CSP/auth callback checks.
- Current full Chrome and Firefox on both macOS and Windows; reference 8 GB laptop, five-minute 1080p source, three consecutive 60-second exports under ten minutes, active-worker cancellation and memory stress.
- Hosted real two-account musician flow and third-account isolation; report delivery and reviewer identity match; event review delivery on the real backend.
- Complete encoder corresponding-source distribution review and provider storage/limits confirmation.
- Production smoke test and rollback rehearsal.

Do not promote a production release on the strength of the local tests alone. No staging or production URL is recorded until actually deployed. `release:check` remains blocked without genuine evidence.

## Dependency advisory review

The workspace audit reports three moderate entries in the local-demo dependency chain (GraffitiLocal → PouchDB → uuid), and no high/critical entries. The specific advisory concerns caller-supplied buffer bounds in uuid v3/v5/v6. The app does not call those UUID APIs with supplied buffers; production decentralized records are separate from the explicit local demo. The pinned Graffiti dependencies have not been silently upgraded. Reassess the dependency chain before a broader release. This is a limited review, not a claim that every dependency is vulnerability-free.
