# Messages Engine Execution Contract (Required Layer)

Messages is the transaction communication engine of TradeScout.

It enables structured communication only after a valid connection is established through Direct Connect.

Messages does not function as a general messaging platform.

## Messages Invariant

Messages may only exist within a valid connection lifecycle created by Direct Connect.

No user-to-user messaging may occur outside that lifecycle.

## Messages Engine Responsibilities

Messages is responsible for:
- Facilitate communication between connected parties
- Maintain conversation history for active connections
- Support coordination for active work or transactions
- Preserve conversation records for governance and trust signals

Messages does not:
- Create new connections
- Allow unsolicited messaging
- Replace Direct Connect lifecycle
- Act as an open messaging platform

Messages supports coordination, not discovery.

## Messages Core Loop

Every conversation follows this lifecycle:

Direct Connect ACCEPT
-> Connection Created
-> Message Thread Created
-> Conversation Exchange
-> Transaction Coordination
-> Outcome Recorded
-> Thread Archived

Messages cannot exist before connection creation.

## Thread Ownership Rule

A message thread must be owned by a valid Direct Connect connection record.

Each thread must reference:
- connection_id
- Participating entities
- Associated objective or transaction context

Threads lacking a valid connection_id must not be created.

## Message Subjects

Messages may occur between:
- Homeowners and contractors
- Contractors and coordinators
- Businesses and customers
- Other verified entities approved by governance

All subjects must have a valid Direct Connect relationship.

## Participant Lock Rule

Participants in a message thread must match the entities authorized by the associated Direct Connect connection.

Participants may not be added, replaced, or expanded outside that connection lifecycle unless approved by governance.

## Message Types

Messages may include structured communication types:
- Text messages
- Project coordination updates
- Scheduling discussions
- File or photo attachments
- Work progress updates

Messages must relate to an active connection context.

## Message Boundaries

### Messaging Scope Rule

Messages must remain scoped to the objective, project, or transaction associated with the connection.

Unrelated discussions must not occur within message threads.

Messages must not allow:
- Cold outreach
- Lead solicitation
- Advertising
- Unrelated promotion

Any attempt to bypass Direct Connect through messaging is a contract violation.

## Message Signals for CVS

Message interactions generate behavioral signals that feed CVS.

Examples:
- Responsiveness
- Coordination quality
- Dispute indicators
- Abuse or harassment signals

These signals contribute to the Platform Behavior namespace.

## Message Governance Layer

Messages must include moderation safeguards.

Governance checks include:
- Harassment detection
- Spam attempts
- Policy violations
- Dispute indicators

Moderation outcomes may influence CVS risk flags.

## Message Memory System

Messages maintain historical conversation records including:
- Conversation history
- Attachments
- Transaction context
- Dispute records

These records support:
- Outcome tracking
- Dispute resolution
- Trust signal evaluation

## Archival Integrity Rule

Completed or inactive message threads must transition to archived state.

Archived threads:
- Remain accessible for audit and dispute resolution
- May not accept new messages without reopening through governance or lifecycle transition

## Message Analytics

Messages should track coordination metrics such as:
- Response time
- Conversation resolution rate
- Dispute frequency
- Message abuse reports

These metrics help tune governance and CVS signals.

## Message System Boundaries

Messages must remain transaction communication infrastructure.

Messages must never become:
- A social messaging system
- A marketing outreach tool
- A lead generation channel
- A replacement for Direct Connect

## Structural Risk

The primary failure mode is messaging bypassing contact gates.

Example drift:
- Users contacting contractors without requests
- Cold outreach
- Lead scraping

To prevent this:
- Message threads must require a valid Direct Connect connection ID.
- Any attempt to message outside that lifecycle must fail.

## Messages Position in the TradeScout OS

CVS / Trust Engine
-> Community
-> Scout
-> Direct Connect
-> Messages
-> Exchange
-> Maps
-> HomeScout

Messages sits after coordination approval.

## Contract Compliance Checklist

All message-related changes must pass these checks.

### 1. Messages Require Valid Connection

PASS if:
- All message threads require Direct Connect connection ID.

FAIL if:
- Users can message without connection lifecycle.

### 2. Messages Must Not Enable Cold Outreach

PASS if:
- Messaging only occurs between approved parties.

FAIL if:
- Users can message strangers.

### 3. Message Signals Must Affect CVS

PASS if:
- Conversation outcomes contribute to CVS behavior namespace.

FAIL if:
- Messaging behavior does not affect trust signals.

### 4. Governance Must Detect Abuse

PASS if:
- Moderation tools detect spam, harassment, or abuse.

FAIL if:
- Abusive messaging does not trigger governance review.

### 5. Messaging Must Remain Contextual

PASS if:
- Messages reference an active work or transaction context.

FAIL if:
- Messages exist without a related objective or connection.

## Review Requirement

Any PR affecting messaging threads, moderation logic, or conversation lifecycle requires contract review.

## Implementation Anchors

Implementation anchors must reference active messaging components such as:
- Message thread service
- Conversation storage
- Moderation service
- Connection validation

If file paths relocate, the checklist must be updated in the same PR.

## System State After Locking Messages

You now have five core OS engines governed by contracts:
- CVS / Trust Engine
- Scout
- Direct Connect
- Community
- Messages

These cover the full lifecycle:
- Trust
- Intent
- Signals
- Coordination
- Communication
