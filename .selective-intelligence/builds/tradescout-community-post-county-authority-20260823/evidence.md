# D9 evidence — Community post county authority

Date: 2026-08-23

Baseline: `687b9c657d03c57273742c06460cc8facf4753f8`

Branch: `codex/tradescout-community-interior-d9-20260823`

Candidate identity rule: this tracked record does not embed its own future commit SHA. The authoritative exact candidate identity is the full commit recorded in `artifacts/release-contract/<sha12>/evidence.json` after the final tree is committed and verified clean.

Release state: **HOLD**. Implementation and disposable-database proof pass on the working tree; independent Objector/Aligner rereview, exact-candidate proof, minimum gate, attestation, PR review, merge, Render deployment, and production identity remain required.

## Continuity and release truth

- D7's preserved local queue receipt was reconciled from `in_progress` to `fleshed` only after PR 425, review resolution, exact status, Render deployment, and production receipt were rechecked. D9 is the sole active local queue item.
- D8's tracked execution contract and evidence remain immutable candidate-time HOLD records. They are historical snapshots, not the current deployment verdict. PR 430's post-deploy receipt and exact production identity establish the released D8 state.
- At `2026-08-23T13:59:58Z`, `origin/main`, Render, `/api/health`, and `/community` all matched `687b9c657d03c57273742c06460cc8facf4753f8`. Health was healthy, database connected, migrations compatible `124/124`, and required schema present.
- The canonical checkout remained clean but stale at `00d2a682d87e19b84774881f2e53bf6914aff9be`, so D9 was created in an isolated worktree from the exact current-main commit instead.

## Locked outcome

The canonical authenticated Community post endpoint accepts creation only for a non-impersonated persisted principal, derives write scope, state, and county only from that exact user and matching canonical county-registry row, and uses the same identity and geography for the post, `post.created` reflection, and any routed county note. Incomplete, non-string, or contradictory impersonation markers fail closed, while a complete acted-as session returns stable `COMMUNITY_IMPERSONATION_WRITE_UNAVAILABLE` before lookup or writes. That denial is required because the released auth payload, feed, saves, likes, comments, and moderation paths do not yet represent one coherent target persona; it prevents a successful target-county write from disappearing when the principal-county client refetches. Caller-supplied `scope`, `stateCode`, and `countyFips` never grant global, broader, or cross-county write authority.

## Observed defect

- Exact released source at baseline 687b9c65 protects the route with authentication and onboarding middleware, reloads the persisted user, then destructures `scope`, `stateCode`, and `countyFips` from `req.body`.
- It computes `scope || "county"`, `stateCode || user.state`, and `countyFips || user.countyFips`, so caller input takes precedence over canonical persisted geography and the canonical `user.stateCode` field is not used.
- Those resolved caller-influenced values are written to `community_posts` and copied into the `post.created` reflection event.
- Request-category routing can also write `county_notes` using the same caller-influenced county, extending the integrity gap beyond the post row and event reflection.
- The repository's own authenticated integration helper creates users with canonical `stateCode` plus `countyFips` and no legacy `state`. For that valid user shape, the released route can return a created post with null `stateCode`; the local feed then filters by both state and county equality, so the post can disappear immediately after the client refetches.
- The schema's scope union includes broader geographic values; the route performs no create-boundary scope or canonical-identity validation before storage.
- The released client mutation sends content, title, category, and images only and hides creation in global view. That protects the current UI path but does not protect the HTTP boundary from a stale or hostile authenticated caller.
- No production POST was sent. Production inspection was read-only; the request audit contained GET requests only.

## Reuse decision

- Harden and reuse `server/locationContext.ts` as the canonical strict persisted-user location owner, and reuse `storage.getCountyByFips` to bind the write to a real state-consistent operational county.
- Reuse the existing `POST /api/community/posts` route, `storage.createCommunityPost`, and `reflectCommunityAction` owners.
- Add focused tests to the existing server test surface; create no parallel API, storage repository, schema, migration, client mutation, or Community component.
- Preserve the unrelated root JW Stone Selective Intelligence lock as historical work from its isolated lane; it is not authority for this TradeScout Community release and will not be edited here.

## Implementation

- Added `server/utils/requestEffectiveUser.ts`, a pure resolver that accepts only raw nonempty string IDs/role, uses the authenticated principal when no impersonation marker exists, recognizes a target only when `isImpersonating`, `impersonatedUserId`, `impersonatingRole`, and `originalUser.id` are complete and the original ID matches the principal, and otherwise fails closed. Arrays, objects, numbers, partial markers, false flags, and principal mismatch cannot be stringified into authority.
- The Community create route returns stable `COMMUNITY_IDENTITY_CONTEXT_INVALID` before storage access for ambiguous identity state and stable `COMMUNITY_IMPERSONATION_WRITE_UNAVAILABLE` for every coherent acted-as session before persisted-user lookup or Community writes. Accepted non-impersonated requests retain the established onboarding middleware and reload the exact principal.
- `server/locationContext.ts` now accepts only strict two-letter canonical state plus five-digit FIPS, uses legacy `state` only when canonical `stateCode` is absent, resolves the county through `storage.getCountyByFips`, and rejects unknown or state-inconsistent records.
- The route ignores caller geography, forces scope `county`, and uses one effective user ID plus one canonical county context for the post, reflection, and county note while preserving title, content, category, images, tags, routing, publication defaults, and response shape.
- Added pure resolver/location tests, source-order and ownership contract tests, and disposable authenticated HTTP persistence tests. No schema, migration, client, contact, Trust/CVS, moderation, AppShell, or Scout owner changed.

## Automated proof

