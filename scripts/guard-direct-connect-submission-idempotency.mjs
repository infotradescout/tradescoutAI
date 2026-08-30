import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const route = read("server/routes/direct-connect.ts");
const service = read("server/services/directConnectSubmissionIdempotencyService.ts");
const shell = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
const integration = read("server/tests/direct-connect-gates.integration.test.ts");

const failures = [];
const requireText = (source, text, label) => {
  if (!source.includes(text)) failures.push(`${label}: missing ${JSON.stringify(text)}`);
};

requireText(service, "PRIMARY KEY (owner_user_id, submission_key)", "owner/key uniqueness");
requireText(service, "UNIQUE (request_id)", "request uniqueness");
requireText(service, "pg_advisory_xact_lock", "concurrent replay lock");
requireText(service, "return db.transaction(async (tx: any) =>", "atomic claim");
requireText(service, ".insert(workRequests)", "atomic request insert");
requireText(service, "DIRECT_CONNECT_IDEMPOTENCY_CONFLICT", "payload conflict");
requireText(service, "replayed: true", "exact replay");
requireText(route, "submissionKey:", "request schema");
requireText(route, "hashDirectConnectSubmissionPayload", "canonical payload hash");
requireText(route, "idempotencyReplayed: true", "replay response");
requireText(shell, "createDirectConnectSubmissionKey", "client key");
requireText(shell, "setSubmissionKey(parsed.submissionKey)", "draft key hydration");
requireText(shell, "persistDirectConnectDraft({", "failed draft persistence");
requireText(integration, "replayRes.status).toBe(200)", "replay proof");
requireText(integration, "conflictRes.status).toBe(409)", "conflict proof");
requireText(integration, "expect(duplicates).toHaveLength(1)", "single request proof");

if (failures.length) {
  console.error("Direct Connect submission-idempotency guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Direct Connect submission-idempotency guard passed (16 checks).");
