import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const route = read("server/routes/direct-connect.ts");
const completion = read("server/routes/direct-connect/completion.ts");
const lifecycle = read("server/routes/direct-connect/job-lifecycle.ts");
const integration = read("server/tests/direct-connect-gates.integration.test.ts");

const failures = [];
const requireText = (source, value, label) => {
  if (!source.includes(value)) failures.push(`${label}: missing ${JSON.stringify(value)}`);
};
const requireAbsent = (source, value, label) => {
  if (source.includes(value)) failures.push(`${label}: forbidden ${JSON.stringify(value)}`);
};
const requireOrder = (source, anchors, label) => {
  let cursor = -1;
  for (const anchor of anchors) {
    const next = source.indexOf(anchor, cursor + 1);
    if (next < 0) {
      failures.push(`${label}: missing or out-of-order ${JSON.stringify(anchor)}`);
      return;
    }
    cursor = next;
  }
};

requireText(route, "registerDirectConnectCompletionRoute(app, {", "route registration");
requireText(route, "finalizeDirectConnectCompletion: (args: any) =>", "lifecycle injection");
requireText(completion, '"/api/direct-connect/requests/:id/complete"', "completion endpoint");
requireText(
  completion,
  "export async function finalizeDirectConnectCompletion",
  "canonical finalizer"
);
requireText(completion, "FOR UPDATE", "serialized completion");
requireText(completion, "You can only complete your own requests", "requester ownership");
requireText(completion, 'String(requestRow.source || "") !== "direct_connect"', "canonical source");
requireText(completion, 'currentStatus === "completed"', "idempotent replay");
requireText(completion, 'currentStatus !== "in_progress"', "lifecycle gate");
requireText(completion, 'contactGateState !== "released"', "contact release gate");
requireText(completion, "assignment.status = 'accepted'", "accepted assignment");
requireText(completion, "contractor.user_id = ${providerUserId}", "contractor ownership");
requireOrder(
  completion,
  [
    "FROM job_completion_requests",
    "UPDATE job_completion_requests",
    ".update(workRequests)",
    "UPDATE direct_connect_job_workspaces",
  ],
  "atomic completion convergence"
);
requireText(completion, "confirmationUpdatedNow", "confirmation replay state");
requireText(completion, "recordTrustLedgerEvent({", "trust outcome");
requireText(completion, "recordOutcomeEvent(outcomeEvent)", "confidence outcome");
requireText(completion, 'eventType: "job_completed"', "dispatch outcome");
requireText(completion, "appendHomeIdCompletedWorkEnrichmentFromDirectConnect", "HomeID outcome");
requireText(
  lifecycle,
  "const completionDecision = await finalizeDirectConnectCompletion({",
  "lifecycle delegation"
);
requireText(lifecycle, "idempotencyReplayed: !completionDecision.completedNow", "lifecycle retry");
requireText(lifecycle, "const rejectionResult = await db.execute", "rejection compare-and-set");
requireAbsent(lifecycle, "SET active_stage = 'completed'", "workspace-only completion");
requireAbsent(lifecycle, 'eventType: "job_completed"', "duplicate job-completed event");
requireText(integration, "providerCompleteAttempt.status).toBe(403)", "wrong-actor proof");
requireText(integration, "repeatCompleteRes.body?.idempotencyReplayed).toBe(true)", "retry proof");
requireText(integration, "trustCompletion.rows?.[0]", "trust persistence proof");
requireText(integration, "homeCompletion.rows).toHaveLength(2)", "HomeID persistence proof");

if (failures.length) {
  console.error("Direct Connect completion guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Direct Connect completion guard passed (27 closure and convergence checks).");
