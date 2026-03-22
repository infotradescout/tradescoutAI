# Scout Behavior Gap Backlog

Generated: 2026-02-24

## Purpose

Track the highest-value Scout behavior gaps after introducing the canonical registry and enforcement gate.

## Current Baseline

- Registry file exists: `scout-behavior-registry.json`
- Enforcer exists: `scripts/enforce-scout-behavior-registry.mjs`
- Coverage audit exists: `SCOUT_BEHAVIOR_COVERAGE_AUDIT.md`

## Priority Gaps (Next Tranche)

1. **Auth-required intent path coverage depth (server)**
   - Add cases for unauthenticated -> structured action guidance -> no unsafe action leak.
   - Validate metadata consistency (`sourceUsed`, `fallbackUsed`, confidence band) for auth branches.

2. **Enhanced-v4 confidence fallback contract (server)**
   - Add explicit tests for low-confidence enhanced responses falling through to classic path.
   - Assert source audit fields remain deterministic for fallback cases.

3. **Deterministic early-exit vs synthesis contract (server)**
   - Add test matrix for equivalent prompts to guarantee stable route + action shape.
   - Verify no contract drift under minor prompt wording changes.

4. **Client fallback continuity signals (client)**
   - Add tests for fallback UI states preserving user trust cues (clear next action, no dead end).
   - Verify controller rail/action chips still expose actionable recovery.

5. **Registry contract quality gate (tooling)**
   - Extend enforcer to require `targetBelief`, `targetBehavior`, `riskPrevented` presence and non-empty values.
   - Optionally require each mapped test file to contain at least one test title token matching the behavior id.

## Verification Commands

- `npm run audit:scout-behaviors`
- `npm run enforce:scout-behaviors`
- `npm run check`
