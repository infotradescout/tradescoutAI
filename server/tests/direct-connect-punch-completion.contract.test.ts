import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const routePath = path.resolve(process.cwd(), "server/routes/direct-connect/job-lifecycle.ts");
const rootRoutePath = path.resolve(process.cwd(), "server/routes/direct-connect.ts");
const completionRoutePath = path.resolve(
  process.cwd(),
  "server/routes/direct-connect/completion.ts"
);
const servicePath = path.resolve(
  process.cwd(),
  "server/services/directConnectDispatchLedgerService.ts"
);

function read(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

const readRouteSources = () =>
  [read(rootRoutePath), read(routePath), read(completionRoutePath)].join("\n");

describe("direct-connect punch list and completion gate contract", () => {
  it("adds ready-for-punchout endpoint and gating", () => {
    const source = readRouteSources();
    expect(source).toContain('"/api/direct-connect/jobs/:jobWorkspaceId/ready-for-punchout"');
    expect(source).toContain("Punchout requires an accepted estimate.");
    expect(source).toContain("Punchout requires work to be started.");
    expect(source).toContain('eventType: "punch_list_started"');
  });

  it("adds punch list item endpoints", () => {
    const source = readRouteSources();
    expect(source).toContain('"/api/direct-connect/jobs/:jobWorkspaceId/punch-list-items"');
    expect(source).toContain(
      '"/api/direct-connect/jobs/:jobWorkspaceId/punch-list-items/:punchItemId"'
    );
    expect(source).toContain(
      '"/api/direct-connect/jobs/:jobWorkspaceId/punch-list-items/:punchItemId/respond"'
    );
    expect(source).toContain("Punch list requires an accepted estimate.");
    expect(source).toContain('"punch_item_created"');
    expect(source).toContain('"punch_item_resolved"');
    expect(source).toContain('"punch_item_approved"');
    expect(source).toContain('"punch_item_rejected"');
    expect(source).toContain('"punch_item_waived"');
  });

  it("adds completion request endpoints with unresolved punch-item gate", () => {
    const source = readRouteSources();
    expect(source).toContain('"/api/direct-connect/jobs/:jobWorkspaceId/completion-request"');
    expect(source).toContain(
      '"/api/direct-connect/jobs/:jobWorkspaceId/completion-request/respond"'
    );
    expect(source).toContain("Completion request requires an accepted estimate.");
    expect(source).toContain("Completion request requires started work.");
    expect(source).toContain("Unresolved punch list items block completion.");
    expect(source).toContain('eventType: "completion_requested"');
    expect(source).toContain('"completion_confirmed"');
    expect(source).toContain('"completion_rejected"');
    expect(source).toContain('eventType: "job_completed"');
    expect(source).toContain("const completionDecision = await finalizeDirectConnectCompletion({");
  });

  it("does not auto-create invoice or receipt in punch/completion module", () => {
    const source = readRouteSources();
    const block = source.slice(
      source.indexOf('"/api/direct-connect/jobs/:jobWorkspaceId/ready-for-punchout"'),
      source.indexOf('"/api/direct-connect/jobs/:jobWorkspaceId/completion-request/respond"')
    );
    expect(block).not.toContain("INSERT INTO job_invoices");
    expect(block).not.toContain("INSERT INTO job_receipts");
  });

  it("extends lifecycle service for punch/completion states and actions", () => {
    const source = read(servicePath);
    expect(source).toContain('"punch_item_created"');
    expect(source).toContain('"punch_item_acknowledged"');
    expect(source).toContain('"punch_item_started"');
    expect(source).toContain('"punch_item_resolved"');
    expect(source).toContain('"punch_item_approved"');
    expect(source).toContain('"punch_item_rejected"');
    expect(source).toContain('"punch_item_waived"');
    expect(source).toContain('"completion_requested"');
    expect(source).toContain('"completion_confirmed"');
    expect(source).toContain('"completion_rejected"');
    expect(source).toContain('"create_punch_item"');
    expect(source).toContain('"request_completion"');
    expect(source).toContain('"confirm_completion"');
    expect(source).toContain('"reject_completion"');
  });

  it("exposes punch and completion summary fields on detail/list surfaces", () => {
    const source = readRouteSources();
    expect(source).toContain("latestPunchListStatus");
    expect(source).toContain("punchItemCount");
    expect(source).toContain("openPunchItemCount");
    expect(source).toContain("latestCompletionStatus");
    expect(source).toContain("activeCompletionRequestId");
    expect(source).toContain("completionBlockedReason");
  });
});
