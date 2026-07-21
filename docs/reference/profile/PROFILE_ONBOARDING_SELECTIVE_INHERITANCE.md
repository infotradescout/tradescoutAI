# Profile onboarding: template pick + selective inheritance

Status: active reference  
Related: [`PROFILE_SITE_TEMPLATE_TAXONOMY.md`](./PROFILE_SITE_TEMPLATE_TAXONOMY.md), [`docs/LISA_PRODUCT_DEFINITION.md`](../../LISA_PRODUCT_DEFINITION.md)

## Funnel

```text
Account (name, county, city, phone)
    → Intent / lane (offer services, business, …)
    → Starting template (v1 gallery)
    → Business record (name, category, website, about)
    → Public profile (siteTemplate + contentBlocks)
```

At each handoff we use **selective inheritance**: propose what to carry forward, what to leave behind, and what the human should confirm. We do not blank-prompt a new identity or invent contact power.

## V1 starting templates (onboarding picker)

- `wholesaler`
- `auto-glass`
- `plumbing-company`
- `electrician-solo`

Stored on the provisional draft as `preferences.provisional.profileDraft.siteTemplateId` until the public profile is created/updated.

## Inheritance rules

Implementation: `shared/profileSelectiveInheritance.ts`

| Field | Prefer | Notes |
|-------|--------|-------|
| Display name | Business name → account name | Brand first |
| Headline / hero text | Business description → category hint → template seed | No silent LLM rewrite |
| City / county | Business → account | County remains the operational container |
| Website | Business | Optional |
| Template | Explicit onboarding pick | Seeds layout; editable later |

Decisions per field: `keep_source` | `keep_target` | `merge` | `discard`.

Defaults are applied automatically on first public-profile materialization; the merge UI lets owners/super-admins override when promoting account → business → profile.

## Law alignment

- Visibility ≠ access; contact stays Intent → Decision Card → Contact.
- Claims-first: template pick is preference + layout seed, not verification.
- Assist, don’t replace: humans confirm identity and merge choices.
- Refuse waste: do not regenerate copy that already exists on account/business.
- **Every** resulting public profile still ships: trust section, TradeScout footer
  handoff, and Direct Connect–only contact (no public tel/mailto). See
  `PROFILE_SITE_LAW_INVARIANTS` in `shared/profileSiteTemplates.ts`.

## Surfaces

1. `/onboarding/template` — pick starting template after business-facing intent.
2. `/u/:slug/edit` + live manage chrome — change template / featured fields later.
3. Apply path — `applyProfileSelectiveInheritance()` when creating or hydrating a public profile from provisional draft + business.
