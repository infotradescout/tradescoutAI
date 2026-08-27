# JW Stone public media migration

**Status:** staged production migration. The existing TradeScout Render service and existing Cloudflare R2 bucket remain the only production owners.

## Corrected ownership

JW Stone catalog metadata stays in the repository. Image and video bytes do not.

| Responsibility | Canonical owner |
| --- | --- |
| Stone names, categories, dimensions, finish, color, image order | Existing catalog metadata |
| Public image and video bytes | Existing Cloudflare R2 bucket under `public-media/images/businesses/jw-stone/` |
| Existing public URLs | TradeScout server compatibility routes under `/images/businesses/jw-stone/` |
| Stone designer image responses | The same R2-backed public media owner |
| Migration identity and recovery source | `scripts/data/jw-stone-public-media-manifest.json` |

The manifest pins every source file to an immutable repository revision, Git blob identity, byte count, content type, and deterministic R2 key. It contains metadata only, not image bytes.

## Safe release order

1. Render builds the release without the JW Stone media directory in its Docker context.
2. The existing pre-deploy command runs the idempotent JW Stone media migration before database migration and before traffic swap.
3. Every missing or mismatched object is downloaded from the pinned immutable source, byte-counted, Git-blob verified, uploaded to the existing R2 bucket, and verified again with object metadata.
4. The migration marker is written only after all manifest entries pass.
5. A missing credential, failed download, mismatched object, or incomplete total exits non-zero. Render keeps the current production release live.
6. Each migration writes a verification marker for the exact Render release commit. The production container checks both markers before it starts and performs the same idempotent migration if Blueprint synchronization ever lags.
7. After pre-deploy and health checks pass, the same public URLs are served from R2 through TradeScout.

No temporary Render service, new bucket, alternate host, or GitHub Actions workflow is part of this migration.

The same release removes the legacy R.E.D. Graniti build-time image downloader. Its 11 currently published source SVGs are pinned by byte count and SHA-256, migrated to `public-media/images/businesses/red-graniti/source/`, and served at their existing `/images/businesses/red-graniti/source/` URLs. The small company logo remains a client shell asset.

## Recovery

- Before merge, the current `main` revision remains the rollback point and still contains every source asset.
- After merge, the migration manifest retains the exact immutable source revision and per-file Git blob identities.
- If the new release cannot read R2, Render must not swap traffic because pre-deploy fails.
- A roll-forward can repair configuration or object delivery without changing catalog URLs.
- Rolling back restores the previous bundled-media release while the verified R2 copies remain harmless and reusable.

## Verification commands

- `npm run media:verify:jw-stone`
- `npm run media:migrate:jw-stone:dry-run`
- `npm run media:migrate:jw-stone:verify` after the first production migration
- `npm run media:verify:red-graniti`
- `npm run media:migrate:red-graniti:dry-run`
- `npm run media:migrate:red-graniti:verify` after the first production migration
- focused server and catalog tests
- `npm run check`
- `npm run build`
- production GET, HEAD, conditional, and range checks against representative legacy image and video URLs after release

The pull request must record pre- and post-change media bytes, Docker context transfer, build duration, migration totals, public URL checks, and anything not run.
