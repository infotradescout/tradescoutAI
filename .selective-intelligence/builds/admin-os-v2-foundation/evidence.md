# TradeScout Admin OS v2 — foundation evidence

## Owner outcome

The existing admin system is not acceptable as a collection of dashboards, cards, headers, and sub-portals nested inside one another. Every admin tool must be rebuilt from the top down as one coherent operating system.

The owner’s screenshot exposed the governing failure:

- A navigation dashboard beside a page dashboard
- A second page header repeating the route
- A portal card inside the page
- Tabs inside the portal card
- Another dashboard card inside the selected tab
- Large status cards before the actual operating records
- Repeated names, descriptions, badges, borders, and empty framing

The required outcome is an operator workbench, not dashboards inside dashboards.

## Foundation decision

Admin OS v2 uses one persistent shell:

1. One outcome-based navigation rail
2. One integrated top toolbar
3. One content workspace
4. One global tool search
5. One mobile navigation drawer
6. No secondary admin bottom navigation
7. No density mode
8. No page-level shell cards
9. No silent fallback from an unknown route to Admin Home

## Navigation model

The 21 role-visible admin tools are grouped by operator outcome:

- Inbox & Requests
- People & Trust
- Partners & Market
- Coverage & Intelligence
- Platform
- Finance

Implementation language is replaced in the public admin navigation where a clearer operator label exists:

- Direct Connect Requests → Requests
- TradePartners + TradeDeals → Partner Operations
- Verification → Address & Identity
- Listings Approval → Marketplace Listings
- Sales CRM → Sales Pipeline
- Telemetry Center → System Status
- Admin Panel → Platform Settings
- Controls Hub → Platform Controls

Hidden compatibility routes remain routable but do not compete in primary navigation.

## Admin Home

Admin Home becomes an operator inbox with:

- Unread operating work
- Connection-path health
- Blocked paths
- Snapshot freshness
- Needs Action list
- Platform State
- Common Workspaces

It does not present another tool catalog, synthetic urgency, decorative policy cards, or false zeroes when a signal feed is unavailable.

## Workspace migration model

Admin OS v2 separates tools into two safe states during migration:

### Native v2

The tool uses AdminWorkspace primitives and does not recreate a page shell.

Current native v2 surfaces in this release:

- Admin Home
- Partner Operations
- Requests

### Adapted v1

The existing tool keeps its API behavior, actions, dialogs, and records while the shared surface adapter removes the old outer page frame, excess width limits, heavy shadows, and incompatible card treatment. Each adapted tool is then migrated independently without pausing the others.

This is presentation adaptation only. It does not change data, permissions, writes, or routing.

## Partner Operations proof

Partner Operations no longer includes a second portal heading or a card surrounding the full feature.

It now uses a thin sticky subnavigation with:

- Partner Intake
- Live Profiles
- TradeDeals
- Campaigns

Live Profiles and Partner Intake use summary strips, one toolbar, and expandable operating rows instead of two-column card walls.

## Request Operations proof

The Requests workspace now uses the shared AdminWorkspace structure. The legacy request composer remains functional but its duplicate card heading, outer border, background, and padding are removed inside the native v2 page.

## Route safety

Unknown `/admin/...` paths no longer silently resolve to Admin Home. The content router detects the legacy fallback and shows a clear unregistered-route state with the exact requested path.

The earlier compatibility alias from `/admin/partner-operations` to `/admin/tradepartners` remains intact.

## Preserved behavior

This foundation does not change:

- Admin roles or permissions
- API endpoints
- Partner records
- User records
- Requests
- Profile ownership
- Contact routing
- Stone Core
- Inventory
- Marketplace data
- Finance data
- Existing writes inside adapted tools

## Release boundary

This is the Admin OS v2 foundation, not a claim that all 21 individual workflows are fully redesigned.

Foundation completion requires:

- Successful TypeScript and production build
- Shell, navigation, route, Admin Home, Partner Operations, and Requests contracts
- Production startup with no critical schema drift
- Authenticated desktop evidence
- Authenticated mobile evidence
- Confirmation that unknown admin paths do not show Admin Home
- Confirmation that all role-visible tools remain reachable

After foundation release, individual workspaces continue migrating concurrently without returning to the old nested-dashboard shell.
