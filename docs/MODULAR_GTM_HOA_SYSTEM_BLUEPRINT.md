# TradeScout Modular GTM + HOA System Blueprint

Date: 2026-02-25
Status: Draft for execution alignment

## 1) Strategic Positioning (Corrected)

TradeScout is an authority-first operating system for local work.
HOA is one capability pack inside TradeScout, not the platform definition.

### Core Platform (always-on)
- Scout-mediated routing and action orchestration
- Claims-first identity and verification
- Trust/CVS-governed exposure
- Discovery → Intent → Decision Card → Contact gating
- County intelligence as operational container

### Capability Packs (modular)
- HOA Operations
- Contractor Discovery & Pro Presence
- Marketplace/Exchange
- Community Memory & Announcements
- Messaging/Authority workflows

## 2) Modular GTM Framework (Core + Packs)

### GTM Layer A: Platform Narrative (all audiences)
- Message: Connection Without Compromise
- Promise: trusted action paths, no lead-selling, no pay-to-play shortcuts
- Psychological intent:
  - Target belief: system decisions are governed, not arbitrary.
  - Target behavior: users follow Scout and decision-card pathways.
  - Principles: predictability, institutional trust, legibility.
  - Risk prevented: marketplace/lead-gen misclassification.

### GTM Layer B: Entry Motion by Buyer Context
- HOA board/manager: governance + operational control + auditable workflows
- Homeowner: fast trusted outcomes with low friction and clear next steps
- Contractor: participation through verified, policy-bound pathways (not purchased leads)
- Admin/operator: policy controls, observability, enforcement

### GTM Layer C: Expansion Motion
- Land with one urgent problem per segment
- Expand into adjacent capability packs once trust is established
- Keep cross-pack identity and authority model consistent

## 3) HOA Capability Pack (Top-to-Bottom System Outline)

## 3.1 System Purpose
Provide a governed operations layer for HOA communities while preserving TradeScout’s global authority model.

## 3.2 Stakeholders and Roles
- Resident/member
- Board member (president, vice president, etc.)
- HOA manager (third-party or board-embedded)
- Vendor/contractor participant
- Platform support admins (super/super admin failsafe support)

Design principle: role title does not equal unlimited authority; permissions are action-scoped.

## 3.3 Authority Model
- Platform-level authority (super/super admin) for support and recovery paths
- HOA membership authority for community operations
- Capability flags (view finances, edit docs, manage vendors, create votes)
- Governance config controls quorum/threshold in HOA context

## 3.4 Domain Components
- HOA profile and governance configuration
- Membership and role records
- Voting and vote response records
- Financial records and fee collection audit entries
- Vendor directory and service request flows
- Dashboard telemetry (member counts, activity, transactions)

## 3.5 API/Service Surface (current implementation-aligned)
- Dashboard and profile retrieval
- Member membership/permission retrieval
- Vendor listing + service requests
- Vote listing + submission
- Board transfer vote initiation
- Fee collection and resident-level finance audit records

## 3.6 Key User Journeys

### A) Resident Journey
1. Join HOA membership context
2. See dashboard summary in plain language
3. Submit maintenance request via approved vendor path
4. Vote on active proposals
5. Review announcements/documents relevant to own role

### B) Board/Manager Journey
1. Access governance-aware dashboard
2. Review finances and collection signals
3. Launch/monitor votes (including board transfer flow)
4. Manage vendors and service quality outcomes
5. Communicate decisions to residents with audit trail

### C) Vendor Journey (through gated flows)
1. Enter as vetted participant
2. Receive scoped service requests
3. Respond with status and completion evidence
4. Build trust through outcomes, not volume gaming

## 3.7 Operational States and Guardrails
- No county context: blocked with clear guidance
- No HOA membership: blocked with membership guidance
- Permission mismatch: deny action with reason and next step
- Vote expired: auto-finalization and state reconciliation
- Write actions: always produce traceable records

## 4) Next-Level HOA UX (for mixed tech literacy)

