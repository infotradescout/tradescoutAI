# Optional Neon adapters — worker checkpoint

Objective:
Implement optional Neon Object Storage and Scout AI Gateway in the existing
canonical adapters. Preserve current defaults and platform authority. This is a
local implementation/review handoff, not a production cutover.

Base branch/commit:
`main` at `6031a5a2e1f94b2d668035571d3f7154c0c742a0`.

Current branch/commit:
`codex/neon-backend-adapters`; resolve this branch for the local handoff commit
(also reported in the final Worker result). Tests below ran on this implementation;
subsequent changes are documentation/index refresh only. The first commit attempt
found no Git author identity. Parent then authorized `Codex <codex@openai.com>`
for that commit command only; no local/global identity configuration is changed.

Verified completed work:
- Runtime and release-script storage adapters accept explicit `neon-s3`, require
  complete branch AWS settings and an existing bucket name, pass the validated
  HTTPS branch endpoint with path-style addressing and required-only checksums,
  and reject incomplete or contradictory configuration without backend fallback.
- Unset selection preserves R2 -> AWS -> PostgreSQL. Explicit legacy selections
  fail when their own configuration is incomplete. URL/key construction stays in
  existing owners; activating Neon requires a verified copy of existing objects.
- The existing LLM owner supports `neon`/`neon-ai-gateway` in the explicit provider
  order, uses the branch host plus `/v1`, requires a chosen model, bounds output
  and timeout, disables hidden SDK retries, handles text blocks, and retains
  output validation, failover and cooldown. Default provider order is unchanged.
- Existing public-media behavior and PostgreSQL precedence are covered by the
  targeted validation. The old source-text precedence assertion was replaced by
  actual behavior checks against both adapters.
- Official Neon docs were read on 2026-09-17; the current storage quickstart
  supports `aws-us-east-1`, superseding older bundled skill restrictions.

Changed but unverified work:
Live Neon S3 operations, bucket population, gateway model availability, credentials,
billing eligibility, JSON-schema support of the selected model, production end-to-end
county behavior and full release proof have not been exercised. No mocks establish
those claims.

Files changed:
- `.env.example`
- `.selective-intelligence/project-index.json`
- `docs/audits/NEON_BACKEND_ADAPTERS_CHECKPOINT_2026-09-17.md`
- `docs/release/NEON_BACKEND_ADAPTERS.md`
- `scripts/server-object-storage.contract.test.mjs`
- `scripts/server-object-storage.mjs`
- `server/serverObjectStorage.ts`
- `server/services/llmProvider.ts`
- `server/tests/llm-provider-failover.test.ts`
- `server/tests/postgres-public-media-migration.contract.test.ts`
- `server/tests/server-object-storage.test.ts`

Tests/evidence already run:
- `npm ci --ignore-scripts --no-audit --no-fund --cache .npm-cache`: passed after
  materializing the existing `vendor/infinity` lockfile tarball. Package manifests
  and lockfile are unchanged. This is not the required release-mode clean install.
- `node --test scripts/server-object-storage.contract.test.mjs`: 10/10 passed.
- `npm run check`: passed, full-project TypeScript check.
- `npm run test:run -- server/tests/server-object-storage.test.ts server/tests/llm-provider-failover.test.ts server/tests/public-media-storage.test.ts server/tests/postgres-public-media-migration.contract.test.ts --reporter=dot --silent`:
  53/53 tests in 4/4 files passed, no skips. Gateway is mocked; URL signing is local.
- Canonical sibling SI `project_index.py` refresh ran before extension and after
  materializing the complete tracked source set. The index records the extension
  reuse decision. A canonical baseline overlay scan of source at base commit
  `6031a5a2` proves all six current blocking index findings pre-exist this slice.
- Final canonical `project_index.py doctor --root . --json`: exit 1,
  `stale: false`, 6 pre-existing errors and 5 warnings; details below.

Tests/evidence invalidated by later changes:
Initial checks caught an unsupported AWS SDK endpoint-isolation setting and a
literal source-text test affected by the new branching. Both were corrected;
the final 53+10 passing cases supersede the earlier runs. The first index refresh
was based on sparse files; it was replaced after materializing source roots.

Known blockers/risks:
- Index doctor reports six pre-existing errors: duplicate PostCSS configs,
  duplicate onboarding intent/profile pages, and owner collisions for `AppShell`,
  `JwStoneMemberCart`, `NewArrivalsSection`, and `PublicProfileAccountDialog`.
  It also reports five existing raw-UI warnings. No adapter introduced a finding.
  These remain unresolved outside the authorized backend slice; they are not a
  passing architecture gate or permission to consolidate other lanes.
- The tracked index previously represented an older source revision. Its generated
  diff includes current baseline inventory; unrelated product source was not edited.
- Never enable the empty Neon bucket before copying and verifying existing
  server-owned public-media keys. No automatic migration, dual-write or legacy
  read fallback is provided. Existing private upload owners remain in place.
- No cloud provisioning, release gate, browser/county proof, production-secret
  access, customer-data read, billable inference, payment or credit purchase ran.

External side effects and retry safety:
Only local branch/files/dependencies and read-only official documentation fetches.
No push, merge, deploy, external message, cloud mutation or billable request.
The gateway's SDK retry count is zero; the existing fallback loop owns retry policy.

Next exact action:
Parent independently reviews these existing owners and this checkpoint, including
the known index findings, and decides integration. Follow
`docs/release/NEON_BACKEND_ADAPTERS.md` before any separately authorized activation.
Run the repository's release gates at the integration/release boundary.

Actions that must NOT be repeated:
Do not restart Scout/JW audits, clone a second service owner or SI engine, change
contact/trust/county/business-membership gates, infer live success from mocks,
enable an unpopulated bucket, purchase service access, or publish/deploy this worker
branch without the parent's integration decision.

Law classifications:
Contact/Decision Card, Trust/CVS, county and JW membership boundaries: **enforced
by existing owners, unchanged here**; these unit tests do not newly attest every
flow. Live Neon activation and complete release proof: **policy_target**.
