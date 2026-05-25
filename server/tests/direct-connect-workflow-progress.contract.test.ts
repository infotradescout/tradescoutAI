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

describe("direct-connect workflow progress contract", () => {
  it("adds explicit work start endpoint", () => {
    const source = read(routePath);
    expect(source).toContain('"/api/direct-connect/jobs/:jobWorkspaceId/start-work"');
    expect(source).toContain("Work start requires an accepted estimate.");
    expect(source).toContain('eventType: "work_started"');
  });

  it("adds checkpoint endpoints with requester response path", () => {
    const source = read(routePath);
    expect(source).toContain('"/api/direct-connect/jobs/:jobWorkspaceId/checkpoints"');
    expect(source).toContain(
      '"/api/direct-connect/jobs/:jobWorkspaceId/checkpoints/:checkpointId"'
    );
    expect(source).toContain(
      '"/api/direct-connect/jobs/:jobWorkspaceId/checkpoints/:checkpointId/respond"'
    );
    expect(source).toContain("Checkpoints require an accepted estimate.");
    expect(source).toContain('eventType: "checkpoint_created"');
    expect(source).toContain('eventType: "checkpoint_updated"');
    expect(source).toContain('eventType: "checkpoint_completed"');
    expect(source).toContain('"checkpoint_approved"');
    expect(source).toContain('"checkpoint_issue_reported"');
  });

  it("adds change-order endpoints with requester decision path", () => {
    const source = read(routePath);
    expect(source).toContain('"/api/direct-connect/jobs/:jobWorkspaceId/change-orders"');
    expect(source).toContain(
      '"/api/direct-connect/jobs/:jobWorkspaceId/change-orders/:changeOrderId"'
    );
    expect(source).toContain(
      '"/api/direct-connect/jobs/:jobWorkspaceId/change-orders/:changeOrderId/respond"'
    );
    expect(source).toContain("Change orders require an accepted estimate.");
    expect(source).toContain('eventType: "change_order_created"');
    expect(source).toContain('eventType: "change_order_sent"');
    expect(source).toContain('"change_order_approved"');
    expect(source).toContain('"change_order_declined"');
    expect(source).toContain('"change_order_change_requested"');
  });

  it("does not auto-start work from schedule or deposit", () => {
    const source = read(routePath);
    const scheduleRespondBlock = source.slice(
      source.indexOf(
        '"/api/direct-connect/jobs/:jobWorkspaceId/schedule-proposals/:scheduleProposalId/respond"'
      ),
      source.indexOf('"/api/direct-connect/jobs/:jobWorkspaceId/start-work"')
    );
    expect(scheduleRespondBlock).not.toContain("active_stage = 'in_progress'");

    const paymentRespondBlock = source.slice(
      source.indexOf(
        '"/api/direct-connect/jobs/:jobWorkspaceId/payment-requests/:paymentRequestId/respond"'
      ),
      source.indexOf('"/api/direct-connect/jobs/:jobWorkspaceId/schedule-proposals"')
    );
    expect(paymentRespondBlock).not.toContain("active_stage = 'in_progress'");
  });

  it("does not auto-create invoice records from work progress module", () => {
    const source = read(routePath);
    const progressBlock = source.slice(
      source.indexOf('"/api/direct-connect/jobs/:jobWorkspaceId/start-work"'),
      source.indexOf('"/api/direct-connect/assignments/:id/respond"')
    );
    expect(progressBlock).not.toContain("INSERT INTO job_invoices");
  });

  it("extends lifecycle actions and events for progress module", () => {
    const source = read(servicePath);
    expect(source).toContain('"start_work"');
    expect(source).toContain('"complete_checkpoint"');
    expect(source).toContain('"approve_checkpoint"');
    expect(source).toContain('"report_checkpoint_issue"');
    expect(source).toContain('"review_change_order"');
    expect(source).toContain('"decline_change_order"');
    expect(source).toContain('"request_change_order_changes"');
    expect(source).toContain('"change_order_sent"');
    expect(source).toContain('"checkpoint_issue_reported"');
  });

  it("exposes work/checkpoint/change-order summaries on requester and contractor surfaces", () => {
    const source = read(routePath);
    expect(source).toContain("latestWorkStatus");
    expect(source).toContain("checkpointCount");
    expect(source).toContain("openCheckpointCount");
    expect(source).toContain("latestCheckpointStatus");
    expect(source).toContain("changeOrderCount");
    expect(source).toContain("openChangeOrderCount");
    expect(source).toContain("latestChangeOrderStatus");
  });

  it("does not include lead-selling or paid placement language", () => {
    const source = `${read(routePath)}\n${read(servicePath)}`.toLowerCase();
    expect(source).not.toContain("lead selling");
    expect(source).not.toContain("buy lead");
    expect(source).not.toContain("featured placement");
    expect(source).not.toContain("boosted routing");
    expect(source).not.toContain("subscription advantage");
  });
});
