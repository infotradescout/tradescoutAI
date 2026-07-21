# Community makeover — Selective Inheritance packet

Status: `changes_requested`

Observed: 2026-07-21

> This packet stages a plan for review. It does not authorize any code
> change. Every finding is sourced directly from the repo (file paths,
> line numbers, git history) or from named unmerged branches.

Thomas's framing: "tradescout community needs a huge makeover. it should
look and feel more like Nextdoor or facebook." Follow-up scoping: the whole
surface is off (post cards, profile presence, and the lack of any real
"local" feel), and this should go through an audit-then-plan process before
any code changes, the same way the theme convergence work did.

**Process note:** this packet’s keep/discard lists are an instance of
**selective inheritance as a model** (see `docs/LISA_PRODUCT_DEFINITION.md`) —
not only a docs tool. Inherit what still earns its place; discard dead
duplicates and waste; don’t regenerate the feed from a blank prompt.

**North star (refined 2026-07-21):** TradeScout Community must be
**replacement-grade for the local social job** — not a 1:1 Nextdoor clone.
Nextdoor’s **social media craft** is the quality bar (daily local feed,
neighbor presence, discourse, safety/moderation that feels native). We do
**not** copy their product shape wholesale (polygon HOA politics, open
neighbor DMs, ads model, etc.). We keep TradeScout law: visibility ≠ access,
all contact Intent → Decision Card → Contact, Trust/CVS governs exposure, no
pay-to-play — and we win by pairing top-tier local social with the path to
real work (Scout / Direct Connect).

## Why this matters more than it looks

This directly serves the project's own north star: **people don't believe
a TradeScout profile changes their life, and nothing is "done" until they
do.** Community is the one surface whose entire job is proving that belief
socially — a neighbor seeing another neighbor get real help, in public,
is a stronger trust signal than any amount of marketing copy. A feed that
reads like a form instead of a place people want to check daily works
against that goal directly. “Top-notch social” means the local pulse feels
as sticky and human as Nextdoor’s best feed moments — without pretending we
are Nextdoor.

## Part 1 — What exists today (catalogued, not guessed)

### 1.0 Four things share the name "Community" and only one should survive

- `client/src/pages/community-feed.tsx` (1822 lines) — **canonical**,
  routed at `/community-feed`. `/community` redirects here
  (`AppRoutes.tsx:1217-1220`).
- `client/src/pages/community.tsx` (597 lines) — **legacy**, unrouted, but
  still real code with its own composer/category taxonomy
  (`CommunityComposerInline`), still exercising `CommunityPostCard`. Not
  dead, just orphaned — a second, drifting implementation of the same
  surface.
- `client/src/pages/CommunityFeed.tsx` (capital F) — a stub, "remains only
  for the playground" per its own header comment.
