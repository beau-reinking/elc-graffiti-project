# V3 release notes

OurScene now puts the map in the initial viewport, removes its promotional hero/statistics, and retains compact branding/navigation and stacked discovery controls. Free, maximum-price/currency and shared-genre filters combine with the existing date/search/venue filters. Missing or other-currency prices are excluded only when a maximum is active; free tickets count as zero. Genres use any-selected matching. Full fictional addresses appear in cards, thumbnails and details.

All twelve sandbox events have distinct generated fictional performer photographs, descriptive alternatives, visible demo labels and optimized bundled WebP assets. An allowlisted, local-only resolver maps fixture keys to assets. It cannot load arbitrary file paths; user-supplied image links remain HTTPS-only.

## Venue communities

Public Events and Community views replace an operator-first home screen. Owner profile/event forms live in a role-gated Owner area. Visitor and owner login flows share a restored-account selector without exposing actor IDs in rendered text. An optional session-storage preference remembers the selected actor, never session tokens.

A public username claim is required to publish posts or nested text replies. Posts support text, optional HTTPS image links and optional venue-scoped event tags. Replies retain root and parent references. Feeds order posts newest-first and replies oldest-first, with stable-key tie breaks; visual indentation stops after three levels and deeper branches expand. Missing-parent, cyclic and inconsistent ancestry is excluded with diagnostics.

OurScene resolves the venue’s discovered HTTPS `appUrl`, not its website, and adds `?view=community&event=<stable-event-id>`. Local mode resolves known venue actors to sandbox paths. Tagged posts link to `?view=events&event=<stable-event-id>`. These routes survive reload and revisions. Cancelled discussions remain readable; withdrawn/unavailable collections remain readable but cannot be newly tagged.

Authors delete their own content through a terminal author-removal record followed by source deletion. Removal records contain only structural references, original timestamp and optional event tag, preserving reply ancestry and event collections without retaining text or photo URLs. A failed source cleanup yields a visible warning. Venue-authored moderation records hide or restore a subtree in that venue’s interface. Forged moderation is ignored; hiding does not remove publicly stored data. Owners can inspect and restore hidden threads.

## Decentralized usernames

Names are normalized to lowercase and restricted to 3–24 ASCII letters, digits or underscores. Each actor’s latest claim is current (publication timestamp, then smallest URL for ties). For a name claimed by multiple current actors, the lexicographically smallest object URL wins. Claims are public discovery records, not atomic reservations. A loser must choose a new name before publishing, and existing content displays `username_unavailable` until that actor has a winning name. Username setup refuses stale or incomplete discovery.

The UI hides actor identifiers but public Graffiti metadata still exposes authorship. Setup explicitly discloses this and the possibility of later naming conflicts. There is no anonymity, centralized identity authority, account ban service, or promise of global reservation. Existing public content remains readable without login.

## Compatibility and boundaries

Event schema version 1 gains optional `genres` and `demoArtworkKey`; profile version 1 gains optional HTTPS `appUrl`. Old records remain readable. New version-1 community types are `UsernameClaim`, `CommunityPost`, `CommunityReply`, `CommunityRemoval`, and `CommunityModeration`. Separate username and venue-community channels avoid changing the legacy announcement workflow.

Existing immutable event revision, cancellation, removal, cursor, tombstone, stale-cache and subscription lifecycle contracts remain in force. The loader upgrades prior demo records without new event IDs, respects removals, and seeds four communities with visitor identities, event/general posts, five-level replies and a hidden example. No destructive storage reset is required.

Editing community content, approval queues, account bans, uploads, payments, inventory sync, notifications, private messages, and centralized indexing are deferred. External image hosts receive ordinary browser image requests. Map provider terms and operational limits still apply. Real decentralized account/deployment smoke testing is required before launch.

## Verification

The automated suite passes 82 tests across ten files, including existing reader/identity/event contracts and new pricing, genres, username conflicts, nested ancestry, authorization, removal, moderation, source failure/recovery, fixture idempotence, navigation and artwork allowlisting. All five production apps build. Local browser verification uses the official Graffiti local implementation and covers immediate posting/replying, content-free deletion placeholders, owner hide/restore, visitor visibility, session switching, direct discussion reloads, price filtering, generated images, addresses, and a 390 × 844 responsive viewport. Real online account authentication/publication and native mobile devices remain deployment smoke tests.
