# Progressive Exposure Tier Matrix Template

Use this matrix to map each user-visible feature before implementation.

## Legend
- classification: `enforced` | `policy_target` | `temporary_exception`
- temporary_exception requires: owner, rationale, removal date

## Matrix

| Feature Key | Surface | User Segment | Tier | Classification | Unlock Conditions | Locked Message | Fallback Action | Invariants Impacted | Metric Target | Risk If Wrong | Rollback Flag |
|---|---|---|---|---|---|---|---|---|---|---|---|
| scout.core.entry | Scout | all users | 0 | enforced | none | n/a | n/a | Scout bridge | activation_rate | user cannot start | ff.progressive.scout.core.entry |
| profile.core.setup | Profile | new users | 0 | enforced | identity established | Complete setup to continue | /scout?intent=support | claims-first identity | profile_completion_rate | onboarding abandonment | ff.progressive.profile.core.setup |
| direct_connect.basic | Direct Connect | onboarding_complete | 1 | policy_target | first_value_preconditions met | Complete first steps to unlock requests | /scout?intent=estimate | contact gating | time_to_first_value | blocked demand flow | ff.progressive.direct_connect.basic |

## Required fields per row

1. Feature Key
2. Tier
3. Deterministic unlock conditions
4. Locked-state explanation (user-facing)
5. Fallback action (prefer Scout)
6. Invariants impacted
7. Primary metric target
8. Risk if rule fails
9. Rollback flag

## Approval notes

- No row may weaken trust/CVS authority.
- No row may bypass Discovery -> Scout -> Intent -> Decision Card -> Contact.
- No pay-to-play unlock ordering.
- Any temporary exception must include owner + removal date.
