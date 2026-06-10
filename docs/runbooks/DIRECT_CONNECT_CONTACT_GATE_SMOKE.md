# Direct Connect Contact Gate Production Smoke

Status: active runbook
Owner: Direct Connect authority lane
Last updated: 2026-06-10

## Purpose
Prove contact-gate doctrine remains enforced across server payloads, requester cards, and share surfaces.

Target belief: TradeScout protects private contact until explicit release authority.
Target behavior: operators verify contact stays gated before and after release transitions.
Psychological principle: trust through deterministic, explainable gating.
Risk prevented: accidental contact leakage through payload drift or UI rendering drift.

## Contact-Gate Regression Matrix

| Case | Input state | Expected normalized panel state | releasedContact exposed to panel | Expected result |
| --- | --- | --- | --- | --- |
| Missing state | null/undefined | contact_hidden | no | Fail closed |
| Hidden | contact_hidden | contact_hidden | no | Fail closed |
| Provider requested | provider_requested_contact | provider_requested_contact | no | Fail closed |
| Requester approved | requester_approved | requester_approved | no | Fail closed |
| Released | contact_released | contact_released | yes | Show released contact only in DecisionContactGatePanel |
| Unknown | unknown_contact_state | unknown_contact_state | no | Fail closed |
| Truthy payload + non-released | provider_requested_contact + contact payload | provider_requested_contact | no | Ignore payload |

## Read-Only Probes

Set values once:

```bash
BASE_URL="https://www.thetradescout.com"
REQUEST_ID_PRE="<pre-release-request-id>"
REQUEST_ID_RELEASED="<released-request-id>"
AUTH_COOKIE="<session-cookie>"
SHARE_TOKEN="<share-token>"
```

### 1) Pre-release requester list/detail payload probe

```bash
curl -sS "$BASE_URL/api/direct-connect/requests" \
  -H "Cookie: $AUTH_COOKIE" \
  | jq '.[] | select(.id == env.REQUEST_ID_PRE) | {id, contactGateState, releasedContact}'

curl -sS "$BASE_URL/api/direct-connect/requests/$REQUEST_ID_PRE" \
  -H "Cookie: $AUTH_COOKIE" \
  | jq '{requestId, contactGateState, releasedContact}'
```

Pass criteria:
- contactGateState is present.
- releasedContact is null/absent before release.
- No raw phone/email/address appears in payload.

### 2) Released requester list/detail payload probe

```bash
curl -sS "$BASE_URL/api/direct-connect/requests" \
  -H "Cookie: $AUTH_COOKIE" \
  | jq '.[] | select(.id == env.REQUEST_ID_RELEASED) | {id, contactGateState, releasedContact}'

curl -sS "$BASE_URL/api/direct-connect/requests/$REQUEST_ID_RELEASED" \
  -H "Cookie: $AUTH_COOKIE" \
  | jq '{requestId, contactGateState, releasedContact}'
```

Pass criteria:
- contactGateState is released/contact_released.
- releasedContact appears only for released/contact_released server states.

### 3) Share surface no-contact-leak probe

```bash
curl -sS "$BASE_URL/api/direct-connect/share/$SHARE_TOKEN" \
  | jq '{id, title, scopeSummary, gating, releasedContact}'
```

Pass criteria:
- Response contains gating.contactLocked = true.
- releasedContact is absent.
- title/scopeSummary do not reveal raw phone or email.

### 4) UI markup check: no raw contact before release

```bash
curl -sS "$BASE_URL/direct-connect" \
  -H "Cookie: $AUTH_COOKIE" \
  | rg -i "owner@example|[0-9]{3}[-.) ]?[0-9]{3}[- ]?[0-9]{4}|Released contact"
```

Pass criteria:
- For a pre-release request context, no raw phone/email appears.
- No standalone released-contact block appears before release.

### 5) Fail-closed unknown-state local proof

```bash
npm run test:run -- client/src/pages/direct-connect/requestCardPresentation.test.ts
npm run test:run -- client/src/components/ui/DecisionContactGatePanel.test.ts
```

Pass criteria:
- Unknown and missing state tests pass with fail-closed behavior.
- Truthy releasedContact payload is ignored unless normalized state is contact_released.

## What This Does Not Change
- No new contact states.
- No loosening of releasedContact gating.
- No affiliate/payment/ranking behavior.
- No UI redesign.
