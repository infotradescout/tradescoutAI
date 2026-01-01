0. Operator Authority & Escalation (Highest Priority)

Thomas is the final authority on product meaning, monetization philosophy, and system behavior.

Default behavior: Ask A/B, not “no change”

If a decision affects user-visible behavior, routing, gating, or data meaning, Copilot must present A or B (optionally C) and ask which to ship.
Only exception: a change that is purely mechanical (types, lint, broken build) and has no behavior effect.

Mandatory escalation protocol

If an instruction touches or could affect:

Product meaning or positioning

Monetization behavior

Promotion / ad relevance or eligibility

Trust / CVS logic

Geographic readiness / coverage logic

Signup, verification, identity semantics

User-visible behavior with unclear intent

Admin OS / authority plane

Copilot must stop and ask using this format:

Issue: what is ambiguous
Impact: what could change if guessed
Options: up to 3 concrete paths
Question: one direct question to Thomas

Until clarified, no code or behavior changes may be made.

1. Identity & Mission (Frozen)
What TradeScout is

TradeScout is a trust-verified, relevance-controlled local marketing and transaction infrastructure where:

Users can fully participate without being charged.

Promotions (ads, boosts, deals, TradeDeals/affiliates) are shown only when contextually relevant.

The system prioritizes conversion quality and trust, not impression volume.

The platform is locality-first and community-driven.

What TradeScout is NOT

Not a SaaS subscription product for users

Not a generic ad network

Not a social network driven by open-ended feeds

Core principles (non-negotiable)

AI chat (Scout) is the primary controller of the site.

UI pages/components are surfaces/tools Scout orchestrates.

Promotion is suppressed by default unless eligibility + relevance are satisfied.

Never charge users to participate.
Any paid tools must be:

Optional

Non-blocking

Cost + $1

Treated as a business/marketing expense.

2. Canonical Authority Systems (Single Sources of Truth)

These systems define truth and must not be duplicated or reinterpreted:

Admin OS (Authority Plane)

Config-driven navigation and visibility

Role/snapshot-aware permissions and routing

No structural/nav refactors unless adding a new tool using the same pattern

Geographic Readiness Engine

County-level readiness states (unassigned / partial / full)

Verified Coverage Rate and time-based deltas

Logic lives in one backend service and is consumed by UI

Promotion Eligibility & Relevance Engine

Decides if a user should see:

Ads (local / regional / national)

Boosted marketplace items

Local business deals

MealScout-style promotions (as a type within TradeScout)

TradeDeals / affiliate offers
Rule: suppression by default

Trust / CVS Gating

Trust-weighted control of promotion visibility

Spend alone must never override trust constraints

Monetization Rules (Frozen)

Allowed revenue:

Paid boosts (marketplace + local deals)

MealScout-style promotions (as a promotion type)

Ads (local / regional / national)

Marketplace transaction fees

Community Builder donations (with redistribution)

Affiliate / TradeDeals revenue share

Optional cost-plus-$1 tools

Forbidden:

Charging users to participate

Paywalls for core functionality

Degrading usability for non-payment

3. Relevance-Only Promotion Rules (Critical)

Users must never see ads or TradeDeals that do not apply to their life, interests, or context. Promotions are shown only when alignment is present.

Enforcement rules:

If relevance or eligibility is unclear → do not show promotion.

Promotion decisions must be internally explainable (admin/observability).

Relevance always outranks revenue.

3.1 Context-Aware Static Language (Aggregated Only)

Static site language may adapt using aggregated, location- and interest-scoped data only.

Personalized copy must:

Use only group-level, time-bounded aggregates (e.g., “dealers in Dallas posted 12 new cars this week”)

Be backed by a real, server-side query or aggregate endpoint

Degrade gracefully to neutral, non-numeric language when data is unavailable or ambiguous

Must not:

Reference individual behavior (searches, clicks, conversions, messages)

Invent or interpolate counts, earnings, performance, or rankings

Leak user-specific details that feel like surveillance

If aggregate endpoint is unavailable/errors:

Suppress numbers

Show neutral copy (“New listings are being added in your area”)

4. Chat-First Control Plane

From Scout, users should be able to handle their entire TradeScout experience:

Ask questions and receive an answer

Receive suggested actions whenever warranted

Click through full A→Z flows (not just text instructions)

Use A/B and Yes/No navigation, naturally

Build order (mandatory)

When adding/changing features:

Design the chat path first (intent → tool/action → response + links/actions)

Then implement/adjust the UI surface as an orchestrated tool

5. Scout Output Contract (Must Hold)

Scout responses must satisfy:

Answer the user’s question

Provide at least one actionable next step when the situation warrants action

Attach clickable actions/links (not hidden URLs)

Use local context when relevant and available

Include community path when useful, especially on low confidence or limited local supply

If a recommendation is monetized:

It must be disclosed (“Paid recommendation”)

It must include why it’s relevant

It must never override trust/relevance or appear just because it’s paid

Defaults you locked

Default to Hire / Direct Connect as primary when applicable, but show both paths.

If no earned path exists, suggest: Ask your community (plus a clear flow).

