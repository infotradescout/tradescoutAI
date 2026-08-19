import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("Admin OS v2 Finance Ledger", () => {
  it("registers finance as a native Admin OS surface", () => {
    const source = read("client/src/admin/AdminToolSurface.tsx");
    expect(source).toContain('"finance"');
  });

  it("uses one native read-only ledger workspace", () => {
    const source = read("client/src/components/admin/FinanceLedgerPanel.tsx");

    expect(source).toContain('AdminWorkspace data-testid="admin-finance-ledger-v2"');
    expect(source).toContain("AdminSummaryStrip");
    expect(source).toContain("Transaction evidence");
    expect(source).toContain("Credits minus debits in this filtered window");
    expect(source).not.toContain("<Card");
    expect(source).not.toContain("<Table");
  });

  it("preserves the existing finance ledger read authority and server filters", () => {
    const source = read("client/src/components/admin/FinanceLedgerPanel.tsx");

    expect(source).toContain("/api/admin/finance/ledger?");
    expect(source).toContain('params.set("limit", "200")');
    expect(source).toContain('params.set("from", from)');
    expect(source).toContain('params.set("to", to)');
    expect(source).toContain('params.set("direction", direction)');
    expect(source).toContain('params.set("transactionType", typeFilter.trim())');
  });

  it("keeps the ledger read-only", () => {
    const source = read("client/src/components/admin/FinanceLedgerPanel.tsx");

    expect(source).not.toContain('apiRequest("POST"');
    expect(source).not.toContain('apiRequest("PUT"');
    expect(source).not.toContain('apiRequest("PATCH"');
    expect(source).not.toContain('apiRequest("DELETE"');
  });

  it("keeps movement separate from bank balance or recognized revenue", () => {
    const source = read("client/src/components/admin/FinanceLedgerPanel.tsx");

    expect(source).toContain("it is not a bank balance or recognized revenue statement");
    expect(source).toContain("Positive net change means more credits than debits");
    expect(source).toContain("No missing movement was represented as zero");
  });

  it("keeps Vault Contributions as a separate finance workspace", () => {
    const source = read("client/src/components/admin/FinanceLedgerPanel.tsx");
    expect(source).toContain('href="/admin/vault-contributions"');
  });
});
