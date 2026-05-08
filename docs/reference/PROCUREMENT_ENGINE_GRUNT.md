# TradeScout Procurement Engine

TradeScout Procurement Engine is the reusable procurement operating system behind two deployment modes:

- **TradeScout Utility Mode:** `/utilities/supply-run` lets TradeScout users order supplies under “Supply Run,” with public language “Order materials from anywhere. Fulfilled by Grunt.”
- **Grunt Direct Ordering Mode:** `/grunt/order` and `/grunt/admin/orders` give Grunt a branded ordering and fulfillment system powered by the same backend.

The engine is workspace-based instead of Grunt-hardcoded. `procurement_workspaces` owns brand/operator identity, `origin_workspace_id` records where an order came from, `fulfillment_workspace_id` records who fulfills it, and `source_channel` records the entry path such as `tradescout_supply_run` or `grunt_direct_ordering`.

## Ownership And Access

TradeScout-originated orders keep the TradeScout customer relationship and request context. Grunt can see only fulfillment data needed to source, purchase, pick up, deliver, and prove completion. The Grunt routes do not expose Trust/CVS scoring, unrelated profiles, browsing data, rankings, or contact systems.

Grunt-originated orders belong to the Grunt workspace as direct ordering records. TradeScout/LISA owns the platform code, engine schema, infrastructure IP, and analytics model.

## Core Tables

- `procurement_workspaces`
- `procurement_workspace_members`
- `procurement_workspace_branding`
- `procurement_order_sources`
- `procurement_orders`
- `procurement_order_items`
- `procurement_order_files`
- `procurement_quotes`
- `procurement_quote_lines`
- `procurement_fulfillment_events`
- `procurement_messages`
- `procurement_delivery_proofs`
- `procurement_payment_authorizations`
- `partner_webhook_events`

## Seeded Workspaces

- `tradescout`: platform workspace for TradeScout Utility Mode.
- `grunt`: fulfillment partner workspace for Grunt Direct Ordering and TradeScout-routed fulfillment.

## Operating Flow

1. Customer creates an order with items, delivery address, urgency, vehicle need, supplier preference, and private file uploads.
2. Admin reviews the order and builds quote lines for materials, delivery fee, service fee, and contingency buffer.
3. Customer or admin approves the quote.
4. Admin assigns fulfillment to a workspace such as Grunt.
5. Grunt accepts, updates fulfillment status, adds ETA/supplier confirmation, uploads receipts and proof, and marks the order completed.
6. The event timeline preserves every operational status update.

## Product Packaging

**Package 1: TradeScout Supply Run**
Tracks completed utility orders inside TradeScout and gives TradeScout users a local supply discovery/action path.

**Package 2: Grunt Ordering System**
Gives Grunt direct customer ordering, quote approval, dashboard operations, receipt handling, delivery proof, and repeat-order infrastructure.

**Package 3: Investor Demo Layer**
The same live system can show branded ordering, backend queue, status pipeline, completed order metrics, and operational reporting for fundraising conversations.

## Commercial Framing

Recommended pilot structure: TradeScout/LISA builds and owns the procurement engine, Grunt receives operating access to the branded workspace, and the 90-day pilot measures completed orders, fulfillment time, revenue processed, and repeat customers. After the pilot, terms can move to license, rev share, platform fee, purchase option, or strategic infrastructure partnership.
