import {
  contractors,
  conversations,
  type Conversation,
  workers,
  workRequestAssignments,
  workRequestEvents,
  workRequests,
} from "@shared/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";

export const DIRECT_CONNECT_CONVERSATION_ASSIGNMENT_STATUSES = ["accepted", "completed"] as const;
export const DIRECT_CONNECT_CONVERSATION_REQUEST_STATUSES = [
  "in_progress",
  "pending_outcome",
  "completed",
] as const;

export type DirectConnectConversationAuthorityFailureReason =
  | "THREAD_NOT_FOUND"
  | "CONNECTION_AUTHORITY_MISSING"
  | "EVENT_BINDING_MISMATCH"
  | "EVENT_ASSIGNMENT_MISMATCH"
  | "EVENT_ACTOR_MISMATCH"
  | "AMBIGUOUS_ASSIGNMENT"
  | "PROVIDER_IDENTITY_MISSING"
  | "PROVIDER_IDENTITY_MISMATCH"
  | "CONVERSATION_KEY_MISMATCH";

export type DirectConnectConversationAuthorityCandidate = {
  conversation: Conversation;
  eventMetadata: unknown;
  eventActorUserId: string | null;
  workRequestId: string;
  requesterUserId: string;
  requestSource: string | null;
  requestStatus: string | null;
  assignmentId: string;
  assignmentStatus: string | null;
  providerKey: string | null;
  contractorId: string | null;
  responderUserId: string | null;
  workerId: string | null;
  contractorUserId: string | null;
  workerUserId: string | null;
};

export type DirectConnectConversationAuthoritySuccess = {
  ok: true;
  conversation: Conversation;
  authorizedParticipantUserIds: [string, string];
  requesterUserId: string;
  providerUserId: string;
  contractorId: string | null;
  conversationStatus: string;
  workRequestId: string;
  assignmentId: string;
  assignmentStatus: string;
  requestStatus: string;
};

