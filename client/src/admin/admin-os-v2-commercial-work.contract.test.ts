import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("Admin OS v2 commercial work", () => {
  it("registers commercial work as a native Admin OS surface", () => {
    const source = read("client/src/admin/AdminToolSurface.tsx");
    expect(source).toContain('"commercial-directory"');
  });

  it("uses one native workspace with four operating lanes", () => {
    const source = read("client/src/pages/admin-commercial-directory.tsx");

    expect(source).toContain('AdminWorkspace data-testid="admin-commercial-work-v2"');
    expect(source).toContain("Projects");
    expect(source).toContain("Bid Review");
    expect(source).toContain("Verification");
    expect(source).toContain("New Project");
    expect(source).not.toContain("<Card");
    expect(source).not.toContain("Compact list mode");
  });

  it("preserves project, detail, bid, and verification read authority", () => {
    const source = read("client/src/pages/admin-commercial-directory.tsx");

    expect(source).toContain('"GET", "/api/admin/commercial-directory/projects"');
    expect(source).toMatch(
      /apiRequest\(\s*"GET",\s*"\/api\/admin\/commercial-directory\/verification\/pending"\s*\)/
    );
    expect(source).toContain("/api/commercial-directory/projects/${selectedProjectId}");
    expect(source).toContain("/api/admin/commercial-directory/projects/${selectedProjectId}/bids");
  });

  it("preserves project creation, control, document, bid, and verification writes", () => {
    const source = read("client/src/pages/admin-commercial-directory.tsx");

    expect(source).toContain('fetch("/api/admin/commercial-directory/projects"');
    expect(source).toContain('method: "POST"');
    expect(source).toContain("/api/admin/commercial-directory/projects/${selectedProjectId}");
    expect(source).toContain("/api/admin/commercial-directory/projects/${selectedProjectId}/documents");
    expect(source).toContain(
      "/api/admin/commercial-directory/projects/${selectedProjectId}/bids/${bidId}"
    );
    expect(source).toContain(
      "/api/admin/commercial-directory/verification/documents/${documentId}/review"
    );
  });

  it("keeps eligibility blocking shortlist and award", () => {
    const source = read("client/src/pages/admin-commercial-directory.tsx");

    expect(source).toContain("Ineligible for shortlist or award");
    expect(source).toContain('action: "shortlist"');
    expect(source).toContain('action: "accept"');
    expect(source).toContain("row.eligibility?.isEligible === false");
    expect(source).toContain("License verification missing");
    expect(source).toContain("Insurance verification missing");
  });

  it("limits verification keyboard shortcuts to the verification lane", () => {
    const source = read("client/src/pages/admin-commercial-directory.tsx");

    expect(source).toContain('activeTab !== "verification"');
    expect(source).toContain('key !== "a" && key !== "r"');
    expect(source).toContain('approved: key === "a"');
  });
});
