# Slice 89 - Direct Connect Pensacola Execution Tracker v1

Date: 2026-06-02
Status: PASS (execution tracker baseline)

## Purpose
This tracker turns the Slice 88 county proof runbook into an operator-ready execution record for the first Direct Connect proof county.

Proof county:
- Escambia County, Florida

Operating label:
- Pensacola / Escambia County

Target outcome:
- Track whether Pensacola has enough real requester demand, eligible contractor supply, contractor response, contact-gate discipline, and completed-outcome evidence to support a county launch decision.

## Scope
TradeScout Direct Connect only.

In scope:
- provider category coverage
- seeded request count
- provider responses
- contact-gate releases
- completed outcomes
- daily blockers
- weekly launch scorecard inputs

Out of scope:
- MealScout
- paid placement or ranking advantage
- contact-gate doctrine changes
- staff KPI auth bypass
- Direct Connect UI redesign
- sitemap drift

## Doctrine Guardrails
Law classifications:
- Visibility does not equal access: enforced
- Intent -> Decision Card -> Contact: enforced
- No pay-to-play / no lead selling: enforced
- Home Record optionality: enforced
- Counties as operational containers: policy_target for this tracker
- Trust/CVS governs exposure: policy_target for future tuning after live proof data exists

No temporary exception is introduced.

## Execution Status
Current status:
- `NOT_STARTED`

Allowed status values:
- `NOT_STARTED`: tracker is ready, but county proof has not begun.
- `ACTIVE`: proof window is running.
- `WATCH`: activation exists, but response/outcome evidence is thin.
- `BLOCKED`: a blocker prevents valid proof capture.
- `GO`: launch threshold met.
- `NO_GO`: launch threshold failed or a doctrine blocker occurred.
- `DEFERRED`: proof paused due production evidence/auth/session access limitations.

Proof window:
- Start date:
- End date:
- Operator:
- Review cadence: daily during proof window, weekly for launch scorecard

## Provider Category Tracker
Minimum Slice 88 density target:
- At least `5` eligible contractors/providers in the county.
- At least `3` trades represented.
- At least `2` providers available for the first seeded request category.

| Trade / category | Target providers | Confirmed eligible | Provider IDs / labels | County/service-area confirmed | Can view Direct Connect | Contact remains gated | Paid/ranking influence absent | Notes |
| --- | ---: | ---: | --- | --- | --- | --- | --- | --- |
| General handyman / small repairs | 3 | 0 |  | PENDING | PENDING | PENDING | PENDING |  |
| Roofing / exterior leak response | 2 | 0 |  | PENDING | PENDING | PENDING | PENDING |  |
| Plumbing | 2 | 0 |  | PENDING | PENDING | PENDING | PENDING |  |
| Electrical | 2 | 0 |  | PENDING | PENDING | PENDING | PENDING |  |
| HVAC | 2 | 0 |  | PENDING | PENDING | PENDING | PENDING |  |
| Cleaning / turnover / property care | 2 | 0 |  | PENDING | PENDING | PENDING | PENDING |  |
| Property management / tenant issue support | 2 | 0 |  | PENDING | PENDING | PENDING | PENDING |  |

Provider readiness decision:
- `PENDING`

Provider readiness passes only when:
- At least `5` eligible providers are confirmed.
- At least `3` trades are represented.
- Provider visibility is not controlled by paid, featured, subscription, ranking, or lead-selling fields.
- Provider/requester contact remains redacted before contact gate release.

## Seeded Request Tracker
Minimum Slice 88 seed target:
- `3` submitted requests in the target county.
- At least `2` different trade categories.
- At least `1` request with photos or clear scope details.
- At least `1` request that reaches contractor visibility.

| Request label | Request ID | Date seeded | Trade/category | Real requester or controlled smoke | County confirmed | Home Record optional | Review opened | Submitted | Contractor-visible | Photos/details present | Excluded from public proof metrics if smoke | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Request 1 |  |  |  |  | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |  |
| Request 2 |  |  |  |  | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |  |
| Request 3 |  |  |  |  | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |  |

