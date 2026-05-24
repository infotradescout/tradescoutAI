# Recipe Surface Migration Runbook

Status: Execution-ready
Owner: TradeScout product/app team

## Scope
This runbook applies when both routes exist in app code:
- `/recipe-generator`
- `/recipe-formulator`

Current repo state:
- No route/component code found for either surface.
- Only documentation exists in `Recipe Formulation/`.

## Target End State
1. `/recipe-formulator` is canonical.
2. `/recipe-generator` becomes a backward-compatible redirect/alias.
3. One canonical recipe schema + validation + output selection contract.

## Step 1: Discovery (read-only)
- Find route registrations in `client/src/AppRoutes.tsx`.
- Find page components and supporting hooks/services.
- Find inbound links/buttons across app.
- Find tests and docs referencing generator/formulator.

Commands:
- `rg -n "recipe-generator|recipe-formulator|RecipeGenerator|RecipeFormulator" client/src server`
- `rg -n "\/recipe-generator|\/recipe-formulator" client/src`

## Step 2: Route Consolidation
- Keep `/recipe-formulator` page route.
- Add/keep alias route: `/recipe-generator` -> redirect to `/recipe-formulator`.
- Keep query params passthrough for deep links.

## Step 3: Contract Consolidation
- Define canonical recipe model type (single source).
- Build compatibility adapter from generator payloads to canonical model.
- Preserve backward compatibility for previously saved recipes.

## Step 4: UI Behavior
- Keep formulator controls as primary UX.
- Optional: expose generator as "Quick proof" entry inside formulator, not as separate route.
- Keep downloads as selected derivatives + recipe JSON.

## Step 5: Validation
- Contract tests:
  - legacy recipe loads in canonical model
  - selected outputs render deterministically
  - `/recipe-generator` redirect is non-breaking

## Step 6: Rollout
- Phase A: feature flag + internal users
- Phase B: default route switched
- Phase C: remove dead code after telemetry confirms no generator usage

## Done Criteria
- One canonical route behavior.
- One canonical schema/validator.
- No broken deep links.
- Updated docs and tests.