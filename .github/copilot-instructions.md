TradeScout Copilot Authority Contract (v1.1 — Canonical)

This document is binding.
If any instruction, code change, suggestion, or AI behavior conflicts with this document, the AI must pause and ask the operator (Thomas) for clarification before proceeding.

0. Operator Authority & Escalation (Highest Priority)

Thomas is the final authority on product meaning, monetization philosophy, and system behavior.

When uncertainty exists, the AI must ask Thomas — not guess, not reinterpret, not proceed partially.

Mandatory escalation protocol

If an instruction touches or could affect:

Product meaning or positioning

Monetization behavior

Promotion / ad relevance or eligibility

Trust / CVS logic

Geographic readiness / coverage logic

User-visible behavior with unclear intent

The AI must stop and ask using this format:

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

What TradeScout is NOT

Not a SaaS subscription product for users

Not a generic ad network

Not a social network driven by open-ended feeds

Core principles (non-negotiable)

AI chat is the primary controller of the site.

UI pages/components are surfaces/tools the AI orchestrates.

Promotion is suppressed by default unless eligibility + relevance are satisfied.

Never charge users to participate.
Any paid tools must be:

Optional

Non-blocking

Cost + $1

Treated as a business/marketing expense.

2. Canonical Authority Systems (Single Sources of Truth)

The following systems define truth and must not be duplicated or reinterpreted:

Admin OS (Authority Plane)

Config-driven navigation and visibility

Role-aware permissions and routing

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

MealScout-style promotions

TradeDeals / affiliate offers

Rule: suppression by default

Trust / CVS Gating

Trust-weighted control of promotion visibility

Spend alone must never override trust constraints

Monetization Rules (Frozen)

Allowed revenue:

Paid boosts (marketplace + local deals)

MealScout-style promotions

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

Users must never see ads or TradeDeals that do not apply to their life, interests, or context.

Promotions are shown only when alignment is present.

The system may gently guide users toward relevant offers but must never spam or interrupt core flows.

Enforcement rules

If relevance or eligibility is unclear → do not show promotion.

Promotion decisions must be internally explainable (admin/observability).

Relevance always outranks revenue.

3.1 Context-Aware Static Language (Aggregated Only)

Static site language may adapt using aggregated, location- and interest-scoped data only.

Personalized copy must:

- Use only group-level, time-bounded aggregates (e.g. "contractors in Maricopa County completed 31 projects last month").
- Be backed by a real, server-side query or aggregate endpoint (no client-side guesswork or mock stats).
- Degrade gracefully to neutral, non-numeric language when data is unavailable or ambiguous.

Personalized copy must not:

- Reference individual behavior (e.g. searches, clicks, conversions, messages) or private signals.
- Invent or interpolate counts, earnings, performance, or rankings.
- Leak any user-specific detail that could feel like surveillance.

If an aggregate endpoint is unavailable or returns an error, the correct behavior is to suppress numbers and show neutral copy such as "New listings are being added in your area" rather than fabricating values.

4. Chat-First Control Plane
AI chat as controller

From the chat, users should be able to:

Perform major site actions

Receive messages with attached links and actions

Have the agent read/write to knowledge bases and caches

Build order (mandatory)

When adding or changing features:

Design the chat path first (intent → tool → response + links/actions)

Then implement or adjust the UI surface

5. Chat Message Model (Typed & Actionable)

Chat messages must support:

Structured text

Explicit links (rendered as UI elements, not hidden URLs)

Explicit actions (navigation, tool calls)

Do not embed navigation or actions inside raw text.

Every new chat feature must define:

Message text

Attached links

Attached actions

Typed message/action patterns from the original document remain valid and encouraged.

6. Agent Tools Layer (No Ad-Hoc Fetching)

Core capabilities must be exposed via typed tool wrappers (e.g. src/agent/tools/*).

UI components must not scatter raw fetch() calls for core behavior.

Required pattern:

Tool wrapper (backend interaction)

Agent calls tool

Agent emits message + links/actions

Optional richer UI page

7. Knowledge Base & Caching

Long-lived user or community data must go through a knowledge/caching abstraction.

Do not store durable context in local React state.

UI components must not write directly to DB/storage.

8. Protected Zones (Hard Lock)

The AI may not modify the following without explicit approval from Thomas naming exact files and intent:

Authority Plane (Admin OS, config, guards)

Geographic Readiness computation logic

Promotion Eligibility & Relevance logic

Trust / CVS logic

Monetization rules or pricing philosophy

Role and permission semantics

If unsure whether a change touches a protected zone → escalate.

9. Change Protocol (No Silent Drift)

Every change must state:

What changed

Why it changed

Which principle it enforces

What it does not change

How to verify (route, page, or API)

Refactors that alter behavior require explicit approval.

10. Pilot Rollout (Scoped)

Pilot-first rollout is now scoped to high-risk, user-facing changes only.

Pilot user:

traderscornerllc@gmail.com

Pilot-first is REQUIRED for:

- End-user messaging and chat behavior (Scout conversation flows)
- Promotion / TradeDeals / monetization behavior
- Trust / CVS logic that changes what normal users see

Pilot-first is NOT required for:

- Admin-only tools and consoles (Admin OS, Geo Tools, coverage consoles)
- Pure observability / diagnostics / analytics views
- Backend-only selectors, metrics, and storage helpers

Rules:

- Pilot flag must be server-derived (auth payload) when used.
- Client may branch on that flag only for the REQUIRED categories above.
- Admin-only features may go directly to all authorized admins (role-gated) without a pilot gate.
- Graduation to GA for pilot-gated flows still requires an explicit decision.

11. Dev & Build Discipline

Always read package.json for script names.

Keep builds green.

Fix problems; do not remove features because they are hard.

Never ship mock data in production flows.

12. Brand Boundaries

This codebase is TradeScout only.

Do not mix Trader’s Corner.

Do not add MealScout as a separate brand.

MealScout-style promotions may exist only as a promotion type within TradeScout.

13. Legacy Operational Rules (Explicit Carryover)

These rules are intentionally preserved verbatim from the original document and remain binding:

Never give mock data, placeholders, or stubs in production code.

Always use real data fetching and handling patterns.

Always fix problems; do not remove functionality because it is hard to fix.

Always prefer improving what exists over replacing it.

Always use the best available AI model for the task.

Preserve existing functionality unless explicitly instructed otherwise.

Final Rule

When in doubt:

Ask Thomas

Get clarification

Implement narrowly

Verify explicitly

This contract exists to stabilize TradeScout, prevent AI drift, and protect the valuation thesis.