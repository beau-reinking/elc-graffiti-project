# V3 setup and acceptance walkthrough

1. Open the extracted `music-venues` folder in VS Code. Use Node 22.12+; run `npm install`, then `npm run dev:sandbox`.
2. Visit http://localhost:5173 and choose **Load venues, events & community**. Re-running is safe: stable fixture IDs, revisions, removal markers and existing moderation actions prevent duplicate or resurrected content.
3. Open OurScene. Its initial viewport includes the map. Test Free only, a maximum USD price, multiple genres, and dates. Apply filter changes; Reset restores defaults. Pin counts, location thumbnails and List use the same projection.
4. Open a pin and an event. Confirm complete fictional address, schedule, genre, generated artist image and external demo ticket label. **Join the conversation** opens the venue’s event collection.
5. In Community, **Visitor sign in** accepts a sandbox handle. Use `river_notes`, `milo_live`, or `sky_sounds` for existing names, or create a new handle and choose a username. Local identity is deliberately insecure and remains separate from deployed accounts.
6. Publish a post, optionally select an event or provide a public HTTPS image URL. Reply to a post and then a reply. Expand deeper replies. Delete your own content; descendants survive under a placeholder.
7. Use **Venue owner sign in**: `blue-hour-demo`, `red-room-demo`, `lantern-demo`, or `signal-yard-demo` in its corresponding app. Choose **Owner area** to register/update its profile and publish/revise/cancel/withdraw events. Choose **Moderate community** or return to Community to hide or restore a thread. Switch Active account to verify visitor visibility.
8. Refresh a direct event discussion link. It retains the selected collection. A tagged post opens the venue’s event details. Cancelled discussions stay open; withdrawn event collections remain readable, and withdrawn events cannot be newly tagged.

## Independent deployments

Copy `.env.example` to `.env`, configure actual owner actors and deployment navigation URLs, and keep decentralized mode. Obtain actor IDs through Graffiti account tooling. Publish each app’s full HTTPS entry URL in its **Venue app URL** profile field. Website and app URL have different purposes.

Run `npm test`, `npm run check`, and `npm run build`. Deploy the five `dist/<app-id>` directories separately. Each has relative assets and ordinary query-string routes. Build-time `.env` settings are public; sessions and secrets do not belong in them. Configure a map provider appropriate to expected traffic, retaining attribution. Use `npm run dev:all` for separate development origins, or the sandbox server for shared local storage; do not run both on port 5173.

Online smoke testing requires real Graffiti accounts: sign in a visitor and owner, claim a unique name, publish/reply, verify a second browser sees the records after synchronization, moderate as owner, verify visitor hiding, delete as author, and open OurScene’s cross-origin discussion link. These real-account checks are separate from automated tests and local browser verification.
