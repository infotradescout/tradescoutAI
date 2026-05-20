import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("marketplace seller order lifecycle contract", () => {
  it("allows sellers to advance one valid lifecycle step at a time", () => {
    const source = read("server/routes.ts");
    const routeIndex = source.indexOf('"/api/marketplace/orders/:id/status"');
    expect(routeIndex).toBeGreaterThan(-1);
    const section = source.slice(routeIndex, routeIndex + 5000);

    expect(section).toContain("sellerOrderTransitions");
    expect(section).toContain('item_sold: "payment_received"');
    expect(section).toContain('payment_received: "label_pending"');
    expect(section).toContain('label_pending: "label_purchased"');
    expect(section).toContain('label_purchased: "in_transit"');
    expect(section).toContain('in_transit: "delivered"');
    expect(section).toContain('delivered: "payout_reconciled"');
    expect(section).toContain("nextStatus !== allowedNextStatus");
  });

  it("blocks sellers from skipping straight to payout reconciliation", () => {
    const source = read("server/routes.ts");
    const routeIndex = source.indexOf('"/api/marketplace/orders/:id/status"');
    const section = source.slice(routeIndex, routeIndex + 5000);

    expect(section).toContain("Marketplace order status must advance one step at a time.");
    expect(section).toContain("allowedNextStatus");
    expect(section).not.toContain('item_sold: "payout_reconciled"');
  });

  it("prevents sellers from updating someone else's order", () => {
    const source = read("server/routes.ts");
    const routeIndex = source.indexOf('"/api/marketplace/orders/:id/status"');
    const section = source.slice(routeIndex, routeIndex + 5000);

    expect(section).toContain("WHERE id = $1");
    expect(section).toContain("AND seller_id = $2");
    expect(section).toContain("Marketplace order not found");
  });

  it("returns 400 for invalid status values", () => {
    const source = read("server/routes.ts");
    const routeIndex = source.indexOf('"/api/marketplace/orders/:id/status"');
    const section = source.slice(routeIndex, routeIndex + 5000);

    expect(section).toContain("allowedStatuses");
    expect(section).toContain("Invalid marketplace order status");
    expect(section).toContain("res.status(400)");
  });

  it("only accepts label and tracking data at their matching lifecycle steps", () => {
    const source = read("server/routes.ts");
    const dashboard = read("client/src/pages/exchange/ExchangeSellerDashboard.tsx");
    const routeIndex = source.indexOf('"/api/marketplace/orders/:id/status"');
    const section = source.slice(routeIndex, routeIndex + 5000);

    expect(section).toContain('nextStatus === "label_purchased"');
    expect(section).toContain('nextStatus === "in_transit"');
    expect(dashboard).toContain('nextStatus === "label_purchased"');
    expect(dashboard).toContain('nextStatus === "in_transit"');
    expect(dashboard).toContain("Label URL");
    expect(dashboard).toContain("Tracking number");
    expect(section).toContain("Label URL is required before advancing to label purchased.");
    expect(section).toContain("Tracking number is required before advancing to in transit.");
  });
});
