import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const routePath = path.resolve(process.cwd(), "server/routes/direct-connect.ts");
const servicePath = path.resolve(
  process.cwd(),
  "server/services/directConnectDispatchLedgerService.ts"
);

function read(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

describe("direct-connect invoice and receipt contract", () => {
  it("adds invoice endpoints with completion-confirmed gating", () => {
    const source = read(routePath);
    expect(source).toContain('"/api/direct-connect/jobs/:jobWorkspaceId/invoices"');
    expect(source).toContain('"/api/direct-connect/jobs/:jobWorkspaceId/invoices/:invoiceId"');
    expect(source).toContain('"/api/direct-connect/jobs/:jobWorkspaceId/invoices/:invoiceId/send"');
    expect(source).toContain(
      '"/api/direct-connect/jobs/:jobWorkspaceId/invoices/:invoiceId/respond"'
    );
    expect(source).toContain("Invoice creation requires confirmed completion.");
    expect(source).toContain("Invoice send requires confirmed completion.");
    expect(source).toContain('"invoice_started"');
    expect(source).toContain('"invoice_sent"');
    expect(source).toContain('"invoice_acknowledged"');
    expect(source).toContain('"invoice_disputed"');
    expect(source).toContain('"invoice_marked_paid_outside_platform"');
  });

  it("adds receipt record endpoints and keeps them as records, not processor payments", () => {
    const source = read(routePath);
    expect(source).toContain('"/api/direct-connect/jobs/:jobWorkspaceId/receipts"');
    expect(source).toContain('"/api/direct-connect/jobs/:jobWorkspaceId/receipts/:receiptId"');
    expect(source).toContain("Receipt records require confirmed completion.");
    expect(source).toContain("storesPaymentCredentials: false");
    expect(source).toContain('"receipt_uploaded"');
    expect(source).toContain('"payment_recorded"');
  });

  it("extends service schema/events/actions for invoices and receipts", () => {
    const source = read(servicePath);
    expect(source).toContain("CREATE TABLE IF NOT EXISTS job_invoice_line_items");
    expect(source).toContain("CREATE TABLE IF NOT EXISTS job_invoices");
    expect(source).toContain("CREATE TABLE IF NOT EXISTS job_receipts");
    expect(source).toContain('"invoice_started"');
    expect(source).toContain('"invoice_line_item_added"');
    expect(source).toContain('"invoice_sent"');
    expect(source).toContain('"invoice_acknowledged"');
    expect(source).toContain('"invoice_disputed"');
    expect(source).toContain('"invoice_marked_paid_outside_platform"');
    expect(source).toContain('"invoice_voided"');
    expect(source).toContain('"receipt_uploaded"');
    expect(source).toContain('"payment_recorded"');
    expect(source).toContain('"receipt_disputed"');
    expect(source).toContain('"receipt_voided"');
    expect(source).toContain('"create_invoice"');
    expect(source).toContain('"send_invoice"');
    expect(source).toContain('"view_invoice"');
    expect(source).toContain('"view_receipt"');
  });

  it("exposes invoice/receipt summary fields on requester and contractor surfaces", () => {
    const source = read(routePath);
    expect(source).toContain("latestInvoiceStatus");
    expect(source).toContain("invoiceCount");
    expect(source).toContain("activeInvoiceId");
    expect(source).toContain("latestReceiptStatus");
    expect(source).toContain("latestPaymentRecordStatus");
    expect(source).toContain("receiptCount");
  });

  it("does not add lead-selling or paid-placement language", () => {
    const source = read(routePath);
    expect(source.toLowerCase()).not.toContain("lead-selling");
    expect(source.toLowerCase()).not.toContain("buy lead");
    expect(source.toLowerCase()).not.toContain("boosted placement");
    expect(source.toLowerCase()).not.toContain("paid placement");
  });
});
