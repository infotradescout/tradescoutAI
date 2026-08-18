# R.E.D. Graniti profile contact correction

## Approved intent lock

Approved in chat on 2026-08-18 after the user corrected the profile contact and language outcome.

- R.E.D. Graniti remains an independent TradeScout-admin-controlled company profile.
- JW Stone is the exclusive first-cut distributor, not the owner of the R.E.D. profile.
- A visible **Call JW Stone** action and a separate **Start a Request** action must exist on desktop and mobile.
- Protected calls and submitted requests must use the existing JW Stone Direct Connect target.
- The request must capture material, block/slab/first-cut format, quantity or dimensions, destination, timing, and project details.
- Public copy must follow R.E.D. Graniti's real position: more than 50 years, blocks, slabs, quality control, company-owned quarries, and worldwide distribution.
- Public copy must not explain Stone Core, admin custody, canonical records, or internal routing.
- R.E.D. company identity, the distribution right, canonical materials, and JW inventory remain separate.

## Official-source evidence used

- R.E.D. Graniti official English home page
- R.E.D. Group page
- R.E.D. Quarries, Blocks, Slabs page
- R.E.D. official contacts

The sources establish the company's three public business lanes, more-than-50-year position, quality-control language, quarry footprint, Italian yards and warehouse, and official headquarters contact.

## Canonical reuse

- Reused the existing protected JW Stone express-contact reveal endpoint.
- Reused the existing JW Stone express-request endpoint so calls and requests reach the verified JW Stone operator.
- Reused the existing R.E.D. dedicated profile renderer, source imagery, TradeScout profile handoff, share controls, and profile trust actions.
- Added one bounded R.E.D.-specific contact panel because the generic materials panel exposes unrelated showroom and bundle choices and cannot collect the approved first-cut fields.

## Worker files

- `shared/redGranitiProfile.ts`
- `server/services/redGranitiProfileProvisioning.ts`
- `client/src/pages/profile-sites/RedGranitiProfileTheme.tsx`
- `client/src/pages/profile-sites/RedGranitiDirectConnectPanel.tsx`
- `server/tests/red-graniti-profile-theme.contract.test.ts`
- `server/tests/red-graniti-profile.contract.test.ts`

## Required proof before release

1. Production build passes.
2. Logged-out profile renders the dedicated R.E.D. theme.
3. Desktop header and hero show Call JW Stone and Start a Request.
4. Mobile persistent bar shows both actions.
5. Call reveal returns the protected JW Stone telephone destination.
6. First-cut form posts to the JW Stone express-request route with R.E.D. context.
7. Production request assignment targets JW Stone while R.E.D. profile ownership remains TradeScout admin controlled.
8. No R.E.D. material is added to JW inventory by this change.
