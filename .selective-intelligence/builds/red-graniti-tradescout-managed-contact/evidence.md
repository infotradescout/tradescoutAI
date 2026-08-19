# R.E.D. Graniti TradeScout-managed contact correction

## Approved correction

Approved in chat on 2026-08-18 after the rendered profile showed R.E.D. Graniti's Italian corporate phone and email in the public contact card.

The profile is TradeScout managed. The public operating contact must therefore be:

- Phone: `(850) 543-0748`
- Email: `contact@thetradescout.com`

The R.E.D. Graniti headquarters address remains company information, but its Italian corporate phone, fax, and email are not the public response destination on this managed profile.

## Production evidence inspected

The current JW Stone operating record shows:

- protected operating phone `(850) 543-0748`;
- notification email `contact@thetradescout.com`.

The R.E.D. Graniti business record remains admin managed and keeps the private `request-only` phone sentinel so the admin steward's personal phone cannot be selected by generic routing.

## Worker changes

- Added one canonical `RED_GRANITI_MANAGED_CONTACT` record.
- Replaced the `Company contact` card with `TradeScout managed contact`.
- The public card now shows the managed phone and TradeScout inbox.
- The Italian address remains under a separate `Company headquarters` label.
- Removed R.E.D. Graniti's corporate phone, fax, and email from the public identity object to prevent accidental re-rendering.
- Preserved the existing protected Call behavior and JW Stone first-cut request assignment.

## Objector checks

The release must fail if any of these return:

1. `Company contact` with R.E.D. Graniti's Italian phone or `info@redgraniti.com`.
2. A direct Italian telephone link on the TradeScout-managed profile.
3. The managed card loses `(850) 543-0748` or `contact@thetradescout.com`.
4. The company headquarters address disappears.
5. R.E.D. ownership changes to JW Stone.
6. R.E.D. materials become JW Stone physical inventory.

## Release proof required

1. Production build and server bundle pass.
2. Contract tests compile against the managed-contact record.
3. Production deploy reaches live status.
4. The live profile record remains published, active, admin managed, and separate from JW Stone ownership.
5. Stone Core remains unchanged: nine canonical materials, no manufactured physical assets or inventory positions, one active first-cut right, and no published material availability.
