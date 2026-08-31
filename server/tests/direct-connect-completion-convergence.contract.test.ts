import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const registrarSource = read("server/routes/direct-connect.ts");
const completionSource = read("server/routes/direct-connect/completion.ts");
const lifecycleSource = read("server/routes/direct-connect/job-lifecycle.ts");

describe("Direct Connect completion convergence", () => {
  it("injects one completion finalizer into both requester completion surfaces", () => {
    expect(registrarSource).toContain("finalizeDirectConnectCompletion,");
    expect(registrarSource).toContain("finalizeDirectConnectCompletion: (args: any) =>");
    expect(completionSource).toContain("export async function finalizeDirectConnectCompletion");
    expect(completionSource).toContain("const decision = await finalizeDirectConnectCompletion({");
    expect(lifecycleSource).toContain(
      "const completionDecision = await finalizeDirectConnectCompletion({"
    );
  });

  it("confirms the completion request in the same transaction as canonical closure", () => {
    const lockIndex = completionSource.indexOf("FROM job_completion_requests");
    const confirmationIndex = completionSource.indexOf("UPDATE job_completion_requests");
    const requestIndex = completionSource.indexOf(".update(workRequests)");
    const workspaceIndex = completionSource.indexOf("UPDATE direct_connect_job_workspaces");
    expect(lockIndex).toBeGreaterThan(-1);
    expect(confirmationIndex).toBeGreaterThan(lockIndex);
    expect(requestIndex).toBeGreaterThan(confirmationIndex);
    expect(workspaceIndex).toBeGreaterThan(requestIndex);
    expect(completionSource).toContain("FOR UPDATE");
  });

  it("removes the lifecycle route's weaker workspace-only completion path", () => {
    expect(lifecycleSource).not.toContain("SET active_stage = 'completed'");
    expect(lifecycleSource).not.toContain('eventType: "job_completed"');
    expect(lifecycleSource).not.toContain("appendHomeIdCompletedWorkEnrichmentFromDirectConnect({");
  });

  it("keeps replay, trust, outcome, dispatch, and HomeID effects behind the finalizer", () => {
    expect(completionSource).toContain('currentStatus === "completed"');
    expect(completionSource).toContain("recordTrustLedgerEvent({");
    expect(completionSource).toContain("recordOutcomeEvent(outcomeEvent)");
    expect(completionSource).toContain('eventType: "job_completed"');
    expect(completionSource).toContain("appendHomeIdCompletedWorkEnrichmentFromDirectConnect({");
    expect(lifecycleSource).toContain("idempotencyReplayed: !completionDecision.completedNow");
    expect(lifecycleSource).toContain("const rejectionResult = await db.execute");
    expect(lifecycleSource).toContain("RETURNING id");
  });
});
