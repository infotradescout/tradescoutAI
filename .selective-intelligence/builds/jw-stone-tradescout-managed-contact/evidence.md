# JW Stone TradeScout-managed contact

## Intent lock

Approved in chat on 2026-08-18 immediately after R.E.D. Graniti was corrected to use the TradeScout-managed response destination.

The same contact rule applies to JW Stone:

- Public phone: `(850) 543-0748`
- Public email: `contact@thetradescout.com`
- Calls and requests remain handled through TradeScout.
- The Pensacola address and JW Stone social identities remain company information.
- The owner account and any private owner email do not become public contact details.
- JW Stone ownership, inventory, stone identity, and profile presentation are not transferred or combined with another profile.

## Existing-state finding

Production already used `(850) 543-0748` as the business phone and `contact@thetradescout.com` as the notification inbox, but the business email was still `wagner@jwstonellc.com` and the public company section did not clearly show the managed phone and email.

## Worker result

- Added one canonical JW Stone managed-contact contract.
- Added a visible `TradeScout managed contact` section to the JW Stone company card.
- Kept the Pensacola visit address and official social channels below it.
- Added the managed phone and email to JW Stone structured profile data.
- Added production boot normalization for phone, business email, and notification email.
- Preserved the current business and profile owner IDs.
- Preserved the protected Call reveal and Direct Connect request flow.

## Objector checks

The correction must prevent:

1. The private owner email returning to the public contact card or business response field.
2. The public card showing only a company address without a managed response destination.
3. A contact correction transferring the business or profile owner.
4. The direct Call action bypassing the existing protected contact route.
5. Contact work changing inventory, stone names, prices, availability, or profile layout outside the company contact card.

## Release proof required

1. Production build and server bundle pass.
2. The public company section shows `(850) 543-0748` and `contact@thetradescout.com`.
3. Production business phone, email, and notification email match the managed contact.
4. Business and profile owner IDs still match their pre-change owner.
5. Call and request routes remain attached to the JW Stone profile.
6. No JW Stone inventory or Stone Core record changes are introduced.
