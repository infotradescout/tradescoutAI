# Progressive Exposure Rollout Plan (Planning Only)

Status: superseded planning reference
Superseded by: docs/TRADESCOUT_MASTER_PLAN.md
Owner: Product authority + execution team
Date: 2026-04-17

This file is retained as a scoped implementation note. Canonical sequencing and roadmap authority now lives in `docs/TRADESCOUT_MASTER_PLAN.md`.

## 1) Change Declaration

What changes:
- TradeScout will introduce progressive feature exposure so users do not see all surfaces at once.
- Feature visibility will be staged by onboarding progress, activity quality, and time-in-system.

Why:
- Reduce cognitive overload for new users.
- Increase first-value completion and early retention.
- Preserve trust by exposing complexity only when users are ready.

What does NOT change:
- Trust/CVS authority logic.
- Discovery -> Scout -> Intent -> Decision Card -> Contact gating.
- Claims-first identity semantics.
- No pay-to-play exposure rules.

Risk if wrong:
- Perceived manipulation or confusion.
- Lower activation and retention.
- Support burden and trust drift.

## 2) Psychological Intent (Required)

Target belief:
- "TradeScout is guiding me step-by-step to outcomes."

Target behavior:
- Complete core setup and first-value actions before advanced workflows.

Principles used:
- Progressive disclosure.
- Cognitive load reduction.
- Competence reinforcement loops.
- Transparent unlock explanations.

Risk prevented:
- New-user paralysis.
- Premature use of advanced tools without context.
- Early abandonment from overwhelming UI complexity.

## 3) Hard Invariants

The rollout must never:
- Bypass trust/CVS gates.
- Bypass Scout as the bridge to action.
- Reorder contact flow to allow direct ungated contact.
- Unlock visibility through payment signals.
- Change role/claim semantics.

## 4) Exposure Tiers (Policy)

Tier 0: Guided entry
- Goal: Orientation and first trusted action.
- Surfaces: Scout core flow, essential profile setup, core help paths.

Tier 1: First outcome tools
- Goal: Complete first real local workflow.
- Surfaces: Basic browse + request/response workflows.

Tier 2: Workflow depth
- Goal: Repeat quality actions with consistency.
- Surfaces: Operational tools, deeper organization, productivity workflows.

Tier 3: Advanced controls
- Goal: Optimization and power-user/admin capabilities.
- Surfaces: Advanced analytics, expanded configuration, specialist workflows.

## 5) Eligibility Inputs (No code yet)

Eligibility uses additive readiness signals:
- Onboarding state (required milestones completed).
- Activity quality (meaningful completed actions, not raw clicks).
- Time in system (minimum account age for some advanced surfaces).
- Verification/trust prerequisites where relevant.
- Claim/context relevance.

## 6) Unlock Policy Contract

Each feature must define:
- Feature key
- Tier
- Unlock conditions (deterministic)
- User-visible explanation text
- Fallback action when locked
- Rollback flag key

Template:

| Feature Key | Tier | Unlock Conditions | Locked Explanation | Fallback Path | Rollback Flag |
|---|---|---|---|---|---|
| example.feature | 1 | onboarding.profile_complete=true | Complete your profile to unlock this workflow. | /scout?intent=estimate | ff.progressive.example.feature |

## 7) Measurement Plan

Primary outcome metrics:
- Activation rate (new users reaching first value).
- Time to first value.
- Day-7 retention.

Guardrail metrics:
- Trust/support complaints.
- Confusion signals (rapid navigation thrash, repeated dead-end retries).
- Failed gated contact attempts.
- Authority contract violations.

## 8) Rollout Phases

Phase 0: Design and authority sign-off
- Lock tiers, unlock rules, invariants, and rollback criteria.

Phase 1: Shadow mode
- Compute tier eligibility silently.
- No user-facing changes.
- Validate expected eligibility distribution.

Phase 2: Controlled rollout
- 5-10% new-user cohort.
- Kill switch at global and per-tier level.

Phase 3: Scale-up
- Increase cohort only if primary metrics improve and guardrails stay stable.

Phase 4: Policy tuning
- Weekly threshold tuning based on quality outcomes.

## 9) Rollback Protocol

Immediate rollback if any of the following occur:
- Activation drops beyond threshold.
- Trust/support complaints exceed threshold.
- Contact/gating invariant regression.
- Material rise in confusion signals.

Rollback controls:
- Global progressive exposure disable.
- Tier-level disable.
- Feature-level disable.

## 10) Validation Checklist Before Implementation

- [ ] Tier matrix approved by authority.
- [ ] Invariants reviewed and test strategy defined.
- [ ] Metric definitions locked with baselines.
- [ ] Rollback thresholds approved.
- [ ] User-facing unlock explanations drafted.
- [ ] Shadow-mode review plan agreed.

## 11) First Execution Slice (When approved)

Recommended first scope:
- Introduce Tier 0 and Tier 1 only.
- Keep all advanced surfaces unchanged (Tier 2/3 untouched initially).
- Ship with explicit locked-state explanations and Scout fallback CTA.
- Run 14-day controlled cohort observation before widening.
