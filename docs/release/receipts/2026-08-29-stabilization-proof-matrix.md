# Seven-Day Stabilization Proof Matrix

Date: 2026-08-29
Rollback baseline: `a3adb045ec8a3088b705b6ddafb56cf05540552c`
Branch: `stabilization/seven-day-proof-20260829`
Pull request: `#537`
Release state: **DRAFT / HOLD**

This file separates source correction from executable proof and product acceptance. A passing source review does not authorize a production merge.

## 1. Release baseline

| Requirement | State | Evidence |
| --- | --- | --- |
| Current production rollback SHA preserved | PASS | Baseline receipt pins `a3adb045ec8a3088b705b6ddafb56cf05540552c` and Render deploy `dep-da96hcoae00c73ae22p0`. |
| Stabilization work isolated from `main` | PASS | All corrections are on `stabilization/seven-day-proof-20260829`. |
| Unrelated feature work excluded from this release | PASS | Current diff is limited to release evidence, HTTP/telemetry safety, plugin availability, database transport security, and test contracts. |

## 2. First-party event ingestion

| Requirement | State | Evidence |
| --- | --- | --- |
| Only the seven existing demand events may persist | SOURCE PASS | Exact server registry matches the existing client demand-event union. Unknown event names receive HTTP 204 but are not written. |
| Caller-supplied user or contractor identity rejected | SOURCE PASS | Identity is derived only from the authenticated server session; anonymous events store null identity. |
| Request text, messages, email, phone, address, uploads, raw IP, and raw user-agent excluded | SOURCE PASS | Flat allowlist plus controlled attribution object; query/fragment stripping; continuous and formatted phone-like values rejected; raw IP and user-agent are not stored. |
| Oversized payloads dropped | SOURCE PASS | 8 KiB persistence boundary. |
| Telemetry failure cannot break customer work | SOURCE PASS | Response completes before the write; synchronous and asynchronous storage errors are handled fail-soft. |
| Abuse bounded | SOURCE PASS | Production-only one-minute limiter returns a quiet 204. |
| Executable proof | PARTIAL PASS | Isolated TypeScript transpilation passed; five direct sanitizer/event-registry cases passed. Full repository Vitest and build are still required. |

## 3. Historical 5xx correction

| Failure class from audit | Correction | State |
| --- | --- | --- |
| Denied browser origin surfaced as HTTP 500 | CORS denial is classified as HTTP 403 with a generic code. | SOURCE PASS |
| Unsupported WordPress/CMS probes reached the application error path | Known CMS discovery and batch probes fail as no-store HTTP 404 responses. | SOURCE PASS |
| `/api/events` writes failed as customer-visible 500 responses | Event endpoint responds 204 before a bounded fail-soft write. | SOURCE PASS |
| Public media returned 502 after bundled command names changed | Existing production correction #493 remains the current owner. | PRODUCTION BASELINE PASS |
| PostgreSQL targeted-ad fallback emitted invalid `ORDER BY 0` | Existing production correction #521 remains the current owner. | PRODUCTION BASELINE PASS |
| Unconfigured public JWKS route threw | Entire plugin OAuth surface is a non-cacheable 404 until issuer, audience, valid signing key, and client registry are complete. | SOURCE PASS |
| Exact deployed regression proof | Not run because this candidate is not deployed. | BLOCK |

## 4. PostgreSQL transport security

| Requirement | State | Evidence |
| --- | --- | --- |
| Remote URLs cannot use `disable`, `allow`, or ambiguous modes | PASS | Shared URL owner rejects insecure modes and upgrades remote URLs to `sslmode=verify-full`. |
| Local development remains usable | PASS | localhost, 127.0.0.1, and loopback IPv6 remain unchanged. |
| Insecure test exception is explicit and test-only | PASS | Requires both `NODE_ENV=test` and `ALLOW_INSECURE_TEST_DATABASE=true`. |
| Web server actually honors `verify-full` | SOURCE PASS | Node/Render server now uses `pg` and `drizzle-orm/node-postgres` for remote and local connections. The Neon serverless Pool is no longer used by `server/db.ts`, because its default secure-WebSocket mode disables PostgreSQL-protocol TLS and a URL rewrite alone would not prove hostname verification. |
| Migrations, schema verification, media workers, Docker runtime, and Render pre-deploy share the secure URL owner | SOURCE PASS | Drizzle configs, release wrapper, migration wrapper, runtime verifier, Dockerfile, and Render pre-deploy command use the shared hardening module. |
| Exact executable URL contract | PASS | Seven isolated Node contract tests passed. |
| Live connection, migration, and startup proof | Not run on this undeployed candidate. | BLOCK |

