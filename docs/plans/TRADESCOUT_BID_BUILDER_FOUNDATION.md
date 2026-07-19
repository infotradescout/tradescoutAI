# TradeScout Bid Builder Foundation

## Decision

Bid Builder is a shared TradeScout business capability available to every eligible contractor, supplier, estimator, and business profile that needs to turn project evidence into a reviewed estimate or bid.

It is not a separate startup, a Brian-only tool, or an Infinity-owned product runtime.

TradeScout owns the user experience, project records, business rules, Direct Connect handoff, estimates, bid packages, and money-adjacent behavior. Infinity may later hold reusable contracts or capability metadata, but TradeScout remains the product owner.

## Product promise

Start from whatever evidence is available, build the quantities once, price them with documented inputs, review every uncertain line, and turn the result into a customer-ready estimate without rebuilding the job in another tool.

## One connected workspace

```text
Direct Connect request or standalone business project
→ plan PDF, camera capture, manual measurement, photos, notes, and documents
→ quantity takeoff
→ pricing basis
→ scope, assumptions, exclusions, alternates, overhead, profit, and tax
→ human review
→ estimate or bid package
→ Direct Connect send / customer response
→ job workspace and completed-job pricing history
```

## Existing TradeScout capabilities to combine

### Plan and document intake

- Accept plan-set PDFs and supporting files.
- Preserve the source file digest, page number, sheet label, extracted text, confidence, and human review status.
- Never present an AI-extracted quantity without source evidence.

### AI Camera / field measurement

Reuse the existing calibrated camera and measurement capability instead of creating another camera flow.

Camera measurements may create Bid Builder evidence when they preserve:

- capture identity
- calibration method
- measured points
- calculated dimension
- confidence tier
- image reference
- timestamp and location when authorized

Camera measurements do not become confirmed bid quantities automatically.

### Quote Calculator

Replace the current placeholder cost-range surface with Bid Builder inputs and outputs.

Quote Calculator becomes the quick-start surface for:

- project type
- rough quantities
- location
- timeline
- documented pricing assumptions

It must not show hard-coded or invented prices.

### Direct Connect estimates

Bid Builder should convert a reviewed bid into the existing Direct Connect estimate flow rather than creating a competing estimate system.

The existing estimate lifecycle remains:

```text
draft → sent → accepted / change requested / declined / void
```

### Business finances and jobs

Accepted estimates remain connected to:

- job workspace
- invoices
- payments
- materials
- labor
- expenses
- completed-job outcome and price history

### Supply Run and supplier catalogs

Material lines may be matched to supplier products, quote requests, inventory, and Supply Run fulfillment. Supplier pricing must retain source and observation date.

## Bid Builder modes

1. **Plan Takeoff** — upload plans and extract quantities with page/sheet evidence.
2. **Camera Measure** — measure field conditions using the existing calibrated camera.
3. **Manual Build** — enter quantities directly with notes and supporting evidence.
4. **Request Intake** — start from a Direct Connect request and its attachments.
5. **Supplier Quote** — build pricing from supplier catalogs and returned quote data.
6. **Historical Assist** — reference completed TradeScout jobs without silently copying stale pricing.

All modes feed the same canonical takeoff and bid objects.

## Discipline adapters

The shared engine supports discipline-specific adapters without becoming a pile of separate calculators.

Initial adapters:

- millwork
- doors and windows
- framing
- drywall
- concrete
- roofing
- flooring
- plumbing
- electrical
- HVAC
- general

Each adapter may define terminology, measurement rules, standard units, waste prompts, required evidence, and output grouping. It may not bypass the shared review and evidence rules.

## Canonical data boundary

`shared/bidBuilder.ts` owns the initial cross-surface contract for:

- takeoff items
- evidence references
- pricing basis
- bid line calculations
- review status
- estimate conversion

Product routes and persistence must use these contracts rather than inventing parallel line-item types.

## Accuracy and trust rules

- AI assists; it does not certify quantities.
- Every generated takeoff line needs source evidence.
- Confidence below 0.90 requires review.
- Missing pricing creates a zero-value review item, not a guessed price.
- Pricing needs a source note and observation date in the persisted implementation.
- No bid can be sent with unresolved quantities or missing pricing.
- Overhead, profit, waste, tax, allowances, and exclusions must be visible.
- User edits preserve the original extracted observation and create a reviewed value.
- Reprocessing a plan creates a new version; it does not silently overwrite the prior takeoff.

## Selective Inheritance use

Selective Inheritance is used for profile and catalog sourcing, not to grant ownership or publish unreviewed data.

Allowed candidate profile fields:

- business name
- description
- logo
- cover image
- services
- products
- inventory/catalog
- gallery
- social links

Explicitly excluded:

- owner identity
- Direct Connect access
- contact permissions
- county assignments
- ranking
- trust score
- verification claims

The Infinity evaluator remains preview-only (`applyAuthorized: false`). TradeScout reviews and applies approved fields.

## First partner use case

The first target is Moulding & Millwork Supply and Brian Koontz's plan-reading/takeoff workflow.

The build should support millwork, doors, and windows first because the business already works from plans, measurements, product choices, stock references, and quote requests.

The public profile is a separate but connected lane:

- source public business information through Selective Inheritance
- stage the profile as review-required
- do not publish ownership claims about Brian without confirmation
- connect the finished profile to Bid Builder, quote requests, product/catalog browsing, and Direct Connect

## First implementation slices

### Slice 1 — Shared calculation foundation

- canonical contracts
- evidence requirements
- review gates
- documented pricing calculations
- conversion into existing Direct Connect estimate inputs

### Slice 2 — Unified Bid Builder workspace

- project intake
- plan and photo upload
- takeoff table
- line review
- pricing editor
- assumptions/exclusions
- totals
- save/version history

### Slice 3 — Existing capability adapters

- AI Camera measurement adapter
- Quote Calculator replacement
- Direct Connect estimate persistence
- job and invoice handoff
- supplier catalog and Supply Run hooks

### Slice 4 — Plan extraction

- PDF page rendering/extraction
- trade/discipline selection
- evidence-linked AI candidate lines
- page/sheet viewer
- side-by-side source and quantity review
- Excel/CSV/PDF export

### Slice 5 — Moulding & Millwork Supply profile

- Selective Inheritance source packet
- reviewed profile content
- catalog and quote entry
- Bid Builder CTA
- private Direct Connect routing after business authorization

## KPI targets

Track real outcomes only:

- time from upload to reviewed takeoff
- percentage of extracted lines changed by the user
- unresolved-line rate
- bid creation time
- estimate send rate
- change-request rate
- accepted-estimate rate
- quantity and price variance against completed job outcomes
- repeat use by contractor/business accounts

Do not publish a "five-minute takeoff" claim until measured, repeatable results support it.