If local supply seems thin: broaden radius + ask to post to community (together).

Ads: fit the situation, not just the user (conversion quality is the advertiser value).

Prioritize successful outcomes (Connection Without Compromise).

No dead ends

Scout must never return an empty action set.
If no tool/action qualifies, Scout must still offer a safe fallback:

Create request (Direct Connect)

Ask community

Browse providers

Save note / set reminder (if exists)

6. Typed & Actionable Message Model (No raw navigation in text)

Chat messages must support:

Structured text

Explicit links (UI elements)

Explicit actions (navigation/tool calls)

Do not embed navigation or actions inside raw text.

Every new chat feature must define:

Message text

Attached links

Attached actions

Typed message/action patterns

7. Agent Tools Layer (No Ad-Hoc Fetching)

Core capabilities must be exposed via typed tool wrappers (e.g., src/agent/tools/*).
UI components must not scatter raw fetch() calls for core behavior.

Required pattern:

Tool wrapper (backend interaction)

Agent calls tool

Agent emits message + links/actions

Optional richer UI page

8. Knowledge Base & Caching

Long-lived user/community data must go through a knowledge/caching abstraction.
Do not store durable context in local React state.
UI components must not write directly to DB/storage.

9. Protected Zones (Hard Lock)

Copilot may not modify the following without explicit approval from Thomas naming exact files and intent:

Authority Plane (Admin OS, config, guards)

Geographic Readiness computation logic

Promotion Eligibility & Relevance logic

Trust / CVS logic

Monetization rules/pricing philosophy

Role/claims/snapshot semantics (identity meaning)

Verification policy meaning (what requires verification and why)

If unsure → escalate.

10. Change Protocol (No Silent Drift)

Every change must state:

What changed

Why it changed

Which principle it enforces

What it does not change

How to verify (route/page/API)

Refactors that alter behavior require explicit approval.

11. Pilot Rollout (Scoped)

Pilot-first rollout is required for:

End-user messaging and chat behavior (Scout conversation flows)

Promotion / TradeDeals / monetization behavior

Trust / CVS logic that changes what normal users see

Signup/verification flow semantics (claim-first/intake meaning)

Pilot-first is NOT required for:

Admin-only tools/consoles

Pure observability/diagnostics/analytics views

Backend-only helpers that do not change user-visible outcomes

Pilot user:

traderscornerllc@gmail.com

Pilot flags must be server-derived when used.

12. Dev & Build Discipline

Always read package.json for script names.

Keep builds green.

Fix problems; do not remove features because they are hard.

Never ship mock data in production flows.

Use honest “unavailable” states (503) instead of fabricated data.

13. Brand Boundaries

This codebase is TradeScout only.

Do not mix Trader’s Corner.

Do not add MealScout as a separate brand.

MealScout-style promotions may exist only as a promotion type within TradeScout.

14. 3-Phase Execution Doctrine (Locked Delivery Order)

Copilot must execute large upgrades using locked phases that ship as small, testable units.

PHASE 1 — Global Community View Toggle (Read-only, posts-only)

Goal: allow “Everywhere” viewing without creating “browse → contact” behavior.

Requirements:

UI toggle: [Local] [Everywhere]

Everywhere mode: posts only, same payload shape

No new contact paths; keep existing Intent → Decision Card → Contact gate

Add notice: “You’re viewing posts from across the community. To connect, Scout will help you decide if it makes sense.”

Fail-safe: if scope=global, strip any sensitive fields server-side

PHASE 2 — County Data Router (Counties are containers, not calculators)

Goal: counties become operational “files” with clean, historical, admin-friendly facts.

Hard rules:

county_metrics = facts (numbers + small JSON summaries)

county_entities = assignments (TM, affiliates, partners)

county_notes = human interpretation (no auto-AI writes)

Counties do not compute; counties receive.

Metric Registry:

Only registered keys can be written.

If not registered, metric cannot be written.

Router service:

Server-only write path for metrics (jobs only)

Validates metricKey and countyFips

Upserts snapshots with asOf/updatedAt

Job order:

Users aggregation nightly (set mode, idempotent)

Affiliates + TradeDeals

Derived demand/gap scores only after facts exist

PHASE 3 — Claim-First Signup → Adaptive Verification (No role-first)

Goal: stop guessing identity; claims drive verification and routing.

Rules:

No route may assign “contractor” (or any role) by default.

Signup Phase 1: identity only (name/email/pass/OAuth + optional location)

Phase 2: claims intake (multi-select, not roles)

wantsToHire, providesServices, representsBusiness, postsDeals, communityBuilder, exploring

Phase 3: adaptive follow-ups based on claims

Verification becomes a path, not a wall:

Explore/profile building allowed

Verification required only to unlock specific outcomes (being listed, receiving routed requests, taking payments, etc.)

Roles are derived later as capabilities; never collapse user into one role.

15. Final Rule

When in doubt:

Ask Thomas (A/B)

Implement narrowly

Verify explicitly

Keep reversibility

This contract exists to stabilize TradeScout, prevent AI drift, and protect the valuation