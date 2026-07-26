# TradeScout About Contract + Golden Case Baseline

Date: 2026-07-26
Canonical public contract: `/about` (`client/src/pages/about-explainer-content.tsx`)

## Decision

TradeScout's About explainer is the product constitution. This baseline does not add a new product
roadmap. It maps the nine public chapters and 69 action promises to accountable systems, evidence,
current truth, and the next closure required.

No action is marked `PROVEN`. Source files, routes, and local contract tests demonstrate that
machinery exists; they do not prove the complete public promise works in production.

Current action truth:

| Status | Count |
|---|---:|
| `PROVEN` | 0 |
| `PARTIAL` | 59 |
| `PLANNED` | 1 |
| `BLOCKED` | 9 |

The maintained registry is
`config/tradescout-about-operating-contract.json`. The structural guard derives the public chapters
and actions from the canonical JSX and fails on count, identity, copy, status, ownership, evidence,
or unsupported production-proof drift.

## Connected Exchange catalog bridge

Exchange now has a dedicated `Building Materials & Surfaces` category with exactly two
code-maintained profile catalog spotlights:

| Business | Exchange entry | Authoritative detail | Commerce boundary |
|---|---|---|---|
| JW Stone LLC | Natural stone catalog spotlight | `/u/jw-stone#inventory-browser` | Request-only; no Exchange price, stock count, condition, or shipping claim |
| ISSA Build | Honey Onyx and Multi Green Onyx spotlight | `/u/issa-build#material-chapters` | Request-only; no public price, stock, availability, condition, or shipping claim |

These are not copied marketplace inventory rows and do not require a database category or
migration. Exchange is the discovery entry point; each business profile remains the material
authority and owns the protected TradeScout request handoff. The two spotlights cannot be created
through the ordinary public sell form.

JW Stone's existing current-inventory catalog remains unchanged. Old-site-only additions are not
promoted into that catalog merely because an archived page or unlabeled photo exists. Each new slab
or bundle must first receive a stable product number, a confirmed sheet row, and matched image
filenames; the future importer must fail closed on duplicate numbers, missing images, unsupported
material names, or undated status.

## Golden cases

The baseline tracks two real-world archetypes:

1. JW Stone catalog discovery → item-specific managed inquiry → TradeScout operator queue →
   business-branded case conversation → durable delivery outcomes → quote/order or explicit
   no-sale outcome.
2. Service-business discovery → selected recipient → acceptance → case conversation → customer and
   job → estimate/schedule/invoice/payment record → terminal outcome → supported HomeID/CVS memory.

Current stage truth:

| Status | Count |
|---|---:|
| `PROVEN` | 0 |
| `PARTIAL` | 6 |
| `BLOCKED` | 7 |

The report intentionally remains `BLOCKED`. It records the exact gaps instead of skipping stages or
treating a source-string contract as lifecycle proof. It is a structural registry report, not an
operational lifecycle runner. A strict golden-case gate therefore fails until every stage has a
subject-bound production JSON artifact, an existing full commit SHA, an ISO verification instant,
and passed checks. The future operational harness still has to execute the real roles, database,
delivery, browser, and production steps that produce those artifacts.

## Known blockers retained

- No global delegated-operator Direct Connect queue with route, assign, assist, and audited
  business-branded reply.
- Conversations are not yet guaranteed to be unique to the exact case/request/assignment.
- In-app, push, and email outcomes do not share one durable delivery ledger.
- Accepted requests do not yet deterministically carry one case identity through customer, job,
  quote, schedule, invoice or receipt, and terminal outcome.
- Community threads, tags, identity destinations, notifications, groups, and moderation remain in
  the separate queued Connection + Community recovery lane.

## Commands

```bash
npm run guard:about-operating-contract
npm run report:golden-cases
npm run gate:golden-cases
```

The first two commands must succeed now. `gate:golden-cases` is intentionally strict and must remain
non-zero while the report is `PARTIAL` or `BLOCKED`.

## Lane boundaries

This baseline does not include the production-incident repair, Phase E SEO recovery, or the queued
Connection + Community implementation. It records their relevant evidence and blockers without
copying or silently resolving their work.
