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

- Production Acceptance
- System Status
- Scout Resilience
- Error Reports
- Platform Settings
- Platform Controls

### Finance

- Finance

All 22 primary tools are represented. A `More` section is reserved only for a future role-visible tool that has not yet been assigned to an outcome workspace.

## Primary workspace completion

The primary Admin OS migration is structurally complete as of August 19, 2026.

Every primary role-visible navigation tool is registered as a native v2 surface:

| Operating group | Tool ID | Operator label |
|---|---|---|
| Inbox & Requests | `overview` | Admin Home |
| Inbox & Requests | `direct-connect-requests` | Requests |
| Inbox & Requests | `commercial-directory` | Commercial Work |
| Inbox & Requests | `procurement` | Procurement |
| People & Trust | `users` | Users |
| People & Trust | `verification` | Address & Identity |
| People & Trust | `business-verifications` | Business Verification |
| People & Trust | `moderation` | Moderation |
| People & Trust | `business-directory-ops` | Business Directory |
| Partners & Market | `tradepartner-ops` | Partner Operations |
| Partners & Market | `listings` | Marketplace Listings |
| Partners & Market | `crm` | Sales Pipeline |
| Coverage & Intelligence | `geo-map` | County Coverage |
| Coverage & Intelligence | `business-onboarding-telemetry` | Onboarding Health |
| Coverage & Intelligence | `discovery-observatory` | Discovery |
| Platform | `production-acceptance` | Production Acceptance |
| Platform | `live-stream` | System Status |
| Platform | `scout-resilience` | Scout Resilience |
| Platform | `errors` | Error Reports |
| Platform | `panel` | Platform Settings |
| Platform | `controls` | Platform Controls |
| Finance | `finance` | Finance |

The runtime registry is exported from `AdminToolSurface.tsx` as `NATIVE_ADMIN_V2_TOOL_IDS`. A completion contract verifies that it exactly matches the 22 IDs declared by the primary navigation taxonomy.

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

The Procurement parent tool also keeps its three operator detail routes inside this grammar:

- `/admin/procurement/:id`
- `/admin/procurement/workspaces`
- `/admin/procurement/workspaces/:id`

These routes share the `procurement` tool identity and permission boundary rather than appearing as separate navigation tools.

### Adapted surface

An adapted tool retains its current functional component while Admin OS v2 removes the legacy outer page constraints and normalizes visual treatment.

After primary completion, the adapted surface is reserved for compatibility aliases, diagnostic laboratories, and non-primary routes that have not yet received their own native operating redesign. Current examples include commercial-business management, Vault Contributions, protected redirects, and hidden legacy or laboratory routes.

A hidden or detail route being adapted does not make it a primary Admin OS navigation workspace.

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

## Workspace grammar

Primary workspaces and migrated operator detail routes share these rules:

- One page title comes from the integrated shell toolbar.
- A tool does not render another page shell inside the workspace.
- Local tabs use one thin sticky subnavigation when multiple operating lanes are required.
- Summary strips show current operating state, not decorative metrics.
- Unavailable data remains unavailable instead of becoming zero.
- Lists are compact by default and reveal detail on demand.
- Existing server routes remain the read and write authority.
- Destructive actions preserve existing confirmation, reason, and permission requirements.
- Mobile access remains part of the same workspace rather than a second admin product.

## Completed migration sequence

The primary workspace sequence completed in this order:

1. Admin Home and Partner Operations foundation
2. Requests
3. Address & Identity
4. Business Verification
5. Business Directory
6. Marketplace Listings
7. Error Reports
8. Users
9. Moderation
10. Platform Settings
11. Platform Controls
12. System Status
13. Onboarding Health
14. Discovery
15. Scout Resilience
16. County Coverage
17. Commercial Work
18. Procurement
19. Sales Pipeline
20. Finance
21. Production Acceptance

The first native detail-route continuation then migrated the procurement order and procurement workspace routes without adding new navigation entries.

The order was not used as a gate. Company-specific work, HomeID work, partner work, planner work, and other production corrections continued concurrently.

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

## Completion meaning

Primary completion means:

- The 22 outcome-based navigation tools are native v2 surfaces.
- Their canonical routes and permissions remain authoritative.
- Their page-specific operating work no longer depends on the temporary adapted-v1 presentation layer.
- The procurement order and workspace detail routes also remain inside the native Admin OS grammar.
- Other hidden detail and compatibility routes can continue using the adapter until their own production demand justifies a native redesign.

Primary completion does not by itself claim that every production pixel, every empty state, or every authenticated write has been visually approved on every device. That claim requires the release proof below.

## Release proof

Every Admin OS release requires:

- Production build success
- Server bundle success
- Critical schema preflight success
- Production service startup
- Role-based route reachability
- Unknown-route behavior check
- Desktop evidence at 1440 pixels or wider
- Mobile evidence at 390 pixels
- Keyboard Find Tool evidence
- Read/write verification for every migrated workflow
- Clear identification of native versus adapted surfaces

The structural completion contract proves registry coverage. Authenticated browser evidence remains the authority for final visual and interaction approval.
