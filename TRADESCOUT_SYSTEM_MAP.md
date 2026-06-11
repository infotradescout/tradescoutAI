# TRADESCOUT_SYSTEM_MAP

Status: Canonical architecture map for platform onboarding and AI-agent context.
Scope: System relationships, boundaries, and user-facing meaning.

## Platform Doctrine Snapshot

TradeScout is a system for businesses and their community.

Core journey:

Community -> Scout -> Decision Card -> Direct Connect -> Execution -> HomeID

Supporting systems that govern or constrain the journey:

- Trust/CVS
- Claims System
- County Intelligence Layer
- Finance Workflow
- Provider Profiles

## Operating Model

1. Community creates awareness and local signal.
2. Scout turns awareness into understanding, context, and routing.
3. Decision Cards convert understanding into clear next-step action.
4. Direct Connect executes intent through structured request and response flow.
5. Execution outcomes are completed and recorded.
6. HomeID stores durable memory from ownership and project history.

Protection and governance across all stages:

- Trust/CVS enforces verification and confidence boundaries.
- Claims governs ownership and authority assignment.
- County Intelligence provides local operational context.
- Finance Workflow governs funding, approvals, and money movement.
- Provider Profiles establish business identity and reputation context.

## System Ownership Matrix

Use this matrix to determine which system owns a responsibility before implementation.

| System | Owns |
| --- | --- |
| Community | Awareness |
| Scout | Understanding |
| Decision Cards | Recommendation |
| Direct Connect | Action |
| HomeID | Memory |
| Trust/CVS | Verification |
| Claims | Authority |
| Finance | Funding |
| County Intelligence | Geographic Context |
| Provider Profiles | Business Identity |

---

## 1) Community (Awareness)

Purpose:
- Discovery
- Local activity visibility
- Neighborhood signals
- Business/community interaction

Inputs:
- Community posts and updates
- Events and discussions
- Local engagement activity
- Business and member participation

Outputs:
- Awareness signals
- Discovery context
- Engagement indicators that can be interpreted by Scout

Dependencies:
- County Intelligence Layer for location context
- Business Community Layer for participant ecosystem
- Trust/CVS for safe participation boundaries

User-facing role:
- The public awareness surface where people see what is happening locally.

Mental model:
- Community = Awareness

---

## 2) Scout (Understanding)

Purpose:
- Search
- Local summaries
- Discovery interpretation
- Comparison
- Context and routing

Inputs:
- Community signals
- Local intelligence and county context
- Business and home summaries
- User prompts and lookup intent

Outputs:
- Structured understanding
- Comparative context
- Recommendation surfaces
- Next-step routing options (including Decision Card paths)

Dependencies:
- County Intelligence Layer for local facts
- Trust/CVS for confidence and authority boundaries
- Provider Profiles and business data for summaries
- Request and Decision Card systems for action handoff

User-facing role:
- The understanding surface that explains local context and suggests what to do next.

Mental model:
- Scout = Understanding

Not:
- Chatbot
- Assistant
- Support desk

---

## 3) Direct Connect (Action)

Purpose:
- Intent execution
- Request and matching workflow
- Project lifecycle progression

Inputs:
- Structured request intent
- Decision Card handoff
- User/project constraints
- Provider response signals

Outputs:
- Created and routed requests
- Matching and coordination state
- Contact exchange and execution workflow
- Project lifecycle status

Dependencies:
- Request System for structured intent object
- Decision Card System for guided handoff
- Trust/CVS for gating and verification constraints
- Claims System for authority and ownership checks
- Finance Workflow when funding/approval is required

User-facing role:
- The action surface where users start and manage real project requests.

Mental model:
- Direct Connect = Action

---

## 4) HomeID (Memory Layer)

Purpose:
- Property memory
- Ownership memory
- Asset and project memory

Inputs:
- Property profile data
- Service and maintenance events
- Improvement history
- Completed execution outcomes from Direct Connect

Outputs:
- Durable home and asset timeline
- Context for future recommendations
- Historical truth for follow-on decisions

Dependencies:
- Direct Connect and Execution outcomes as memory sources
- Claims System for ownership validity
- Trust/CVS where verification impacts record confidence

User-facing role:
- The persistent memory layer for home and property lifecycle history.

Mental model:
- HomeID = Memory

---

## 5) Trust/CVS (Verification)

Purpose:
- Authority
- Verification
- Confidence and trust enforcement

Inputs:
- Verification evidence
- Credential signals
- Behavior and quality indicators
- Business and participant trust data

Outputs:
- Trust signals and confidence boundaries
- Verification states used by other systems
- Exposure and routing constraints

Dependencies:
- Provider Profiles and Claims for identity and ownership grounding
- Direct Connect and Community for behavior/outcome inputs

User-facing role:
- The confidence layer that determines what actions and visibility are allowed.

Mental model:
- Trust/CVS = Verification

