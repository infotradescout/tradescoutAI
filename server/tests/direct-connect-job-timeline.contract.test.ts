import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const routePath = path.resolve(process.cwd(), "server/routes/direct-connect.ts");

function read(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

describe("direct-connect job timeline contract", () => {
  it("adds requester and job timeline endpoints", () => {
    const source = read(routePath);
    expect(source).toContain('"/api/direct-connect/requests/:id/timeline"');
    expect(source).toContain('"/api/direct-connect/jobs/:jobWorkspaceId/timeline"');
  });

  it("maps timeline phases and includes expected lifecycle categories", () => {
    const source = read(routePath);
    expect(source).toContain("mapEventTypeToPhase");
    expect(source).toContain('"request"');
    expect(source).toContain('"contact"');
    expect(source).toContain('"estimate"');
    expect(source).toContain('"work"');
    expect(source).toContain('"completion"');
    expect(source).toContain('"invoice"');
    expect(source).toContain('"receipt"');
  });

  it("adds readable summary fields for requester and business surfaces", () => {
    const source = read(routePath);
    expect(source).toContain("currentPhase");
    expect(source).toContain("nextActionForRequester");
    expect(source).toContain("nextActionForBusiness");
    expect(source).toContain("timelinePreview");
    expect(source).toContain("latestTimelineItem");
    expect(source).toContain("trustOutcomeStatus");
    expect(source).toContain("financialStatus");
    expect(source).toContain("completionStatus");
  });

  it("defines trust summary labels", () => {
    const source = read(routePath);
    expect(source).toContain("completed_cleanly");
    expect(source).toContain("completed_with_records_pending");
    expect(source).toContain("completion_disputed");
    expect(source).toContain("invoice_disputed");
    expect(source).toContain("punch_items_unresolved");
    expect(source).toContain("job_closed_without_completion");
    expect(source).toContain("in_progress");
  });

  it("keeps trust-safe output language", () => {
    const source = read(routePath).toLowerCase();
    expect(source).not.toContain("buy lead");
    expect(source).not.toContain("paid placement");
    expect(source).not.toContain("boosted placement");
  });
});
