# Slice 91 - Pensacola Request Seeding Plan v1

Date: 2026-06-02
Status: PASS (demand-side ops prep)

## Purpose
This plan defines how to create and monitor the first real route-ready Direct Connect requests for the Pensacola / Escambia County proof run.

Primary KPI path:
- Pensacola real route-ready requests created
- Provider responses
- Contact-gate releases
- Completed outcomes

The goal is to seed enough real, actionable demand to test provider liquidity without fabricating production demand or weakening contact-gate doctrine.

## Scope
TradeScout Direct Connect only.

In scope:
- first request categories to seed
- requester-source channels
- minimum request detail requirements
- route-ready definition
- manual monitoring rules
- response SLA targets
- completed-outcome capture rules

Out of scope:
- MealScout
- fake/test demand counted as production liquidity
- paid placement or lead selling
- contact-gate doctrine changes
- staff KPI auth bypass
- Direct Connect UI changes
- sitemap drift

## Doctrine Guardrails
Law classifications:
- Visibility does not equal access: enforced
- Intent -> Decision Card -> Contact: enforced
- No pay-to-play / no lead selling: enforced
- Home Record optionality: enforced
- Counties as operational containers: policy_target for this seeding plan
- Trust/CVS governs exposure: policy_target until live proof data exists for tuning

No temporary exception is introduced.

Request seeding must not:
- fabricate completed outcomes
- present HomeID preview/test artifacts as real demand
- require Home Record for basic request submission
- expose requester or provider contact before the contact gate
- route based on paid, featured, subscription, or ranking advantage

## First Request Categories
Target county:
- Escambia County, Florida

Operating label:
- Pensacola / Escambia County

Seed these categories first:

| Priority | Request category | Why this category | Matching provider category | Minimum active providers before seed | Notes |
| --- | --- | --- | --- | ---: | --- |
| P0 | Small repair / handyman punch list | Broadest first proof category; easy to scope and complete. | General handyman / small repairs | 2 | Best first route-ready test. |
| P0 | Plumbing leak / fixture issue | High-intent homeowner demand; response speed matters. | Plumbing | 2 | Avoid emergency/safety edge cases unless provider coverage is ready. |
| P0 | HVAC diagnostic / service issue | Strong seasonal urgency and contractor response signal. | HVAC | 2 | Use clear non-emergency scope. |
| P1 | Roof/exterior leak assessment | Good fit for visible home issue and follow-up outcome. | Roofing / exterior leak response | 2 | Include photos if possible. |
| P1 | Electrical fixture/outlet issue | Common request, but needs clear scope boundaries. | Electrical | 2 | Avoid unsafe live-wire/emergency wording. |
| P2 | Cleaning / turnover / property care | Supports rental/property management liquidity. | Cleaning / turnover / property care | 2 | Good for completed-outcome capture. |
| P2 | Tenant/property maintenance coordination | Tests property-manager style demand. | Property management / tenant issue support | 2 | Use only when provider coverage exists. |

Minimum seed set for proof start:
- `3` submitted route-ready requests.
- At least `2` request categories.
- At least `1` request with photos or detailed scope notes.
- At least `1` request that reaches contractor visibility.

## Requester-Source Channels
Allowed requester sources:
- Operator-controlled real request with clear internal proof notes.
- Real homeowner/property owner request with consent to include in proof tracking.
- Known local relationship request where the requester understands this is a live Direct Connect flow.
- Controlled staff smoke request only if it is clearly marked and excluded from public proof metrics.

Preferred source order:
1. Real homeowner/property owner request.
2. Real local relationship request with consent.
3. Operator-controlled real repair/maintenance need.
4. Controlled staff smoke excluded from public proof metrics.

Do not count:
- fabricated requests
- HomeID preview drafts
- hidden QA cards
- duplicate/recycled smoke requests
- requests with invented completion outcomes
- requests outside Escambia County / Pensacola

Source tracking fields:
- source type
- consent/notes status
- county confirmed
- category
- route-ready decision
- public proof eligible: yes/no

