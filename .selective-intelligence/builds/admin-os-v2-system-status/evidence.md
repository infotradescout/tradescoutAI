# Admin OS v2 — System Status

## Owner outcome

System observability cannot remain a massive live-stream presentation filled with generated panels, repeated dashboard cards, presentation-mode controls, and a second internal navigation system. Operators need one current status workspace that separates live signals, crawler traffic, snapshot freshness, automated repair candidates, and historical snapshots.

## Native workspace

The System Status workspace replaces the legacy TradeScout Live Stream surface with five operating lanes:

1. Signals
2. Crawler
3. Snapshots
4. Bot Army
5. History

The shared Admin OS header and navigation remain the only page shell.

## Current state summary

The workspace reports:

- Current signal count
- Active alerts
- Crawler requests over the last 24 hours
- Stale snapshot count

Unavailable feeds display an em dash and an explicit unavailable explanation. They are not converted into a healthy zero.

## Signals

The signal workspace preserves the server-produced live stream and adds focused filters for:

- Source
- Truth state
- State
- County
- Result limit

Signals are ordered by priority and time. Details expand only when needed and can include the observed basis, operator step, target market, sales angle, suggested surface, needed asset, inventory context, market gap, audience, and source evidence.

Preserved endpoints:

- `GET /api/admin/observability/live-stream`
- `POST /api/admin/observability/live-stream/refresh`
- `GET /api/admin/observability/live-stream/export.csv`

## Crawler

Crawler telemetry shows:

- Total requests
- Successful responses
- Client errors
- Server errors
- Top routes
- Top source surfaces
- Top bot identities
- Top counties

Preserved endpoint:

- `GET /api/admin/observability/crawler-telemetry`

## Snapshots

Snapshot health shows the scheduler state and each data container’s:

- Latest compute time
- Row count
- Stale threshold
- Current or stale state

Preserved endpoint:

- `GET /api/admin/observability/snapshot-status`

## Bot Army

The Bot Army workspace shows ranked repair candidates, occurrence counts, severity, score, observed fact, recommended action, and risk if ignored.

The automated promotion scheduler remains visible, and the manual promotion action preserves the resolved-work safeguard owned by Mission Control.

Preserved endpoints:

- `GET /api/admin/mission-control/bot-army/sprint-queue`
- `GET /api/admin/mission-control/bot-army/auto-promote/status`
- `POST /api/admin/mission-control/bot-army/auto-promote/trigger`

## History

Historical system summaries remain available for 1-, 7-, and 30-day lookback windows.

Preserved endpoint:

- `GET /api/admin/observability/live-stream/history`

## Removed presentation clutter

The native workspace removes:

- TradeScout Live Stream as a second page brand
- Presentation mode
- Executive briefing panels
- Auto-rotating presentation slides
- Decorative narrative dashboards
- Repeated page headers
- Nested outer cards
- Independent internal navigation unrelated to the Admin OS

The underlying observability data and operating controls remain.

## Preserved boundaries

This migration does not:

- Change observability source generation
- Change snapshot scheduling
- Change crawler telemetry collection
- Change Bot Army scoring
- Change Mission Control action ownership
- Reopen resolved actions automatically
- Change admin roles or permissions
- Change partners, profiles, requests, users, Stone Core, inventory, marketplace approvals, configuration, or finance data

## Release proof

Release requires:

- Production client and server build
- No critical schema drift
- Live stream read, refresh, export, and history route proof
- Crawler telemetry route proof
- Snapshot-status route proof
- Bot Army queue, status, and trigger route proof
- Confirmation that unavailable sources remain explicit
- Native `live-stream` surface marker
- Authenticated desktop and mobile screenshots
