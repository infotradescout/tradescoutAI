# TradeScout OAuth identity boundary

Google and Facebook sign-in strategies are owned by `server/auth.ts`. Route handlers retain TradeScout onboarding, referral, email-verification, welcome, and session-return behavior. Provider availability is computed once by the auth owner for strategy registration and the public availability response.

## Enforced identity rules

- A stored provider subject proves an existing account. Both the dedicated Google/Facebook column and the provider/provider-ID representation are supported.
- Each authorization entry creates a random session-bound state nonce. Missing, wrong, other-session, and replayed state fail before token exchange or identity resolution. Production custom-domain entries move to the configured callback origin before creating the nonce, retaining the validated continuation.
- Duplicate subject owners or contradictory subject representations fail closed. A matching email never grants login or permission to attach a provider.
- An email-only match requires the existing sign-in method. A subject and email owned by different accounts, or ambiguous case-insensitive email owners, require recovery.
- Subject and normalized-email advisory locks serialize competing OAuth callbacks across processes. A bounded local queue limits pool fan-out. Lock contention returns a retry failure; uniqueness races never attach the winning account.
- New accounts retain a null role, unverified email, and incomplete onboarding. Reserved signup identifiers cannot create an account; their already-linked subject owner may sign in with its persisted authority.
- Return paths are constrained to the current origin, including after URL dot-segment normalization. Passport session regeneration carries only the validated return destination. Failure redirects retain the county/claim context and show a constrained account-recovery message.
- New and incomplete accounts carry the same county/claim destination through onboarding and email verification. Email link generation receives a captured continuation rather than rereading already-consumed session state.

These rules are enforced by the canonical identity policy and OAuth storage repository, registered-strategy tests, and native PostgreSQL/HTTP proof. They preserve the platform's claims-first onboarding requirement; this change adds no contact, county, or trust authority.

## Data compatibility and operating limits

No schema migration or production account rewrite is included. Legacy conflicting rows remain untouched and cannot authenticate through the conflicting provider until reconciled through a separately authorized recovery. Existing accounts do not gain a provider from a matching email. Authenticated provider link/unlink UI is outside this change.

The locking guarantee covers the canonical OAuth resolver. Other authorized account writers must preserve normalized email uniqueness and provider ownership; these locks do not establish a new database-wide provider uniqueness constraint. A rolling deployment containing the older email-attachment implementation does not provide the new behavior on old instances. The default 50-client pool provides headroom for the resolver's four concurrent operations, each holding two lock clients plus query capacity; smaller configured pools require separate capacity validation.

## Reproducible proof

Focused behavior tests:

```powershell
$env:VITEST_SERIAL='true'
npm run test:run -- server/utils/oauthIdentityPolicy.test.ts server/tests/oauth-strategy-callbacks.behavior.test.ts server/tests/identity-authority-spine.contract.test.ts server/tests/privileged-email-authority.regression.test.ts client/src/pages/pre-scout-setup.behavior.test.tsx
```

Native proof requires `NODE_ENV=test`, `RUN_INTEGRATION_TESTS=true`, and `TEST_DATABASE_URL` naming a dedicated local `tradescout_test_oauth_*` database with the application schema. Fixtures use synthetic `.invalid` addresses. The HTTP harness clears inherited integration configuration before loading the app and chooses an available loopback port.

```powershell
npm run test:run -- server/tests/oauth-identity-storage.integration.test.ts server/tests/oauth-strategy-callbacks.integration.test.ts
node --import tsx scripts/tests/oauth-identity-http.native.ts
```

The native tests exercise real storage, advisory locks, registered Passport verification callbacks, Express routes, session regeneration, session-bound state validation, same-origin return handling, and denial of account collisions. The HTTP harness replaces the provider's token/profile response and captures generated verification email content without delivery. Real Google/Facebook token exchange, production credentials, provider-console configuration, deployed browser behavior, and production account reconciliation require separate evidence.
