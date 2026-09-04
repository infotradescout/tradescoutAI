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
      "procurement_supplier_quotes",
      "procurement_payment_authorizations",
    ].forEach((table) => expect(migration).toContain(table));

    expect(migration).toContain("origin_workspace_id");
    expect(migration).toContain("fulfillment_workspace_id");
    expect(migration).toContain("public_access_token");
    expect(migration).toContain("idx_procurement_orders_public_access_token");
    expect(migration).toContain("supplier_snapshot");
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
      "/supplier/procurement/:token",
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

  it("keeps Grunt direct intake public while protecting TradeScout supply runs", () => {
    const route = read("server/routes/procurement.ts");
    expect(route).toContain('app.post("/api/procurement/orders", async');
    expect(route).toContain('sourceChannel !== "grunt_direct_ordering" && !req.isAuthenticated()');
    expect(route).toContain('sourceChannel === "grunt_direct_ordering"');
    expect(route).toContain("Add a customer name, email, or phone for Grunt direct orders");
    expect(route).toContain("public_access_token");
    expect(route).toContain("makePublicAccessToken");
    expect(route).toContain("publicOrderToken(req) === order.public_access_token");
    expect(route).toContain('app.get("/api/procurement/orders/:id", async');
    expect(route).toContain(
      'const fulfillment = isGruntDirect ? await ensureWorkspace("grunt") : null;'
    );
    expect(route).toContain("fulfillment?.id || null");

    const appRoutes = read("client/src/AppRoutes.tsx");
    const gruntOrderBlock = appRoutes.slice(
      appRoutes.indexOf('<Route path="/grunt/order">'),
      appRoutes.indexOf('<Route path="/grunt/order/:id">')
    );
    expect(gruntOrderBlock).toContain("GruntOrder");
    expect(gruntOrderBlock).not.toContain("ProtectedRoute");
    const gruntOrderDetailBlock = appRoutes.slice(
      appRoutes.indexOf('<Route path="/grunt/order/:id">'),
      appRoutes.indexOf('<Route path="/grunt/admin/orders">')
    );
    expect(gruntOrderDetailBlock).toContain("GruntOrderDetail");
    expect(gruntOrderDetailBlock).not.toContain("ProtectedRoute");
  });

  it("covers pilot order transitions and proof metadata", () => {
    const route = read("server/routes/procurement.ts");
    [
      'app.post("/api/procurement/orders/:id/quote"',
      'app.post("/api/procurement/orders/:id/approve"',
      'app.post("/api/procurement/orders/:id/checkout-session"',
      'app.post("/api/procurement/orders/:id/verify-checkout"',
      'app.post("/api/procurement/orders/:id/supplier-quotes"',
      'app.get("/api/procurement/supplier-quotes/:token"',
      'app.post("/api/procurement/supplier-quotes/:token/respond"',
      'app.post("/api/procurement/orders/:id/assign-fulfillment"',
      'app.post("/api/procurement/orders/:id/status"',
      'app.post("/api/procurement/orders/:id/proof"',
      'app.post("/api/grunt/orders/:id/accept"',
      'app.post("/api/grunt/orders/:id/reject"',
      'app.post("/api/partners/grunt/orders/:id/status"',
      'app.post("/api/partners/grunt/orders/:id/proof"',
    ].forEach((needle) => expect(route).toContain(needle));

    expect(route).toContain('proofType: z.enum(["pickup", "receipt", "delivery", "other"])');
    expect(route).toContain("partner_eta");
    expect(route).toContain("recordEvent");
    expect(route).toContain("stripe.checkout.sessions.create");
    expect(route).toContain("procurement_payment_authorizations");
    expect(route).toContain("procurement_supplier_quotes");
    expect(route).toContain("makeSupplierQuoteToken");
    expect(route).toContain("procurement_supply_run");
    expect(route).toContain("allowedStatusTransitions");
    expect(route).toContain("assertStatusTransition");
    expect(route).toContain("values ($1, $2::varchar, $3, $4, $5, $6)");
    expect(route).toContain("status = $2::varchar");
    expect(route).toContain("completed_at = case when $2::varchar = 'completed'");
  });

  it("supports live supplier product link enrichment", () => {
    const route = read("server/routes/procurement.ts");
    const resolver = read("server/services/supplierProductResolver.ts");
    const page = read("client/src/pages/procurement/ProcurementPages.tsx");
    const schema = read("shared/schema/procurement.ts");

    expect(route).toContain('app.post("/api/procurement/products/resolve"');
    expect(route).toContain("resolveSupplierProduct");
    expect(route).toContain("supplier_snapshot");
    expect(resolver).toContain("resolveSupplierProduct");
    expect(resolver).toContain("application\\/ld\\+json");
    expect(resolver).toContain("og:title");
    expect(page).toContain("Use Link");
    expect(page).toContain("supplierSnapshot");
    expect(page).toContain("snapshot saved");
    expect(schema).toContain('supplierSnapshot: jsonb("supplier_snapshot")');
  });

  it("separates read, operate, and public-token permissions", () => {
    const route = read("server/routes/procurement.ts");
    expect(route).toContain("canReadOrder");
    expect(route).toContain("canOperateFulfillment");
    expect(route).toContain("isPublicTokenHolder");
    expect(route).toContain("hasRestrictedPatchFields");
    expect(route).toContain("Only admins can edit operational procurement fields");
    expect(route).toContain("Fulfillment access required");
    expect(route).toContain("redactOrder");
    expect(route).toContain("visibleMessages");
    expect(route).toContain('new Set(["partner", "public"])');
    expect(route).toContain('new Set(["customer", "public"])');
  });

  it("uses operational labels instead of internal engine labels", () => {
    const shared = read("shared/procurement.ts");
    expect(shared).toContain('quote_pending: "Waiting on Quote"');
    expect(shared).toContain('assigned_to_fulfillment: "Sent to Grunt"');
    expect(shared).toContain('proof_uploaded: "Proof Received"');

    const page = [
      "client/src/pages/procurement/ProcurementPages.tsx",
      "client/src/pages/admin-procurement.tsx",
      "client/src/pages/admin-procurement-detail.tsx",
      "client/src/pages/admin-procurement-workspaces.tsx",
      "client/src/pages/admin-procurement-workspace-detail.tsx",
    ]
      .map(read)
      .join("\n");
    expect(page).toContain("Start Supply Run");
    expect(page).toContain('case "tradescout_supply_run":');
    expect(page).toContain('"Supply Run"');
    expect(page).toContain('"Waiting for assignment"');
    expect(page).toContain("Send to Grunt");
    expect(page).toContain("Accept Run");
    expect(page).toContain("Update ETA / Status");
    expect(page).toContain("Upload Receipt");
    expect(page).toContain("Upload Pickup Proof");
    expect(page).toContain("Upload Delivery Proof");
    expect(page).toContain("Pay Quote");
    expect(page).toContain("SupplierQuoteResponsePage");
    expect(page).toContain("Request supplier quote");
    expect(page).toContain("supplierQuotes");
    expect(page).toContain("checkout-session");
    expect(page).toContain("verify-checkout");
    expect(page).toContain("getOrderToken");
    expect(page).toContain("public_access_token");
    expect(page).toContain("tokenQuery");

    const publicGruntDetail = read("client/src/pages/grunt-order-detail.tsx");
    const gruntAdminDetail = read("client/src/pages/grunt-admin-order-detail.tsx");
    expect(publicGruntDetail).toContain("GruntOrderDetail");
    expect(publicGruntDetail).not.toContain("GruntAdminOrderDetail");
    expect(gruntAdminDetail).toContain("GruntAdminOrderDetail");
  });
});
