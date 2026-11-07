# Deploy for free

## Repository

The source projects remain siblings. Use `beau-reinking/elc-graffiti-project` as the existing public GitHub repository, retaining lockfiles and `.node-version`. `.gitignore` excludes dependencies, builds, native bundles, recordings, actual environment/configuration files, caches and local data. Review staged files before the first push. Never upload `sources/`, account sessions, credentials or temporary recordings. The example configuration contains only public values.

GitHub connector availability does not grant Cloudflare account access. No deployment token goes into the browser bundle or repository.

## Cloudflare Pages

Create two **Pages** projects through Git integration with this private repository: staging and production. Select free `pages.dev` addresses. Decide the permanent production address before onboarding real users. The origin matters to browser drafts and authentication storage; localhost sessions and browser-only drafts do not transfer. Graffiti records remain accessible when signed in.

Use the repository root as build root, Node 24.15.0, build command `npm run setup && npm run build:staging` for staging and `npm run setup && npm run build:web` for production, output directory `dist-web`. Do not enable paid add-ons, Functions, R2, Workers, a custom domain or an encoding server. Do not enable automatic production deploys from an untested branch. Connect the staging project to a staging branch; promote the exact tested commit to the production branch.

Because actual `release.config.json` is intentionally ignored, set the **public** environment variable `GT_RELEASE_CONFIG` to the JSON from `release.config.example.json` in both Pages projects. All configuration is public; never put credentials in it. The build validates and injects the moderator into Yudo and OurScene. Optional venue navigation may be configured later. Two real venue owners are no longer a prerequisite: the project owner changed this to moderator-approved community submissions.

The build pins the Graffiti and FFmpeg dependencies, checks 25 MiB per asset and 20,000 files, and creates physical workspace shell documents at each canonical route, aliases, `_headers`, `_redirects`, and a root 404. Missing scripts/encoder assets must return 404, never workspace HTML. Original query parameters on aliases remain intact. Cloudflare currently documents 500 builds/month on Free; that account quota cannot be measured by a source build, so record the dashboard count in release evidence and stay below it. Do not represent an artifact-size check as a monthly-quota check.

## Encoder and notices

The binary asset is an application-level gzip payload with `.bin` extension. Do not attach `Content-Encoding: gzip` to it. The browser explicitly decompresses it, verifies SHA-256 and uncompressed size, then creates the WebAssembly URL. Check the actual staging response and manifest before release. No CDN is needed at runtime. Static versioned encoder bytes may use normal HTTP caching; no service worker stores private recordings.

The generated core JavaScript path is versioned by a checksum. The WASM payload is about 9.8 MiB compressed in this build, below the asset limit. No multithreading or global COOP/COEP headers are used. The website permits same-origin app frames, Blob media/workers, HTTPS Graffiti providers and OSM tiles. Validate CSP against real authentication redirects and recordings on staging.

Review `licenses/ENCODER-SOURCE.md`. Complete corresponding-source distribution and retain its URL before promotion; notices alone do not satisfy every GPL distribution obligation.

## Release and rollback

Complete acceptance evidence at the exact commit. Run `npm test`, native Swift tests if changing native code, `npm run build:staging`, hosted acceptance and `npm run release:check`. Record commit, config, provider limits, encoder manifest and previous successful deployment. Promote that commit, then smoke-test production sign-in, save, excerpt processing/playback and event navigation.

A critical failure means roll back in Pages → Deployments → previous production deployment → Rollback. Do not delete Graffiti records to roll back website code. Retain compatible schemas. Test the restored version with existing records; pause the affected flow if it cannot read them. Keep the failed deployment and diagnostics for investigation without media, messages or session tokens.

Official references:
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/pages/configuration/git-integration/
- https://developers.cloudflare.com/pages/configuration/serving-pages/
- https://developers.cloudflare.com/pages/configuration/rollbacks/

The canonical app paths have real copies of the workspace document with absolute asset URLs. This avoids Pages HTML normalization affecting index.html proxy rules, while absent assets still return 404. After every staging release, run `npm run verify:host -- https://gt-graffiti-workspace-staging.pages.dev` to assert actual route statuses, redirects, headers and decompressed encoder integrity.
