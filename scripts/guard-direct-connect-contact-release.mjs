import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const routes = read("server/routes/direct-connect.ts");
const ledger = read("server/services/directConnectDispatchLedgerService.ts");
const messages = read("client/src/components/messages/MessagesPanel.tsx");
const integration = read("server/tests/direct-connect-gates.integration.test.ts");

const failures = [];
const requireText = (source, text, label) => {
  if (!source.includes(text)) failures.push(`${label}: missing ${JSON.stringify(text)}`);
};

const acceptanceStart = routes.indexOf('"/api/direct-connect/assignments/:id/respond"');
const acceptanceEnd = routes.indexOf(
  '"/api/direct-connect/requests/:id/express-interest"',
  acceptanceStart
);
const acceptance = routes.slice(acceptanceStart, acceptanceEnd);

requireText(acceptance, "db.transaction(async (tx) =>", "atomic acceptance");
requireText(acceptance, "await recordContractorResponse(", "atomic acceptance");
requireText(acceptance, "ledgerResponseType", "atomic acceptance");
requireText(acceptance, "tx\n          );", "atomic acceptance executor");
requireText(ledger, "inserted_response AS (", "response ledger");
requireText(ledger, "inserted_candidate AS (", "accepted-provider candidate");
requireText(ledger, "advanced_gate AS (", "contact request transition");
requireText(ledger, "AND contact_gate_state = 'locked'", "non-regressing contact request");
requireText(ledger, "pg_advisory_xact_lock", "idempotent workspace release");
requireText(ledger, "FOR UPDATE OF d", "serialized contact release");
requireText(ledger, "CONTACT_RELEASE_REQUIRES_ACCEPTED_PROVIDER", "provider-bound release");
requireText(ledger, "has_accepted_assignment DESC", "accepted provider preference");
requireText(ledger, "dispatch.contact_gate_state = 'released'", "released-only contact");
requireText(ledger, "response.id = workspace.contractor_response_id", "response binding");
requireText(ledger, "candidate.eligibility_state = 'eligible'", "eligibility binding");
requireText(routes, "homeownerContact: releasedContact", "conditional provider detail");
requireText(routes, "contactGateState: String(accepted.contact_gate_state", "Messages gate state");
requireText(messages, 'data-testid="direct-connect-released-contact"', "Messages contact panel");
requireText(messages, "Contact stays private until the homeowner explicitly approves", "privacy copy");
requireText(integration, "wrongResponse.status).toBe(404)", "wrong-provider proof");
requireText(integration, "preReleaseDetail.body?.homeownerContact).toBeNull()", "pre-release proof");
requireText(integration, "approvalRes.body?.contactGateState).toBe(\"user_approved\")", "approval proof");
requireText(integration, "workspaceResult.rows).toHaveLength(1)", "idempotency proof");
requireText(integration, "releasedMessageJob.body?.releasedContact?.email", "post-release proof");

if (failures.length) {
  console.error("Direct Connect contact-release guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Direct Connect contact-release guard passed (22 authority and golden-path checks).");
