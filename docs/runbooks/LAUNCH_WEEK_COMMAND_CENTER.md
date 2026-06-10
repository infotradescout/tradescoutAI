# Launch Week Command Center

Date: 2026-06-09
Owner: TradeScout product/engineering/ops
Scope: Hundreds-of-users launch readiness for signup, Scout, Direct Connect, support, and operator response.

## Decision

Do not call the launch ready until the hard gates below are closed.

Launch can proceed in a constrained mode when:
- public app routes are healthy
- signup/login/session persistence is verified
- Scout gives useful next steps without unsafe action or contact leakage
- Direct Connect requester/provider smoke is authenticated and archived
- support intake is staffed and visible
- rollback/deploy ownership is assigned

## Hard Gates

| Gate | Status | Required evidence |
| --- | --- | --- |
| Production health | open | `GET https://www.thetradescout.com/api/health` returns `200` and `status: "healthy"`. |
| Build confirmation | open | `x-tradescout-build` matches the intended deployed commit on `/`, `/scout`, and `/direct-connect`. |
| Signup and session persistence | open | Login/signup smoke confirms `/api/auth/user` survives refresh for a normal user and an admin/support user. |
| Release gates archived | open | `npm run test:release-gates` and `npm run report:release-gates` artifacts are archived for the deployed build. |
| Direct Connect launch traffic smoke | blocked | `artifacts/direct-connect-production-smoke-latest.json` currently shows `BLOCKED` because requester/provider cookies and rate-limit proof inputs are missing. |
| Direct Connect notifications | open | Confirm current build includes notification UI and unauthenticated notification endpoints return `403`, not `500`. |
| Admin support safeguard | open | `ADMIN_SAFETY_KEY` is set in production, known to the launch operator, and support edit policy requires a ticket/reference. |
| Production bypass posture | open | Production env confirms demo/unverified bypass toggles are off. |

## Constrained Launch Mode

If hard gates are not all closed by launch day, reduce the public promise instead of widening risk.

Keep enabled:
- signup/login
- Scout guidance
- read-only discovery
- Direct Connect request drafting/submission only if smoke passes
- support tickets/help

Defer or hide from campaign emphasis:
- payments and money movement
- advanced HOA/accounting workflows
- unproven notification lifecycle claims
- any promise of instant provider response
- any promise that requires live staff KPI access during the first traffic wave

## First 2 Hours Watch

Operator cadence: every 15 minutes for the first 2 hours, then hourly for the first day.

Track:
- `/api/health` latency and status
- 5xx count
- 401/403 spikes on expected authenticated paths
- signup starts/completions
- login failures and password reset requests
- Scout fallback/error rate
- Direct Connect request started/submitted counts
- Direct Connect provider request-list response shape
- support-ticket volume and unresolved critical tickets
- Sentry new issue count

Escalate immediately if:
- any core route returns sustained 500s
- signup/login/session persistence fails
- Direct Connect creates requests but provider board or notifications break
- support queue exceeds available operator response capacity
- any contact leakage or bypass indicator appears

## Manual Smoke Script

Use this sequence once immediately before traffic and once after the first real wave.

1. Open `/` and `/scout`; confirm app mounts and no startup fallback is visible.
2. Create or sign in as a normal user.
3. Refresh; confirm session persists.
4. Start a Scout session and ask for a local next step.
5. Start a Direct Connect request, save/review/submit with no contact leakage.
6. Sign in as a provider/business smoke account.
7. Confirm provider request board returns a JSON array and does not 500.
8. Trigger or inspect a notification; confirm notification center loads and read state persists.
9. Submit a support ticket or error report from the user path.
10. Confirm admin/support operator can find the user/report without unsafe account edits.

## Evidence Commands

Do not run production smoke against real user accounts. Use approved smoke accounts only.

```bash
npm run validate:env
npm run guard:prod-bypass
npm run report:release-gates
npm run smoke:staff-kpi
npm run smoke:direct-connect-production
```

Required env for Direct Connect launch traffic smoke:

```bash
RUN_DIRECT_CONNECT_PRODUCTION_SMOKE=1
TRADESCOUT_REQUESTER_COOKIE="<full requester Cookie header>"
TRADESCOUT_PROVIDER_COOKIE="<full provider Cookie header>"
TRADESCOUT_PRODUCTION_DATABASE_URL="<production database url for rate_limit_buckets evidence>"
RUN_DIRECT_CONNECT_RATE_LIMIT_429=1
```

## Triage Priorities

P0 before traffic:
- health/build/session
- production bypass off
- Direct Connect authenticated smoke
- support intake staffed
- rollback owner assigned

P1 during first day:
- Scout fallback/error rate
- Direct Connect provider board/notifications
- support queue aging
- signup completion friction

P2 after first day:
- copy polish
- lower-traffic workflows
- advanced admin analytics
- broad SEO/category expansion

## User-Facing Promise For Launch Week

Use restrained language:

TradeScout helps people find the right local next step, create verified intent, and move toward connection without opening contact before the decision is ready.

Avoid:
- "instant matches"
- "guaranteed providers"
- "fully automated coordination"
- "payments are production-ready" unless the exact flow has fresh evidence
- contractor-only/homeowner-only framing outside scoped campaigns

## Rollback / Degrade Plan

If the app is unstable:
- stop campaign traffic first
- keep read-only pages and Scout guidance available if healthy
- disable or de-emphasize request submission CTAs until Direct Connect recovers
- route users to support tickets/help instead of asking them to retry silently
- preserve contact gates even under pressure

If Direct Connect is unstable:
- keep Scout and discovery up
- pause public request-submission emphasis
- let users save drafts or contact support
- do not open direct contact as a workaround

If Scout LLM providers are unstable:
- fall back to deterministic guidance and route links
- avoid generating provider/contact claims
- watch fallback rate and user-facing error copy