- `client/src/components/social/*` (`SocialFeed.tsx`, `PostCard.tsx`,
  `CommentsSection.tsx`, `CreatePostModal.tsx`, `ShareModal.tsx`,
  `ReportModal.tsx`) — a **fully separate, explicitly quarantined** system.
  `SocialFeed.tsx`'s own header: `@deprecated Quarantined socialPosts
  client. Community activity is owned by pages/community-feed.tsx and
  CommunityPostCard.` A client-side contract test
  (`client/src/routing/canonical-surface-ownership.contract.test.ts`)
  actively enforces that `SocialFeed.tsx` never becomes reachable through
  routing again.

**The social/\* system already has the richer mechanics being asked for** —
see 1.3 and 1.4. It's the single biggest reusable asset for this makeover,
not a distraction.

### 1.1 Feed structure (`community-feed.tsx`)

`CountyRequiredGate` → header/stats card → `CommunityTopNav` (**currently a
literal no-op**, `return null`, comment: "removed per user request — using
story-style cards instead") → tabs (`forYou | recent | vault`) + an
independent Local/Global toggle → inline composer (local-scope only) →
feed list of `CommunityPostCard` → right rail (`CommunitySnapshotRail` +
trending topics).

A separate full-screen "topic" dialog renders a second, parallel post list
using plain `Card`/`CardContent` instead of `CommunityPostCard` — a second
rendering path for the same data.

**No pagination**: `limit=20&offset=0` is hardcoded everywhere; there is no
"load more," infinite scroll, or cursor anywhere on the client, even though
the server route already accepts `offset`.

### 1.2 Post cards (`CommunityPostCard.tsx`, 910 lines)

- Images: up to 8, uniform `grid-cols-2/3` tiles, no hero-image treatment,
  no lightbox/carousel. Video is silently smuggled into the same image
  array with no `<video>` tag anywhere — it just tries (and fails) to
  `<img>`-render it.
- Author block (avatar, name, role, verified/verification/CVS badges) is
  **written out twice, nearly verbatim**, for the linked vs. read-only
  case (lines 496-579 and 580-658) — no reusable `AuthorChip`.
- Avatar fallback is the TradeScout logo mark, not user initials.
- Category styling (`getCategoryMeta`) covers 10+ types with icon + label +
  accent color — this part is already reasonably rich.
- Likes: single heart icon, binary, no reaction picker.

### 1.3 Reactions — a real system exists, just wired to the wrong table

- Live: `postLikes` (binary, `communityPosts.id`), county-gated. That's it
  on the live path.
- **Dormant but fully built**: `reactionTypeEnum` = `like, love, laugh,
  wow, sad, angry, helpful, thanks` (`shared/schema.ts:220-229`) — an
  actual Facebook-style reaction set already in the database. Full API
  (`server/social-routes.ts:312-380`) with count aggregation and even XP
  hooks for helpful/thanks reactions. Client picker exists in the
  quarantined `social/PostCard.tsx`. **The catch**: `postReactions` FKs to
  `socialPosts.id`, not `communityPosts.id` — it was built for the
  deprecated table.

### 1.4 Comments — flat today, threaded version already built and tested elsewhere

- Live: flat list, no replies rendered (even though `parentCommentId`
  exists on the row), no comment likes UI, no edit/delete UI, inline
  inside `community-feed.tsx:98-271`.
- **Schema bug, independently confirmed**: `postComments.postId` FKs to
  `socialPosts.id`, but the live community route creates comment rows
  keyed by `communityPosts.id` values — a genuine FK/reference mismatch
  that "works" only because the constraint isn't actually enforced in the
  live path.
- **Already fixed and tested on `origin/feature/community-neighborhood-feed-foundation`** (2026-07-08, unmerged): that branch changes the FK to
  `communityPosts.id`, adds a `buildOneLevelCommentThreads` helper (one
  level of visual reply nesting), server-side parent-comment ownership
  validation ("Parent comment does not belong to this post"), and a
  dedicated contract test proving all of it. See Part 2.
- Dormant, richer still: `social/CommentsSection.tsx` has full recursive
  reply rendering + per-comment reactions, also not reachable today.

### 1.5 Profile presence

No reusable author-chip component (see 1.2). Three stacked badges
(verified / verification-status / CVS "Trust checked") but the CVS
**score itself is never shown**, only a static label. Avatar fallback
doesn't use initials.

### 1.6 Neighborhood/local scoping — doesn't exist yet, this is the real gap

The app's location model stops at **county**: `communityPosts.scope` enum
is `national | state | region | county | city` — **no `neighborhood`
value**. `CommunityPostCardData.audienceScope` (client type) already
includes `"neighborhood"` as a possible value, but nothing on the server
ever sets it — an aspirational, unused type slot. The Local/Global toggle
is a coarse binary (your county vs. literally everything), with no
adjacent-area or radius scoping in between. `distanceMiles` is likewise a
client-side field with no server producer.

**This is the single biggest structural gap versus "feel like Nextdoor"** —
Nextdoor's entire hook is neighborhood-scoped, and TradeScout has no
concept of neighborhood at all today, only county.

### 1.7 Composer

Two different, inconsistent category taxonomies (8 options in
`community-feed.tsx` vs. 5 in legacy `community.tsx`). A "Poll" button that
just inserts a text template — no real poll data model or voting. Title
field accepted by the API but never rendered in either composer (dead
field). Video upload exists but is stored into the image array, not a real
video post type.

### 1.8 Tests that any redesign must respect or deliberately update

- `community-post-card-parity.contract.test.ts` — locks `CommunityPostCard`
  as the sole rendering path and its prop/action contract.
- `community-app-surface-ux.contract.test.ts` — a **copy/tone** contract:
  keeps Community's language human and outcome-framed, not "AI system"
  framing. Directly shapes acceptable microcopy for any redesign.
- `community-feed-api.test.ts` — locks strict county-scoped filtering.
- `public-community-post*.test.ts`, `community-post-share.test.ts`,
  `profile-community-post-sharing.contract.test.ts` — lock the
  public/anonymous-safe shape and share/OG behavior of a single post.
- `canonical-surface-ownership.contract.test.ts` — actively keeps
  `SocialFeed.tsx` unreachable; reviving pieces of `social/*` means porting
  logic out, not making that file reachable again.

## Part 2 — Prior art already sitting in the repo

Four branches exist with directly-named relevance. Investigated, not
guessed:

| Branch | Date | Verdict |
|---|---|---|
| `feature/community-feed-ux-de-systemization` | 2026-06-12 | **Already fully merged into main** (zero diff, confirmed via `git merge-base --is-ancestor`) — nothing left to pull. |
| `agent/community-card-convergence` | 2026-07-13 | Its core contribution (`communityPostCardAdapter.ts`) is **already byte-identical in main**. No unique value left to extract. |
| `ui-redesign-community` | 2026-04-05 | Has a `REDESIGN_PLAN.md`, but the plan is generic ("modernize aesthetics," "clean, professional") — not Nextdoor/Facebook-specific — and it targets the **legacy** `community.tsx` page this packet recommends retiring. Too old and too diverged to merge safely; not recommended for revival. |
| `feature/community-neighborhood-feed-foundation` | 2026-07-08 | **Real, tested, relevant work**, but based on main from before several since-added tables (`publicProfileEngagements`, `profileViewEvents`, `propertyParticipantInvites`, the migration-gap fixes from earlier today, etc.) — too diverged to merge or rebase safely. Contains: the `postComments` FK fix (→ `communityPosts.id`, with a migration + contract test), `buildOneLevelCommentThreads` (one-level reply nesting, tested), server-side parent-comment ownership validation, a working category-filter bar wired to the API, and deletion of the two orphaned pages (`CommunityFeed.tsx`, `community.tsx`) down to one canonical route. **Recommendation: re-implement this branch's specific, narrow pieces against current main by hand — don't attempt a git merge.** |

## Part 3 — Proposed direction (for review, not yet authorized)

Framed as lanes, same convention as the theme convergence packet, so they
can land as separate reviewable PRs rather than one giant rewrite.

### Lane A — Retire the duplicates (foundation, must go first)
Delete `client/src/pages/CommunityFeed.tsx` (dead stub) and retire
`client/src/pages/community.tsx` + `CommunityComposerInline.tsx` down to
the one canonical `community-feed.tsx` path, matching what
`feature/community-neighborhood-feed-foundation` already proved out. Merge
the two divergent category taxonomies into one. Nothing else should be
built on top of a surface that still has two competing implementations.

### Lane B — Comments: fix the FK, add one level of threaded replies
Re-implement (by hand, against current main) the `postComments` →
`communityPosts.id` FK fix, `buildOneLevelCommentThreads`, and the
parent-comment ownership check from the neighborhood-feed-foundation
branch. Add reply UI, comment likes (reusing the reaction work in Lane C),
and edit/delete for the comment's own author.

### Lane C — Reactions: extend the existing enum to communityPosts
Add a `communityPostReactions` table (or extend `postReactions` with a
second nullable FK) reusing the already-defined `reactionTypeEnum` (like,
love, laugh, wow, sad, angry, helpful, thanks) and the aggregation/XP-hook
pattern already proven in `server/social-routes.ts`. Port the reaction
picker UI out of the quarantined `social/PostCard.tsx` rather than
reviving that file itself.

### Lane D — Post card & profile presence rework
Extract one reusable `CommunityPostAuthorChip` (author avatar/name/role/
badges) instead of the two near-duplicate inline blocks; use it in the
feed, the topic dialog, and `community-post-detail.tsx` alike. Give images
a real hero-image + thumbnail-strip layout with a lightbox instead of a
uniform grid, and a real `<video>` element instead of the image-array
hack. Show the actual CVS score, not just a static "Trust checked" label.

### Lane E — Real neighborhood scoping (the actual "feel like Nextdoor" gap)
The structural piece nothing today provides. Needs a scoping decision
before implementation (see Open Questions) — likely a new
`communityPosts.neighborhood`-tier column/enum value plus a real
in-between scope (adjacent areas / radius) instead of the current
county-or-global binary. This is the lane most responsible for the actual
"local" feeling Thomas described, and the one with no existing prior art
to lean on.

### Lane F — Composer cleanup
One category taxonomy (post-Lane A), a real video post type, either a real
poll data model or removing the fake poll button, and dropping the dead
`title` field or actually wiring it into the UI.

### Lane G — Consolidate action reflection into Profile CVS
**Implemented 2026-07-21 (v1 consolidation).** Product intent: community
context and actions affect CVS for any user by completing the already-
contracted Community → Signal → CVS loop — not inventing a parallel scorer.

Shipped in this pass:
- `server/services/communityActionReflection.ts` + emitters on canonical
  `post.created` / `post.liked` / `comment.created` /
  `moderation.report_filed`
- `trustSnapshotsScoringSql.mjs` **v5**: reads
  `community_posts`/`post_likes`/`post_comments`/`moderation_reports` into
  capped `community_reputation_delta` (likes/comments/debates positive;
  upheld adverse moderation negative). Pending reports do not move CVS.
- Docs: `docs/trust-snapshots.md`, `docs/scoring-dictionary.md`
- Contract: `server/tests/community-action-reflection-cvs.contract.test.ts`

Still deferred (not blocking this consolidation):
- Multi-reaction picker on community posts (Lane C) — when landed, reuse
  existing helpful/thanks → `people_helped` path
- Scout completion → subject CVS (actor telemetry exists; subject outcome
  mapping needs a separate Decision Card completion signal)
- Weight tuning beyond the conservative v5 caps

Hard constraints preserved:
- No pay-to-play; money cannot buy CVS lift.
- Precompute-only (job/service writes `trust_snapshots`; UI never computes).
- Audited weighting with version bump on `TRUST_SNAPSHOTS_VERSION`.
- Visibility ≠ access; community engagement never grants contact or bypasses
  Trust/CVS gating.
- Negative signals (upheld adverse moderation) can lower score; popularity
  alone cannot mint “exceptional” trust.

**Not proposed** (applies to all lanes): reviving `SocialFeed.tsx`/`social/*`
as reachable pages, or merging any of the four prior-art branches via git —
every lane above is a by-hand re-implementation against current main,
informed by (not copied from) that prior work.

## Selective inheritance: exact keep/discard list

Before Lane A deletes anything, an explicit inventory of what gets carried
forward vs. left behind -- not "rewrite everything" and not "delete
everything," item by item:

**Keep / port forward:**
- **Report/flag a post** -- `social/ReportModal.tsx` is a real, fully-built
  moderation report flow (category select + reason). The canonical
  `CommunityPostCard.tsx` has **no report feature at all** today (its only
  `report`-adjacent field is an unrelated `riskFlags: []`). This is a
  genuine safety gap on a public social feed -- port the modal's pattern
  and wire it to community posts as part of Lane D.
- **Threaded comment replies + the `postComments` FK fix** -- from
  `feature/community-neighborhood-feed-foundation` (Lane B, already
  decided above).
- **Multi-reaction picker UI** -- from quarantined `social/PostCard.tsx`,
  reusing the already-defined `reactionTypeEnum` (Lane C, already decided).
- **Category-filter bar wired to `GET /api/community/posts`** -- also from
  the neighborhood-feed-foundation branch; tested, cheap, genuinely useful
  regardless of the tab-model change.

**Discard, not carried forward:**
- `client/src/pages/CommunityFeed.tsx` (capital F) -- dead stub, no real
  logic.
- `client/src/pages/community.tsx` + `CommunityComposerInline.tsx` --
  superseded by canonical's composer/category set once merged.
- The "Scout draft" prefill flow (`postDraft` URL params +
  `scout_draft_created/viewed/published` analytics events, legacy
  `community.tsx` only) -- confirmed **orphaned**: nothing anywhere in the
  app currently links to `/community?postDraft=...`. Not carried forward;
  revive only if a real Scout-to-Community entry point is wanted later.
- The fake "Poll" button (inserts a text template, no real data model) --
  removed, not replaced, until/unless a real poll feature is requested
  (Lane F note stands).
- "Mood soon" / "Video soon" disabled stub buttons in the legacy
  composer -- dead placeholders, go with the rest of `community.tsx`.
- `SocialFeed.tsx`, `CreatePostModal.tsx`, `ShareModal.tsx` themselves --
  stay quarantined/unreachable exactly as the existing
  `canonical-surface-ownership.contract.test.ts` enforces. Only specific
  internal logic (reaction picker, comment threading pattern, report
  modal pattern) gets ported out; the files themselves don't become
  reachable again.

## Decisions (2026-07-21)

1. **Lane order**: feed upgrades first (A → B → C → D for a fast, visible
   win), then E, then **H (replacement-grade local identity + neighbor
   moderation UX)** — required for “replace Nextdoor,” not optional polish.
2. **Scoping model (phased under the replace-Nextdoor north star)**:
   - **Phase E (near-term):** three feed tabs — **Local** (≤50 miles off
     existing lat/lng), **Trending**, **For You** — replacing today's
     `forYou | recent | vault` + separate Local/Global toggle. This is the
     first shippable “local pulse,” not the end state.
   - **Phase H (replacement-required):** real neighborhood / locality
     identity so a household has a named place they belong to (not only a
     radius). Polygon/HOA/census-tract choice is still an open design
     decision; “no neighborhoods ever” is **withdrawn** under the
     replace-Nextdoor north star.
3. **`community.tsx` retirement**: confirmed, delete outright as part of
   Lane A -- nothing in routing points to it.
4. **Community actions → Profile CVS (Lane G)**: **implemented as
   action-reflection consolidation (v5)** on 2026-07-21. Canonical community
   actions emit reflection events; Profile CVS performance includes capped
   `community_reputation_delta` from validated tables. Dictionary keeps
   `moderation_community_score` (visibility) separate from Profile CVS;
   only upheld adverse `final_action` outcomes enter CVS.
5. **Quality bar, not a clone (product intent locked):** Nextdoor’s social
   craft is the bar; TradeScout is not a Nextdoor fork. Done means a
   household gets a **top-tier local social pulse** here and a better path
   to real help — without needing Nextdoor for the social part.
   Checklist (social excellence + TradeScout advantage):
   - Daily **local** feed people actually open (E tabs → H named locality
     when we need belonging, not because Nextdoor has polygons)
   - Neighbor **presence** (author chip, real CVS, profiles that feel local)
   - **Discourse** (threaded replies, reactions — B/C) at social-product
     quality
   - **Safety & community moderation** that feels native in the feed:
     report on every post/comment, community vote/hide path surfaced
     in-product (not admin-only) — backend exists; feed UX is the gap
   - **Trust that matters**: actions reflect into CVS (G shipped v1);
     visibility still ≠ contact
   - **Path to action**: Scout / Direct Connect without leaving the local
     social loop (TradeScout advantage — keep; do not add open neighbor DMs
     just because Nextdoor has them)

## Still open

- **For You ranking signals** -- shipping with the category-affinity
  heuristic above as a first pass; revisit once real usage data exists.
- **Video posts (Lane D/F)** -- priority not yet confirmed; treated as
  lower priority than the three items above unless raised again.
- **Lane G follow-ups** -- multi-reaction → helpful/thanks on canonical
  feed (Lane C), Scout subject-outcome mapping, and weight tuning beyond
  the conservative v5 caps. Core consolidation is shipped.
- **Neighborhood identity model (Phase H)** -- polygon vs HOA vs city
  cluster vs address-derived locality; must support “my neighborhood”
  belonging, not only radius search.
- **Neighbor moderation UX** -- report-on-card + community vote/hide in
  the feed; map existing `moderation.ts` / `ReportContentModal` onto
  canonical posts without reviving quarantined `SocialFeed`.

## Apply posture

`applyAuthorized: true` for Lane A (retire duplicates + build the
Local/Trending/For You tab model) as of 2026-07-21. Lanes B-D follow
immediately after in the stated order. Lane E ships the 50-mile Local /
Trending / For You model as the first local pulse. Lane G shipped v1
(`TRUST_SNAPSHOTS_VERSION=5`). **Lane H (named locality + neighbor
moderation UX)** stays on the path for social excellence —
`applyAuthorized: false` until locality model + moderation UX shape are
picked. Explicit non-goals: 1:1 Nextdoor UI clone, open neighbor DMs,
copying their ads/HOA politics model.
