# TradeScout Scoring Dictionary (Canonical)

Purpose: define every production score/signal layer in one place so product, ops, and engineering do not mix unrelated systems.

This document is the source of truth for:
- what each score means
- where it is allowed to influence decisions
- where it is explicitly not allowed

## Core Principles

- Dynamic: scores update as verification, reliability, safety, and outcome signals change.
- Context-aware: requirements vary by user type and state.
- Trust-first: payment never increases trust authority or overrides trust-based ordering.
- Separation of concerns: profile trust, content quality, ad quality, and community impact are separate systems.
- Precompute-first: intelligence is computed by jobs/services, not in admin/UI.

## Operational Status (User-Facing CVS Bands)

For profile CVS (0-100):

- `0-39`: Setup Phase
- `40-69`: Active
- `70-84`: Verified
- `85-100`: High-Trust

These are operational states, not popularity ranks.

## Canonical Layers

## 1) Profile CVS (Trust/Credibility Layer)

- Canonical id: `profile_cvs`
- What it is: provider trust governance score for exposure and eligibility.
- Scale: `0-100`
- Current source:
  - `trust_snapshots.cvs_score`
  - produced by `server/services/trustSnapshotsJob.ts`
- Current baseline inputs:
  - address verification
  - professional verification status
  - license status
  - insurance status
  - risk flags (stored with snapshot)
- Dynamic behavior:
  - recomputed by scheduled job
  - can drop immediately to `0` for key compliance failures
- Allowed influence:
  - discovery/exposure priority
  - eligibility for trust-gated flows
  - permissioning support for connection decisions
- Not allowed to influence:
  - pricing/pay-to-play boosts
  - ad spend-based rank overrides

## 2) Verification State (Gate Layer)

- Canonical id: `verification_state`
- What it is: lifecycle state (`pending`, `under_review`, `approved`, etc.) that controls hard gates.
- Scale/type: enum status (not a numeric score)
- Source examples:
  - `users.verification_status`
  - profile/business verification fields by role/module
- Allowed influence:
  - action permissions (what can/cannot be executed)
  - trust badge/status labeling
  - requirements enforcement by role/state
- Not allowed to influence:
  - any pay-to-boost path

## 3) Trust Snapshot Risk Flags (Safety Context Layer)

- Canonical id: `trust_risk_flags`
- What it is: explicit reasons for risk/constraints in a trust snapshot.
- Scale/type: string array (not numeric), examples:
  - `unverified_address`
  - `license_unverified`
  - `insurance_unverified`
  - `license_expired`
  - `insurance_expired`
- Source:
  - `trust_snapshots.risk_flags`
- Allowed influence:
  - auditable gating rationale
  - fallback/guardrail decisions in contact and trust-dependent actions
- Not allowed to influence:
  - marketing tier placement

## 4) Match Rank Scores (Decision Routing Layer)

- Canonical id: `match_rank_score`
- What it is: context-specific ranking math used to choose/sort candidates.
- Scale: relative numeric (formula varies by flow)
- Source examples:
  - partner recommendation ranking in `server/storage.ts`
  - direct connect score snapshots in decision metadata
- Typical inputs:
  - profile CVS
  - verification status
  - relevance/context fit
  - county/entity metadata (priority, local outcomes, etc.)
- Allowed influence:
  - ordering in recommendations/matching
- Not allowed to influence:
  - bypass of trust or verification gates
  - direct contact permission without required flow invariants

## 5) Community Outcome Score (Outcome Quality Layer)

- Canonical id: `community_outcome_score`
- What it is: quality signal from outcome history (success vs regret) for community contexts.
- Scale: `-1.0` to `+1.0`
- Source:
  - `server/community/outcomeScoring.ts`
- Behavior:
  - neutral default for new/unknown contexts
  - low sample-size dampening
- Allowed influence:
  - subtle ordering/labeling in community surfaces
- Not allowed to influence:
  - core identity verification status
  - hard compliance gates by itself

## 6) Moderation Community Score (Content Safety Layer)

- Canonical id: `moderation_community_score`
- What it is: weighted content moderation score from votes/flags/hides.
- Scale: signed numeric around 0 (implementation-specific)
- Source:
  - moderation scores tables/routes
- Allowed influence:
  - content visibility controls (flag/hide/escalate)
- Not allowed to influence:
  - provider CVS directly
  - legal/professional verification state directly

## 7) Ad Community Value Score (Ad Quality Layer)

- Canonical id: `ad_community_value_score`
- What it is: ad quality/relevance score based on ad feedback and engagement.
- Scale: `0-100`
- Source:
  - `advertisements.community_score`
  - recomputed in `recomputeAdCommunityScores` (`server/storage.ts`)
- Allowed influence:
  - ad selection/filtering quality
- Not allowed to influence:
  - provider trust authority
  - profile CVS

Important naming note: this has historically been called "CVS" in ad comments. It is not profile CVS and must be treated as a separate namespace.

## 8) Community Builder Evaluation Score (Program Layer)

- Canonical id: `community_builder_total_score`
- What it is: program-specific score for Community Builder progression.
- Scale: `0-100`
- Source:
  - computed in `client/src/pages/community-builder/dashboard.tsx`
  - blended from contribution value, completion, and trust-quality inputs
- Allowed influence:
  - Community Builder rank/progression UX
- Not allowed to influence:
  - provider CVS gates unless explicitly wired through Trust/CVS policy

## 9) Community Impact Signals (Impact Layer, Not One Score)

- Canonical id: `community_impact_signals`
- What it is: ledgered impact evidence, not a single authority score.
- Source examples:
  - county/community vault balances and ledger entries
  - cause votes and allocation shares
  - foundation donation/impact reporting
- Allowed influence:
  - impact reporting, attribution, cause funding decisions
  - community-facing transparency surfaces
- Not allowed to influence:
  - bypass of verification/trust gating
  - pay-to-priority in trust ranking

## Governance Rules (Hard Constraints)

- No pay-to-play in trust authority.
- Trust/CVS governs exposure; money cannot override trust.
- Role/state requirements are adaptive and must remain explicit.
- Contact and action routing must preserve Intent -> Decision Card -> Contact.
- Admin/UI reads precomputed trust intelligence; it does not compute it.

## Implementation Guardrails

- Do not reuse `CVS` label for non-profile scores.
- Always include score namespace in payloads (`profile_cvs`, `ad_community_value_score`, etc.).
- Keep "status gates" (verification enums) separate from "ranking math" (scores).
- If a new score is introduced, add it here before rollout and define:
  - owner service/job
  - storage location
  - allowed influence
  - prohibited influence
  - user-facing label/copy

