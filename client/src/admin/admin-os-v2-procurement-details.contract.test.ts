import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("Admin OS v2 procurement detail workspaces", () => {
  it("replaces the shared public order shell with one native admin order workspace", () => {
    const source = read("client/src/pages/admin-procurement-detail.tsx");

    expect(source).toContain('AdminWorkspace data-testid="admin-procurement-order-v2"');
    expect(source).toContain("Overview");
    expect(source).toContain("Quote & Suppliers");
    expect(source).toContain("Fulfillment");
    expect(source).toContain("Evidence");
    expect(source).not.toContain("ProcurementPages");
    expect(source).not.toContain("<Card");
    expect(source).not.toContain("<Shell");
  });

  it("preserves the existing procurement order read and write authority", () => {
    const source = read("client/src/pages/admin-procurement-detail.tsx");

    expect(source).toContain("/api/procurement/orders/${encodeURIComponent(id)}");
    expect(source).toContain("/api/procurement/orders/${id}/quote");
    expect(source).toContain("/api/procurement/orders/${id}/assign-fulfillment");
    expect(source).toContain("/api/procurement/orders/${id}/supplier-quotes");
    expect(source).toContain("/api/procurement/orders/${id}/approve");
    expect(source).toContain("/api/procurement/orders/${id}/checkout-session");
    expect(source).toContain("/api/procurement/orders/${id}/verify-checkout");
    expect(source).toContain("/api/procurement/orders/${id}/status");
    expect(source).toContain("/api/procurement/orders/${id}/proof");
    expect(source).toContain('apiRequest("PATCH", `/api/procurement/orders/${id}`');
    expect(source).toContain("uploadPrivateObject(proofFile)");
  });

  it("keeps private files on the authenticated procurement download route", () => {
    const source = read("client/src/pages/admin-procurement-detail.tsx");

    expect(source).toContain("/api/procurement/orders/${id}/files/${file.id}/download");
    expect(source).toContain("this page creates no public");
  });

  it("rebuilds procurement workspace registry and detail routes natively", () => {
    const registry = read("client/src/pages/admin-procurement-workspaces.tsx");
    const detail = read("client/src/pages/admin-procurement-workspace-detail.tsx");

    expect(registry).toContain('AdminWorkspace data-testid="admin-procurement-workspaces-v2"');
    expect(detail).toContain(
      'AdminWorkspace data-testid="admin-procurement-workspace-detail-v2"'
    );
    expect(registry).not.toContain("ProcurementPages");
    expect(detail).not.toContain("ProcurementPages");
    expect(registry).not.toContain("<Card");
    expect(detail).not.toContain("<Card");
  });

  it("preserves procurement workspace create and update authority", () => {
    const registry = read("client/src/pages/admin-procurement-workspaces.tsx");
    const detail = read("client/src/pages/admin-procurement-workspace-detail.tsx");

    expect(registry).toContain('apiRequest("GET", "/api/procurement/workspaces")');
    expect(registry).toContain('apiRequest("POST", "/api/procurement/workspaces"');
    expect(detail).toContain('apiRequest("GET", "/api/procurement/workspaces")');
    expect(detail).toContain("/api/procurement/workspaces/${id}");
    expect(detail).toContain('apiRequest("PATCH"');
  });

  it("reads the flattened workspace branding returned by the current server route", () => {
    const registry = read("client/src/pages/admin-procurement-workspaces.tsx");
    const detail = read("client/src/pages/admin-procurement-workspace-detail.tsx");

    for (const source of [registry, detail]) {
      expect(source).toContain("public_name");
      expect(source).toContain("primary_color");
      expect(source).toContain("support_email");
      expect(source).toContain("support_phone");
      expect(source).toContain("workspaceBranding");
    }
  });

  it("keeps public procurement pages in the shared procurement module", () => {
    const publicModule = read("client/src/pages/procurement/ProcurementPages.tsx");

    expect(publicModule).toContain("export function SupplyRunNew");
    expect(publicModule).toContain("export function GruntOrderNew");
    expect(publicModule).toContain("export function SupplierQuoteResponsePage");
  });
});