## Minimum Request Detail Requirements
A request is minimally complete when it includes:
- short title
- description of the work needed
- category/trade
- Pensacola/Escambia location context
- urgency/timing preference
- property type or basic site context if relevant
- requester availability or response preference inside the governed product flow
- photo or clear scope detail when the category benefits from visual context

Recommended detail quality:
- clear problem statement
- what changed or failed
- approximate location on property
- whether issue is recurring or new
- safe access notes if needed
- budget preference only if requester wants to provide it

Do not require:
- Home Record
- HomeID component selection
- private contact details in docs
- budget disclosure
- contractor pre-selection

## Route-Ready Definition
A request is `route_ready` when all are true:
- County is Escambia County / Pensacola.
- Category maps to at least one target provider trade.
- Minimum request details are present.
- Request is submitted through Direct Connect, not only drafted.
- Home Record was optional, not required.
- Request does not come from preview/test/HomeID draft artifacts counted as live demand.
- Provider visibility can be created through legitimate assignment/routing.
- Contact remains gated before release.
- No paid/featured/subscription/ranking field controls routing visibility.

A request is not route-ready when:
- It is a draft only.
- It lacks category or location context.
- It has no eligible provider category.
- It is outside the target county.
- It is a QA/smoke artifact counted as public demand.
- It would require contact-gate bypass to proceed.
- It depends on paid/priority routing.

## Seeded Request Tracker
| Request label | Source channel | Category | County confirmed | Minimum details present | Photo/scope detail | Home Record optional | Submitted | Route-ready | Contractor-visible | Public proof eligible | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Seed Request 1 |  | Small repair / handyman punch list | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |  |
| Seed Request 2 |  | Plumbing leak / fixture issue | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |  |
| Seed Request 3 |  | HVAC diagnostic / service issue | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |  |
| Seed Request 4 |  | Roof/exterior leak assessment | OPTIONAL | OPTIONAL | OPTIONAL | OPTIONAL | OPTIONAL | OPTIONAL | OPTIONAL | OPTIONAL |  |
| Seed Request 5 |  | Cleaning / turnover / property care | OPTIONAL | OPTIONAL | OPTIONAL | OPTIONAL | OPTIONAL | OPTIONAL | OPTIONAL | OPTIONAL |  |

## Manual Monitoring Rules
Monitor each seeded route-ready request daily until it reaches a stable state.

Daily request checks:
- request status
- contractor visibility state
- provider response/action state
- contact-gate state
- requester-facing copy
- contractor-facing copy if accessible
- notification state if observable
- blocker state

Monitor for immediate blockers:
- contact details visible before gate release
- preview/test artifact shown as live demand
- raw enum/internal copy on requester or contractor card
- Home Record required for request progression
- provider response path unavailable
- routing controlled by paid/ranking/featured/subscription field

Manual monitoring must not record:
- raw private contact data in docs
- staff cookies
- request headers/cURL output
- unredacted private screenshots

## Response SLA Targets
These are operating targets for the proof run, not product promises to users.

| Step | Target SLA | Watch threshold | Fail threshold | Notes |
| --- | --- | --- | --- | --- |
| Request submitted -> contractor-visible | same day | > 24 hours | > 48 hours or never visible | Requires eligible provider density. |
| Contractor-visible -> contractor action started | 24 hours | > 48 hours | > 72 hours without action | Tests provider activation. |
| Contractor action -> contact-gate decision | 24 hours after action | > 48 hours | no decision path available | Must preserve gate. |
| Contact release -> documented follow-up | 48 hours | > 72 hours | no follow-up state | Needed for completed-outcome evidence. |
| Submitted request -> final outcome evidence | 7 days | 14 days | no outcome after proof window | May become WATCH, not automatic failure. |

SLA decision values:
- `PASS`: target met.
- `WATCH`: threshold exceeded but path still active.
- `FAIL`: fail threshold exceeded or blocker observed.
- `DEFERRED`: evidence unavailable without unsafe auth/session handling.

