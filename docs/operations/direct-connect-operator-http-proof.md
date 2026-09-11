# Direct Connect operator HTTP proof

This fixture starts the actual `registerRoutes` Express application, Passport local password
authentication, PostgreSQL cookie sessions, authority middleware, storage, and Vite app. It
does not replace API handlers, permission middleware, eligibility filters, or messages with
mock endpoints. All accounts, requests, notifications, and messages are synthetic local data.

Use a dedicated loopback PostgreSQL database named `ts_operator_test`. The runner refuses
other hosts/databases or a non-test environment and removes provider credentials before
loading application modules. Do not load a development or production `.env` file.

1. Set `NODE_ENV=test`, `TEST_DATABASE_URL` for that disposable database,
   and `ALLOW_TEST_DB_FULL_SYNC=true`.
   Run the repository's `scripts/bootstrap-test-db.mjs --full-sync` with the explicit
   disposable-database safety flags required by that script.
2. Set the database timezone to UTC before starting the application.
3. Set `OPERATOR_HTTP_PROOF=true` and run
   `node --import tsx scripts/direct-connect-operator-http-proof.ts`.
   Keep this process running. It listens only on `http://127.0.0.1:5218`.
4. In another process using the same test database environment, run
   `node --import tsx scripts/verify-direct-connect-operator-http-proof.ts`.
   This applies committed SQL-owned fixture prerequisites `0005_documents.sql` and
   `0094_accounting_books_foundation.sql` if their tables are absent; it does not claim
   a complete production migration replay.
5. The private `test-results/operator-http-proof/fixture.private.json` contains the current
   synthetic identities/password, request and conversation IDs, and local session cookies.
   Sign in through `/login` as `identities.operator.email` using that password, then open
   `/admin/direct-connect-requests?requestId=<requestId>`.
   Sign in as the provider to open `/messages?thread=<conversationId>`.
   Never publish the private fixture/state files. Share only the sanitized HTTP evidence
   and screenshots of these synthetic accounts.

The HTTP runner covers one Alachua County request created by the requester, explicit operator
permissions, county eligibility, missing dispatch ownership, forced snapshot/audit rollback,
one invitation across replay, changed-payload rejection, provider acceptance, locked contact,
requester-only approval and release, staff-authored reply/replay, exact request history,
contractor-profile owner reading, and unrelated viewer rejection. It writes sanitized
`test-results/operator-http-proof/http-evidence.json`.

The native fixture found two contact-path defects: a manual invitation did not snapshot the
eligible provider into the dispatch ledger, and request-contact SQL could not type a null
worker profile parameter. Manual invitation now records the candidate in its locked
transaction, requires the matching requester-owned dispatch, and preserves the contact lock.
The contact route retains its existing candidate/response authority checks with typed nulls.
The Messages job-context projection now reads county and city from their canonical request
and requester-owned dispatch fields and uses canonical conversation membership; its native
provider200/unrelated403 checks accompany the message-read checks.

This establishes local route and browser behavior for synthetic identities. It is not
production authentication, a customer message, email delivery, merge, or deployment proof.
Stop only this fixture process when finished; the database/cluster is owned separately.
