# Dormant Screen Pass and inheritance recovery

Updated: 2026-09-07T19:20:32Z.

Bounded deliverable: adapt the outstanding #568 correction from `f9837e71c22883b986ed3d4c266b0b93673d6d0e` onto frozen recovery `75f8ff8447231e0dc6df46049044456c3ed72a91` in isolated branch `integration/copy-recovery-20260907`. Local implementation and commit are authorized; push, PR, merge and deployment are outside this slice. Other worktrees remain untouched.

Reuse decision: modify the two existing public explainer owners and existing Infinity shadow adapter; remove only the verified dormant selective-inheritance sender/policy. No new product capability or parallel owner is introduced. Live attribution touch and conversion callers in `server/services/referralAttribution.ts` and `server/utils/attributionConversionLedger.ts` remain byte-for-byte unchanged.

The explainers no longer promise Screen Pass or a completed screening flow. The old PR's claim of expanding partner coverage was not inherited: the currently routed background-check page has no submission/payment handler, and no corresponding submission API was found. Both explainers now state that screening is unavailable through TradeScout and retain the existing information link. The background-check page itself remains an unimplemented workflow; this slice does not complete it or change its presentation.

Removed: `server/integrations/infinitySelectiveInheritance.ts`, its imports and unused sender in `infinityShadow.ts`, and tests asserting that dormant policy. Repository searches found no runtime caller. Retained: `/v1/attribution-touches`, `/v1/conversion-evidence`, their hashing/idempotency behavior, configuration/HTTPS checks and nonblocking failure semantics. Adapter documentation now describes only those live observations. Its existing temporary-exception owner, rationale and review date remain recorded there.

Proof:

- Isolated `npm ci --no-audit --no-fund`: 1,305 packages installed; lockfiles unchanged.
- `npm run check`: passed.
- Focused Vitest: 7 files, 38 tests passed across the adapter, attribution/conversion, About links and rendered landing explainer. The adapter test substitutes fetch to assert both retained endpoint payloads, opaque object identities, idempotency and exclusion of private input fields; it makes no external delivery claim.
- Changed production TypeScript lint passed. The repository ESLint configuration ignores the test file; TypeScript and Vitest cover it. Prettier applied the repository's formatting to touched files.
- Runtime/client/shared and adapter-doc search: no Screen Pass, selective-inheritance endpoint, deleted policy import or deleted sender remains. Historical recovery audit context is preserved.
- Root's independent source review found no blocker in the bounded adaptation, retained callers or payload assertions.

The Selective Intelligence refresh starts and ends with the same 16 inherited duplicate-owner errors and 5 raw-control warnings. These existing component-convergence findings are outside the approved #568 deliverable and remain explicitly deferred to the separate #569 work; no new competing owner is added. Index freshness and remaining findings are checked with `project_index.py doctor`; no all-clear architecture claim is made.

No database, authenticated browser, full production build/release gate, live provider delivery or production action was performed for this isolated slice. The parent recovery candidate's broader evidence does not substitute for an exact combined-candidate release gate.
