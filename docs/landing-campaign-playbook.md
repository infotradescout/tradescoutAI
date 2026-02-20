# Landing Campaign Playbook

Use one landing template for many campaign pages.

## Route Pattern

- ` /landing/<slug> `
- ` /lp/<slug> `

Examples:

- `/landing/contractor-roofing-austin`
- `/landing/homeowner-kitchen-remodel-dallas`
- `/lp/realtor-listing-prep-tampa`

If `<slug>` starts with a known audience prefix, TradeScout applies that audience base copy:

- `contractor`
- `homeowner`
- `realtor`
- `hoa`
- `property-manager`
- `lender`
- `insurance-agent`
- `supplier`
- `affiliate`

## Query Overrides (No Code Changes)

Use URL params to customize per video/user type:

- `base` (force a base audience)
- `name` (display name)
- `badge`
- `headline` (split lines with `|`)
- `subhead`
- `primaryLabel`, `primaryHref`
- `secondaryLabel`, `secondaryHref`, `secondaryScroll`
- `hideSecondary=1`
- `logoImg`, `trustImg`, `craftImg` (same-origin image paths)
- `audLabel`, `audTitle`, `audDesc`
- `audCard1Title`, `audCard1Desc`
- `audCard2Title`, `audCard2Desc`
- `ctaKicker`, `ctaTitle` (split lines with `|`), `ctaDesc`
- `ctaPrimaryLabel`, `ctaPrimaryHref`
- `ctaSecondaryLabel`, `ctaSecondaryHref`
- `hideCtaSecondary=1`
- `nav` in format `Label::href|Label::href`

## Example Link

`/landing/contractor-hvac-austin-v1?base=contractor&headline=Get%20Better%20Jobs|Without%20Lead%20Spam&subhead=Scout%20routes%20relevant%20local%20requests%20to%20pros.&primaryLabel=Start%20With%20Scout&primaryHref=/pre-scout-setup?mode=create&trustImg=/landing/hvac-trust.jpg&craftImg=/landing/hvac-craft.jpg`

## Attribution

Landing demand tracking automatically captures:

- `ref`
- `utm_*`
- `variant` (path slug)
- `campaignKey`

And propagates attribution into internal CTA routes.