## 5. Plugin OAuth availability

| Requirement | State | Evidence |
| --- | --- | --- |
| Partial or malformed configuration cannot expose a broken public surface | SOURCE PASS | Router-wide configuration guard returns no-store 404. |
| Complete configuration retains existing authorization-code/PKCE behavior | SOURCE PASS | Existing routes remain behind the configuration guard. |
| Signing key is never exposed | SOURCE PASS | JWKS exports the public key only. |
| Full focused test run | Not executed in the complete repository environment. | BLOCK |

## 6. Product acceptance matrix

These are release blockers, not optional follow-up notes.

### Authenticated TradeScout roles

| Journey | Desktop | Mobile | Release state |
| --- | --- | --- | --- |
| Requester creates, resumes, reviews, and submits a request | Not captured | Not captured | BLOCK |
| Provider receives, opens, responds, and reaches the permitted contact state | Not captured | Not captured | BLOCK |
| Business owner manages the linked business without identity leakage | Not captured | Not captured | BLOCK |
| Profile-account user can see and continue their own profile workspace | Not captured | Not captured | BLOCK |
| Super-admin retains intended authority without leaking it during impersonation | Not captured | Not captured | BLOCK |
| Exiting impersonation restores the real administrator session | Not captured | Not captured | BLOCK |

### JW Stone

| Acceptance requirement | Desktop | Mobile | Release state |
| --- | --- | --- | --- |
| Browse by color shows exactly eight equal, touching slices | Not captured | Not captured | BLOCK |
| Visible range clearly communicates white, rust/red-brown, rose, gold, green, blue, earth, and black | Not captured | Not captured | BLOCK |
| Every slice is a clean slab-only crop | Not captured | Not captured | BLOCK |
| No hand, person, clamp, crane, rack, sky, pavement, yard, or broken image | Not captured | Not captured | BLOCK |
| Headline remains correct and unauthorized supporting text remains absent | Not captured | Not captured | BLOCK |

### BidRock

| Acceptance requirement | Desktop | Mobile | Release state |
| --- | --- | --- | --- |
| Verified buyer opens a confirmed unpriced lot and submits a private quantity/total offer | Not captured | Not captured | BLOCK |
| Authorized seller can review, accept, counter, or decline | Not captured | Not captured | BLOCK |
| No automatic order, payment, fee, commission, or contact release occurs | Not captured | Not captured | BLOCK |
| Unauthorized and unverified users fail closed without corrupting offer state | Not captured | Not captured | BLOCK |

## 7. Production public-media storage

| Requirement | State | Evidence |
| --- | --- | --- |
| Current known public media size recorded | PASS | Separate storage audit records at least approximately 198 MB of known public media inside an approximately 15.96 GB production database. |
| Current route compatibility preserved | SOURCE PASS | This stabilization branch does not change public media URLs or object rows. |
| Object-storage exit conditions recorded | PASS | Exit is required before media growth materially harms backup, restore, read load, cost, or database isolation. |
| Destructive branch/object cleanup avoided without proof | PASS | No non-production database branch or media object was deleted by this lane. |

## 8. Stale current-week pull requests

Closed as superseded or obsolete during this stabilization lane:

- #427
- #428
- #433
- #436
- #457
- #468
- #489

No active work was merged from those stale branches.

## 9. Executable validation still required

Before this draft may become release-ready, the exact final branch head must pass all of the following from a complete checkout:

1. Clean dependency installation.
2. Full TypeScript check.
3. Focused telemetry, public-request-guard, plugin OAuth, database URL, release-runtime, and stabilization tests.
4. Production client/server build.
5. Final Docker runtime verification.
6. Fresh disposable PostgreSQL migration and required-schema verification using verified TLS.
7. Authenticated browser proof for every role row above.
8. Desktop and mobile JW Stone visual captures.
9. Desktop and mobile BidRock buyer/seller captures with payments and fees remaining off.
10. Exact-head release receipt and informational status.

## 10. Current decision

**Product: BLOCK** — required human-visible and authenticated journeys are not captured.

**Technical: BLOCK** — targeted isolated checks pass, but the complete exact-head repository gate, Docker proof, and disposable database proof have not run.

**Merge: HOLD.** Keeping this pull request in draft is the correct outcome until both Product and Technical reach PASS on the same exact head.