---

## 6) Finance Workflow

Purpose:
- Money movement
- Funding and approval chains
- Payment workflow governance

Inputs:
- Financing requests
- Project cost and approval requirements
- Lender/approver responses
- Payment authorization events

Outputs:
- Funding decisions
- Approval state transitions
- Payment authorization and financial routing artifacts

Dependencies:
- Direct Connect for project intent and execution stage
- Decision Cards for approval prompts and next-step actions
- Trust/CVS for confidence-sensitive approvals

User-facing role:
- The funding and approval layer that enables financially governed execution.

Mental model:
- Finance = Funding and Approval

---

## 7) Provider Profiles

Purpose:
- Business identity
- Reputation and verification context
- Authority display surface

Inputs:
- Claimed business data
- Credentials and verification artifacts
- Reviews, portfolio, and service area data

Outputs:
- Public and operational business identity
- Reputation and authority signals consumed by routing/matching

Dependencies:
- Claims System for ownership validity
- Trust/CVS for verification and confidence scoring
- County Intelligence for service-area context

User-facing role:
- The business identity layer users evaluate before action decisions.

Mental model:
- Provider Profile = Business Identity

---

## 8) Claims System

Purpose:
- Ownership assignment
- Control and authority establishment

Inputs:
- Claim requests (business, property, asset)
- Ownership proof and verification artifacts
- Transfer intents

Outputs:
- Authority assignments
- Ownership transfer records
- Control state used by downstream systems

Dependencies:
- Trust/CVS for verification rigor
- Provider Profiles and HomeID for claimed entity binding

User-facing role:
- The authority assignment layer that decides who controls what.

Mental model:
- Claims = Authority Assignment

---

## 9) County Intelligence Layer

Purpose:
- Living geographic containers
- Local intelligence and routing context

Inputs:
- Regional operational data
- Jurisdictional context
- Local trend and assignment signals

Outputs:
- County-scoped context for discovery, routing, and summaries
- Regional relevance inputs to Scout and Direct Connect

Dependencies:
- Core data pipelines and local context sources
- Community and business activity signals

User-facing role:
- The invisible geographic intelligence layer that keeps decisions locally grounded.

Mental model:
- County Layer = Geographic Intelligence

---

## 10) Request System

Purpose:
- Structured intent capture
- Project definition lifecycle

Inputs:
- User need and intent
- Draft details and requirements
- Review and publication decisions

Outputs:
- Canonical request objects
- Draft/review/published state transitions
- Intent artifacts consumed by Direct Connect

Dependencies:
- Scout and Decision Cards for entry/handoff context
- Trust/CVS and Claims where authority gating is required

User-facing role:
- The intent formalization layer that turns a need into a structured request.

Mental model:
- Request = Structured Intent

---

## 11) Decision Card System

Purpose:
- Awareness-to-action bridge
- Guided next-step decisions

Inputs:
- Scout understanding outputs
- Request readiness and trust context
- Approval or routing constraints

Outputs:
- Recommended actions
- Next-step prompts
- Routing decisions into Direct Connect or related flows

Dependencies:
- Scout for interpreted context
- Request System for action payload readiness
- Trust/CVS and Finance for gated/approval-sensitive actions

User-facing role:
- The guided-action layer that reduces ambiguity between understanding and execution.

Mental model:
- Decision Card = Guided Action

---

## 12) Business Community Layer

Purpose:
- Business + community ecosystem coherence

Inputs:
- Businesses, organizations, providers, and members
- Community interactions and local network activity

Outputs:
- Local economic and social graph context
- Participation substrate for Community, Scout, and Direct Connect

Dependencies:
- Community for engagement surfaces
- Provider Profiles for business identity
- County Intelligence for regional grounding

User-facing role:
- The ecosystem layer connecting businesses and community participants.

Mental model:
- TradeScout is businesses and their community (not only contractors and homeowners)

---

## Relationship Summary

Primary flow:

Community -> Scout -> Decision Card -> Direct Connect -> Execution -> HomeID

Governance and support overlays:

- Trust/CVS: verification and confidence constraints across all stages
- Claims System: ownership and control validity
- County Intelligence Layer: local relevance and geographic routing context
- Finance Workflow: funding, approval, and payment governance
- Provider Profiles: business identity and authority/reputation context

## Onboarding Guidance

When building a new feature:

1. Identify which of the 12 systems is primary.
2. Confirm whether the feature is awareness, understanding, action, memory, or governance.
3. Ensure handoffs follow the operating model and do not bypass Decision Card and Direct Connect when action is required.
4. Verify Trust/CVS, Claims, and County constraints before enabling user-visible action.
5. Record resulting execution outcomes into HomeID when the feature affects property/project memory.

## Contributor Rule

Before adding a feature, determine which system owns the responsibility.

This document is intended to prevent doctrine drift and keep implementation aligned with TradeScout system law.