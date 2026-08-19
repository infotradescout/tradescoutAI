import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("Admin OS v2 procurement", () => {
  it("registers procurement as a native Admin OS surface", () => {
    const source = read("client/src/admin/AdminToolSurface.tsx");
    expect(source).toContain('"procurement"');
  });

  it("replaces the shared marketing shell with a native order queue", () => {
    const source = read("client/src/pages/admin-procurement.tsx");

    expect(source).toContain('AdminWorkspace data-testid="admin-procurement-v2"');
    expect(source).toContain("AdminSummaryStrip");
    expect(source).toContain("AdminToolbar");
    expect(source).toContain("Order queue");
    expect(source).toContain("Open order workspace");
    expect(source).not.toContain("ProcurementPages");
    expect(source).not.toContain("<Card");
  });

  it("preserves the existing order list authority and server filters", () => {
    const source = read("client/src/pages/admin-procurement.tsx");

    expect(source).toContain('apiRequest("GET", `/api/procurement/orders${query}`)');
    expect(source).toContain('params.set("status", status)');
    expect(source).toContain('params.set("sourceChannel", sourceChannel)');
    expect(source).toContain('params.set("fulfillmentWorkspace", fulfillmentWorkspace)');
  });

  it("keeps the existing detail and fulfillment-workspace routes", () => {
    const source = read("client/src/pages/admin-procurement.tsx");

    expect(source).toContain('href="/admin/procurement/workspaces"');
    expect(source).toContain("href={`/admin/procurement/${order.id}`}");
    expect(source).toContain("Order writes remain in the existing detail workspace");
  });

  it("keeps the full procurement status vocabulary visible", () => {
    const source = read("client/src/pages/admin-procurement.tsx");

    for (const status of [
      '"submitted"',
      '"quote_pending"',
      '"assigned_to_fulfillment"',
      '"purchased"',
      '"delivery_started"',
      '"proof_uploaded"',
      '"completed"',
      '"cancelled"',
      '"refunded"',
    ]) {
      expect(source).toContain(status);
    }
  });

  it("does not add a second procurement write path", () => {
    const source = read("client/src/pages/admin-procurement.tsx");

    expect(source).not.toContain('apiRequest("POST"');
    expect(source).not.toContain('apiRequest("PATCH"');
    expect(source).not.toContain('apiRequest("PUT"');
    expect(source).not.toContain('apiRequest("DELETE"');
  });
});
