# Slice 90 - Pensacola Provider Target List v1

Date: 2026-06-02
Status: PASS (ops execution prep)

## Purpose
This document defines the first Pensacola / Escambia County provider target list structure for Direct Connect county proof execution.

Primary KPI:
- Pensacola verified/active providers by trade

The goal is to establish the supply-side floor before request volume is treated as meaningful liquidity.

## Scope
TradeScout Direct Connect only.

In scope:
- first provider/trade categories
- initial provider target list structure
- qualification criteria
- outreach status stages
- provider activation definition
- weekly provider-density score

Out of scope:
- MealScout
- paid placement or ranking advantage
- lead selling
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
- Counties as operational containers: policy_target for this target list
- Trust/CVS governs exposure: policy_target until live provider proof produces enough data for tuning

No temporary exception is introduced.

Provider outreach must not promise:
- paid ranking advantage
- exclusive lead ownership
- guaranteed request volume
- early requester contact access
- bypass of verification, trust, or contact-gate rules

## First Provider Categories
Target county:
- Escambia County, Florida

Operating label:
- Pensacola / Escambia County

Initial trades:
- General handyman / small repairs
- Roofing / exterior leak response
- Plumbing
- Electrical
- HVAC
- Cleaning / turnover / property care
- Property management / tenant issue support

First outreach priority:
1. General handyman / small repairs
2. Plumbing
3. HVAC
4. Roofing / exterior leak response
5. Electrical
6. Cleaning / turnover / property care
7. Property management / tenant issue support

Rationale:
- Handyman, plumbing, HVAC, roofing, and electrical cover high-frequency homeowner/property issues.
- Cleaning/property care and property management support rental/turnover workflows and follow-up outcomes.
- The mix supports at least three trades before county proof execution begins.

## Minimum Density Targets
County proof supply floor:
- At least `5` verified/active providers total.
- At least `3` trades represented.
- At least `2` active providers for the first seeded request category.

Trade targets:

| Trade / category | Minimum active providers | Stretch target | Priority | Notes |
| --- | ---: | ---: | --- | --- |
| General handyman / small repairs | 3 | 5 | P0 | Best first seeded-request category. |
| Plumbing | 2 | 4 | P0 | High urgency; good fit for Direct Connect proof. |
| HVAC | 2 | 4 | P0 | Seasonal urgency; contractor response speed matters. |
| Roofing / exterior leak response | 2 | 4 | P1 | Strong proof category for exterior/weather issues. |
| Electrical | 2 | 3 | P1 | Requires eligibility confidence and clear scope boundaries. |
| Cleaning / turnover / property care | 2 | 3 | P2 | Useful for property/rental follow-up outcomes. |
| Property management / tenant issue support | 2 | 3 | P2 | Useful for repeat demand and completed-outcome capture. |

## Qualification Criteria
A provider can enter the target list when:
- Business operates in or near Escambia County / Pensacola.
- Trade/category is relevant to Direct Connect requests.
- Provider has a reachable public business profile, phone, email, or website for outreach.
- Provider is not being targeted because of paid placement, sponsorship, featured status, or ranking advantage.

A provider can be marked `qualified` when:
- Service area includes Escambia County / Pensacola.
- Trade/category is confirmed.
- Provider appears legitimate and operational.
- Provider is appropriate for homeowner/property requests.
- Provider can be routed through Direct Connect without contact-gate bypass.
- Provider does not require exclusive leads or paid priority to participate.

A provider can be marked `verified_active` when:
- Provider has acknowledged Direct Connect or the operator has confirmed a valid operational contact path.
- Provider is eligible for at least one target trade/category.
- Provider can receive or view relevant Direct Connect opportunities through the governed flow.
- Provider contact is not exposed to requesters before the contact gate.
- Requester contact is not exposed to provider before the contact gate.
- No paid/ranking/featured/subscription field controls visibility or action access.

