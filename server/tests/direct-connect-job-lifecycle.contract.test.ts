import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("direct connect job lifecycle foundation contracts", () => {
  it("creates a job workspace only after contact release", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain('nextState === "released"');
    expect(source).toContain("createOrGetJobWorkspaceAtContactRelease");
    expect(source).toContain('eventType: "job_workspace_created"');
  });

  it("does not auto-create estimates, invoices, or payment records at contact release", () => {
    const source = read("server/routes/direct-connect.ts");
    const releaseBlockStart = source.indexOf('nextState === "released"');
    const releaseBlock =
      releaseBlockStart >= 0 ? source.slice(releaseBlockStart, releaseBlockStart + 5000) : source;
    expect(releaseBlock).not.toContain("INSERT INTO job_estimates");
    expect(releaseBlock).not.toContain("INSERT INTO job_invoices");
    expect(releaseBlock).not.toContain("INSERT INTO job_payment_requests");
    expect(releaseBlock).not.toContain("INSERT INTO job_payment_records");
  });

  it("defines optional lifecycle module tables", () => {
    const source = read("server/services/directConnectDispatchLedgerService.ts");
    expect(source).toContain("CREATE TABLE IF NOT EXISTS direct_connect_job_workspaces");
    expect(source).toContain("CREATE TABLE IF NOT EXISTS job_estimates");
    expect(source).toContain("CREATE TABLE IF NOT EXISTS job_estimate_line_items");
    expect(source).toContain("CREATE TABLE IF NOT EXISTS job_material_items");
    expect(source).toContain("CREATE TABLE IF NOT EXISTS job_labor_items");
    expect(source).toContain("CREATE TABLE IF NOT EXISTS job_acceptances");
    expect(source).toContain("CREATE TABLE IF NOT EXISTS job_payment_requests");
    expect(source).toContain("CREATE TABLE IF NOT EXISTS job_payment_records");
    expect(source).toContain("CREATE TABLE IF NOT EXISTS job_checkpoints");
    expect(source).toContain("CREATE TABLE IF NOT EXISTS job_change_orders");
    expect(source).toContain("CREATE TABLE IF NOT EXISTS job_punch_list_items");
    expect(source).toContain("CREATE TABLE IF NOT EXISTS job_invoices");
    expect(source).toContain("CREATE TABLE IF NOT EXISTS job_receipts");
  });

  it("exposes active stage and allowed lifecycle actions in request detail", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("jobWorkspaceId");
    expect(source).toContain("activeStage");
    expect(source).toContain("allowedLifecycleActions");
    expect(source).toContain("latestJobStatus");
  });

  it("defines stage-gated lifecycle actions for requester and contractor", () => {
    const source = read("server/services/directConnectDispatchLedgerService.ts");
    expect(source).toContain("create_estimate");
    expect(source).toContain("send_estimate");
    expect(source).toContain("accept_estimate");
    expect(source).toContain("request_deposit");
    expect(source).toContain("create_checkpoint");
    expect(source).toContain("create_change_order");
    expect(source).toContain("add_punch_list_item");
    expect(source).toContain("send_final_invoice");
  });
});