## Provider Response Tracker
| Request label | Request ID | Provider label | Visible timestamp | Action timestamp | SLA state | Contact gate state | Contact leakage observed | Human-readable card copy | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Response 1 |  |  |  |  | PENDING | PENDING | NO | PENDING |  |
| Response 2 |  |  |  |  | PENDING | PENDING | NO | PENDING |  |
| Response 3 |  |  |  |  | PENDING | PENDING | NO | PENDING |  |

Provider response counts when:
- Request is route-ready.
- Contractor visibility is legitimate.
- Contractor action is started by an eligible provider.
- Contact remains gated until approved release.

Provider response does not count when:
- Provider saw a draft/preview/test artifact.
- Provider was ineligible for the county/trade.
- Contact details were exposed before gate release.
- Visibility was influenced by paid/priority/ranking logic.

## Contact-Gate Release Rules
A contact-gate release can count only when:
- It follows the governed decision path.
- The release is tied to a submitted route-ready request.
- The provider action/decision context is documented.
- Requester/provider contact was redacted before release.
- Release state is auditable inside the approved system of record.

Release cannot count when:
- Contact was shared manually outside the governed flow.
- Contact was exposed by a card, notification, raw payload, or screenshot before gate release.
- Release was created for a fake/preview/test request counted as live demand.
- Release happened because of paid or priority status.

## Completed-Outcome Capture Rules
A completed outcome counts when all are true:
- Request was route-ready.
- Request reached contractor visibility.
- Eligible provider started action.
- Contact-gate state is documented.
- Final lifecycle state is documented.
- Outcome evidence is real, not fabricated.
- No contact leakage occurred before gate release.
- No paid/ranking influence affected routing or action access.

Outcome evidence can include:
- requester-confirmed completion
- provider-confirmed completion
- documented follow-up state after contact-gate release
- resolved pending state with operator notes

Outcome evidence cannot include:
- admin-only completion without context
- fabricated or hypothetical completion
- contractor-visible-only state
- request submitted with no provider action
- contact-gate bypass path

## Weekly Demand Scorecard
| Field | Value |
| --- | --- |
| County | Escambia County, Florida |
| Week |  |
| Route-ready requests created | 0 |
| Categories represented | 0 |
| Requests with photos/scope details | 0 |
| Contractor-visible requests | 0 |
| Provider responses/actions | 0 |
| Contact-gate releases | 0 |
| Completed outcomes | 0 |
| Home Record required incidents | 0 |
| Contact leakage incidents | 0 |
| Preview/test artifact incidents | 0 |
| Paid/ranking influence incidents | 0 |
| SLA watch count | 0 |
| SLA fail count | 0 |
| Decision | PENDING |
| Notes |  |

Decision rules:
- `GO`: at least `3` route-ready requests, at least `1` provider response/action, zero doctrine blockers, and at least `1` completed outcome or documented follow-up state.
- `WATCH`: route-ready requests exist, but provider response or completed outcome evidence is thin.
- `NO_GO`: no route-ready requests, no eligible provider response path, or any doctrine blocker occurs.
- `DEFERRED`: evidence cannot be safely captured.

## Measurement Gap Watch
No code change is required by this seeding plan yet.

Open a narrow implementation slice only if:
- Request status cannot distinguish draft/submitted/route-ready/contractor-visible states.
- Routing cannot be tied to Pensacola/Escambia County in a staff-safe way.
- Completed outcome cannot be recorded or audited.
- Contact-gate release state cannot be verified without exposing private data.
- Provider response/action cannot be tied back to a seeded request.
- Weekly demand score cannot be produced without unsafe manual handling.

## Final Decision
Slice 91 is a demand-side ops prep PASS.

Pensacola request seeding now has a plan for:
- first request categories
- requester-source channels
- minimum request detail requirements
- route-ready definition
- manual monitoring rules
- response SLA targets
- completed-outcome capture rules

No product code is required unless live seeding exposes a missing request-status, routing, provider-response, contact-gate, or completed-outcome capture point.
