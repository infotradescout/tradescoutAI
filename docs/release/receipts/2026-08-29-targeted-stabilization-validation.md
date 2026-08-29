# Targeted Stabilization Validation Receipt

Date: 2026-08-29
Branch: `stabilization/seven-day-proof-20260829`
Source head before this documentation-only receipt: `b26c3cc86df54b0c5804a2e1e568611c5094e255`
Runtime baseline: `a3adb045ec8a3088b705b6ddafb56cf05540552c`
Environment: Node `v22.16.0`; system TypeScript `5.8.3`

This is targeted evidence only. It is not the repository's complete minimum-release contract.

## 1. Verified PostgreSQL URL owner

The exact contents of `shared/database-url-security.mjs` and its exact standalone Node contract were mirrored into an isolated local directory.

Command:

```text
node --test scripts/database-url-security.contract.test.mjs
```

Result:

```text
7 tests
7 passed
0 failed
```

Covered:

- remote URL upgrade to `sslmode=verify-full`;
- rejection of `disable`, `allow`, and unsupported remote modes;
- localhost preservation;
- explicit test-only insecure exception;
- both database environment variables;
- rejection of invalid and non-PostgreSQL URLs.

SHA-256 of the mirrored exact shared module:

```text
793c2bcc7e47522057f0af0c027e623480b8ec956e83fccaad462b5a5fd6b0a7
```

SHA-256 of the mirrored exact standalone contract:

```text
aa1ba127458f5bf3e976e5f7971b4393eb43edc5f0dcfaf1994b4fd2720c6adc
```

## 2. TypeScript syntax transpilation

The changed event-route logic and changed database-owner logic were reconstructed from the exact reviewed source in isolated files and transpiled with TypeScript's `transpileModule` using ES2022 output.

Result:

```text
src/events.ts: syntax PASS
src/db.ts: syntax PASS
```

This proves parser/transpiler acceptance of the reviewed logic. It does not replace project type resolution, lint, bundling, or runtime dependency verification.

## 3. Direct telemetry privacy cases

The transpiled event module was loaded with an isolated no-op rate-limit adapter and exercised directly.

Result:

```text
TypeScript transpile: PASS
Telemetry privacy cases: 5 PASS
```

Covered:

- continuous ten-digit phone-like value rejected;
- formatted phone-like value rejected;
- ordinary short campaign numbers preserved;
- query values stripped from an allowed route;
- only the seven registered demand events are accepted.

## 4. Source review correction made after the first TLS draft

Primary Neon driver documentation states that its serverless driver normally secures the WebSocket transport and disables PostgreSQL-protocol TLS by default. Therefore, merely rewriting the serverless driver's connection URL to `sslmode=verify-full` would not prove PostgreSQL hostname verification.

The branch was corrected before release:

- `server/db.ts` now uses `pg` and `drizzle-orm/node-postgres` for both remote and local Node server connections;
- the same secure connection URL owner remains shared by the server, Drizzle, migrations, release workers, Docker, and Render pre-deploy;
- a source contract prevents the Neon serverless Pool from returning to the Node server database owner.

## 5. Proof not available in this execution environment

The complete repository could not be cloned or downloaded because the local runtime cannot resolve GitHub and the connector does not expose a repository archive. The following are therefore still BLOCKED and are not implied by this receipt:

- repository `npm ci`;
- repository TypeScript project check with its pinned TypeScript version;
- Vitest suite;
- production build;
- Docker build and final-runtime resolver proof;
- disposable PostgreSQL migration/schema proof;
- real verified-TLS database connection;
- authenticated browser matrix;
- JW Stone desktop/mobile visual acceptance;
- BidRock desktop/mobile buyer/seller acceptance.

## Decision

Targeted validation: **PASS**

Technical release gate: **BLOCK**

Product release gate: **BLOCK**

Merge/deploy authorization: **NONE**
