# Community Engine Execution Contract (Required Layer)

Community is the local signal and reputation engine of TradeScout.

It produces verifiable social signals that feed the CVS / Trust Engine.

Community does not function as a generic social network.

## Community Invariant

Community exists to surface real local activity and proof, not entertainment or engagement loops.

Posts must contribute to local knowledge, verification, or coordination.

## Community Subjects

Community signals may originate from:
- Users
- Contractors
- Businesses
- Verified professionals
- Property owners where applicable

Signals must be attributed to the originating subject and stored in the correct CVS namespace.

## Community Engine Responsibilities

Community is responsible for:
- Surface local discussion
- Capture proof of work
- Capture recommendations
- Capture reputation signals
- Provide moderation signals
- Feed trust signals into CVS

Community does not:
- Create contractor connections
- Route users to marketplace actions
- Replace Direct Connect communication
- Act as an open messaging system

Community generates signals, not transactions.

## Community Core Loop

Every community interaction follows this signal pipeline:

Content Creation
-> Context Classification
-> Signal Extraction
-> Moderation Evaluation
-> Trust Signal Recording
-> CVS Signal Update

## Community Content Types

Community content must fall into one of the following categories:
- Discussion
- Questions
- Job Proof
- Recommendations
- Local Alerts
- Project Updates

Content outside these categories should be moderated.

## Signal Types Generated

Community produces several types of trust signals.

### Proof Signals
- Completed work posts
- Project photos
- Before/after documentation

## Proof Integrity Rule

Proof posts must contain verifiable context including at least one of:
- Work description
- Project location context (general area)
- Contractor or business attribution
- Supporting imagery or documentation

Proof signals lacking verifiable context must not influence CVS reputation scoring.

### Recommendation Signals
- Endorsements
- Positive experiences
- Community referrals

### Reputation Signals
- Helpful responses
- Verified participation
- Community recognition

### Moderation Signals
- Flagged content
- Spam reports
- Policy violations

## Community Signal Flow to CVS

Community signals must pass through moderation and validation before affecting CVS.

Community Activity
-> Signal Extraction
-> Moderation Review
-> CVS Reputation Namespace

This prevents manipulation.

## Exposure Rules

Community visibility must respect CVS eligibility.

Examples:
- Low trust actors -> reduced post visibility
- Verified professionals -> higher credibility signals
- Risk flags -> moderation review

Community does not override CVS exposure rules.

## Community Interaction With Other Engines

Community feeds signals to other engines but does not control them.

- CVS -> receives reputation signals
- Scout -> uses community proof when recommending pros
- Direct Connect -> may display community proof during contractor review
- Exchange -> may show seller reputation
- Maps -> may surface local community activity

Community is signal input, not decision authority.

## Governance Layer

Community governance protects signal quality.

Governance checks include:
- Spam detection
- Self-promotion abuse
- Fake reputation attempts
- Content policy violations

Moderation outcomes may influence CVS risk signals.

## Community Memory System

Community stores historical signal data including:
- Proof of work history
- Recommendation history
- Moderation records
- User participation patterns

These records inform CVS reputation scoring.

## Community Analytics

Community metrics track signal health rather than engagement metrics.

Examples:
- Proof post frequency
- Recommendation credibility
- Moderation rate
- Signal-to-noise ratio

These metrics help tune moderation thresholds.

## Community System Boundaries

Community must remain a signal generator.

Community must never become:
- A lead generation system
- An open messaging platform
- A promotional advertising feed
- A generic social network

Its role is verification and knowledge sharing.

## Promotion Boundary

Community may allow limited informational promotion when it contributes to verifiable local knowledge.

Promotion becomes a violation when:
- It attempts to solicit direct contact
- It repeats identical promotional content
- It lacks verifiable context (proof, explanation, or discussion)

Repeated violations must trigger CVS risk signals.

## Structural Risk

The primary failure mode is self-promotion spam.

Example drift:
- Contractor promotion posts
- Lead scraping
- Fake reviews

To prevent this:
- Moderation signals must feed CVS risk flags
- Repeated promotional abuse must reduce exposure

## Community Position in the TradeScout OS

CVS / Trust Engine
-> Community
-> Scout
-> Direct Connect
-> Exchange
-> Maps
-> HomeScout

Community is the primary trust signal producer.

## Contract Compliance Checklist

All Community changes must pass these checks.

### 1. Community Must Generate Trust Signals

PASS if:
- Community interactions produce verifiable signals for CVS

FAIL if:
- Community activity does not affect trust signals

### 2. Community Must Not Enable Direct Contact

PASS if:
- Direct contact only occurs through Direct Connect

FAIL if:
- Community posts allow messaging or bypass contact gates

### 3. Moderation Signals Must Affect CVS

PASS if:
- Moderation actions produce CVS risk signals

FAIL if:
- Policy violations do not affect trust exposure

### 4. Community Must Not Become Advertising

PASS if:
- Promotional content is moderated or limited

FAIL if:
- Community becomes dominated by self-promotion posts

### 5. Proof Posts Must Remain Verifiable

PASS if:
- Proof content supports verifiable work evidence

FAIL if:
- Proof posts cannot be validated or audited

## Review Requirement

Any PR affecting community posting, moderation logic, or reputation signals requires contract review.

## Implementation Anchors

Implementation anchors must point to the active community components:
- Community post service
- Moderation service
- Reputation signal extraction
- Community feed logic

If file paths relocate, this checklist must be updated in the same PR.

## System State After Locking Community

You now have four core OS engines locked:
- CVS / Trust Engine
- Scout
- Direct Connect
- Community

These govern:
- Trust
- Intent
- Coordination
- Signals
