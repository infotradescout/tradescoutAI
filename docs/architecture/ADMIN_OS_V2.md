# TradeScout Admin OS v2

## Purpose

Admin OS v2 is one operating system for platform work. It replaces the prior pattern of a navigation dashboard, page dashboard, portal card, tab card, and record cards stacked inside one another.

The system is designed for operators who need to find work, understand current state, make a decision, and complete the action without navigating through implementation structure.

## Shell

Every admin route uses the same shell:

- Persistent desktop workspace rail
- Collapsible icon rail
- Mobile drawer
- Integrated sticky toolbar
- Global Find Tool action and `/` keyboard shortcut
- One content workspace

The shell does not provide a second bottom navigation, density selector, route badge, repeated Admin OS badge, or permanent dashboard card.

## Navigation authority

The underlying tool registry remains the route and permission authority.

Admin OS v2 adds a presentation taxonomy that reorganizes role-visible tools by operating outcome without changing their canonical paths or permission rules.

### Inbox & Requests

- Admin Home
- Requests
- Commercial Work
- Procurement

### People & Trust

- Users
- Address & Identity
- Business Verification
- Moderation
- Business Directory

### Partners & Market

- Partner Operations
- Marketplace Listings
- Sales Pipeline

### Coverage & Intelligence

- County Coverage
- Onboarding Health
- Discovery

### Platform

- System Status
- Scout Resilience
- Error Reports
- Platform Settings
- Platform Controls

### Finance

- Finance

All 21 primary tools are represented. A `More` section is reserved only for a future role-visible tool that has not yet been assigned to an outcome workspace.

## Tool surfaces

### Native v2 surface

A native v2 tool uses the shared workspace primitives:

- `AdminWorkspace`
- `AdminWorkspaceSubnav`
- `AdminSection`
- `AdminSummaryStrip`
- `AdminToolbar`
- `AdminList`
- `AdminEmptyState`

Native pages do not recreate the app shell, page header, or nested dashboard container.

### Adapted surface

An adapted tool retains its current functional component while Admin OS v2 removes the legacy outer page constraints and normalizes visual treatment.

Adapted surfaces are temporary migration states. They preserve functionality while each workflow is rebuilt independently.

## Route behavior

Unknown admin routes must never silently render Admin Home.

The Admin Content Router detects the old registry fallback and shows an explicit unregistered-route state. Compatibility aliases must be declared before the admin wildcard.

## Admin Home

Admin Home answers four questions:

1. What work is unread?
2. Are customer connection paths succeeding?
3. What is blocked or stale?
4. Which common workspace should the operator open next?

It does not duplicate the navigation tool catalog.

## Partner Operations

Partner Operations demonstrates the intended workspace grammar:

- One sticky local subnavigation
- No portal wrapper card
- No duplicate title
- Summary strip only when useful
- One search/filter toolbar
- Compact expandable rows
- Detail only on demand

## Migration order

Individual tools migrate concurrently in this order of operational value:

1. Requests
2. Users
3. Address & Identity
4. Business Verification
5. Business Directory
6. Error Reports
7. System Status
8. Marketplace Listings
9. Commercial Work
10. Procurement
11. Sales Pipeline
12. County Coverage
13. Platform Settings
14. Platform Controls
15. Scout Resilience
16. Discovery
17. Onboarding Health
18. Moderation
19. Finance

Partner Operations and Admin Home are already part of the foundation.

The order is not a gate. A tool can move earlier when production demand requires it.

## Non-negotiable boundaries

Admin redesign must not:

- Change permission authority silently
- Create new write paths without explicit review
- Hide unavailable data as zero
- Invent queue urgency
- Combine unrelated company or partner records
- Change ownership
- Change public contact routing
- Change request recipients
- Change inventory or Stone Core
- Remove compatibility routes without a replacement
- Break mobile access

## Release proof

Every Admin OS release requires:

- Production build success
- Role-based route reachability
- Unknown-route behavior check
- Desktop evidence at 1440 pixels or wider
- Mobile evidence at 390 pixels
- Keyboard Find Tool evidence
- Read/write verification for every migrated workflow
- Clear identification of native versus adapted surfaces
