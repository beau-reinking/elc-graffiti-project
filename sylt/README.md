# Sylt

This app is also available inside **GTGraffitiLauncher** through the shared local workspace. See `../GTGraffitiLauncher/workspace/README.md`. Its original Graffiti namespace is retained for compatibility.


A responsive web app for musicians to save private audio/video practice, share selected takes, and encourage friends. Home includes friend management. No streaks or daily goals.

## Run on your computer

Use Node 22 or newer:

```sh
npm ci
npm run build
npm start
```

Open `http://127.0.0.1:4173`. This is the self-hosted production server; no ChatGPT account or hosting service is required. The application itself uses Graffiti login when you choose to save real account data. “Explore the demo” works without an account.

For development, use `npm run dev`. Run `npm test` for behavior, access-control, and HTTP server tests. Open `/design.html` for the annotated interactive desktop/mobile review.

The standard browser is important: the existing GT Graffiti Launcher embedded web view blocks microphone/camera access. Uploading remains an alternative where recording APIs are unavailable.

## Deploy on your own server

### Node

Build once with `npm ci` and `npm run build`, then run `npm start` under your server's process manager. The runtime only needs Node, `server.mjs`, and the built `dist/` directory; it does not need installed npm packages. `HOST` defaults to `127.0.0.1` and `PORT` to `4173`. Set them in your service environment if needed. The app is intended to live at the root of its domain.

Put your normal HTTPS reverse proxy in front of port 4173. `Caddyfile.example` provides a minimal configuration: replace `music.example.com` with your domain and point its DNS at your server. Keep the app process listening on loopback when using a proxy on the same machine. For other static servers, serve the contents of `dist/` directly; retain the real `/design.html` and asset paths rather than redirecting all requests to an authentication portal.

### Docker

```sh
docker compose up --build -d
```

This builds the browser assets and runs a non-root Node server at `http://127.0.0.1:4173`. It needs no database, writable data volume, or application secrets. Use the same HTTPS proxy configuration for your own domain. Stop it with `docker compose down`.

Use HTTPS for remote access: browser microphone/camera capture requires a secure context. Localhost is supported for local testing. See [MDN's recording permission requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#privacy_and_security).

Public recording links use the current server origin automatically. There is no site-wide ChatGPT sign-in gate: public shares are viewable without an Sylt login, while private and friend-only data remain protected by Graffiti's object and media access rules.

## Account and data

Real sign-in uses `@graffiti-garden/implementation-decentralized` and the provider's account flow. Sylt does not collect passwords. All production records and media go through Graffiti. Browser-local demo storage uses IndexedDB and is labeled separately; demo public links are intentionally unavailable.

Private practice objects and media explicitly allow only their author. Sharing uploads separate media with a captured friend audience. Public sharing creates another media copy and a public metadata object. Friends-only comments stay separate. Graffiti data objects are immutable: profiles/settings use the latest authored record. Friendship acceptance must be authored by the request target. Removing a friend affects future interactions; earlier shares retain their original audience until removed.

Recordings are limited to five minutes and 100 MiB. Browser format support varies. No transcoding, offline upload queue, or cloud draft recovery is implemented. A failed take remains available while its recording dialog stays open.

Operation IDs and discovery before retries reconcile already-saved practice entries and comments. Media references are retained during retries. Graffiti's distributed interface does not guarantee transactional exactly-once writes; delayed discovery after an ambiguous network failure remains a pilot edge case.

## Design handoff

Open `/design.html` for interactive desktop (1200 px) and narrow-screen (390 px) prototypes with annotations and a screen/state inventory. Both use explicitly labeled demo data. The demo recordings are generated musical tones, not claimed human performances.

See `PILOT.md` for the usability study and four-week pilot protocol.

## Verification and deployment limits

Automated tests cover recording validation, deterministic feed order, reciprocal friendships and removal/reconnection, escaping, and real Graffiti local-implementation access rules for private objects/media, friend shares, public copies, comments, and deletion.

Browser checks cover demo startup, upload/preview/private save, optional friend sharing, comment persistence, friend-panel focus restoration, and desktop/mobile rendering. Production account creation, microphone/camera capture on physical devices, and two real-user end-to-end sharing require user accounts/device permissions and remain manual pilot checks. Automated access tests use Graffiti's local test implementation; production always uses the decentralized implementation.

The standalone package contains no ChatGPT Sites manifest or deployment tooling. Hosting the browser app yourself does not also host the Graffiti infrastructure: identity and social data still use the Graffiti provider selected by the user. No new server destination or domain was supplied, so remote deployment is left to your server administrator. Docker files are supplied but require verification on a machine with Docker installed.

The local Graffiti test package pulls older PouchDB dependencies with moderate audit advisories; those dependencies are development-only and excluded from the browser bundle. Review the upstream test dependency before using it in any server process.
