import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const route = read("server/routes/direct-connect.ts");
const completion = read("server/routes/direct-connect/completion.ts");
const integration = read("server/tests/direct-connect-gates.integration.test.ts");

const failures = [];
const requireText = (source, value, label) => {
  if (!source.includes(value)) failures.push(`${label}: missing ${JSON.stringify(value)}`);
};

requireText(route, "registerDirectConnectCompletionRoute(app, {", "route registration");
requireText(completion, '"/api/direct-connect/requests/:id/complete"', "completion endpoint");
requireText(completion, "FOR UPDATE", "serialized completion");
requireText(completion, "You can only complete your own requests", "requester ownership");
requireText(completion, 'String(requestRow.source || "") !== "direct_connect"', "canonical source");
requireText(completion, 'currentStatus === "completed"', "idempotent replay");
requireText(completion, 'currentStatus !== "in_progress"', "lifecycle gate");
requireText(completion, 'contactGateState !== "released"', "contact release gate");
requireText(completion, "!providerUserId", "provider binding");
requireText(completion, "assignment.status = 'accepted'", "accepted assignment");
requireText(completion, "contractor.user_id = ${providerUserId}", "contractor ownership");
requireText(completion, ".update(workRequests)", "request completion");
requireText(completion, "SET status = 'completed', active_stage = 'completed'", "workspace completion");
requireText(completion, "recordTrustLedgerEvent({", "trust outcome");
requireText(completion, 'eventType: "job_completed"', "dispatch outcome");
requireText(completion, "appendHomeIdCompletedWorkEnrichmentFromDirectConnect", "HomeID outcome");
requireText(integration, "providerCompleteAttempt.status).toBe(403)", "wrong-actor proof");
requireText(integration, "repeatCompleteRes.body?.idempotencyReplayed).toBe(true)", "retry proof");
requireText(integration, "trustCompletion.rows?.[0]", "trust persistence proof");
requireText(integration, "homeCompletion.rows).toHaveLength(2)", "HomeID persistence proof");

if (failures.length) {
  console.error("Direct Connect completion guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Direct Connect completion guard passed (20 closure and outcome checks).");
