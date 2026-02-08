# TradeScout Industry Execution Roadmap

Status date: 2026-02-07

## Order of execution

1. Public profile infrastructure (crawlable + protected contact)
2. Direct Connect canonical funnel (all external contact routes through TS account flow)
3. Scout trust governance model (humans generate signal, Scout weights/enforces)
4. Community UX overhaul (cards, toggle logic, identity surfaces)
5. Admin/data integrity hardening (no mock metrics in live admin)
6. Settings and account wiring completion (no dead actions)

## Phase 1: Public profile infrastructure

Objective:
Public profiles are indexable and discoverable while direct contact details stay protected behind authenticated TradeScout contact flow.

Required outcomes:
- `/p/:slug` remains canonical public profile route.
- Dynamic SEO + JSON-LD are emitted server-side.
- Public profile API never exposes direct contact values.
- Public UI shows spam-prevention gating and routes to Direct Connect.

Progress:
- Implemented public profile API CTA redaction with `direct_connect_only` policy metadata.
- Added profile page SEOHelmet canonical/metadata fallback for client route hydration.
- Aligned public contact copy with account-required anti-spam policy.
- Removed direct contact fields from public business profile API responses.

Status: **Complete** (meets required outcomes as of 2026-02-08)

## Phase 2: Direct Connect canonical funnel

Objective:
Any contact intent from public or internal discovery routes through Direct Connect.

Required outcomes:
- Remove bypass paths that reveal direct phone/email on public surfaces.
- Normalize all "contact/message/hire" CTA paths to Direct Connect intent flow.
- Add explicit intent context payload (`hire`, `advise`, `collaborate`, `reconnect`) in routing.

Progress:
- Removed direct phone/email from public contractor APIs and public UI surfaces (cards, profiles, county map).
- Routed contractor contact CTAs and chat entry points through Direct Connect with explicit `intent=hire` context.
- Routed internal connection/contact CTAs (realtor connections) through Direct Connect and removed direct contact displays.

Status: **Complete** (meets required outcomes as of 2026-02-08)

## Phase 3: Scout trust governance model

Objective:
Scout is never presented as a recommender. Scout only governs human signals.

Required outcomes:
- Product language uses: "human recommendation, Scout-governed".
- Decision surfaces reflect "allow/defer/block by policy" instead of endorsements.
- Data model extension for staked recommendations and outcome penalties.

Progress:
- Updated core community recommendation and decision components away from "Scout recommends" phrasing.
- Removed recommendation language from system prompt templates and added policy-test coverage.
- Added admin observability telemetry panel for `scout_policy_violation_detected`.
- Updated decision/CTA copy to emphasize policy-governed trust signals.

Status: **Complete** (meets required outcomes as of 2026-02-08)

## Phase 4: Community UX overhaul

Objective:
Sharper feed layout, cleaner identity surfaces, and stable locality toggles.

Required outcomes:
- Top cards more compact.
- Local/Everywhere toggle strictly controls feed scope.
- Post cards and profile image rendering consistency.

Progress:
- Compacted Community Snapshot cards (size + typography).
- Local/Everywhere toggle now hides local snapshot in global view to prevent mixed scope.
- Standardized community post avatar sizing for consistent profile rendering.

Status: **Complete** (meets required outcomes as of 2026-02-08)

## Phase 5: Admin/data integrity

Objective:
Admin pages must reflect live metrics and operational state.

Required outcomes:
- No mock fallbacks on primary KPI cards.
- Observability, users, geo coverage, and platform metrics backed by live APIs.

## Phase 6: Settings completeness

Objective:
All user settings controls persist to live backend endpoints and return meaningful feedback.

Required outcomes:
- Remove no-op controls.
- Ensure every settings CTA resolves to a real route or persisted action.
