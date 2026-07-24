# Release control

**Status:** `main` is the production release channel. Render auto-deploys on every push/merge to `main`.

## Control plane

| Layer | Posture |
| --- | --- |
| Render auto-deploy | **On Commit** for production web service (`tradescout-pro`) |
| Production path | Merge/push to `main` → Render builds and deploys |
| GitHub Actions deploy workflow | Optional backup only (`workflow_dispatch`). **Not required** for production |
| CI | Advisory until billing/minutes work. Do **not** block Render on Actions |

Repo file `render.yaml` sets `autoDeployTrigger: commit`. **Dashboard Auto-Deploy must stay On** (or Blueprint sync must keep commit) so merges to `main` reach production.

## Operating rule

**Push/merge to `main` deploys production via Render. GitHub Actions is not required for that path.**

## Human checklist (Render)

1. Open production web service `tradescout-pro` (tradescoutai.onrender.com).
2. **Settings → Build & Deploy → Auto-Deploy → On** (On Commit).
3. Do not switch Auto-Deploy Off to “wait for Actions.”
4. Optional: use Dashboard Manual Deploy or the `workflow_dispatch` deploy workflow only as a backup.
5. Verify production with the live build/commit marker.

## GitHub Actions / billing

When billing is locked, jobs may finish in seconds with empty steps. That does not stop Render auto-deploy. Prefer admin merge bypass for merge gates while Actions cannot go green, rather than turning Auto-Deploy Off.

Do not require Actions-green before Render can deploy.

## Branch protection

| Check name (job) | Workflow | Role |
| --- | --- | --- |
| `build-and-guard` | `CI` (`.github/workflows/ci.yml`) | Preferred merge signal when Actions works |

While Actions billing is locked, admins may merge with bypass so `main` can move. Render will still deploy that push.

## Agent rules

- Treat merge to `main` as a production release.
- Do not claim production is updated from a green local command or Actions hook alone; confirm the live build marker.
- See `AGENTS.md` release-control section.
