# Scout Logic Audit (Governance Reset)

Date: 2026-02-07

## Decision Enforced
- Humans generate trust signals.
- Scout does not recommend or endorse people.
- Scout governs weighting, decay, constraints, and enforcement.

## Critical Findings
1. Legacy recommendation API existed at `/api/scout/recommendations*`.
2. Scout server prompt/copy still used recommendation language in several decision/copy paths.
3. Scout UI starter cards and community card copy still implied "trusted recommendations."
4. Onboarding claim labels used recommendation wording.

## Changes Applied
1. Retired recommendation endpoints:
   - `server/routes/scout-recommendations.ts`
   - Endpoints now return `410` with `SCOUT_RECOMMENDATIONS_RETIRED`.
2. Updated Scout server language:
   - `server/routes/scout.ts`
   - Replaced recommendation phrasing with trust-signal/governance phrasing.
   - Replaced `Paid recommendation` with `Sponsored placement`.
3. Updated Scout UI language:
   - `client/src/scout/ScoutOS.tsx`
   - Switched copy to "signal-backed help" and "trust signals."
4. Updated onboarding labels:
   - `client/src/scout/claimTypes.ts`
   - `client/src/scout/claimInference.ts`
   - Labels now reference trusted signals, not recommendations.
5. Added runtime policy guardrails:
   - `server/services/scoutPolicy.ts`
   - `server/routes/scout.ts` now sanitizes outbound Scout text/actions and logs
     `scout_policy_violation_detected` telemetry events when corrections are applied.
6. Added automated policy tests:
   - `server/tests/scout-policy.test.ts`
   - Verifies recommendation phrasing is rewritten before user-visible output.

## Additional Changes (2026-02-08)
1. Removed recommendation language from system prompt templates (`server/cache/manual/system_prompt.md`).
2. Extended policy tests to assert system prompt avoids recommendation phrasing.
3. Added admin observability panel + API for `scout_policy_violation_detected` telemetry.
4. Updated community decision/CTA copy to emphasize policy governance and trust signals.

## Remaining Audit Backlog
1. Review any remaining non-community UI copy that implies Scout endorses people (site-wide sweep).

## Release Gate For This Phase
- Recommendation endpoints return `410`.
- No primary Scout landing copy says "Scout recommends".
- `npm run check` passes.
