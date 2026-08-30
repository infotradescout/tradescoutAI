import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Admin OS v2 core workspaces", () => {
  it("marks every migrated queue as a native v2 surface", () => {
    const surface = read("client/src/admin/AdminToolSurface.tsx");

    for (const toolId of [
      "overview",
      "tradepartner-ops",
      "direct-connect-requests",
      "verification",
      "business-verifications",
      "business-directory-ops",
      "listings",
      "errors",
    ]) {
      expect(surface).toContain(`"${toolId}"`);
    }
  });

  it("rebuilds Error Reports around one operating queue and preserves its writes", () => {
    const page = read("client/src/pages/admin-error-reports.tsx");

    expect(page).toContain("AdminWorkspace");
    expect(page).toContain("AdminSummaryStrip");
    expect(page).toContain("AdminToolbar");
    expect(page).toContain("AdminList");
    expect(page).toContain('data-testid="admin-error-reports-v2"');
    expect(page).toContain("Error queue");
    expect(page).toContain("Unresolved");
    expect(page).toContain("Critical");
    expect(page).toContain('apiRequest("GET", "/api/admin/error-reports")');
    expect(page).toContain('apiRequest("PATCH", `/api/admin/error-reports/${id}`, data)');
    expect(page).toContain("ReportDetailDialog");
    expect(page).not.toContain("<Card");
    expect(page).not.toContain("Manage bug reports and user feedback");
  });

  it("rebuilds Address and Identity and corrects the update-call contract", () => {
    const page = read("client/src/pages/admin-address-verifications.tsx");

    expect(page).toContain("AdminWorkspace");
    expect(page).toContain("AdminSummaryStrip");
    expect(page).toContain("AdminToolbar");
    expect(page).toContain("AdminList");
    expect(page).toContain('data-testid="admin-address-verifications-v2"');
    expect(page).toContain("Address and identity queue");
    expect(page).toContain("Overdue");
    expect(page).toContain(
      "/api/admin/address-verifications?status=${encodeURIComponent(statusFilter)}"
    );
    expect(page).toContain('apiRequest("PUT", `/api/admin/address-verifications/${id}`');
    expect(page).toContain("Save decision");
    expect(page).not.toContain("<Card");
    expect(page).not.toContain('apiRequest(`/api/admin/address-verifications/${id}`, "PUT"');
  });

  it("keeps business-verification decisions field-specific", () => {
    const page = read("client/src/pages/admin-profile-verifications.tsx");

    expect(page).toContain("AdminWorkspace");
    expect(page).toContain("AdminSummaryStrip");
    expect(page).toContain("AdminToolbar");
    expect(page).toContain("AdminList");
    expect(page).toContain('data-testid="admin-business-verifications-v2"');
    expect(page).toContain("Business verification queue");
    expect(page).toContain("Approve or reject each required field independently");
    expect(page).toContain("REQUIREMENT_FIELDS");
    expect(page).toMatch(/apiRequest\(\s*"GET",/);
    expect(page).toContain(
      "/api/admin/profile-verifications?status=${encodeURIComponent(statusFilter)}"
    );
    expect(page).toContain(
      'apiRequest("PUT", `/api/admin/profile-verifications/${args.profileId}`'
    );
    expect(page).toContain('decision: "approved"');
    expect(page).toContain('decision: "rejected"');
    expect(page).not.toContain("<Table");
    expect(page).not.toContain("<Card");
  });

  it("keeps Business Directory source, run, log, summary, and suggestion authority intact", () => {
    const page = read("client/src/pages/admin-business-directory-ops.tsx");

    expect(page).toContain("AdminWorkspace");
    expect(page).toContain("AdminWorkspaceSubnav");
    expect(page).toContain("AdminSummaryStrip");
    expect(page).toContain("AdminList");
    expect(page).toContain('data-testid="admin-business-directory-v2"');
    expect(page).toContain("Directory supply");
    expect(page).toContain("Suggested changes");
    expect(page).toContain("Pensacola and Escambia supply");
    expect(page).toContain("/api/admin/business-seeding/runs?limit=50");
    expect(page).toContain("/api/admin/business-seeding/places-textsearch/run");
    expect(page).toContain("/api/admin/business-directory/pensacola-liquidity/summary");
    expect(page).toContain("/api/admin/business-directory/suggestions?status=");
    expect(page).toContain(
      "/api/admin/business-directory/suggestions/${encodeURIComponent(id)}/status"
    );
    expect(page).toContain("Start seed run");
    expect(page).toContain("View logs");
    expect(page).toContain("Resolve");
    expect(page).toContain("Reject");
    expect(page).not.toContain("<Card");
    expect(page).not.toContain("Business Directory Ops");
  });

  it("rebuilds Marketplace Listings without changing approval endpoints", () => {
    const page = read("client/src/pages/admin-listings.tsx");

    expect(page).toContain("AdminWorkspace");
    expect(page).toContain("AdminSummaryStrip");
    expect(page).toContain("AdminToolbar");
    expect(page).toContain("AdminList");
    expect(page).toContain('data-testid="admin-marketplace-listings-v2"');
    expect(page).toContain("Marketplace approval queue");
    expect(page).toContain('apiRequest("GET", "/api/admin/marketplace/pending")');
    expect(page).toContain("/api/admin/marketplace/listings/${id}/approve");
    expect(page).toContain("/api/admin/marketplace/listings/${id}/reject");
    expect(page).toContain("Seller-facing rejection reason");
    expect(page).toContain("Approve listing");
    expect(page).toContain("Reject listing");
    expect(page).not.toContain("<Card");
    expect(page).not.toContain("Pending Listings Approval");
  });

  it("records the Selective Intelligence preservation boundary", () => {
    const evidence = read(".selective-intelligence/builds/admin-os-v2-core-workspaces/evidence.md");

    expect(evidence).toContain("Core queues must become native workspaces");
    expect(evidence).toContain("Error Reports");
    expect(evidence).toContain("Address & Identity");
    expect(evidence).toContain("Business Verification");
    expect(evidence).toContain("Business Directory");
    expect(evidence).toContain("Marketplace Listings");
    expect(evidence).toContain("does not change");
    expect(evidence).toContain("Desktop and mobile screenshots");
  });
});