Disqualifiers:
- Outside county/service area with no Pensacola coverage.
- Inactive or unreachable business.
- Requires paid priority, lead purchase, or exclusive lead ownership.
- Requires bypassing contact gate.
- Fails trust/eligibility review.
- Presents user safety, fraud, or licensing concern that cannot be resolved.

## Outreach Status Stages
Allowed status values:
- `candidate`: identified but not yet qualified.
- `qualified`: service area/category look valid.
- `outreach_started`: first outreach sent or call attempted.
- `contacted`: provider responded or live conversation occurred.
- `interested`: provider is open to Direct Connect participation.
- `verified_active`: provider is eligible and usable for county proof.
- `declined`: provider declined participation.
- `unreachable`: repeated outreach failed.
- `disqualified`: provider failed qualification or doctrine requirements.
- `watch`: possible provider, but needs follow-up before activation.

Stage movement rules:
- Do not mark `verified_active` from public listing data alone.
- Do not mark `declined` until the provider explicitly declines or outreach exhaustion is documented.
- Do not mark `disqualified` without a reason.
- Do not include private contact details in public docs.

## Initial Target List Structure
Use provider labels until IDs are available. Do not paste private contact details into this document.

| Target label | Trade/category | Source | City/service area | Qualification status | Outreach status | Last touch | Next action | Activation status | Doctrine notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Provider 01 | General handyman / small repairs |  | Pensacola / Escambia | candidate | candidate |  | qualify service area | not_active | contact gate must remain intact |
| Provider 02 | General handyman / small repairs |  | Pensacola / Escambia | candidate | candidate |  | qualify service area | not_active | contact gate must remain intact |
| Provider 03 | General handyman / small repairs |  | Pensacola / Escambia | candidate | candidate |  | qualify service area | not_active | contact gate must remain intact |
| Provider 04 | Plumbing |  | Pensacola / Escambia | candidate | candidate |  | qualify service area | not_active | contact gate must remain intact |
| Provider 05 | Plumbing |  | Pensacola / Escambia | candidate | candidate |  | qualify service area | not_active | contact gate must remain intact |
| Provider 06 | HVAC |  | Pensacola / Escambia | candidate | candidate |  | qualify service area | not_active | contact gate must remain intact |
| Provider 07 | HVAC |  | Pensacola / Escambia | candidate | candidate |  | qualify service area | not_active | contact gate must remain intact |
| Provider 08 | Roofing / exterior leak response |  | Pensacola / Escambia | candidate | candidate |  | qualify service area | not_active | contact gate must remain intact |
| Provider 09 | Roofing / exterior leak response |  | Pensacola / Escambia | candidate | candidate |  | qualify service area | not_active | contact gate must remain intact |
| Provider 10 | Electrical |  | Pensacola / Escambia | candidate | candidate |  | qualify service area | not_active | contact gate must remain intact |
| Provider 11 | Electrical |  | Pensacola / Escambia | candidate | candidate |  | qualify service area | not_active | contact gate must remain intact |
| Provider 12 | Cleaning / turnover / property care |  | Pensacola / Escambia | candidate | candidate |  | qualify service area | not_active | contact gate must remain intact |
| Provider 13 | Cleaning / turnover / property care |  | Pensacola / Escambia | candidate | candidate |  | qualify service area | not_active | contact gate must remain intact |
| Provider 14 | Property management / tenant issue support |  | Pensacola / Escambia | candidate | candidate |  | qualify service area | not_active | contact gate must remain intact |
| Provider 15 | Property management / tenant issue support |  | Pensacola / Escambia | candidate | candidate |  | qualify service area | not_active | contact gate must remain intact |

## Outreach Cadence
Recommended cadence:
- Day 1: qualify candidate list and start first outreach for P0 trades.
- Day 2: follow up with non-responders and add replacement candidates.
- Day 3: confirm interested providers and mark eligibility blockers.
- Day 4: attempt second follow-up for P0 non-responders.
- Day 5: lock first weekly density score.
- Day 6-7: fill trade gaps and prepare proof-run provider set.