Request seeding decision:
- `PENDING`

Seeded request rules:
- Do not count HomeID preview drafts.
- Do not count hidden test artifacts.
- Do not count QA-only cards as live demand.
- Do not count fabricated completion outcomes.
- Controlled smoke requests must be clearly identified and excluded from public proof metrics unless separately approved.

## Provider Response Tracker
| Response label | Request ID | Provider ID / label | Date visible | Date action started | Action type | Event observed | Contact gate state | Contact leaked before gate | Human-readable contractor card | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Response 1 |  |  |  |  |  | PENDING | PENDING | NO | PENDING |  |
| Response 2 |  |  |  |  |  | PENDING | PENDING | NO | PENDING |  |
| Response 3 |  |  |  |  |  | PENDING | PENDING | NO | PENDING |  |

Provider response passes when:
- At least `1` eligible contractor starts an action on a contractor-visible request.
- `direct_connect_contractor_action_started` is observed locally or in a safe production evidence source when available.
- Contractor-facing cards use human-readable copy.
- Contact remains gated before approved release.

## Contact-Gate Release Tracker
| Release label | Request ID | Provider ID / label | Gate state before | Gate decision source | Release timestamp | Requester contact exposed to provider | Provider contact exposed to requester | Audit note / evidence | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Release 1 |  |  |  |  |  | PENDING | PENDING |  |  |
| Release 2 |  |  |  |  |  | PENDING | PENDING |  |  |

Contact-gate release rules:
- Contact release must follow the governed decision path.
- Request visibility alone must not release contact.
- Contractor action alone must not release contact unless the product doctrine explicitly allows that state transition.
- Any early contact exposure is an immediate `NO_GO` blocker.

## Completed Outcome Tracker
A completed outcome counts only when it has an auditable lifecycle trail.

| Outcome label | Request ID | County | Trade/category | Submitted at | Contractor-visible at | Contractor action at | Contact gate transition | Final lifecycle state | Completed outcome evidence | No contact leakage | No paid/ranking influence | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Outcome 1 |  | Escambia County, FL |  |  |  |  |  |  |  | PENDING | PENDING |  |
| Outcome 2 |  | Escambia County, FL |  |  |  |  |  |  |  | PENDING | PENDING |  |

Completed-outcome decision:
- `PENDING`

Outcome can count when:
- Request was submitted.
- Contractor visibility was legitimate.
- Contractor action was recorded.
- Final lifecycle state is documented.
- Contact gate state is documented.
- No contact leakage or paid/ranking influence occurred.

Outcome cannot count when:
- Request remained draft-only.
- Contractor visibility never occurred.
- Contractor-visible request had no contractor action.
- Completion is admin-only without audit context.
- Any step bypassed contact-gate doctrine.

## Daily Blocker Tracker
Use one row per proof day.

