# Exchange Engine Execution Contract (Required Layer)

Exchange is the economic marketplace engine of TradeScout.

It manages the creation, discovery, and lifecycle of tradable assets and opportunities within the platform.

Exchange operates under the governance of CVS / Trust Engine and must respect eligibility, exposure, and contact coordination rules enforced by other engines.

Exchange is not an open classifieds system.

## Exchange Invariant

All marketplace objects must originate from verified platform entities and must respect CVS eligibility before exposure.

Exchange must never allow listings, offers, or transactions that bypass trust evaluation.

## Exchange Engine Responsibilities

Exchange is responsible for:
- Create marketplace listings
- Expose tradable opportunities
- Maintain listing lifecycle
- Enable economic discovery
- Provide listing metadata for routing
- Support transaction initiation through platform flows

Exchange does not:
- Create direct connections
- Handle transaction communication
- Override CVS exposure decisions
- Operate as an anonymous marketplace

Exchange provides economic discovery, not communication or contact authority.

## Exchange Core Loop

Every marketplace object follows this lifecycle:

Listing Creation
-> Eligibility Verification (CVS)
-> Exposure Decision
-> Discovery
-> Transaction Initiation
-> Direct Connect Routing
-> Coordination via Messages
-> Outcome Recording
-> Listing Completion / Archive

Listings must pass CVS eligibility checks before exposure.

## Listing Lifecycle Rule

Listings must follow a deterministic lifecycle.

Allowed states include:

DRAFT
-> ELIGIBLE
-> EXPOSED
-> TRANSACTION INITIATED
-> COMPLETED
-> ARCHIVED

Listings must not transition outside these lifecycle states without governance approval.

## Exchange Listing Subjects

Listings may originate from:
- Contractors
- Businesses
- Verified professionals
- Property owners (via HomeScout)
- Approved commercial entities

Anonymous listings are not permitted.

## Listing Ownership Rule

Every listing must have a single authoritative owner entity.

The owner must be a verified platform subject and must remain responsible for the listing lifecycle.

Listings without a valid owner entity must not be created or exposed.

## Listing Types

Exchange may host several marketplace object types:
- Service opportunities
- Equipment listings
- Material listings
- Vehicle listings
- General goods
- Local economic opportunities

Property listings remain governed by HomeScout, not Exchange.

## Listing Metadata Requirements

All listings must include minimum metadata.

Required fields:
- Owner identity
- Location context
- Category
- Description of asset or opportunity
- Pricing or offer structure
- Eligibility state

Listings missing required metadata must not be exposed.

## Contact Redaction Rule

Listings must not expose direct contact information.

Phone numbers, email addresses, external links, or other contact methods must be removed or blocked from listing content.

Contact initiation must route through Direct Connect.

## Listing Exposure Rules

Exchange must consult CVS before exposing listings.

Examples:
- Verified professionals -> full exposure
- Limited trust actors -> reduced visibility
- Risk flags -> restricted or blocked listings

Exchange cannot override CVS exposure outcomes.

## Listing Discovery Rules

Discovery may include:
- Location-based discovery
- Category filtering
- Trust-weighted ranking
- Opportunity relevance

Discovery must remain trust-sensitive and location-aware.

## Exchange Interaction With Other Engines

Exchange integrates with other TradeScout engines but does not override their authority.

- CVS -> determines listing eligibility and visibility
- Scout -> routes demand toward listings or opportunities
- Direct Connect -> manages contact initiation for listings
- Messages -> coordinates transactions after connection
- Community -> provides reputation signals for listing owners
- Maps -> surfaces geographic marketplace activity
- HomeScout -> governs property-related assets

Exchange is the supply engine, not the trust or coordination engine.

## Exchange Governance Layer

Governance must detect marketplace abuse patterns including:
- Fraudulent listings
- Misleading descriptions
- Spam listings
- Duplicate opportunities
- Policy violations

Governance outcomes may trigger CVS risk flags.

## Duplicate Listing Control

Exchange must detect and limit duplicate listings originating from the same entity or representing the same asset.

Repeated duplication attempts must trigger CVS risk signals.

## Exchange Memory System

Exchange stores historical listing data including:
- Listing lifecycle records
- Ownership history
- Transaction outcomes
- Dispute records
- Listing edits

These records inform CVS behavior signals.

## Exchange Analytics

Marketplace health metrics include:
- Listing success rate
- Opportunity conversion rate
- Fraud detection rate
- Listing duplication frequency
- Exposure fairness

These metrics help tune exposure and governance rules.

## Exchange System Boundaries

Exchange must remain marketplace infrastructure.

Exchange must never become:
- An anonymous classifieds system
- A messaging platform
- A lead generation marketplace
- A pay-to-rank advertising system

All economic activity must remain governed by CVS eligibility and Direct Connect coordination.

## Transaction Authority Boundary

Exchange may initiate transactions but must not finalize or coordinate them.

All coordination must occur through Direct Connect and Messages.

Exchange must remain a discovery and initiation layer only.

## Structural Risk

The primary failure mode is trust bypass through listings.

Example drift:
- Anonymous listings
- Spam marketplace activity
- Fake opportunities
- Contact bypass through listing descriptions

To prevent this:
- Listings must require verified ownership
- Contact initiation must route through Direct Connect
- CVS eligibility must gate exposure

## Exchange Position in the TradeScout OS

CVS / Trust Engine
-> Community
-> Scout
-> Direct Connect
-> Messages
-> Exchange
-> Maps
-> HomeScout

Exchange operates after trust and coordination layers.

## Contract Compliance Checklist

All marketplace-related changes must pass these checks.

### 1. Listings Must Pass CVS Eligibility

PASS if:
- All listings consult CVS eligibility before exposure.

FAIL if:
- Listings appear without trust evaluation.

### 2. Listings Must Have Verified Ownership

PASS if:
- Listing owner identity is verified.

FAIL if:
- Anonymous listings are allowed.

### 3. Exchange Must Not Enable Direct Contact

PASS if:
- Contact initiation routes through Direct Connect.

FAIL if:
- Listings expose contact information or allow messaging.

### 4. Listing Abuse Must Affect CVS

PASS if:
- Fraud or spam listings produce CVS risk signals.

FAIL if:
- Marketplace abuse does not influence trust exposure.

### 5. Marketplace Discovery Must Respect Trust Signals

PASS if:
- Trust eligibility influences listing visibility.

FAIL if:
- Listings rank without considering CVS trust state.

## Review Requirement

Any PR affecting listing creation, discovery, marketplace governance, or listing exposure requires contract review.

## Implementation Anchors

Implementation anchors must reference active Exchange components such as:
- Listing creation service
- Marketplace discovery service
- Eligibility validation logic
- Listing governance service

If file paths relocate, the compliance checklist must be updated in the same PR.

## System State After Locking Exchange

You now have six core OS engines governed by contracts:
- CVS / Trust Engine
- Scout
- Direct Connect
- Community
- Messages
- Exchange

These engines govern the full lifecycle:
- Trust
- Signals
- Intent
- Coordination
- Communication
- Supply
