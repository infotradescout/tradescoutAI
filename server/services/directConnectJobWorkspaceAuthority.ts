import { workRequestAssignments, workRequestEvents } from "@shared/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  isAuthorizedDirectConnectConversationParticipant,
  resolveDirectConnectConversationAuthority,
  type DirectConnectConversationAuthoritySuccess,
} from "./directConnectConversationAuthority";

const ACCEPTED_ASSIGNMENT_STATUSES = ["accepted", "completed"] as const;

type ProviderKeyKind = "business" | "contractor" | "responder" | "worker";

export type DirectConnectJobWorkspaceRecord = {
  id: string;
  requestId: string;
  requesterUserId: string;
  businessId: string | null;
  contractorId: string | null;
  contractorResponseId: string;
  contactGateState: string;
};

export type DirectConnectAcceptedProviderBinding = {
  workRequestId: string;
  assignmentId: string;
  assignmentStatus: string;
  providerKey: string;
  providerKeyKind: ProviderKeyKind;
  providerKeyId: string;
  conversationId: string;
  requesterUserId: string;
  providerUserId: string;
  contractorId: string | null;
  responderUserId: string | null;
  workerId: string | null;
  businessId: string | null;
  contractorResponseId: string;
  contractorResponseType: string;
  contractorResponseContactState: string;
  contractorResponseContractorId: string | null;
  contractorResponseUserId: string | null;
  acceptedAt: Date | string;
  conversationAuthority: DirectConnectConversationAuthoritySuccess;
};

export type DirectConnectJobWorkspaceAuthoritySuccess = {
  ok: true;
  workspace: DirectConnectJobWorkspaceRecord;
  binding: DirectConnectAcceptedProviderBinding;
  requesterUserId: string;
  providerUserId: string;
  workRequestId: string;
  assignmentId: string;
  providerKey: string;
  conversationId: string;
};

export type DirectConnectJobWorkspaceAuthorityFailureReason =
  | "WORKSPACE_NOT_FOUND"
  | "WORKSPACE_AMBIGUOUS"
  | "ACCEPTED_CONNECTION_MISSING"
  | "ACCEPTED_CONNECTION_AMBIGUOUS"
  | "ASSIGNMENT_BINDING_MISSING"
  | "PROVIDER_KEY_INVALID"
  | "ACCEPTED_RESPONSE_MISSING"
  | "WORKSPACE_REQUEST_MISMATCH"
  | "WORKSPACE_REQUESTER_MISMATCH"
  | "WORKSPACE_PROVIDER_MISMATCH"
  | "WORKSPACE_RESPONSE_MISMATCH"
  | "CONTACT_GATE_NOT_RELEASED"
  | "EXPECTED_CONVERSATION_MISMATCH"
  | "EXPECTED_ASSIGNMENT_MISMATCH";

export type DirectConnectJobWorkspaceAuthorityResult =
  | DirectConnectJobWorkspaceAuthoritySuccess
  | {
      ok: false;
      reason: DirectConnectJobWorkspaceAuthorityFailureReason;
    };

export type DirectConnectAcceptedProviderBindingResult =
  | {
      ok: true;
      binding: DirectConnectAcceptedProviderBinding;
    }
  | {
      ok: false;
      reason: DirectConnectJobWorkspaceAuthorityFailureReason;
    };

