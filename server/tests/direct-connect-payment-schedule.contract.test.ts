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

describe("direct-connect payment and scheduling gate contract", () => {
  it("adds payment request and schedule proposal endpoints", () => {
    const source = read(routePath);
    expect(source).toContain('"/api/direct-connect/jobs/:jobWorkspaceId/payment-requests"');
    expect(source).toContain(
      '"/api/direct-connect/jobs/:jobWorkspaceId/payment-requests/:paymentRequestId/respond"'
    );
    expect(source).toContain('"/api/direct-connect/jobs/:jobWorkspaceId/schedule-proposals"');
    expect(source).toContain(
      '"/api/direct-connect/jobs/:jobWorkspaceId/schedule-proposals/:scheduleProposalId/respond"'
    );
  });

  it("gates payment and schedule operations on accepted estimate", () => {
    const source = read(routePath);
    expect(source).toContain("Payment requests require an accepted estimate.");
    expect(source).toContain("Schedule proposals require an accepted estimate.");
  });

  it("records lifecycle events for deposit and schedule transitions", () => {
    const source = read(routePath);
    expect(source).toContain('eventType: "deposit_requested"');
    expect(source).toContain('eventType = "deposit_paid_outside_platform"');
    expect(source).toContain('eventType = "deposit_waived"');
    expect(source).toContain('eventType: "schedule_proposed"');
    expect(source).toContain('eventType = "schedule_accepted"');
    expect(source).toContain('eventType = "schedule_change_requested"');
    expect(source).toContain('"schedule_declined"');
    expect(source).toContain('eventType: "job_scheduled"');
  });

  it("exposes payment and schedule summaries on requester and contractor details", () => {
    const source = read(routePath);
    expect(source).toContain("latestPaymentRequestStatus");
    expect(source).toContain("paymentRequestCount");
    expect(source).toContain("latestScheduleStatus");
    expect(source).toContain("scheduleProposalCount");
    expect(source).toContain("activeScheduleProposalId");
  });

  it("extends lifecycle service with payment/schedule states and actions", () => {
    const source = read(servicePath);
    expect(source).toContain('"deposit_acknowledged"');
    expect(source).toContain('"payment_request_canceled"');
    expect(source).toContain('"schedule_change_requested"');
    expect(source).toContain('"job_scheduled"');
    expect(source).toContain('"create_payment_request"');
    expect(source).toContain('"acknowledge_payment_request"');
    expect(source).toContain('"request_schedule_change"');
  });

  it("does not auto-create invoice records in payment/schedule gate", () => {
    const source = read(routePath);
    const paymentBlock = source.slice(
      source.indexOf('"/api/direct-connect/jobs/:jobWorkspaceId/payment-requests"'),
      source.indexOf('"/api/direct-connect/jobs/:jobWorkspaceId/schedule-proposals"')
    );
    expect(paymentBlock).not.toContain("INSERT INTO job_invoices");
    const scheduleBlock = source.slice(
      source.indexOf('"/api/direct-connect/jobs/:jobWorkspaceId/schedule-proposals"'),
      source.indexOf(
        '"/api/direct-connect/jobs/:jobWorkspaceId/schedule-proposals/:scheduleProposalId/respond"'
      ) + 500
    );
    expect(scheduleBlock).not.toContain("INSERT INTO job_invoices");
  });
});
