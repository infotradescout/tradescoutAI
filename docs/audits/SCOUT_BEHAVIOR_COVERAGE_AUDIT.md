# Scout Behavior Coverage Audit

Generated: 2026-02-25T05:01:38.751Z

## Coverage Snapshot

- Client behavior headers detected: 12
- Server behavior headers detected: 9
- Client Scout test files: 6
- Server Scout test files: 2
- Total Scout-related test cases detected: 73

## Client Behavior Branches (ScoutOS)

- EXPLICIT NAV INTENT (high confidence; user asked to be routed)
- EXPLANATION: "Why isn't this moving yet?"
- EXPLANATION: "Why can't I message yet?"
- SCOUT ONBOARDING INTENT (fast win)
- PROVIDER INTENT A: "I want to offer services here"
- PROVIDER INTENT B: "How strong is my presence here?"
- PROVIDER INTENT C: "Help me run a promotion/deal"
- COMMUNITY INTENT: "Help me post an announcement/update"
- CONTRACTOR SEARCH INTENT
- MARKETPLACE INTENT: search vs post
- CONTACT SUPPORT INTENT
- FALLBACK: Use existing server flow if no intent matched

## Server Behavior Branches (scout route)

- Smart synthesis that ENFORCES the execution contract
- Fallback: take a hard slice if everything is oversized
- SPECIAL HANDLING: Detect intro/overview questions and use comprehensive synthesis
- GOVERNOR MODE: Situation-driven intelligence
- LAYER RESOLUTION: Use knowledge service 4-layer system
- SMART SYNTHESIS / DETERMINISTIC ROUTING
- Deterministic early-exit: if user intent maps cleanly to an allowed
- Brand identity firewall: if the synthesized answer clearly violates
- Handle auth-required intent

## Scout Test Surfaces

- client/src/scout/actionValidation.test.ts
- client/src/scout/contextRoles.test.ts
- client/src/scout/localIntents.test.ts
- client/src/scout/messageBuilders.test.ts
- client/src/scout/scout.eval.test.ts
- client/src/scout/scoutTiles.test.ts
- server/tests/scout-policy.test.ts
- server/tests/scoutDeterministicIntent.test.ts

## Immediate Gap Signals

- Large number of behavior branches with comparatively sparse server route-level Scout tests.
- Behavior discovery is comment/branch driven rather than contract-driven cataloging.
- No unified behavior registry tying intent branches to expected action contracts and tests.

## Recommended Next Recovery Steps

1. Create a canonical Scout Behavior Registry (intent key, trigger, authority gate, expected action shape).
2. Add contract tests for each registry entry (trigger -> response metadata -> allowed action types).
3. Enforce a CI guard that fails when new behavior branches are added without registry plus tests.