function normalizedId(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseProviderKey(providerKey: unknown): { kind: ProviderKeyKind; id: string } | null {
  const normalized = normalizedId(providerKey);
  if (!normalized) return null;
  const separatorIndex = normalized.indexOf(":");
  if (separatorIndex < 1) return null;
  const kind = normalized.slice(0, separatorIndex) as ProviderKeyKind;
  const id = normalized.slice(separatorIndex + 1).trim();
  if (!["business", "contractor", "responder", "worker"].includes(kind) || !id) {
    return null;
  }
  return { kind, id };
}

function sameNullableId(left: unknown, right: unknown): boolean {
  return normalizedId(left) === normalizedId(right);
}

export function evaluateDirectConnectJobWorkspaceAuthority(input: {
  workspace: DirectConnectJobWorkspaceRecord;
  binding: DirectConnectAcceptedProviderBinding;
  expectedConversationId?: string;
  expectedAssignmentId?: string;
}): DirectConnectJobWorkspaceAuthorityResult {
  const { workspace, binding } = input;
  if (workspace.contactGateState !== "released") {
    return { ok: false, reason: "CONTACT_GATE_NOT_RELEASED" };
  }
  if (workspace.requestId !== binding.workRequestId) {
    return { ok: false, reason: "WORKSPACE_REQUEST_MISMATCH" };
  }
  if (workspace.requesterUserId !== binding.requesterUserId) {
    return { ok: false, reason: "WORKSPACE_REQUESTER_MISMATCH" };
  }
  if (
    input.expectedConversationId &&
    normalizedId(input.expectedConversationId) !== binding.conversationId
  ) {
    return { ok: false, reason: "EXPECTED_CONVERSATION_MISMATCH" };
  }
  if (
    input.expectedAssignmentId &&
    normalizedId(input.expectedAssignmentId) !== binding.assignmentId
  ) {
    return { ok: false, reason: "EXPECTED_ASSIGNMENT_MISMATCH" };
  }

  const expectedBusinessId = binding.providerKeyKind === "business" ? binding.providerKeyId : null;
  if (
    !sameNullableId(workspace.businessId, expectedBusinessId) ||
    !sameNullableId(workspace.contractorId, binding.contractorId)
  ) {
    return { ok: false, reason: "WORKSPACE_PROVIDER_MISMATCH" };
  }
  if (
    workspace.contractorResponseId !== binding.contractorResponseId ||
    binding.contractorResponseUserId !== binding.providerUserId ||
    !sameNullableId(binding.contractorResponseContractorId, binding.contractorId)
  ) {
    return { ok: false, reason: "WORKSPACE_RESPONSE_MISMATCH" };
  }

  return {
    ok: true,
    workspace,
    binding,
    requesterUserId: binding.requesterUserId,
    providerUserId: binding.providerUserId,
    workRequestId: binding.workRequestId,
    assignmentId: binding.assignmentId,
    providerKey: binding.providerKey,
    conversationId: binding.conversationId,
  };
}

export function isAuthorizedDirectConnectJobWorkspaceParticipant(
  authority: DirectConnectJobWorkspaceAuthoritySuccess,
  userId: unknown
): boolean {
  return isAuthorizedDirectConnectConversationParticipant(
    authority.binding.conversationAuthority,
    userId
  );
}

export function getDirectConnectJobWorkspaceParticipantRole(
  authority: DirectConnectJobWorkspaceAuthoritySuccess,
  userId: unknown
): "requester" | "provider" | null {
  const normalizedUserId = normalizedId(userId);
  if (normalizedUserId === authority.requesterUserId) return "requester";
  if (normalizedUserId === authority.providerUserId) return "provider";
  return null;
}

export async function resolveDirectConnectAcceptedProviderBinding(
  requestId: string
): Promise<DirectConnectAcceptedProviderBindingResult> {
  const normalizedRequestId = normalizedId(requestId);
  if (!normalizedRequestId) {
    return { ok: false, reason: "ACCEPTED_CONNECTION_MISSING" };
  }

  const acceptedEvents = await db
    .select({
      metadata: workRequestEvents.metadata,
      createdAt: workRequestEvents.createdAt,
    })
    .from(workRequestEvents)
    .where(
      and(
        eq(workRequestEvents.workRequestId, normalizedRequestId),
        eq(workRequestEvents.type, "provider_accepted" as any)
      )
    )
    .orderBy(desc(workRequestEvents.createdAt), desc(workRequestEvents.id))
    .limit(20);

  const resolvedConnections: Array<{
    authority: DirectConnectConversationAuthoritySuccess;
    acceptedAt: Date | string;
  }> = [];
  for (const event of acceptedEvents) {
    const conversationId = normalizedId(metadataRecord(event.metadata).conversationId);
    if (!conversationId || !event.createdAt) continue;
    const authority = await resolveDirectConnectConversationAuthority(conversationId, {
      expectedWorkRequestId: normalizedRequestId,
    });
    if (authority.ok) {
      resolvedConnections.push({ authority, acceptedAt: event.createdAt });
    }
  }

  const uniqueConnections = Array.from(
    new Map(
      resolvedConnections.map((connection) => [
        `${connection.authority.assignmentId}:${connection.authority.conversation.id}`,
        connection,
      ])
    ).values()
  );
  if (uniqueConnections.length === 0) {
    return { ok: false, reason: "ACCEPTED_CONNECTION_MISSING" };
  }
  if (uniqueConnections.length !== 1) {
    return { ok: false, reason: "ACCEPTED_CONNECTION_AMBIGUOUS" };
  }

  const { authority, acceptedAt } = uniqueConnections[0];
  const [assignment] = await db
    .select({
      id: workRequestAssignments.id,
      workRequestId: workRequestAssignments.workRequestId,
      status: workRequestAssignments.status,
      providerKey: workRequestAssignments.providerKey,
      contractorId: workRequestAssignments.contractorId,
      responderUserId: workRequestAssignments.responderUserId,
      workerId: workRequestAssignments.workerId,
    })
    .from(workRequestAssignments)
    .where(
      and(
        eq(workRequestAssignments.id, authority.assignmentId),
        eq(workRequestAssignments.workRequestId, normalizedRequestId),
        inArray(
          workRequestAssignments.status,
          ACCEPTED_ASSIGNMENT_STATUSES as unknown as Array<"accepted" | "completed">
        )
      )
    )
    .limit(1);
  if (!assignment) {
    return { ok: false, reason: "ASSIGNMENT_BINDING_MISSING" };
  }

  const parsedProviderKey = parseProviderKey(assignment.providerKey);
  if (!parsedProviderKey) {
    return { ok: false, reason: "PROVIDER_KEY_INVALID" };
  }
  const contractorId = normalizedId(assignment.contractorId);
  const responderUserId = normalizedId(assignment.responderUserId);
  const workerId = normalizedId(assignment.workerId);
  if (
    (parsedProviderKey.kind === "contractor" && parsedProviderKey.id !== contractorId) ||
    (parsedProviderKey.kind === "worker" && parsedProviderKey.id !== workerId) ||
    (parsedProviderKey.kind === "responder" && parsedProviderKey.id !== authority.providerUserId) ||
    ((parsedProviderKey.kind === "business" || parsedProviderKey.kind === "worker") &&
      responderUserId !== authority.providerUserId)
  ) {
    return { ok: false, reason: "PROVIDER_KEY_INVALID" };
  }

  const responseRows = contractorId
    ? await db.execute(sql`
        SELECT id, request_id, contractor_id, responder_user_id, assignment_id, provider_key,
          response_type, contact_request_state, created_at
        FROM direct_connect_contractor_responses
        WHERE request_id = ${normalizedRequestId}
          AND contractor_id = ${contractorId}
          AND responder_user_id = ${authority.providerUserId}
          AND assignment_id = ${authority.assignmentId}
          AND provider_key = ${String(assignment.providerKey)}
          AND response_type IN ('interested', 'need_more_info')
          AND contact_request_state IN ('contractor_requested', 'user_approved', 'released')
          AND created_at >= ${acceptedAt}
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `)
    : await db.execute(sql`
        SELECT id, request_id, contractor_id, responder_user_id, assignment_id, provider_key,
          response_type, contact_request_state, created_at
        FROM direct_connect_contractor_responses
        WHERE request_id = ${normalizedRequestId}
          AND contractor_id IS NULL
          AND responder_user_id = ${authority.providerUserId}
          AND assignment_id = ${authority.assignmentId}
          AND provider_key = ${String(assignment.providerKey)}
          AND response_type IN ('interested', 'need_more_info')
          AND contact_request_state IN ('contractor_requested', 'user_approved', 'released')
          AND created_at >= ${acceptedAt}
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `);
  const response = ((responseRows.rows || []) as any[])[0] || null;
  if (!response) {
    return { ok: false, reason: "ACCEPTED_RESPONSE_MISSING" };
  }

  const providerKey = String(assignment.providerKey);
  return {
    ok: true,
    binding: {
      workRequestId: normalizedRequestId,
      assignmentId: String(assignment.id),
      assignmentStatus: String(assignment.status),
      providerKey,
      providerKeyKind: parsedProviderKey.kind,
      providerKeyId: parsedProviderKey.id,
      conversationId: authority.conversation.id,
      requesterUserId: authority.requesterUserId,
      providerUserId: authority.providerUserId,
      contractorId,
      responderUserId,
      workerId,
      businessId: parsedProviderKey.kind === "business" ? parsedProviderKey.id : null,
      contractorResponseId: String(response.id),
      contractorResponseType: String(response.response_type),
      contractorResponseContactState: String(response.contact_request_state),
      contractorResponseContractorId: normalizedId(response.contractor_id),
      contractorResponseUserId: normalizedId(response.responder_user_id),
      acceptedAt,
      conversationAuthority: authority,
    },
  };
}

async function loadWorkspaceById(
  workspaceId: string
): Promise<DirectConnectJobWorkspaceRecord | null> {
  const result = await db.execute(sql`
    SELECT
      w.id,
      w.request_id,
      w.requester_user_id,
      w.business_id,
      w.contractor_id,
      w.contractor_response_id,
      d.contact_gate_state
    FROM direct_connect_job_workspaces w
    INNER JOIN direct_connect_dispatch_requests d ON d.id = w.request_id
    WHERE w.id = ${workspaceId}
    LIMIT 1
  `);
  const row = ((result.rows || []) as any[])[0] || null;
  const contractorResponseId = normalizedId(row?.contractor_response_id);
  if (!row || !contractorResponseId) return null;
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    requesterUserId: String(row.requester_user_id),
    businessId: normalizedId(row.business_id),
    contractorId: normalizedId(row.contractor_id),
    contractorResponseId,
    contactGateState: String(row.contact_gate_state || "locked"),
  };
}

