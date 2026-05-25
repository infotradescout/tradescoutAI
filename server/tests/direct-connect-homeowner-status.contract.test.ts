import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("direct connect homeowner status contracts", () => {
  it("supports homeowner list and detail endpoints", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain('"/api/direct-connect/requests"');
    expect(source).toContain('"/api/direct-connect/requests/:id"');
    expect(source).toContain("You can only view your own requests");
  });

  it("keeps contact release behind homeowner approval transitions", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("contractor_requested->user_approved");
    expect(source).toContain("user_approved->released");
    expect(source).toContain("contractor_requested->denied");
    expect(source).toContain("Invalid contact gate transition");
  });

  it("records homeowner visibility and approval audit events", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("homeowner_viewed_request");
    expect(source).toContain("homeowner_viewed_response");
    expect(source).toContain("contact_approved");
    expect(source).toContain("contact_denied");
    expect(source).toContain("contact_released");
    expect(source).toContain("request_closed");
  });

  it("shows homeowner status actions in my requests surface", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(source).toContain("Approve contact");
    expect(source).toContain("Decline contact");
    expect(source).toContain("Release contact");
    expect(source).toContain("/api/direct-connect/requests/${payload.requestId}/contact-gate");
  });

  it("does not add monetization-based routing language", () => {
    const source = read("server/routes/direct-connect.ts").toLowerCase();
    expect(source).not.toContain("buy lead");
    expect(source).not.toContain("boosted placement");
    expect(source).not.toContain("featured placement");
    expect(source).not.toContain("subscription priority");
  });
});
