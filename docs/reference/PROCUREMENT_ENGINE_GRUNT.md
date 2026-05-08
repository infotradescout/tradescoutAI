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

## Internal TradeScout SOP

Use this flow for TradeScout Supply Run orders before sending work to Grunt.

1. Open `/admin/procurement`.
2. Filter by order source, status, or fulfillment partner.
3. Open the Supply Run.
4. Review the delivery address, item list, notes, and uploaded files.
5. Add internal notes if the request needs cleanup before quoting.
6. Build the quote using materials estimate, delivery fee, service fee, and contingency buffer.
7. Send the quote.
8. Approve the quote manually during pilot if payment is not enabled.
9. Use **Send to Grunt** when the order is ready for fulfillment.
10. Track the timeline until receipt, pickup proof, delivery proof, and completion are recorded.

TradeScout should keep control of the customer relationship, quote review, and handoff decision. Grunt should receive only what it needs to fulfill the run.

## Grunt Operator SOP

Use this flow for Grunt direct orders and TradeScout-routed Supply Runs.

1. Open `/grunt/admin/orders`.
2. Review assigned TradeScout orders and Grunt direct orders.
3. Open an order.
4. Use **Accept Run** or **Reject Run**.
5. Add or update ETA with **Update ETA / Status**.
6. Move the order through supplier confirmed, purchase pending, purchased, driver assigned, pickup started, picked up, delivery started, delivered, and completed as applicable.
7. Upload receipt when purchase is made.
8. Upload pickup proof when supplies are collected.
9. Upload delivery proof when supplies are dropped off.
10. Mark completed after delivery proof is attached and the order is closed operationally.

Grunt operators should not need GitHub, database access, full admin access, or help from Thomas to run the dashboard.

## Pilot Terms Sheet

**Pilot length:** 90 days.

**Owner of platform engine:** TradeScout/LISA.

**Operator during pilot:** Grunt.

**Allowed use:** Grunt direct ordering and TradeScout-routed Supply Runs.

**Data boundaries:** Grunt can access fulfillment details, delivery address, customer contact needed for fulfillment, item list, receipts, pickup proof, delivery proof, ETA, and status history. Grunt cannot access unrelated TradeScout profiles, Trust/CVS scoring, contractor ranking logic, lead routing data, browsing data, database access, or source code.

**Pilot KPIs:**

- completed orders
- average fulfillment time
- revenue processed
- repeat customers
- customer issues or disputes

**After pilot:** licensing agreement, revenue share, purchase option, expanded partnership, or shutdown of Grunt operating access.

Business framing for demos: “We built the ordering layer as infrastructure owned by TradeScout/LISA. Grunt can operate on it during a pilot, and if it proves valuable, we can license it, revenue share it, or structure a purchase option.”

## Pilot Readiness Checklist

- [ ] TradeScout user can create Supply Run.
- [ ] Grunt direct customer can create order.
- [ ] Admin can view and manage all procurement orders.
- [ ] Admin can filter by workspace, source, and status.
- [ ] Admin can review uploaded files.
- [ ] Admin can build and send quote.
- [ ] Admin or customer can approve quote for pilot.
- [ ] Admin can send order to Grunt.
- [ ] Grunt can only view Grunt-originated or Grunt-assigned orders.
- [ ] Grunt cannot access unrelated TradeScout profile, trust, ranking, or lead data.
- [ ] Quote builder works.
- [ ] Quote approval works.
- [ ] Status timeline works.
- [ ] Private file upload works.
- [ ] Receipt upload works.
- [ ] Pickup proof upload works.
- [ ] Delivery proof upload works.
- [ ] Empty states work.
- [ ] Error states work.
- [ ] Mobile flow is usable.
- [ ] Pilot language protects TradeScout/LISA ownership.

## Internal Pilot Account Setup

If real internal accounts do not exist yet, create them with the guarded seed script. Do not use fake/sample orders for the pilot walkthrough, and do not give Grunt external access.

Set these environment variables locally or in a secure one-off shell session:

- `PILOT_TS_CUSTOMER_EMAIL`
- `PILOT_TS_CUSTOMER_PASSWORD`
- `PILOT_TS_ADMIN_EMAIL`
- `PILOT_TS_ADMIN_PASSWORD`
- `PILOT_GRUNT_OPERATOR_EMAIL`
- `PILOT_GRUNT_OPERATOR_PASSWORD`

Optional display-name variables:

- `PILOT_TS_CUSTOMER_FIRST_NAME`
- `PILOT_TS_CUSTOMER_LAST_NAME`
- `PILOT_TS_ADMIN_FIRST_NAME`
- `PILOT_TS_ADMIN_LAST_NAME`
- `PILOT_GRUNT_OPERATOR_FIRST_NAME`
- `PILOT_GRUNT_OPERATOR_LAST_NAME`

Run:

```bash
npm run seed:procurement-pilot
```

The script:

- creates or updates the TradeScout customer account
- creates or updates the TradeScout admin account with `ops_admin`
- creates or updates the limited Grunt operator account
- grants the Grunt operator only `grunt` procurement workspace access
- grants the Grunt operator only the `grunt` procurement entitlement
- does not print passwords
- does not create orders, files, quotes, proofs, or sample data

Use those accounts for the manual walkthrough and permission kill-tests.

## Known Limitations

These are intentionally deferred until the pilot proves demand:

- full supplier catalog
- automated Home Depot or Lowe's integration
- live driver GPS
- Stripe Connect split payments
- supplier bidding
- AI item substitution
- public launch marketing

Payment is manual for the pilot. Quote approval can be recorded by the customer or an admin until payment authorization/capture is explicitly approved.
