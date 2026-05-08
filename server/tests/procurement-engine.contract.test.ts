import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("procurement engine contract", () => {
  it("uses workspace/source based procurement tables", () => {
    const migration = read("migrations/0092_procurement_engine_workspaces.sql");
    [
      "procurement_workspaces",
      "procurement_workspace_members",
      "procurement_workspace_branding",
      "procurement_order_sources",
      "procurement_orders",
      "procurement_payment_authorizations",
    ].forEach((table) => expect(migration).toContain(table));

    expect(migration).toContain("origin_workspace_id");
    expect(migration).toContain("fulfillment_workspace_id");
    expect(migration).toContain("tradescout_supply_run");
    expect(migration).toContain("grunt_direct_ordering");
  });

  it("keeps fulfillment statuses brand-neutral", () => {
    const shared = read("shared/procurement.ts");
    expect(shared).toContain("assigned_to_fulfillment");
    expect(shared).toContain("accepted_by_fulfillment");
    expect(shared).toContain("rejected_by_fulfillment");
    expect(shared).not.toContain("sent_to_grunt");
    expect(shared).not.toContain("accepted_by_grunt");
  });

  it("registers TradeScout, Grunt, admin, and workspace routes", () => {
    const appRoutes = read("client/src/AppRoutes.tsx");
    [
      "/utilities/supply-run",
      "/utilities/supply-run/new",
      "/utilities/supply-run/:id",
      "/grunt/order",
      "/grunt/order/:id",
      "/grunt/admin/orders",
      "/grunt/admin/orders/:id",
      "/admin/procurement",
      "/admin/procurement/workspaces",
      "/admin/procurement/workspaces/:id",
    ].forEach((route) => expect(appRoutes).toContain(route));
  });

  it("authorizes Grunt with workspace membership or procurement entitlement", () => {
    const route = read("server/routes/procurement.ts");
    expect(route).toContain("procurement_workspace_members");
    expect(route).toContain("getTradepartnerUserEntitlement");
    expect(route).toContain('accessScope: "procurement"');
    expect(route).toContain("fulfillment_workspace_id");
    expect(route).toContain("isPrivateObjectKey");
  });
});