| Day | Date | Submitted requests | Contractor-visible requests | Contractor actions | Contact releases | Completed outcomes | Preview/test artifact incident | Contact leakage incident | Paid/ranking influence incident | Home Record required incident | Copy/status issue | Blocker summary | Decision |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- | --- |
| Day 1 |  | 0 | 0 | 0 | 0 | 0 | NO | NO | NO | NO | NO |  | PENDING |
| Day 2 |  | 0 | 0 | 0 | 0 | 0 | NO | NO | NO | NO | NO |  | PENDING |
| Day 3 |  | 0 | 0 | 0 | 0 | 0 | NO | NO | NO | NO | NO |  | PENDING |
| Day 4 |  | 0 | 0 | 0 | 0 | 0 | NO | NO | NO | NO | NO |  | PENDING |
| Day 5 |  | 0 | 0 | 0 | 0 | 0 | NO | NO | NO | NO | NO |  | PENDING |
| Day 6 |  | 0 | 0 | 0 | 0 | 0 | NO | NO | NO | NO | NO |  | PENDING |
| Day 7 |  | 0 | 0 | 0 | 0 | 0 | NO | NO | NO | NO | NO |  | PENDING |
| Day 8 |  | 0 | 0 | 0 | 0 | 0 | NO | NO | NO | NO | NO |  | OPTIONAL |
| Day 9 |  | 0 | 0 | 0 | 0 | 0 | NO | NO | NO | NO | NO |  | OPTIONAL |
| Day 10 |  | 0 | 0 | 0 | 0 | 0 | NO | NO | NO | NO | NO |  | OPTIONAL |
| Day 11 |  | 0 | 0 | 0 | 0 | 0 | NO | NO | NO | NO | NO |  | OPTIONAL |
| Day 12 |  | 0 | 0 | 0 | 0 | 0 | NO | NO | NO | NO | NO |  | OPTIONAL |
| Day 13 |  | 0 | 0 | 0 | 0 | 0 | NO | NO | NO | NO | NO |  | OPTIONAL |
| Day 14 |  | 0 | 0 | 0 | 0 | 0 | NO | NO | NO | NO | NO |  | OPTIONAL |

Immediate blocker conditions:
- Any requester or provider contact detail leaks before gate release.
- Any preview/test/HomeID draft artifact appears as normal live demand.
- Any paid, featured, subscription, ranking, or lead-selling field controls visibility or action access.
- Home Record is required for basic request submission.
- Eligible provider cannot see/action a legitimate routed request.
- Requester or contractor copy exposes raw enum/internal state.

## Weekly County Launch Scorecard
| Field | Value |
| --- | --- |
| County | Escambia County, Florida |
| Week |  |
| Request starts | 0 |
| Review opened | 0 |
| Requests submitted | 0 |
| Contractor-visible requests | 0 |
| Contractor actions started | 0 |
| Contact-gate approvals/releases | 0 |
| Completed outcomes | 0 |
| Preview/test artifact incidents | 0 |
| Contact leakage incidents | 0 |
| Paid/ranking influence incidents | 0 |
| Home Record required incidents | 0 |
| Provider density status | PENDING |
| Requester activation status | PENDING |
| Contractor activation status | PENDING |
| Board integrity status | PENDING |
| Final decision | PENDING |
| Notes |  |

Decision values:
- `GO`: all go/no-go thresholds met.
- `WATCH`: activation exists, but contractor action or completed outcome evidence remains thin.
- `NO_GO`: blocker condition occurred or activation is absent.
- `DEFERRED`: proof cannot be completed because safe live evidence access is unavailable.

## Measurement Source Notes
Preferred evidence sources:
- Direct Connect local lifecycle contracts for expected behavior.
- Production visual proof for board/copy/contact leakage checks.
- Staff KPI smoke runner only after staff session is safely rotated and locally set.
- Operator-entered proof tracker rows for daily execution state.

Do not record:
- Staff cookies.
- Raw request headers.
- cURL output containing session material.
- Private requester/provider contact data unless stored in the approved system of record.

## Measurement Gap Watch
No code change is required by this tracker yet.

Open a narrow implementation slice only if the proof run reveals one of these blockers:
- No reliable place to record daily county proof metrics.
- No safe way to tie contractor visibility to county in reporting.
- No auditable completed-outcome state exists.
- Contact-gate release cannot be verified without exposing private data in docs.
- Staff-safe scorecard evidence cannot be captured without weakening auth.

## Final Decision
Slice 89 is an execution-tracker PASS.

Pensacola proof execution now has a fillable tracking structure for:
- provider categories/trades
- seeded requests
- provider responses
- contact-gate releases
- completed outcomes
- daily blockers
- weekly county launch scorecard

No code change is required unless the live proof run exposes a missing measurement, admin view, or Trust Ledger capture point.