export async function resolveDirectConnectJobWorkspaceAuthority(
  workspaceId: string,
  options: {
    expectedConversationId?: string;
    expectedAssignmentId?: string;
  } = {}
): Promise<DirectConnectJobWorkspaceAuthorityResult> {
  const normalizedWorkspaceId = normalizedId(workspaceId);
  if (!normalizedWorkspaceId) {
    return { ok: false, reason: "WORKSPACE_NOT_FOUND" };
  }
  const workspace = await loadWorkspaceById(normalizedWorkspaceId);
  if (!workspace) {
    return { ok: false, reason: "WORKSPACE_NOT_FOUND" };
  }
  const bindingResult = await resolveDirectConnectAcceptedProviderBinding(workspace.requestId);
  if (!bindingResult.ok) return bindingResult;
  return evaluateDirectConnectJobWorkspaceAuthority({
    workspace,
    binding: bindingResult.binding,
    expectedConversationId: options.expectedConversationId,
    expectedAssignmentId: options.expectedAssignmentId,
  });
}

export async function resolveDirectConnectJobWorkspaceAuthorityForRequest(
  requestId: string,
  options: {
    expectedConversationId?: string;
    expectedAssignmentId?: string;
  } = {}
): Promise<DirectConnectJobWorkspaceAuthorityResult> {
  const normalizedRequestId = normalizedId(requestId);
  if (!normalizedRequestId) {
    return { ok: false, reason: "WORKSPACE_NOT_FOUND" };
  }
  const workspaceRows = await db.execute(sql`
    SELECT id
    FROM direct_connect_job_workspaces
    WHERE request_id = ${normalizedRequestId}
    ORDER BY created_at DESC, id DESC
    LIMIT 2
  `);
  const rows = (workspaceRows.rows || []) as any[];
  if (rows.length === 0) {
    return { ok: false, reason: "WORKSPACE_NOT_FOUND" };
  }
  if (rows.length !== 1) {
    return { ok: false, reason: "WORKSPACE_AMBIGUOUS" };
  }
  return resolveDirectConnectJobWorkspaceAuthority(String(rows[0].id), options);
}
