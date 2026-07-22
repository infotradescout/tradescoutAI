import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("business operations dashboard restoration", () => {
  it("uses owner-scoped operating records instead of demo totals", () => {
    const source = read("client/src/pages/business-owner-dashboard.tsx");

    expect(source).toContain('apiRequest("GET", "/api/profiles")');
    expect(source).toContain('apiRequest("GET", "/api/profile-booking/requests/incoming")');
    expect(source).toContain('apiRequest("GET", "/api/direct-connect/inbox")');
    expect(source).toContain('apiRequest("GET", "/api/accounting/job-flows")');
    expect(source).toContain('apiRequest("GET", "/api/accounting/reports/summary")');
    expect(source).toContain("Nothing here is");
    expect(source).toContain("estimated or demo data.");
    expect(source).toContain("accountingQuery.data?.sourceAvailable === false");

    expect(source).not.toContain("Monthly Revenue");
    expect(source).not.toContain("Team Members");
    expect(source).not.toContain("Growth Rate");
    expect(source).not.toContain("$45,250");
  });

  it("labels an unavailable accounting source instead of turning it into a real zero", () => {
    const serverSource = read("server/invoicingDocumentsRouter.ts");

    expect(serverSource).toContain("sourceAvailable: false");
    expect(serverSource).toContain('req.path === "/api/accounting/reports/summary"');
  });

  it("owns profile, booking, client, job, estimate, invoice, and message continuation", () => {
    const source = read("client/src/pages/business-owner-dashboard.tsx");

    expect(source).toContain("const profileHref = profileIsPublished");
    expect(source).toContain("`/u/${encodeURIComponent(primaryProfile!.slug!)}`");
    expect(source).toContain("`/u/${encodeURIComponent(primaryProfile.slug)}/edit`");
    expect(source).toContain('href: "/direct-connect/inbox"');
    expect(source).toContain('href: "/messages"');
    expect(source).toContain('href: "/finances/clients"');
    expect(source).toContain('href: "/finances/jobs"');
    expect(source).toContain('href: "/finances/estimates"');
    expect(source).toContain('href: "/finances/invoices"');
    expect(source).toContain('href: "/finances/records"');
    expect(source).toContain('href: "/offer-services"');
    expect(source).not.toContain('href: "/crm"');
  });

  it("lets the owner advance real incoming booking state", () => {
    const source = read("client/src/pages/business-owner-dashboard.tsx");

    expect(source).toContain("`/api/profile-booking/requests/${encodeURIComponent(id)}/status`");
    expect(source).toContain('status: "accepted"');
    expect(source).toContain('status: "declined"');
    expect(source).toContain('status: "completed"');
  });
});
