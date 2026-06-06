# Direct Connect Giveaway Legal Policy Audit - 2026-06-06

## Scope

- Reviewed public giveaway and legal-policy routing for the TradeScout Direct Connect Giveaway.
- Surfaces reviewed: `/giveaway-rules`, `/privacy`, `/terms`, legacy `/legal/privacy-policy`, legacy `/legal/terms-of-service`, cookie policy contact surfaces, and giveaway static fallback.
- This audit is a product/legal-content implementation audit. Final legal approval remains outside the codebase.

## Findings And Updates

| Area | Classification | Status | Update |
| --- | --- | --- | --- |
| Dedicated official rules page | enforced | updated | `/giveaway-rules` and its static fallback remain the master rules surface. |
| Privacy policy coverage for giveaway data | enforced | updated | `/privacy` now discloses Direct Connect Giveaway entry data, eligibility status, duplicate-entry controls, winner/prize processing, and promotion record retention. |
| Terms incorporation of official rules | enforced | updated | `/terms` now states promotions are governed by their official rules and links the Direct Connect Giveaway rules. |
| Junk, fraudulent, automated, or duplicate entries | enforced | updated | Terms and official rules preserve TradeScout's right to disqualify entries that violate the rules or exceed limits. |
| Contact-gate invariants | enforced | unchanged | Giveaway participation does not bypass Direct Connect contact, trust, or routing gates. |
| Contact mailbox | enforced | updated | Public legal/giveaway contact copy uses `contact@thetradescout.com`. |
| Legacy legal source files | policy_target | updated | Legacy `/legal/*` source files were updated even though app routes redirect canonical users to `/privacy` and `/terms`. |

## Remaining Operational Notes

- `enforced`: Direct Connect backend eligibility continues to use the Shadow Drop path: request accepted, giveaway ledger entry marked eligible only for Florida entries.
- `enforced`: July 3, 2026 remains the sweepstakes end/drawing timing used in the official rules and abbreviated-rule copy.
- `policy_target`: Counsel should review final public wording before paid promotion or high-volume advertising.
