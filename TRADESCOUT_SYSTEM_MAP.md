# TRADESCOUT_SYSTEM_MAP

Status: Canonical TradeScout OS architecture map for contributors and AI agents.
Scope: System doctrine, shared context, tool ownership, and handoff behavior.

## TradeScout OS Principle

TradeScout is an operating system of connected tools.

TradeScout OS = one operating system, many connected tools, shared context, clear handoffs.

TradeScout is not:
- A contractor directory
- A lead marketplace
- A chatbot
- A generic community app

TradeScout is:
- An operating system for local business, property, service, trust, and community workflows.

Architecture rule:
- Do not collapse tools into generic actions.
- Do not delete tools to force simplification.
- Do not present tools as disconnected apps.

## Shared Context Layer

All tools must read/write through shared context instead of creating isolated per-tool truth.

Shared context domains:
- Identity state: user identity, role capabilities, session context.
- Trust state: verification, confidence, trust/CVS constraints.
- Location state: county and local routing context.
- Property/home memory state: HomeID timelines, component and service history.
- Business profile state: provider identity, credentials, service-area context.
- Request state: structured intent, lifecycle stage, assignment/routing readiness.
- Finance state: funding eligibility, approval status, payment progression.

OS continuity requirement:
- A user moving between tools keeps identity, trust, location, memory, request, and finance context intact.

## Tool Handoff Rules

Canonical handoff chain:
- Community -> Scout
- Scout -> Decision Cards
- Decision Cards -> Direct Connect
- Direct Connect -> HomeID

Cross-cutting rules:
- Trust/CVS verifies and constrains action across all tools.
- Claims assigns and validates authority across all tools.
- Finance attaches to eligible requests/projects and governs funding/approval paths.

Handoff quality standard:
- Every handoff must preserve shared context.
- Every handoff must declare next-step clarity for the user.
- No handoff may bypass authority/trust constraints.

## Primary Tools

These are user-facing workflow tools in the OS chain.

### 1) Community

Purpose:
- Awareness and local discovery.

User job:
- Find local signals, activity, and business/community updates.

Inputs:
- Local posts, updates, events, discussions, and participation.

Outputs:
- Awareness signals and discovery context.

Dependencies:
- County Intelligence for local context.
- Trust/CVS for participation safety boundaries.

Handoff behavior:
- Community surfaces route users to Scout for understanding and decision readiness.

### 2) Scout

Purpose:
- Understanding through search, local summaries, comparison, and contextual lookup.

User job:
- Understand what is happening locally and what next action makes sense.

Inputs:
- Community signals, county/local intelligence, profile and request context.

Outputs:
- Interpreted context, recommendations, and next-step routing candidates.

Dependencies:
- County Intelligence for local facts.
- Provider Profiles for business context.
- Trust/CVS for confidence boundaries.

Handoff behavior:
- Scout hands off to Decision Cards for explicit next-step guidance.

### 3) Decision Card System

Purpose:
- Bridge understanding into guided action.

User job:
- Choose the next best step with clear recommendation and constraints.

Inputs:
- Scout outputs, trust constraints, request readiness, finance/approval context.

Outputs:
- Recommended next action and routing decision.

Dependencies:
- Scout for interpreted context.
- Request System for action payload readiness.
- Trust/CVS and Finance for gated paths.

Handoff behavior:
- Decision Cards route actionable cases into Direct Connect.

### 4) Direct Connect

Purpose:
- Action workflow: create requests, route responses, and execute projects.

User job:
- Start and manage real-world service/project action.

Inputs:
- Structured request intent, Decision Card routing, trust/authority constraints.

Outputs:
- Request lifecycle progression, assignment/routing state, contact exchange, execution status.

Dependencies:
- Request System for canonical intent.
- Trust/CVS and Claims for gating/authority.
- Finance Workflow for eligible funded paths.

Handoff behavior:
- Completed outcomes are projected into HomeID memory.

### 5) HomeID

Purpose:
- Durable property, ownership, and project memory.

User job:
- Preserve and reuse home/asset history for future decisions.

Inputs:
- Execution outcomes, maintenance/service records, ownership context.

Outputs:
- Property timeline, component history, historical memory for future recommendations.

Dependencies:
- Direct Connect execution outcomes.
- Claims for ownership validity.
- Trust/CVS where memory confidence affects downstream decisions.

Handoff behavior:
- HomeID memory feeds future Scout context and Decision Card readiness.

## Supporting Services

These services are not optional add-ons; they are OS-level control planes supporting primary tools.

### 6) Trust/CVS

Purpose:
- Verification and confidence enforcement.

User job:
- Ensure participants and actions are trustworthy and policy-compliant.

Inputs:
- Verification evidence, credentials, behavior and quality signals.

Outputs:
- Trust/verification states and exposure/action constraints.

Dependencies:
- Provider Profiles, Claims, Community, and Direct Connect signals.

