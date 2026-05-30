# First-Use Guidance Live Verification (Slice 35)

Date: 2026-05-30

Status: PARTIAL PASS (deployment/runtime blocker)

## Scope
Live verification for first-use guidance only:
- launcher visibility
- six required options
- dismiss/restore behavior
- route mapping
- guidance presence on HomeID, Direct Connect, Scout
- banned copy check on guidance surfaces

No feature work performed.

## Build hash proof
- Host: `https://www.thetradescout.com`
- Header: `x-tradescout-build: 47d69add057790e359577d6bb3986f5e5b7aef0b`
- Result: PASS (`47d69add` or newer confirmed)

## Live route checks
Checked with Playwright browser automation against:
- `/`
- `/homes`
- `/direct-connect`
- `/scout`

### Active blocker
All tested routes render a boot fallback surface with:
- "TradeScout encountered a startup issue."
- "We could not render the app yet. Reload to recover."

This prevents reliable runtime verification of launcher UI and interactive route mapping.

### Observed route outcomes
- `/` -> 200, resolves to `/landing`, boot fallback shown
- `/homes` -> 200, redirects to `/pre-scout-setup?mode=signin&next=%2Fhomes`, boot fallback shown
- `/direct-connect` -> 200, boot fallback shown
- `/scout` -> 200, boot fallback shown

## Guidance verification status
- Home page launcher visible: BLOCKED by boot fallback
- Six required launcher options visible: BLOCKED by boot fallback
- Dismiss/restore behavior: BLOCKED by boot fallback
- Route map interactions: BLOCKED by boot fallback
- HomeID guidance presence: BLOCKED by boot fallback
- Direct Connect guidance presence: PARTIAL (string present in page payload)
- Scout guidance presence: PARTIAL (string present in page payload)

## Banned copy status (visible live UI)
Because runtime UI did not fully boot, this check is not authoritative for interactive surfaces.

Payload text on `/scout` still contains:
- "Scout helps"
- "Ask Scout"

Treat as follow-up copy/runtime validation once the boot fallback is resolved.

## Decision
Slice 35 is not fully clear for production guidance verification due to a live runtime startup blocker.

## Next step (Slice 36 target)
Repair live app boot/startup issue first, then rerun the same first-use guidance live verification checklist.