Outreach notes should record:
- date
- method
- stage change
- trade/category
- county/service-area confirmation
- next action
- blocker, if any

Do not record:
- private direct contact data in docs
- staff cookies
- raw headers
- lead-buying promises
- paid priority promises

## Provider Activation Definition
Provider activation counts only when all are true:
- Provider is qualified for Pensacola / Escambia County.
- Provider is mapped to at least one Direct Connect trade/category.
- Provider can receive or view Direct Connect opportunities through the governed flow.
- Provider has acknowledged interest or has a verified operational participation path.
- Provider action path does not expose requester contact before the contact gate.
- Provider visibility is not influenced by paid, featured, subscription, priority, or ranking advantage.

Provider activation does not count when:
- Provider is only a scraped/candidate listing.
- Provider is outside the county/service area.
- Provider has not been reached and no operational path is verified.
- Provider visibility depends on paid placement or lead-selling logic.
- Provider requires direct contact before the governed gate.
- Provider is present only through preview/test/demo artifacts.

## Weekly Provider-Density Score
Use this score once per week until county proof begins.

| Field | Value |
| --- | --- |
| County | Escambia County, Florida |
| Week |  |
| Total candidates | 15 |
| Qualified providers | 0 |
| Outreach started | 0 |
| Contacted providers | 0 |
| Interested providers | 0 |
| Verified/active providers | 0 |
| Active trades represented | 0 |
| P0 trade active provider count | 0 |
| Disqualified providers | 0 |
| Unreachable providers | 0 |
| Contact-gate concern count | 0 |
| Paid/ranking concern count | 0 |
| Decision | PENDING |
| Notes |  |

Decision rules:
- `GO`: at least `5` verified/active providers, at least `3` trades represented, and at least `2` active providers in the first seeded request category.
- `WATCH`: at least `3` verified/active providers, but trade/category density is still thin.
- `NO_GO`: provider activation is absent or a doctrine blocker appears.
- `DEFERRED`: provider activation cannot be assessed because safe operational evidence is unavailable.

## Provider Density Formula
Track these weekly:
- verified active provider count
- active trade count
- P0 provider depth
- doctrine blocker count

Suggested summary:

```text
provider_density_score = verified_active_providers / 5
trade_coverage_score = active_trades_represented / 3
p0_depth_score = active_p0_trade_providers / 2
```

Readiness interpretation:
- `>= 1.0` for all three scores and zero doctrine blockers: supply floor ready.
- Any score below `1.0`: keep outreach active.
- Any doctrine blocker above `0`: stop and resolve before proof execution.

## Blocker Log
| Date | Provider label | Trade/category | Blocker type | Severity | Resolution owner | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  | service_area / unreachable / contact_gate / paid_priority / trust / other |  |  | open |  |

Escalate immediately if:
- Provider requests paid priority or lead purchase.
- Provider expects requester contact before contact gate release.
- Provider appears ineligible but is still visible as eligible supply.
- Provider target data cannot be recorded without exposing private contact information.

## Measurement Gap Watch
No code change is required by this target list yet.

Open a narrow implementation slice only if:
- There is no reliable place to store provider activation status outside docs.
- Provider activation cannot be tied to county/trade in a staff-safe way.
- Provider outreach needs an auditable Trust Ledger capture point.
- Direct Connect cannot distinguish candidate, qualified, and verified/active providers.
- Weekly provider-density score cannot be produced without unsafe manual data handling.

## Final Decision
Slice 90 is an ops execution prep PASS.

Pensacola provider supply now has a target-list structure for:
- first trade categories
- qualification criteria
- outreach stages
- provider activation definition
- weekly provider-density scoring
- blocker tracking

No product code is required until real outreach reveals a missing provider activation store, admin view, or Trust Ledger capture point.