- `npx vitest run server/tests/location-context.test.ts server/tests/request-effective-user.test.ts server/tests/community-post-county-authority.contract.test.ts` — **PASS**, 3 files / 18 tests.
- `npm run check` — **PASS**.
- `git diff --check` — **PASS** (line-ending notices only).
- Broader Community/CVS/source suite — **PASS**, 12 files / 59 tests; the 2 database-gated feed cases skipped in that non-database invocation and are covered by the dedicated disposable suite below.
- `npm run build` — **PASS**. Existing Browserslist age, Tailwind arbitrary-duration ambiguity, mixed static/dynamic Three.js import, and large-chunk warnings remained non-blocking. Generated sitemap timestamps and Red Graniti source caches were restored/removed after proof so they are not part of D9.
- Migrated disposable PostgreSQL 16 container `tradescout-d9-community-authority-20260823`, bound only to `127.0.0.1:55439`, with `TEST_DATABASE_URL` and `RUN_INTEGRATION_TESTS=true`: `server/tests/community-post-county-authority.integration.test.ts` — **PASS**, 1 file / 4 authenticated HTTP tests.
- The disposable suite proves ordinary spoof rejection and immediate feed parity; unknown county fail-closed behavior; no privileged widening; and a real acted-as client journey that obtains `/api/auth/user` principal county A, attempts a target-county-B post, receives the stable 409, refetches exactly with the client-derived county-A filters, observes no phantom post, and confirms zero post/event/note writes for both principal and target.
- The fresh disposable database lacks the optional `feature_flags` table, so its existing authority-phase lookup logged a safe-default warning during the feed test. The suite still passed and the warning was unrelated to this write boundary; exact candidate/full release proof remains pending.

## Project index and reuse gate

- Final working-tree refresh at `2026-08-23T14:51:10Z` indexed 212 directories, 3,679 source files, 20,062 symbols, 1,484 components, and 11,177 functions/hooks. The new strict identity helper and D9 tests are present in the index.
- Doctor remains not-ready on the repository's historical duplicate-owner baseline: 1,099 errors and five raw-element warnings. The pre-D9 refresh had 1,101 errors and the same five warnings, so D9 introduced no new competing owner and reduced the count by two. Repository-wide consolidation remains excluded from this release.
- Reuse disposition: the existing `locationContext`, Community route, storage, county registry, reflection, auth middleware, and session markers remain the canonical owners. The one new pure request-identity helper consolidates a previously missing fail-closed boundary; no parallel endpoint, storage owner, component, schema, or migration was created.

## Independent review

- SI Intent Objector: **SUSTAINED**. A server-controlled county write boundary outranks the separately observed composer layout defects because it preserves a platform-law and data-integrity invariant for every client.
- SI Implementation Objector identified and sustained three successive P1s: original-admin write fallback, non-string marker coercion, and target-write/principal-refetch disappearance. All are corrected; final verdict is **PASS / GO** with no implementation, law, contract, or proof blocker on the working tree. Its independent rerun passed 34 focused/broader tests, TypeScript, law-drift, authority-gates, HTTP-semantics, and diff checks.
- SI Aligner held the same target-write/principal-refetch mismatch and authorized either a whole-spine target correction or bounded fail-closed create. Final verdict is **ALIGNED**, with no open finding and approval to proceed to exact-candidate verification.
- SI Verifier status is **PARTIAL pre-commit**, correctly limited to the bounded deliverable: source and working-tree proof are locally sound, D10 remains open, and no D9 release/live proof exists. Its next safe step is the clean exact candidate, minimum-release gate, attestation, PR review, merge, Render wait, and exact production identity proof.
- SI Verifier: **PENDING exact candidate**.

## Law integrity classification

- Read-only global Community view: **enforced target for D9**. Ordinary create requests will be forced to county scope; no global action path is added.
- Counties are operational containers: **enforced target for D9**. Canonical persisted-user county identity will govern post and reflection writes.
- Visibility does not equal access: **enforced**, unchanged. Read visibility grants no write, contact, or broader geographic authority.
- Intent → Decision Card → Contact: **enforced**, unchanged; no contact path changes.
- Trust/CVS governs exposure: **enforced**, unchanged; D9 changes only write geography authority and preserves reflection parity.
- Fully target-coherent acted-as Community posting: **policy_target**, not claimed or partially simulated in D9. Until auth payload, feed viewer/saved state, likes, comments, moderation, and composer identity share one target persona, the create boundary is enforced fail-closed.
- Temporary exceptions: none introduced.

## Following verified frontier

- Exact production at `390x844` has a separate high-priority mobile composer width defect: the card is about 334px wide while its inner flex content remains about 669px, and overflow clipping places the Post button completely outside the viewport. The production capture is `C:\Users\flavo\.codex\visualizations\2026\08\22\01a02a0c-1488-7b91-8baa-a89ee2760d68\D9-community-production\tradescout-community-d9-390x844.png`, SHA-256 `1d364c4776937f9cf14185c3266dd9f54409092c82688d3ead6cc09d09ca780b`.
- Short-height desktop sticky behavior is a second, lower-priority issue: actions can be reached by scrolling, but focus-scroll can place the title, hint, Cancel, or upper textarea under the canonical header. These UI defects are explicitly excluded from D9 and remain first in the post-release frontier.

## Release boundary

Do not attest, push, merge, or claim production correction until a clean exact commit passes focused authority tests, broader Community/CVS contracts, typecheck, build, source guards, independent Objector/Aligner review, exact minimum release gate, exact-head review, Render deploy, exact `x-tradescout-build` and health identity, and read-only production smoke. Production verification must not create a Community post.
