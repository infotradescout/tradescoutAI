import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const routePath = path.resolve(process.cwd(), "server/routes/direct-connect/job-lifecycle.ts");
const rootRoutePath = path.resolve(process.cwd(), "server/routes/direct-connect.ts");

function readRoute() {
  return [rootRoutePath, routePath].map((filePath) => fs.readFileSync(filePath, "utf8")).join("\n");
}

describe("direct-connect estimate contract", () => {
  it("adds estimate endpoints under job workspaces", () => {
    const source = readRoute();
    expect(source).toContain('"/api/direct-connect/jobs/:jobWorkspaceId/estimates"');
    expect(source).toContain('"/api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId"');
    expect(source).toContain(
      '"/api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId/send"'
    );
    expect(source).toContain(
      '"/api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId/respond"'
    );
  });

  it("requires released contact before estimate creation", () => {
    const source = readRoute();
    expect(source).toContain("Estimate creation requires released contact.");
    expect(source).toContain("contact_gate_state");
  });

  it("keeps requester visibility safe by hiding draft estimates", () => {
    const source = readRoute();
    expect(source).toContain('if (isRequester && status === "draft")');
    expect(source).toContain("Estimate not available");
  });

  it("records estimate lifecycle events and transitions", () => {
    const source = readRoute();
    expect(source).toContain('eventType: "estimate_started"');
    expect(source).toContain('eventType: "estimate_line_item_added"');
    expect(source).toContain('eventType: "estimate_sent"');
    expect(source).toContain('eventType = "estimate_accepted"');
    expect(source).toContain('eventType = "estimate_change_requested"');
    expect(source).toContain('"estimate_declined"');
  });

  it("exposes estimate summary fields on requester and contractor detail surfaces", () => {
    const source = readRoute();
    expect(source).toContain("latestEstimateStatus");
    expect(source).toContain("estimateCount");
    expect(source).toContain("activeEstimateId");
  });

  it("does not introduce lead-selling language", () => {
    const source = readRoute().toLowerCase();
    expect(source).not.toContain("buy lead");
    expect(source).not.toContain("premium request");
    expect(source).not.toContain("boosted");
    expect(source).not.toContain("featured placement");
  });
});
