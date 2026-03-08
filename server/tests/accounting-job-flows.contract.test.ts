import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("accounting job flow contracts", () => {
  it("exposes a canonical accounting job-flow endpoint", () => {
    const source = read("server/invoicingDocumentsRouter.ts");

    expect(source).toContain('"/api/accounting/job-flows"');
    expect(source).toContain("resolveJobFlowStage");
    expect(source).toContain(
      "type IN ('ESTIMATE', 'CONTRACT', 'INVOICE', 'RECEIPT', 'EXPENSE', 'BILL', 'PURCHASE_ORDER', 'CREDIT_NOTE', 'PAYMENT', 'JOURNAL_ENTRY')"
    );
    expect(source).toContain("res.json({ jobs: flows });");
  });

  it("finance job and estimate pages consume the canonical job-flow endpoint", () => {
    const jobsPage = read("client/src/pages/finances-jobs.tsx");
    const estimatesPage = read("client/src/pages/finances-estimates.tsx");

    expect(jobsPage).toContain('queryKey: ["/api/accounting/job-flows"]');
    expect(jobsPage).toContain("stageLabelMap");
    expect(estimatesPage).toContain('queryKey: ["/api/accounting/job-flows"]');
    expect(estimatesPage).toContain("Estimate pipeline");
    expect(jobsPage).not.toContain("/deal-room/");
    expect(estimatesPage).not.toContain("/deal-room/");
  });

  it("supports linking standalone invoices and expenses to an existing accounting job", () => {
    const serverSource = read("server/invoicingDocumentsRouter.ts");
    const invoicesPage = read("client/src/pages/finances-invoices.tsx");
    const expensesPage = read("client/src/pages/finances-expenses.tsx");

    expect(serverSource).toContain("const requestedJobId =");
    expect(serverSource).toContain("INVALID_ACCOUNTING_JOB_ID");
    expect(serverSource).toContain("ACCOUNTING_JOB_NOT_FOUND");
    expect(invoicesPage).toContain("jobId: linkedJobId.trim() || undefined");
    expect(expensesPage).toContain("jobId: linkedJobId.trim() || undefined");
    expect(invoicesPage).toContain("Link existing job ID (optional)");
    expect(expensesPage).toContain("Link existing job ID (optional)");
  });

  it("supports finance-native estimate and contract creation", () => {
    const serverSource = read("server/invoicingDocumentsRouter.ts");
    const estimatesPage = read("client/src/pages/finances-estimates.tsx");

    expect(serverSource).toContain('"/api/accounting/standalone-estimate"');
    expect(serverSource).toContain('"/api/accounting/standalone-contract"');
    expect(serverSource).toContain("INVALID_ESTIMATE_TOTAL");
    expect(serverSource).toContain("INVALID_CONTRACT_TOTAL");
    expect(estimatesPage).toContain("Create estimate");
    expect(estimatesPage).toContain("Create contract draft");
    expect(estimatesPage).toContain('fetch("/api/accounting/standalone-estimate"');
    expect(estimatesPage).toContain('fetch("/api/accounting/standalone-contract"');
  });

  it("supports finance-native standalone receipt creation", () => {
    const serverSource = read("server/invoicingDocumentsRouter.ts");
    const invoicesPage = read("client/src/pages/finances-invoices.tsx");

    expect(serverSource).toContain('"/api/accounting/standalone-receipt"');
    expect(serverSource).toContain("INVALID_RECEIPT_TOTAL");
    expect(invoicesPage).toContain("Standalone receipt record");
    expect(invoicesPage).toContain('fetch("/api/accounting/standalone-receipt"');
  });

  it("supports additional bookkeeping record types beyond the core lifecycle", () => {
    const serverSource = read("server/invoicingDocumentsRouter.ts");
    const invoicesPage = read("client/src/pages/finances-invoices.tsx");
    const reportsPage = read("client/src/pages/finances-reports.tsx");

    expect(serverSource).toContain('"/api/accounting/standalone-record"');
    expect(serverSource).toContain('"/api/accounting/records"');
    expect(serverSource).toContain("UNSUPPORTED_ACCOUNTING_RECORD_TYPE");
    expect(serverSource).toContain("BILL");
    expect(serverSource).toContain("PURCHASE_ORDER");
    expect(serverSource).toContain("CREDIT_NOTE");
    expect(serverSource).toContain("PAYMENT");
    expect(serverSource).toContain("JOURNAL_ENTRY");
    expect(invoicesPage).toContain("Other bookkeeping records");
    expect(invoicesPage).toContain('fetch("/api/accounting/standalone-record"');
    expect(reportsPage).toContain("fetch(`/api/accounting/records?${params.toString()}`");
  });

  it("exposes a dedicated finances records ledger route", () => {
    const routesSource = read("client/src/AppRoutes.tsx");
    const recordsPage = read("client/src/pages/finances-records.tsx");

    expect(routesSource).toContain(
      'const FinancesRecords = React.lazy(() => import("./pages/finances-records"));'
    );
    expect(routesSource).toContain('<Route path="/finances/records">');
    expect(recordsPage).toContain("fetch(`/api/accounting/records?${params.toString()}`");
    expect(recordsPage).toContain('fetch("/api/accounting/standalone-record"');
  });
});
