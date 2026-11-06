# GT Graffiti web release

Yudo, Sylt and OurScene share one Graffiti identity and workspace. This is the source checkout for the free web launch; the sibling native Mac launcher remains supported. Synced project references and the previous local checkout have not been changed.

## Run locally

Use Node **24.15.0** (`.node-version`). From this folder:

```
npm run setup
npm test
npm run build:preview
npm run preview
```

Open http://127.0.0.1:5189. This is a static-only preview; it has no session or clip server. `/qa.html` is a staging/preview synthetic browser test. It never publishes test recordings to Graffiti. Existing native operation remains at http://127.0.0.1:5178.

For a release build, copy `release.config.example.json` to `release.config.json`. The example contains the reviewer address supplied by the project owner: `https://bcreinking.graffiti.actor`. Verify it exactly matches the actor emitted by your Graffiti session before testing delivery. No credentials belong in this file. Staging and production build commands reject invalid configuration.

```
npm run build:staging
npm run build:web
```

The output is `dist-web/`. A successful build is **not** proof that release gates passed. Run `npm run release:check` against the tested commit and complete `docs/ACCEPTANCE.md` before public promotion. No staging or production URL has been created in this checkout.

## What is included

- Single-origin public workspace, stable routes and aliases, browser-only encoding, optional local native encoding.
- Pinned FFmpeg wrapper 0.12.15 and single-threaded core 0.12.10; self-hosted scripts, worker, compressed WASM, integrity manifest, notices.
- Research disclosure, feedback contact, privacy policy, user agreement and sanitized copyable diagnostics.
- OurScene public browsing, open venue discovery, owner tools, and reviewer-approved community event submissions.
- Existing Graffiti namespaces, record contracts and local storage keys. No existing accounts or records are migrated to a new namespace.

See [deployment and rollback](docs/DEPLOYMENT.md), [test gates](docs/ACCEPTANCE.md), [operations](docs/OPERATIONS.md), [architecture](docs/ARCHITECTURE.md), and [verification results](docs/VERIFICATION.md).

## Native build

From `GTGraffitiLauncher`, run `zsh scripts/build.sh`. This uses the native Vite profile, Node loopback server and packaged FFmpeg tools. Build tools and native dependencies are omitted from the web build. The original delivered native application remains in the parent outputs folder. Rebuilding makes a separate bundle next to this checkout's launcher folder; it does not overwrite that original.

## Cost boundary

No paid service, custom domain, Cloudflare Functions/R2, external processing server, email service, push service or automatic telemetry is configured. Cloudflare Pages and Graffiti provider limits must be checked at release. Free plans do not guarantee unlimited storage or permanent availability. No ChatGPT Sites deployment is used.