export type DirectConnectConversationAuthorityResult =
  | DirectConnectConversationAuthoritySuccess
  | {
      ok: false;
      reason: DirectConnectConversationAuthorityFailureReason;
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

export function isDirectConnectMessageScopedToRequest(
  messageMetadata: unknown,
  workRequestId: unknown
): boolean {
  const expectedWorkRequestId = normalizedId(workRequestId);
  if (!expectedWorkRequestId) return false;
  return normalizedId(metadataRecord(messageMetadata).workRequestId) === expectedWorkRequestId;
}

const DIRECT_CONNECT_PARTICIPANT_RESERVED_METADATA = new Set([
  "assignmentId",
  "clientMessageId",
  "connectionId",
  "representedProviderUserId",
  "staffActorUserId",
  "staffAssisted",
  "staffReason",
  "workRequestId",
  "_interactionSignature",
  "_messageType",
  "_senderType",
]);

export function sanitizeDirectConnectParticipantMessageMetadata(
  messageMetadata: unknown
): Record<string, unknown> {
  if (!messageMetadata || typeof messageMetadata !== "object" || Array.isArray(messageMetadata)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(messageMetadata as Record<string, unknown>).filter(
      ([key]) => !DIRECT_CONNECT_PARTICIPANT_RESERVED_METADATA.has(key)
    )
  );
}

export function evaluateDirectConnectConversationAuthorityCandidate(
  candidate: DirectConnectConversationAuthorityCandidate
): DirectConnectConversationAuthorityResult {
  if (candidate.requestSource !== "direct_connect") {
    return { ok: false, reason: "CONNECTION_AUTHORITY_MISSING" };
  }
  if (
    !DIRECT_CONNECT_CONVERSATION_REQUEST_STATUSES.includes(
      String(
        candidate.requestStatus || ""
      ) as (typeof DIRECT_CONNECT_CONVERSATION_REQUEST_STATUSES)[number]
    ) ||
    !DIRECT_CONNECT_CONVERSATION_ASSIGNMENT_STATUSES.includes(
      String(
        candidate.assignmentStatus || ""
      ) as (typeof DIRECT_CONNECT_CONVERSATION_ASSIGNMENT_STATUSES)[number]
    )
  ) {
    return { ok: false, reason: "CONNECTION_AUTHORITY_MISSING" };
  }

  const metadata = metadataRecord(candidate.eventMetadata);
  if (normalizedId(metadata.conversationId) !== candidate.conversation.id) {
    return { ok: false, reason: "EVENT_BINDING_MISMATCH" };
  }

  const eventAssignmentId = normalizedId(metadata.assignmentId);
  const eventProviderKey = normalizedId(metadata.providerKey);
  const requiresExactEventBinding =
    Number(metadata.authorityBindingVersion || 0) >= 2 ||
    Boolean(eventAssignmentId || eventProviderKey);
  if (requiresExactEventBinding && (!eventAssignmentId || !eventProviderKey)) {
    return { ok: false, reason: "EVENT_ASSIGNMENT_MISMATCH" };
  }
  const eventAssignmentBindings = [
    [metadata.assignmentId, candidate.assignmentId],
    [metadata.providerKey, candidate.providerKey],
    [metadata.contractorId, candidate.contractorId],
    [metadata.responderUserId, candidate.responderUserId],
    [metadata.workerId, candidate.workerId],
  ].filter(([eventValue]) => normalizedId(eventValue));
  if (
    eventAssignmentBindings.some(
      ([eventValue, assignmentValue]) => normalizedId(eventValue) !== normalizedId(assignmentValue)
    )
  ) {
    return { ok: false, reason: "EVENT_ASSIGNMENT_MISMATCH" };
  }

  const providerUserIds = Array.from(
    new Set(
      [candidate.contractorUserId, candidate.responderUserId, candidate.workerUserId]
        .map(normalizedId)
        .filter((value): value is string => Boolean(value))
    )
  );
  if (providerUserIds.length === 0) {
    return { ok: false, reason: "PROVIDER_IDENTITY_MISSING" };
  }
  if (providerUserIds.length !== 1) {
    return { ok: false, reason: "PROVIDER_IDENTITY_MISMATCH" };
  }

  const requesterUserId = normalizedId(candidate.requesterUserId);
  const providerUserId = providerUserIds[0];
  if (!requesterUserId || requesterUserId === providerUserId) {
    return { ok: false, reason: "PROVIDER_IDENTITY_MISMATCH" };
  }
  if (normalizedId(candidate.eventActorUserId) !== providerUserId) {
    return { ok: false, reason: "EVENT_ACTOR_MISMATCH" };
  }

  const expectedProviderConversationKey = normalizedId(candidate.contractorId) || providerUserId;
  if (
    candidate.conversation.homeownerId !== requesterUserId ||
    candidate.conversation.contractorId !== expectedProviderConversationKey
  ) {
    return { ok: false, reason: "CONVERSATION_KEY_MISMATCH" };
  }

  return {
    ok: true,
    conversation: candidate.conversation,
    authorizedParticipantUserIds: [requesterUserId, providerUserId],
    requesterUserId,
    providerUserId,
    contractorId: normalizedId(candidate.contractorId),
    conversationStatus: String(candidate.conversation.status || ""),
    workRequestId: candidate.workRequestId,
    assignmentId: candidate.assignmentId,
    assignmentStatus: String(candidate.assignmentStatus),
    requestStatus: String(candidate.requestStatus),
  };
}

export function isAuthorizedDirectConnectConversationParticipant(
  authority: DirectConnectConversationAuthoritySuccess,
  userId: unknown
): boolean {
  const normalizedUserId = normalizedId(userId);
  return Boolean(
    normalizedUserId && authority.authorizedParticipantUserIds.includes(normalizedUserId)
  );
}

export function getDirectConnectConversationSenderType(
  authority: DirectConnectConversationAuthoritySuccess,
  userId: unknown
): "homeowner" | "contractor" | null {
  const normalizedUserId = normalizedId(userId);
  if (normalizedUserId === authority.requesterUserId) return "homeowner";
  if (normalizedUserId === authority.providerUserId) return "contractor";
  return null;
}

export async function resolveDirectConnectConversationAuthority(
  conversationId: string,
  options: { expectedWorkRequestId?: string } = {}
): Promise<DirectConnectConversationAuthorityResult> {
  const normalizedConversationId = normalizedId(conversationId);
  const expectedWorkRequestId = normalizedId(options.expectedWorkRequestId);
  if (!normalizedConversationId) {
    return { ok: false, reason: "THREAD_NOT_FOUND" };
  }

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, normalizedConversationId))
    .limit(1);
  if (!conversation) {
    return { ok: false, reason: "THREAD_NOT_FOUND" };
  }

  const [acceptedEvent] = await db
    .select({
      eventId: workRequestEvents.id,
      eventMetadata: workRequestEvents.metadata,
      eventActorUserId: workRequestEvents.actorUserId,
      workRequestId: workRequests.id,
      requesterUserId: workRequests.createdByUserId,
      requestSource: workRequests.source,
      requestStatus: workRequests.status,
    })
    .from(workRequestEvents)
    .innerJoin(workRequests, eq(workRequests.id, workRequestEvents.workRequestId))
    .where(
      and(
        eq(workRequestEvents.type, "provider_accepted" as any),
        sql`${workRequestEvents.metadata} ->> 'conversationId' = ${normalizedConversationId}`,
        expectedWorkRequestId ? eq(workRequests.id, expectedWorkRequestId) : undefined
      )
    )
    .orderBy(desc(workRequestEvents.createdAt), desc(workRequestEvents.id))
    .limit(1);

  if (!acceptedEvent) {
    return { ok: false, reason: "CONNECTION_AUTHORITY_MISSING" };
  }

  const acceptedEventMetadata = metadataRecord(acceptedEvent.eventMetadata);
  const eventAssignmentId = normalizedId(acceptedEventMetadata.assignmentId);
  const assignments = await db
    .select({
      assignmentId: workRequestAssignments.id,
      assignmentStatus: workRequestAssignments.status,
      providerKey: workRequestAssignments.providerKey,
      contractorId: workRequestAssignments.contractorId,
      responderUserId: workRequestAssignments.responderUserId,
      workerId: workRequestAssignments.workerId,
      contractorUserId: contractors.userId,
      workerUserId: workers.userId,
    })
    .from(workRequestAssignments)
    .leftJoin(contractors, eq(contractors.id, workRequestAssignments.contractorId))
    .leftJoin(workers, eq(workers.id, workRequestAssignments.workerId))
    .where(
      and(
        eq(workRequestAssignments.workRequestId, acceptedEvent.workRequestId),
        eventAssignmentId
          ? eq(workRequestAssignments.id, eventAssignmentId)
          : inArray(workRequestAssignments.status, ["accepted", "completed"] as Array<
              "accepted" | "completed"
            >)
      )
    )
    .orderBy(desc(workRequestAssignments.updatedAt), desc(workRequestAssignments.id))
    .limit(eventAssignmentId ? 1 : 10);

  const evaluated = assignments.map((assignment) =>
    evaluateDirectConnectConversationAuthorityCandidate({
      conversation,
      eventMetadata: acceptedEvent.eventMetadata,
      eventActorUserId: acceptedEvent.eventActorUserId,
      workRequestId: String(acceptedEvent.workRequestId),
      requesterUserId: String(acceptedEvent.requesterUserId),
      requestSource: acceptedEvent.requestSource,
      requestStatus: acceptedEvent.requestStatus,
      assignmentId: String(assignment.assignmentId),
      assignmentStatus: assignment.assignmentStatus,
      providerKey: assignment.providerKey,
      contractorId: assignment.contractorId,
      responderUserId: assignment.responderUserId,
      workerId: assignment.workerId,
      contractorUserId: assignment.contractorUserId,
      workerUserId: assignment.workerUserId,
    })
  );
  const authorized = evaluated.filter(
    (result): result is DirectConnectConversationAuthoritySuccess => result.ok
  );
  if (authorized.length === 1) return authorized[0];
  if (authorized.length > 1) {
    return { ok: false, reason: "AMBIGUOUS_ASSIGNMENT" };
  }
  return evaluated[0] || { ok: false, reason: "CONNECTION_AUTHORITY_MISSING" };
}