Handoff behavior:
- Applies verification gates and confidence boundaries across all tool transitions.

### 7) Claims System

Purpose:
- Ownership and authority assignment.

User job:
- Establish who controls business/property/assets and can take privileged actions.

Inputs:
- Claim requests, proof artifacts, transfer intents.

Outputs:
- Authority assignments and ownership transfer state.

Dependencies:
- Trust/CVS verification rigor.
- Provider Profiles and HomeID binding context.

Handoff behavior:
- Injects authority truth into all tools before sensitive actions are allowed.

### 8) Provider Profiles

Purpose:
- Business identity, reputation, and credential context.

User job:
- Evaluate provider identity and trust signals before action.

Inputs:
- Claimed profile data, credentials, portfolio, service areas, reviews.

Outputs:
- Operational business identity and reputation signals.

Dependencies:
- Claims for ownership validity.
- Trust/CVS for verification status.
- County Intelligence for regional relevance.

Handoff behavior:
- Supplies business identity context to Scout, Decision Cards, and Direct Connect.

### 9) Finance Workflow

Purpose:
- Funding, approvals, and payment flow governance.

User job:
- Progress financially constrained work with clear approval/payment state.

Inputs:
- Financing requests, project financial requirements, approvals, payment events.

Outputs:
- Funding decisions, approval progression, payment status artifacts.

Dependencies:
- Direct Connect request/project lifecycle.
- Decision Cards for approval prompts.
- Trust/CVS for confidence-sensitive approvals.

Handoff behavior:
- Attaches to eligible requests/projects and governs finance-dependent transitions.

### 10) County Intelligence Layer

Purpose:
- Geographic/local context and routing intelligence.

User job:
- Keep discovery, understanding, and action locally relevant.

Inputs:
- Regional operational data, jurisdiction context, local trend signals.

Outputs:
- County-scoped relevance and routing context.

Dependencies:
- Community and business activity signals.

Handoff behavior:
- Supplies local context to Community, Scout, Decision Cards, and Direct Connect.

### 11) Request System

Purpose:
- Structured intent lifecycle (draft -> review -> published action object).

User job:
- Convert need into an actionable, canonical request.

Inputs:
- User need, project definition details, review decisions.

Outputs:
- Canonical request objects and lifecycle state transitions.

Dependencies:
- Scout and Decision Cards for upstream context.
- Trust/CVS and Claims where gated authority is required.

Handoff behavior:
- Provides validated intent payloads to Direct Connect.

### 12) Business Community Layer

Purpose:
- Unified business/community network substrate.

User job:
- Participate in a local ecosystem where businesses and community members interact.

Inputs:
- Businesses, organizations, providers, community members, local interactions.

Outputs:
- Shared ecosystem context for awareness, understanding, and action tools.

Dependencies:
- Community, Provider Profiles, County Intelligence.

Handoff behavior:
- Stabilizes cross-tool network context used by Community and Scout.

## User-Facing Navigation

Navigation goal:
- One OS home with clear entry points, not fragmented app islands.

Required user-facing navigation model:
- Community: awareness entry.
- Scout: understanding and contextual lookup.
- Decision Cards: explicit next-step guidance.
- Direct Connect: action/request execution.
- HomeID: memory and historical continuity.

Navigation continuity rules:
- Shared language across tools.
- Shared identity/trust/memory context indicators.
- Clear handoff prompts between tools.
- No dead-end transitions that force user re-orientation.

## Internal System Ownership Matrix

Use this matrix before adding or changing features.

| System | Ownership | Responsibility Lens |
| --- | --- | --- |
| Community | Awareness | Local signal discovery and engagement context |
| Scout | Understanding | Interpretation, search, summary, comparison, routing context |
| Decision Cards | Recommendation | Next-step recommendation and action framing |
| Direct Connect | Action | Request execution and project action lifecycle |
| HomeID | Memory | Durable property/asset/project memory |
| Trust/CVS | Verification | Confidence and exposure/action constraints |
| Claims | Authority | Ownership and control assignment |
| Finance | Funding | Approval and payment/funding progression |
| County Intelligence | Geographic Context | Local relevance and jurisdiction-aware routing context |
| Provider Profiles | Business Identity | Verified business identity and reputation context |
| Request System | Structured Intent | Canonical intent lifecycle and readiness payload |
| Business Community Layer | Ecosystem Substrate | Shared business/community graph context |

Contributor rule:
- Before adding a feature, determine which system owns the responsibility.

## Product Principle

The tools are separate but must not feel fragmented.

Target experience:
- One OS.
- Many tools.
- Shared context.
- Clear handoffs.

## Implementation Guardrails

This document is architecture doctrine for contributors and AI agents.

Validation scope for updates to this file:
- Documentation only.
- No runtime changes.
- No routing changes.
- No doctrine deletion.