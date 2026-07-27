import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  evaluateDirectConnectJobWorkspaceAuthority,
  isAuthorizedDirectConnectJobWorkspaceParticipant,
  type DirectConnectAcceptedProviderBinding,
  type DirectConnectJobWorkspaceRecord,
} from "../services/directConnectJobWorkspaceAuthority";

const ROUTE_SOURCE = readFileSync(new URL("../routes/direct-connect.ts", import.meta.url), "utf8");
const AUTHORITY_SOURCE = readFileSync(
  new URL("../services/directConnectJobWorkspaceAuthority.ts", import.meta.url),
  "utf8"
);
const LEDGER_SOURCE = readFileSync(
  new URL("../services/directConnectDispatchLedgerService.ts", import.meta.url),
  "utf8"
);
const LEDGER_MIGRATION_SOURCE = readFileSync(
  new URL("../../migrations/0115_direct_connect_ledger_foundation.sql", import.meta.url),
  "utf8"
);

function acceptedBusinessBinding(
  overrides: Partial<DirectConnectAcceptedProviderBinding> = {}
): DirectConnectAcceptedProviderBinding {
  const workRequestId = overrides.workRequestId || "request-a";
  const assignmentId = overrides.assignmentId || "assignment-a";
  const conversationId = overrides.conversationId || "conversation-a";
  const requesterUserId = overrides.requesterUserId || "requester";
  const providerUserId = overrides.providerUserId || "provider-a";
  const businessId = overrides.businessId || "business-a";
  const providerKey = overrides.providerKey || `business:${businessId}`;
  return {
    workRequestId,
    assignmentId,
    assignmentStatus: "accepted",
    providerKey,
    providerKeyKind: "business",
    providerKeyId: businessId,
    conversationId,
    requesterUserId,
    providerUserId,
    contractorId: null,
    responderUserId: providerUserId,
    workerId: null,
    businessId,
    contractorResponseId: overrides.contractorResponseId || "response-a",
    contractorResponseType: "interested",
    contractorResponseContactState: "contractor_requested",
    contractorResponseContractorId: null,
    contractorResponseUserId: providerUserId,
    acceptedAt: new Date("2026-07-26T12:00:00.000Z"),
    conversationAuthority: {
      ok: true,
      conversation: {
        id: conversationId,
        homeownerId: requesterUserId,
        contractorId: providerUserId,
        status: "active",
      } as any,
      authorizedParticipantUserIds: [requesterUserId, providerUserId],
      requesterUserId,
      providerUserId,
      contractorId: null,
      conversationStatus: "active",
      workRequestId,
      assignmentId,
      assignmentStatus: "accepted",
      requestStatus: "in_progress",
    },
    ...overrides,
  };
}

function workspaceFor(
  binding: DirectConnectAcceptedProviderBinding
): DirectConnectJobWorkspaceRecord {
  return {
    id: `workspace:${binding.workRequestId}`,
    requestId: binding.workRequestId,
    requesterUserId: binding.requesterUserId,
    businessId: binding.businessId,
    contractorId: binding.contractorId,
    contractorResponseId: binding.contractorResponseId,
    contactGateState: "released",
  };
}