Goal: premium clarity, not complexity. Make advanced power available without making basic tasks hard.

## 4.1 UX System Principles
- Progressive disclosure: show the minimum needed first, reveal detail on demand
- One primary action per screen section
- Plain-language labels over internal jargon
- Persistent “What happens next” hints after each major action
- Strong empty states with guided recovery
- Consistent visual grammar for trust states (allowed, gated, pending, complete)

Psychological intent:
- Target belief: “I can use this correctly even if I’m not technical.”
- Target behavior: complete workflows without side-channel workarounds.
- Principles: cognitive load reduction, guided choice, confidence scaffolding.
- Risk prevented: abandonment, misclicks, off-platform coordination.

## 4.2 Information Architecture for HOA
- Home: Snapshot + urgent actions
- Maintenance: request, status, vendor accountability
- Voting: active, closing soon, completed with outcomes
- Financials: high-level summary first, detail drill-down second
- Residents: role-aware directory visibility
- Documents: governed library with clear recency and ownership

## 4.3 Interaction Patterns (low-tech safe)
- Wizard-style flow for critical tasks (request service, initiate vote)
- Confirm screens before irreversible actions
- Status chips with natural language (“Needs board approval”, “Waiting on vendor”)
- Large tap targets and high contrast action buttons
- Mobile-first readability with desktop density options
- Inline examples/placeholders for every text input

## 4.4 Copy and Guidance Standards
- Use action-first labels: “Request service”, “Cast vote”, “Review summary”
- Avoid policy jargon unless expanded with tooltip/plain explanation
- Show consequence text before submit (“This notifies board + logs audit record”)
- Avoid urgency manipulation or social pressure mechanics

## 4.5 Accessibility and Inclusivity Baseline
- WCAG-friendly contrast and typography defaults
- Keyboard-complete flow support
- Screen-reader meaningful labels for status and controls
- Error messages explain fix path, not just failure state
- Optional “simple mode” UI density for low digital confidence users

## 5) Capability Pack Entry Motions (Execution)

### Motion 1: HOA Operations Entry
- Land on maintenance + governance snapshot
- Expand to voting + financials + documents

### Motion 2: Homeowner Entry
- Land on trusted action path (maintenance, local guidance)
- Expand to community memory + decision-card contact flows

### Motion 3: Contractor Entry
- Land on verified profile and service request handling
- Expand to trust-backed visibility and outcomes history

## 6) Measurement Model (what success means)

### Adoption KPIs
- HOA monthly active members
- % residents completing first meaningful action
- Board/manager weekly operational usage rate

### Trust KPIs
- % actions completed via governed in-platform path
- Contact attempts blocked/redirected correctly through Scout path
- Vendor request completion quality and resident satisfaction trends

### Usability KPIs
- Time-to-complete for top 5 workflows
- Form error rate by workflow
- Drop-off rate per step for non-technical users

## 7) Implementation Roadmap (practical sequence)

### Phase 1 (stabilize + simplify)
- Normalize top 5 HOA workflows into guided patterns
- Add explicit “next step” guidance blocks on all key pages
- Tighten permission feedback messaging

### Phase 2 (trust visibility)
- Add audit/provenance summaries for board/manager actions
- Add resident-friendly status timeline for requests and votes
- Standardize governance-state chips across HOA surfaces

### Phase 3 (advanced operations)
- Architectural review workflow
- Violations lifecycle with role-safe visibility
- Common area reservations with policy-aware approvals

## 8) Explicit Boundaries

This blueprint does not change core TradeScout law:
- No pay-to-play
- No lead-selling
- No direct authority bypass
- No role-first signup semantics
- No ungated discovery-to-contact path

HOA remains a capability pack under the same authority system.

## 9) Immediate Build Checklist

- Confirm HOA role-permission matrix against live policy
- Prioritize 5 low-tech critical workflows for UX refactor
- Add “simple mode” wireframe pass for HOA pages
- Create acceptance tests for top workflow clarity and completion
- Publish operator runbook for mixed HOA governance models
