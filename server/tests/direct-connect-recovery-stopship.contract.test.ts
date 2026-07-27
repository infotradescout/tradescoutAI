import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

function between(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("Direct Connect recovery stop-ship contracts", () => {
  const routes = read("server/routes/direct-connect.ts");
  const ledger = read("server/services/directConnectDispatchLedgerService.ts");
  const dashboard = read("client/src/pages/contractor-dashboard.tsx");
  const exactBindingMigration = read("migrations/0114_direct_connect_contact_gate_binding.sql");

  it("normalizes the raw work request owner before acceptance side effects", () => {
    const respond = between(
      routes,
      '"/api/direct-connect/assignments/:id/respond"',
      '"/api/direct-connect/requests/:id/express-interest"'
    );
    expect(respond).toContain('requestRow.createdByUserId ?? requestRow.created_by_user_id ?? ""');
    expect(respond).toContain('throw new Error("DIRECT_CONNECT_REQUEST_OWNER_REQUIRED")');
    expect(respond).toContain("const homeownerId = requestOwnerUserId");
    expect(respond).toContain("requesterUserId: requestOwnerUserId");
    expect(respond).toContain("userId: requestOwnerUserId");
    expect(respond).not.toContain("String(requestRow.createdByUserId)");
  });

  it("does not append a request_closed dispatch event while reopening", () => {
    const reopen = between(
      routes,
      '"/api/direct-connect/requests/:id/reopen"',
      '"/api/direct-connect/requests/:id/mark-pending-outcome"'
    );
    expect(reopen).toContain('fromStatus: "cancelled"');
    expect(reopen).toContain('toStatus: "open"');
    expect(reopen).toContain('eventType: "direct_connect_reopened"');
    expect(reopen).not.toContain('eventType: "request_closed"');
  });

  it("binds contractor dashboard responses to persisted exact assignments", () => {
    expect(routes).toContain("const assignmentByRequestId = new Map<string, any>()");
    expect(routes).toContain('safeSelectRows("exact routed assignments"');
    expect(routes).toContain("if (!exactAssignment) continue");
    expect(routes).toContain("assignmentId: String(exactAssignment.id)");
    expect(dashboard).toContain("`/api/direct-connect/assignments/${input.assignmentId}/respond`");
    expect(dashboard).not.toContain(
      "`/api/direct-connect/contractor/requests/${input.requestId}/respond`"
    );
    expect(dashboard).not.toContain("/request-contact");
  });

  it("does not let a legacy unbound response disable an exact assignment action", () => {
    const list = between(
      routes,
      '"/api/direct-connect/contractor/requests"',
      '"/api/direct-connect/contractor/requests/:id"'
    );
    expect(list).toContain("const responseByAssignmentId = new Map<string, any>()");
    expect(list).toContain("WHERE assignment_id IS NOT NULL");
    expect(list).toContain('responseByAssignmentId.get(String(exactAssignment.id || "")) || null');
  });

  it("fails closed on the deprecated request-level response authority", () => {
    const broadRespond = between(
      routes,
      '"/api/direct-connect/contractor/requests/:id/respond"',
      '"/api/direct-connect/contractor/requests/:id/request-contact"'
    );
    expect(broadRespond).toContain("DIRECT_CONNECT_EXACT_ASSIGNMENT_REQUIRED");
    expect(broadRespond).not.toContain("direct_connect_dispatch_candidates");
    expect(broadRespond).not.toContain("recordContractorResponse");
  });

  it("keeps candidate snapshots and events inside the assignment transaction", () => {
    const autoRoute = between(
      routes,
      "const routeRequestToTopContractors = async",
      "// Requester-facing: route an open Direct Connect request to top contractors"
    );
    const assignmentTransaction = autoRoute.indexOf("const persistRoutingMutation = async");
    const transactionEnd = autoRoute.indexOf("const routingMutation =", assignmentTransaction);
    const mutation = autoRoute.slice(assignmentTransaction, transactionEnd);
    expect(assignmentTransaction).toBeGreaterThanOrEqual(0);
    expect(transactionEnd).toBeGreaterThan(assignmentTransaction);
    expect(mutation).toContain("await snapshotDispatchCandidate");
    expect(mutation).toContain('eventType: "candidate_eligible"');
    expect(autoRoute.slice(0, assignmentTransaction)).not.toContain(
      "await snapshotDispatchCandidate"
    );
  });

  it("uses the mutation executor for all dispatch foundation evidence", () => {
    expect(ledger).toContain(
      "executor: DirectConnectSqlExecutor = db as unknown as DirectConnectSqlExecutor"
    );
    expect(ledger).toContain("await executor.execute(sql`");
    const persist = between(
      ledger,
      "export async function persistFinalizedDispatchRequest",
      "export async function appendDispatchEvent"
    );
    expect(persist).not.toContain("contact_gate_state = EXCLUDED.contact_gate_state");
  });

  it("commits release evidence with the gate and repairs missing notifications on replay", () => {
    const release = between(
      ledger,
      "export async function releaseContactAndCreateOrGetJobWorkspace",
      "export function getAllowedLifecycleActions"
    );
    expect(release).toContain("direct-connect-job-workspace-created:");
    expect(release).toContain("direct-connect-contact-gate:");
    expect(release).toContain("'job_workspace_created'");
    expect(release).toContain("'contact_released'");
    expect(release).toContain("ON CONFLICT (event_id) DO NOTHING");

    const append = between(
      ledger,
      "export async function appendDispatchEvent",
      "type InternalNotificationStatus"
    );
    expect(append).not.toContain("if (!inserted) return");
    expect(append).toContain(
      "resolveLifecycleRecipients(args.requestId, args.eventType, executor)"
    );
    expect(append).toContain("const lifecycleNotificationId");
    expect(append).toContain("ON CONFLICT (id) DO NOTHING");
    expect(append).toContain(
      "createInternalDirectConnectNotification(internalNotification, executor)"
    );
  });

  it("does not backfill duplicate legacy assignments into the same provider key", () => {
    expect(exactBindingMigration).toContain("AS null_assignment_count");
    expect(exactBindingMigration).toContain("candidate.null_assignment_count = 1");
    expect(exactBindingMigration).toContain("AS assignment_provider_count");
    expect(exactBindingMigration).toContain("AS provider_assignment_count");
    expect(exactBindingMigration).toContain("assignment_provider_count = 1");
    expect(exactBindingMigration).toContain("provider_assignment_count = 1");
  });

  it("repairs only one chronological legacy acceptance chain", () => {
    expect(exactBindingMigration).toContain("AS assignment_event_count");
    expect(exactBindingMigration).toContain("assignment_event_count = 1");
    expect(exactBindingMigration).toContain("AS next_accepted_at");
    expect(exactBindingMigration).toContain("response.created_at < candidate.next_accepted_at");
    expect(exactBindingMigration).toContain("event.request_event_count = 1");
    expect(exactBindingMigration).toContain("AS eligible_response_count");
    expect(exactBindingMigration).toContain("AS unsafe_response_count");
    expect(exactBindingMigration).toContain(
      "NULLIF(BTRIM(event.metadata->>'assignmentId'), '') IS NULL"
    );
    expect(exactBindingMigration).toContain(
      "NULLIF(BTRIM(event.metadata->>'providerKey'), '') IS NULL"
    );
    expect(exactBindingMigration).toContain("AS has_exact_acceptance_chain");
    expect(exactBindingMigration).toContain("readiness.has_single_accepted_conversation_event");
  });

  it("enforces exact bindings on every new acceptance mutation", () => {
    expect(exactBindingMigration).toContain(
      "CREATE TRIGGER enforce_direct_connect_assignment_provider_key"
    );
    expect(exactBindingMigration).toContain("DIRECT_CONNECT_ASSIGNMENT_PROVIDER_KEY_REQUIRED");
    expect(exactBindingMigration).toContain("dc_response_binding_pair_check");
    expect(exactBindingMigration).toContain("dc_actionable_response_exact_binding_check");
    expect(exactBindingMigration).toContain("dc_contact_gate_binding_pair_check");
    expect(exactBindingMigration).toContain("dc_advanced_contact_gate_exact_binding_check");
    expect(exactBindingMigration).toContain("dc_provider_accepted_exact_binding_check");
  });
});
