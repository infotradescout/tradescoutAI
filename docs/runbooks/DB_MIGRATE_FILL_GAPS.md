# DB migrate: normal path vs fill-gaps

## When to use what

| Situation | Command | Notes |
| --- | --- | --- |
| Forward-only deploy (ledger cursor behind journal tip) | `npm run db:migrate` then `npm run db:verify:required` | Default predeploy path. Uses `drizzle-kit migrate`. |
| Ledger has a **later** journal tag but is missing **earlier** tags | `npm run db:migrate:fill-gaps` (optionally `--dry-run`, then `--mark-already-applied` when schema objects already exist) | Recovery only. Normal migrate will not go backward. |
| After gap-fill, ledger row count > journal (UNKNOWN / duplicate hashes) | `npm run db:ledger:prune-orphans` (try `--dry-run` first) | Makes `appliedCount` match journal length for health/compatibility. |

Do **not** run fill-gaps or prune-orphans as routine predeploy. They are operator recovery tools after ledger drift.

## Drizzle watermark trap

`drizzle-kit migrate` (and drizzle-orm’s migrator) only applies journal entries whose `when` / folder millis is **greater than** `max(drizzle.__drizzle_migrations.created_at)`.

If production once recorded a later tag (for example `0113_...`) while earlier tags were never applied, those earlier gaps are permanently skipped by normal migrate. Health may show `appliedCount < expectedCount` or missing required schema even though “migrate succeeded.”

**Recovery:** apply by hash presence in journal order via `npm run db:migrate:fill-gaps`, then verify with `npm run db:verify:required`. Use `--mark-already-applied` only when a statement fails because the object already exists (schema ahead of ledger).

## Predeploy vs live Docker

Repo `render.yaml` declares:

```text
preDeployCommand: node runtime/run-release.mjs run-production-predeploy scripts/run-production-predeploy.mjs
runtime: docker
healthCheckPath: /api/health
```

The paid production Docker service runs that command in the newly built image
before traffic moves. The compiled worker performs normal migrate and required
schema verification before any public-media migration. The image must retain
the compiled release workers, runtime launcher/config, `migrations/`, and the
independently locked production `drizzle-kit` dependency.

See `docs/DEPLOYMENT_TARGET.md` and `RELEASE_CONTROL.md` for the dashboard and
proof contract. Do not remove pre-deploy or weaken verification to recover a
failed deploy; the previous healthy instance should remain live while the
image or migration problem is corrected.
