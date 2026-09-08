import { describe, expect, it, vi } from "vitest";
import {
  getStandaloneAccountingSnapshotForUser,
  getStandaloneVendorSnapshotForUser,
} from "../routes/scout";

const normalizeSql = (value: unknown) => String(value).replace(/\s+/g, " ").trim();

describe("mounted Scout standalone-finance lineage", () => {
  it("queries only explicit null-FK standalone invoices and computes AR behavior", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        { client_name: "Acme", status: "sent", total: "125.50" },
        { client_name: "Acme", status: "paid", total: "25" },
        { client_name: "Beta", status: "draft", total: "50" },
      ],
    });

    const snapshot = await getStandaloneAccountingSnapshotForUser("user-1", { query } as any);

    expect(snapshot).toEqual({
      totalInvoiced: 200.5,
      totalPaid: 25,
      totalUnpaid: 175.5,
      clientCount: 2,
      largestOpenClient: { name: "Acme", amount: 125.5 },
    });
    const sql = normalizeSql(query.mock.calls[0][0]);
    expect(sql).toContain("created_by = $1 AND job_id IS NULL");
    expect(sql).toContain("left(payload->>'accountingGroupId', 5) = 'acct_'");
    expect(sql).toContain("permissions->>'lineageKind' = 'standalone_accounting'");
    expect(sql).not.toContain("job_id LIKE 'acct_%'");
    expect(query.mock.calls[0][1]).toEqual(["user-1"]);
  });

  it("queries only explicit null-FK standalone expenses and computes vendor behavior", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        { vendor_name: "Supply Co", total: "40" },
        { vendor_name: "Supply Co", total: "10.25" },
        { vendor_name: "Fuel Co", total: "15" },
      ],
    });

    const snapshot = await getStandaloneVendorSnapshotForUser("user-2", { query } as any);

    expect(snapshot).toEqual({
      totalExpenses: 65.25,
      vendorCount: 2,
      topVendor: { name: "Supply Co", amount: 50.25 },
    });
    const sql = normalizeSql(query.mock.calls[0][0]);
    expect(sql).toContain("created_by = $1 AND job_id IS NULL");
    expect(sql).toContain("left(payload->>'accountingGroupId', 5) = 'acct_'");
    expect(sql).toContain("permissions->>'lineageKind' = 'standalone_accounting'");
    expect(sql).not.toContain("job_id LIKE 'acct_%'");
    expect(query.mock.calls[0][1]).toEqual(["user-2"]);
  });
});
