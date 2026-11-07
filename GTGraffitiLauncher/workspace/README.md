# GT Graffiti Workspace

The local workspace brings together **Yudo**, **Sylt**, and **OurScene**. It does not use ChatGPT Sites. The native GT Graffiti Launcher starts the server and opens the workspace in the default full browser after readiness. Safari or Chrome handles Graffiti redirects, passkeys, file selection, and recording permissions. The launcher retains server status and logs; unrelated library apps still use embedded views.

## Development

Use Node 22.12+ and install dependencies with `npm ci` in this folder and the sibling app folders `../../yudo`, `../../sylt`, and `../../ourscene`. Run `npm run build` here to build all apps, then `npm start`. Open **http://127.0.0.1:5178**. Stop any older standalone Yudo server first; the workspace never kills unrelated processes. Standalone app source/build commands remain available in each folder.

The native bundle includes the built web assets, Node, FFmpeg, ffprobe, relocated dynamic libraries, and license notices. Build it from the parent project with `zsh scripts/build.sh`. Building requires Xcode/Swift and the developer toolchain; normal use of the finished app requires no Homebrew installation or Terminal.

## Shared account and application views

The parent workspace owns one Graffiti client. App-host adapters mount isolated same-origin application documents and inject shared identity/navigation/media services. This preserves their separate designs, scopes styles and legacy global handlers, and keeps views mounted when switching. Activation/deactivation/disposal hooks stop playback, retain drafts, and clean up observers. Sylt prompts before stopping a live recording. Owner contexts in OurScene remain separate from the selected personal actor.

The original Graffiti namespaces and browser-storage keys are retained. Renaming does not migrate or duplicate real Graffiti records. Browser-only drafts, demo data, and sessions from the previous embedded view do not automatically transfer to a full browser, even at the same address. Real Graffiti records remain available after signing in. The shared workspace demo uses its own local Graffiti database, fictional musician identities, and a generated 72-second audio fixture. It never contacts real accounts. Demo publishing is local to that database even where the application says “public.”

## Sylt excerpts on Yudo

In Sylt, choose **My Practice → Feature on Yudo**, or choose **Add from Sylt** in Yudo’s sample editor. Select an interval, prepare the clip locally, play the exported preview, and add it to the private Yudo draft. A 60-second/50 MiB limit and three total Yudo sample slots apply. The editor keeps the interval selection for retry. Video is exported as H.264/AAC MP4, up to 720p, without upscaling; audio is AAC M4A. Oversized video is retried at 480p. It never silently shortens the selected interval.

Publishing the Yudo profile creates a separate **public Sylt excerpt**. The original retains its audience. The original URL, selected interval, and export revision live only in owner-restricted lineage records. Public excerpt metadata contains neither the private original reference nor its caption. Yudo links to the public excerpt and resolves it before playback, checking the author, access, format, duration, and size. No full-length original is published as a shortcut.

Yudo profile details can be imported once from Sylt after reviewing selected fields. Subsequent profile edits remain independent. Instruments require an explicit mapping to a Yudo role; images are validated before import.

Removing a Yudo sample only unlinks it. The sample editor’s **Manage public Sylt excerpts** action removes public excerpts or retries cleanup. Deleting the original through Sylt cascades to its excerpts; terminal markers hide an excerpt before deletion, and lineage supports retrying failed media cleanup. Yudo account-data removal does not delete Sylt assets. Changes performed directly through other Graffiti clients do not trigger Sylt’s deletion cascade. Distributed writes cannot guarantee exactly-once publication during prolonged delayed discovery; operation IDs and reconciliation reduce duplicates.

## Local media service

Media jobs accept bytes and bounded intervals, not paths/URLs/commands. Requests require the exact loopback host, same-origin access, a launch-specific token, and an account context. The server does not receive Graffiti credentials. Jobs have account-specific IDs, cancellation, 30-minute expiry, and private temporary files. Cleanup runs on cancellation, shutdown, expiry, and the next server start. One encode runs at a time. The CLI is invoked using argument arrays.

## Verification and remaining acceptance gates

Run `npm test` here, each app’s tests, OurScene’s `npm run check`, and the parent Swift tests. Automated tests use real local Graffiti permissions and actual FFmpeg exports, including exactly 60 seconds, silent portrait MP4, and WebM. Cross-post tests cover author mismatch, private source/lineage isolation, retries, removal markers, and source cascades. Server tests cover origin/token/account restrictions and path confinement.

Real-provider authentication (new passkey, restored session, cancellation, logout, account switching, return to initiating app), two real accounts, physical-device capture, and a clean Mac are manual release checks in Safari and Chrome. The user must complete credential creation and permission prompts. Workspace login-event failures display an error with a retry action. Never claim these passed merely because the automated local tests pass. Configure the real Yudo moderator actor before inviting pilot users. The native bundle is ad hoc signed for local development, not notarized for public distribution.
