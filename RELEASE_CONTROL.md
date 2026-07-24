# Release control (P0 posture)

**Status:** Production must not deploy on every merge to `main`.

Billing exposed a deeper control-plane failure: when GitHub Actions cannot run, merges to `main` still reach production via Render auto-deploy and/or push-triggered deploy hooks. Restoring billing alone is not enough.

## Current control plane (intended)

| Layer | Required posture |
| --- | --- |
| Render auto-deploy | **Off** for production web service (`tradescout-pro`) |
| GitHub Actions deploy workflow | `workflow_dispatch` only, with approved SHA + `DEPLOY_PRODUCTION` confirmation + green `build-and-guard` |
| Branch protection | PRs required; required check `build-and-guard`; no direct pushes to `main` |
| Merge policy (human) | Only approved release/remediation merges during this period |

Repo file `render.yaml` sets `autoDeployTrigger: "off"`. **Blueprint sync / Dashboard must match** or Render will keep deploying on commit.

## Human P0 checklist (Render — required)

Do these in the Render Dashboard before further feature merges:

1. Open the production web service for TradeScout (`tradescout-pro` / tradescoutai.onrender.com).
2. **Settings → Build & Deploy → Auto-Deploy → Off** (or apply/sync Blueprint so `autoDeployTrigger: "off"` is live).
3. Confirm there is no secondary path that redeploys `main` on every commit.
4. After Auto-Deploy is Off, deploy only by:
   - Dashboard **Manual Deploy** of an approved SHA, or
   - GitHub Action **Production Release & Deploy** (`workflow_dispatch`) after CI is green for that SHA.
5. Verify production with the live build/commit marker (not “workflow ran”).

No Render API token is assumed in this repo remediation.

## GitHub Actions / billing evidence (observed)

Annotation on failed jobs (both org repos):

> The job was not started because your account is locked due to a billing issue.

Pattern: runs complete in ~3–5s with **empty steps** (no checkout/install/test). When billing was healthy, substantive CI ran ~2+ minutes.

Until billing is unlocked, required checks cannot go green. That correctly blocks the approved deploy workflow; it does **not** stop Render if Auto-Deploy is still On Commit.

## Branch protection vs check names

| Required check name (job) | Workflow |
| --- | --- |
| `build-and-guard` | `CI` (`.github/workflows/ci.yml`) |

Other workflows (`Release Gates`, `E2E`, `Bot Army`, etc.) are validation lanes, not the minimum merge gate documented here.

## Agent rules during this period

- Do not merge unrelated features to `main`.
- Do not claim production deploy succeeded from a green local command or a hook HTTP 2xx alone.
- See `AGENTS.md` release-control section.