describe("Direct Connect exact job-workspace authority", () => {
  it("allows only the exact requester and accepted provider, not another routed provider", () => {
    const binding = acceptedBusinessBinding();
    const authority = evaluateDirectConnectJobWorkspaceAuthority({
      workspace: workspaceFor(binding),
      binding,
      expectedConversationId: binding.conversationId,
      expectedAssignmentId: binding.assignmentId,
    });

    expect(authority.ok).toBe(true);
    if (!authority.ok) return;
    expect(isAuthorizedDirectConnectJobWorkspaceParticipant(authority, "requester")).toBe(true);
    expect(isAuthorizedDirectConnectJobWorkspaceParticipant(authority, "provider-a")).toBe(true);
    expect(isAuthorizedDirectConnectJobWorkspaceParticipant(authority, "provider-b")).toBe(false);
  });

  it("does not cross-bind two accepted requests between the same participant pair", () => {
    const first = acceptedBusinessBinding();
    const second = acceptedBusinessBinding({
      workRequestId: "request-b",
      assignmentId: "assignment-b",
      conversationId: "conversation-b",
      contractorResponseId: "response-b",
    });

    const wrongConversation = evaluateDirectConnectJobWorkspaceAuthority({
      workspace: workspaceFor(first),
      binding: first,
      expectedConversationId: second.conversationId,
      expectedAssignmentId: second.assignmentId,
    });
    expect(wrongConversation).toEqual({
      ok: false,
      reason: "EXPECTED_CONVERSATION_MISMATCH",
    });

    const wrongRequest = evaluateDirectConnectJobWorkspaceAuthority({
      workspace: workspaceFor(first),
      binding: second,
    });
    expect(wrongRequest).toEqual({
      ok: false,
      reason: "WORKSPACE_REQUEST_MISMATCH",
    });
  });

  it("does not cross-bind two businesses owned by the same provider user", () => {
    const acceptedBusiness = acceptedBusinessBinding({
      providerUserId: "shared-owner",
      businessId: "business-a",
      providerKey: "business:business-a",
    });
    const workspace = {
      ...workspaceFor(acceptedBusiness),
      businessId: "business-b",
    };

    expect(
      evaluateDirectConnectJobWorkspaceAuthority({
        workspace,
        binding: acceptedBusiness,
      })
    ).toEqual({
      ok: false,
      reason: "WORKSPACE_PROVIDER_MISMATCH",
    });
  });

  it("keeps an exact workspace inaccessible until the requester releases contact", () => {
    const binding = acceptedBusinessBinding();
    const workspace = {
      ...workspaceFor(binding),
      contactGateState: "user_approved",
    };

    expect(evaluateDirectConnectJobWorkspaceAuthority({ workspace, binding })).toEqual({
      ok: false,
      reason: "CONTACT_GATE_NOT_RELEASED",
    });
  });

  it("binds the accepted ledger response to the exact assignment and provider key", () => {
    expect(AUTHORITY_SOURCE).toContain("assignment_id = ${authority.assignmentId}");
    expect(AUTHORITY_SOURCE).toContain("provider_key = ${String(assignment.providerKey)}");
    expect(LEDGER_MIGRATION_SOURCE).toContain("assignment_id text NULL");
    expect(LEDGER_MIGRATION_SOURCE).toContain("provider_key text NULL");
    expect(LEDGER_MIGRATION_SOURCE).toContain("idx_dc_contractor_responses_assignment_binding");
    expect(ROUTE_SOURCE).toContain("assignmentId: String(updatedAssignment.id)");
    expect(ROUTE_SOURCE).toContain("providerKey: providerKey || null");
    const acceptanceRoute = ROUTE_SOURCE.slice(
      ROUTE_SOURCE.indexOf('"/api/direct-connect/assignments/:id/respond"'),
      ROUTE_SOURCE.indexOf('"/api/direct-connect/requests/:id/express-interest"')
    );
    expect(acceptanceRoute).toMatch(/recordContractorResponse\([\s\S]*?,\s*tx\s*\);/);
    expect(acceptanceRoute).toContain('nextState: "contractor_requested"');
    expect(acceptanceRoute).toContain("assignmentId: String(updatedAssignment.id)");
    expect(acceptanceRoute).toContain("providerKey,");
  });

  it("permits legacy acceptance evidence only behind locked exact release authority", () => {
    expect(ROUTE_SOURCE).toContain("authorityBindingVersion: 2");
    expect(LEDGER_SOURCE).toContain("FROM conversations");
    expect(LEDGER_SOURCE).toContain("FOR UPDATE");
    expect(LEDGER_SOURCE).toContain("actor_user_id = ${normalized.providerUserId}");
    expect(LEDGER_SOURCE).toContain("metadata->>'conversationId' = ${normalized.conversationId}");
    expect(LEDGER_SOURCE).toContain("NULLIF(BTRIM(metadata->>'assignmentId'), '') IS NULL");
    expect(LEDGER_SOURCE).toContain("NULLIF(BTRIM(metadata->>'providerKey'), '') IS NULL");
    expect(LEDGER_SOURCE).toContain("COALESCE(metadata->>'authorityBindingVersion', '') <> '2'");
    expect(LEDGER_SOURCE).toContain(
      'String(response.assignment_id || "").trim() !== normalized.assignmentId'
    );
    expect(LEDGER_SOURCE).toContain(
      'String(response.provider_key || "").trim() !== normalized.providerKey'
    );
  });

  it("guards every job lifecycle route with the exact workspace resolver", () => {
    const jobRouteCount =
      ROUTE_SOURCE.match(/"\/api\/direct-connect\/jobs\/:jobWorkspaceId/g)?.length || 0;
    const authorityGuardCount =
      ROUTE_SOURCE.match(
        /const exactJobWorkspaceAuthority = await requireExactJobWorkspaceParticipant/g
      )?.length || 0;

    expect(jobRouteCount).toBeGreaterThan(0);
    expect(authorityGuardCount).toBe(jobRouteCount);
  });

  it("resolves the message job bridge through its exact conversation assignment", () => {
    const routeStart = ROUTE_SOURCE.indexOf('"/api/direct-connect/messages/threads/:threadId/job"');
    const routeEnd = ROUTE_SOURCE.indexOf(
      '"/api/direct-connect/jobs/:jobWorkspaceId/timeline"',
      routeStart
    );
    const route = ROUTE_SOURCE.slice(routeStart, routeEnd);

    expect(route).toContain("resolveDirectConnectConversationAuthority(threadId)");
    expect(route).toContain("eq(workRequests.id, conversationAuthority.workRequestId)");
    expect(route).toContain("eq(workRequestAssignments.id, conversationAuthority.assignmentId)");
    expect(route).toContain("expectedConversationId: threadId");
    expect(route).not.toContain("ORDER BY a.updated_at DESC");
    expect(route).not.toContain("a.contractor_id = ${providerKey}");
  });

  it("creates a released workspace from the accepted binding, not an arbitrary candidate", () => {
    const routeStart = ROUTE_SOURCE.indexOf('"/api/direct-connect/requests/:id/contact-gate"');
    const routeEnd = ROUTE_SOURCE.indexOf("// Requester-facing: cancel", routeStart);
    const route = ROUTE_SOURCE.slice(routeStart, routeEnd);

    expect(route).toContain("resolveDirectConnectAcceptedProviderBinding(requestId)");
    expect(route).toContain("assignmentId: acceptedBinding.assignmentId");
    expect(route).toContain("providerKey: acceptedBinding.providerKey");
    expect(route).toContain("conversationId: acceptedBinding.conversationId");
    expect(route).toContain("contractorResponseId: acceptedBinding.contractorResponseId");
    expect(route).not.toContain("ORDER BY created_at ASC");
    expect(route).not.toContain("const latestResponse");
  });
});
