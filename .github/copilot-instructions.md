TradeScout Copilot Authority Contract

v1.2 — Canonical + Scout v1 Execution Layer (Binding)

This document is binding.

If any instruction, code change, suggestion, or AI behavior conflicts with this document, the AI must pause and ask the operator (Thomas) for clarification before proceeding.

This contract exists to prevent drift, enforce outcome quality, and protect valuation.

0. Operator Authority & Escalation (Highest Priority)

Thomas is the final authority on:

Product meaning

Monetization philosophy

Trust and verification behavior

System intent and user outcomes

Mandatory Escalation Protocol

If an instruction touches or could affect:

Product meaning or positioning

Monetization behavior

Promotion / ad relevance or eligibility

Trust / CVS logic

Geographic readiness / coverage logic

User-visible behavior with unclear intent

The AI must stop and ask using this exact format:

Issue: what is ambiguous
Impact: what could change if guessed
Options: up to 3 concrete paths
Question: one direct question to Thomas

Until clarified:

❌ No code changes

❌ No partial implementation

❌ No reinterpretation

1. Identity & Mission (Frozen)
What TradeScout IS

TradeScout is a trust-verified, relevance-controlled local operating system where:

Users can fully participate without being charged

Promotions are shown only when contextually relevant

Conversion quality and trust outrank impressions and revenue

Community + transactions + discovery are orchestrated together

What TradeScout is NOT

Not a SaaS subscription product for users

Not a generic ad network

Not a feed-driven social network

Core Principles (Non-Negotiable)

AI chat (Scout) is the primary controller

UI pages are surfaces/tools Scout orchestrates

Promotion is suppressed by default

Users are never charged to participate

Paid tools (allowed only if):

Optional

Non-blocking

Cost + $1

Treated as a business/marketing expense

2. Canonical Authority Systems (Single Sources of Truth)

The following systems define truth and must never be duplicated or reinterpreted:

Admin OS (Authority Plane)

Config-driven navigation and visibility

Role-aware permissions and routing

No structural/nav refactors unless adding a new tool using the same pattern

Geographic Readiness Engine

County-level states: unassigned / partial / full

Verified Coverage Rate + deltas

Logic lives only in backend service

Promotion Eligibility & Relevance Engine

Determines eligibility for:

Ads (local / regional / national)

Boosted marketplace items

Local business deals

MealScout-style promotions

TradeDeals / affiliates

Rule: suppression by default

Trust / CVS Gating

Trust-weighted control of promotion visibility

Spend must never override trust

Monetization Rules (Frozen)

Allowed revenue

Paid boosts

MealScout-style promotions

Ads

Marketplace transaction fees

Community Builder donations (redistributed)

Affiliate / TradeDeals revenue

Optional cost-plus-$1 tools

Forbidden

Charging users to participate

Paywalls on core flows

Degrading non-paying users

3. Relevance-Only Promotion Rules (Critical)

Users must never see irrelevant promotions

Alignment is required (context + intent)

Guidance is allowed; spam is not

Enforcement

If relevance or eligibility is unclear → suppress

All promo decisions must be internally explainable

Relevance always outranks revenue

3.1 Context-Aware Static Language (Aggregated Only)

Static language may adapt using aggregated, scoped data only.

Allowed

Group-level, time-bounded aggregates

Server-side queries only

Graceful neutral fallback

Forbidden

Individual behavior references

Invented stats

Surveillance-like language

If aggregates are unavailable → suppress numbers.

4. Scout-First Control Plane (Expanded)
Scout as Controller

From chat, users must be able to:

Perform major site actions

Navigate via explicit actions

Complete full A→Z flows

Mandatory Build Order

Chat path (intent → decision → action)

Tool execution

UI surface (if needed)

4.1 Scout v1 Execution Guarantees (NEW — Binding)

Every Scout response must:

Answer the user’s question

Provide at least one actionable path

Never leave the user at a dead end

Include community when applicable

Be shaped by confidence

Confidence-Shaped Options

Low confidence: 1 primary + community

Medium confidence: up to 2 options

High confidence: 1 decisive option (+ override)

Defaults

Hiring / connection flows default to Direct Connect

Community path is included when:

confidence is low, OR

locality exists, OR

urgency is high

End-State Rule

Scout may never return:

empty actions

empty suggestedActions

“just text” with no outcome

4.2 Hire vs DIY Pattern (NEW)

For “how-to” or provider-search intents:

Primary: Hire / Direct Connect

Secondary: DIY / Learn

Both must include:

why this option exists

full A→Z flow

4.3 Deals & Promotions in Scout (NEW)

If deals are shown:

Max 3

Clearly labeled “Paid recommendation”

Include why relevant

Must never be prioritized because paid

Suppressed when:

low confidence AND

no locality

Scout must never create a situation where:

A user clicks a deal they cannot redeem

Eligibility is discovered after the click

5. Chat Message Model (Typed & Actionable)

Messages must support:

Structured text

Explicit links

Explicit actions

Do not hide navigation inside text.

Each feature must define:

Text

Links

Actions

Why (internal or visible)

6. Agent Tools Layer (No Ad-Hoc Fetching)

Core behavior via typed tools

No raw fetch scattered in UI

Pattern:

Tool → Agent → Message + Actions

7. Knowledge Base & Caching

Durable context via KB layer

No DB writes from UI

No long-lived React state for truth

8. Protected Zones (Hard Lock)

May not be modified without explicit approval:

Admin OS

Geo readiness logic

Promotion eligibility

Trust / CVS logic

Monetization philosophy

Authority semantics

If unsure → escalate.

9. Change Protocol (No Silent Drift)

Every change must state:

What changed

Why

Which principle it enforces

What it does NOT change

How to verify

Behavior-changing refactors require approval.

10. Pilot Rollout (Scoped)

Pilot user

traderscornerllc@gmail.com

Pilot-first required for

Scout conversation behavior

Promotion / monetization behavior

Trust / CVS changes

Not required for

Admin OS

Observability

Backend helpers

11. Dev & Build Discipline

Read package.json

Keep builds green

Never ship mock data

Fix problems — don’t delete them

12. Brand Boundaries

TradeScout only

No Trader’s Corner

MealScout only as a promotion type

13. Legacy Rules (Preserved Verbatim)

Never ship mock data

Always use real data

Always fix problems

Improve existing systems

Preserve functionality

Use best available model

Final Rule

When in doubt:

Ask Thomas
Get clarity
Implement narrowly
Verify explicitly