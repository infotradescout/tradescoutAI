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
    expect(source).toContain("type IN ('ESTIMATE', 'CONTRACT', 'INVOICE', 'RECEIPT', 'EXPENSE')");
    expect(source).toContain("res.json({ jobs: flows });");
  });

  it("finance job and estimate pages consume the canonical job-flow endpoint", () => {
    const jobsPage = read("client/src/pages/finances-jobs.tsx");
    const estimatesPage = read("client/src/pages/finances-estimates.tsx");

    expect(jobsPage).toContain('queryKey: ["/api/accounting/job-flows"]');
    expect(jobsPage).toContain("stageLabelMap");
    expect(estimatesPage).toContain('queryKey: ["/api/accounting/job-flows"]');
    expect(estimatesPage).toContain("Estimate pipeline");
  });

  it("supports linking standalone invoices and expenses to an existing accounting job", () => {
    const serverSource = read("server/invoicingDocumentsRouter.ts");
    const invoicesPage = read("client/src/pages/finances-invoices.tsx");
    const expensesPage = read("client/src/pages/finances-expenses.tsx");

    expect(serverSource).toContain("const requestedJobId =");
    expect(serverSource).toContain("jobId must use acct_ prefix");
    expect(serverSource).toContain("jobId must reference an existing accounting job");
    expect(invoicesPage).toContain("jobId: linkedJobId.trim() || undefined");
    expect(expensesPage).toContain("jobId: linkedJobId.trim() || undefined");
    expect(invoicesPage).toContain("Link existing job ID (optional)");
    expect(expensesPage).toContain("Link existing job ID (optional)");
  });
});
