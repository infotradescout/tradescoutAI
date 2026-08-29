# Seven-Day Stabilization Baseline

Date: 2026-08-29
Production branch: `main`
Locked production SHA: `a3adb045ec8a3088b705b6ddafb56cf05540552c`
Render production deploy: `dep-da96hcoae00c73ae22p0`
Render state at lock: `live`
Audit window: 2026-08-22 00:00 America/Chicago through 2026-08-29 11:00 America/Chicago
Audit result: current production may remain live; the next release must be stabilization and proof rather than another product feature.

## Product Spine Gate

Product PASS and Technical PASS are separate requirements. Tests alone do not prove product correctness. Every changed user path must have direct desktop and mobile acceptance evidence before release.

## Ordered stabilization contract

1. Preserve this exact SHA as the rollback baseline.
2. Harden the first-party event ingestion boundary before expanding passive telemetry.
3. Classify and repair application-owned 5xx failures from the audit window.
4. Prove the authenticated Requester, Provider, Business Owner, Profile Account, Super Admin, and impersonation-exit paths.
5. Prove the final JW Stone Browse by color presentation on desktop and mobile.
6. Prove the BidRock verified-buyer and authorized-seller offer lifecycle without activating payments or fees.
7. Audit PostgreSQL public-media storage size, growth, backup, restore, read-load, and object-storage exit conditions.
8. Close or clearly supersede stale current-week pull requests.
9. Require full PostgreSQL TLS certificate verification in production-capable connection paths, with an explicit local/test exception only where required.
10. Publish one coherent stabilization pull request, exact-head validation receipt, normal `main` merge, Render On Commit deployment, and post-deploy production receipt.

## Release hold

Until the ordered contract above is satisfied, do not merge unrelated product features into this stabilization branch. Any emergency correction must be narrowly scoped, must preserve the rollback SHA above, and must receive its own production receipt.

## Required final receipt

The release receipt must record:

- exact candidate SHA and merge SHA;
- Product PASS or BLOCK;
- Technical PASS or BLOCK;
- exact validation commands and results;
- desktop and mobile evidence for changed user paths;
- sanitized telemetry proof;
- database migration and required-schema proof;
- Render deploy ID and status;
- production build identity and `/api/health` result;
- rollback or roll-forward disposition.
