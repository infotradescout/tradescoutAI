import { describe, expect, it } from "vitest";
import type { Conversation } from "@shared/schema";
import {
  evaluateDirectConnectConversationAuthorityCandidate,
  getDirectConnectConversationSenderType,
  isAuthorizedDirectConnectConversationParticipant,
  isDirectConnectMessageScopedToRequest,
  sanitizeDirectConnectParticipantMessageMetadata,
  type DirectConnectConversationAuthorityCandidate,
} from "../services/directConnectConversationAuthority";

function conversation(contractorId: string): Conversation {
  return {
    id: "conversation-1",
    homeownerId: "requester-1",
    contractorId,
    leadId: null,
    status: "active",
    lastMessageAt: new Date("2026-07-26T12:00:00.000Z"),
    homeownerRating: null,
    contractorRating: null,
    homeownerFeedback: null,
    contractorFeedback: null,
    createdAt: new Date("2026-07-26T12:00:00.000Z"),
    updatedAt: new Date("2026-07-26T12:00:00.000Z"),
  };
}

function candidate(
  overrides: Partial<DirectConnectConversationAuthorityCandidate> = {}
): DirectConnectConversationAuthorityCandidate {
  return {
    conversation: conversation("contractor-profile-1"),
    eventMetadata: {
      conversationId: "conversation-1",
      contractorId: "contractor-profile-1",
    },
    eventActorUserId: "contractor-user-1",
    workRequestId: "request-1",
    requesterUserId: "requester-1",
    requestSource: "direct_connect",
    requestStatus: "in_progress",
    assignmentId: "assignment-1",
    assignmentStatus: "accepted",
    providerKey: "contractor:contractor-profile-1",
    contractorId: "contractor-profile-1",
    responderUserId: null,
    workerId: null,
    contractorUserId: "contractor-user-1",
    workerUserId: null,
    ...overrides,
  };
}

describe("Direct Connect conversation authority", () => {
  it("allows a historical acceptance event with only an exact conversation binding", () => {
    const result = evaluateDirectConnectConversationAuthorityCandidate(
      candidate({
        eventMetadata: {
          conversationId: "conversation-1",
        },
      })
    );

    expect(result).toMatchObject({
      ok: true,
      workRequestId: "request-1",
      assignmentId: "assignment-1",
      providerUserId: "contractor-user-1",
    });
  });

  it("requires both exact assignment keys on versioned acceptance events", () => {
    expect(
      evaluateDirectConnectConversationAuthorityCandidate(
        candidate({
          eventMetadata: {
            authorityBindingVersion: 2,
            conversationId: "conversation-1",
          },
        })
      )
    ).toEqual({ ok: false, reason: "EVENT_ASSIGNMENT_MISMATCH" });

    expect(
      evaluateDirectConnectConversationAuthorityCandidate(
        candidate({
          eventMetadata: {
            authorityBindingVersion: 2,
            conversationId: "conversation-1",
            assignmentId: "assignment-1",
            providerKey: "contractor:contractor-profile-1",
          },
        })
      )
    ).toMatchObject({ ok: true, assignmentId: "assignment-1" });
  });

  it("authorizes a traditional contractor user while preserving contractors.id as the key", () => {
    const result = evaluateDirectConnectConversationAuthorityCandidate(candidate());

    expect(result).toMatchObject({
      ok: true,
      authorizedParticipantUserIds: ["requester-1", "contractor-user-1"],
      requesterUserId: "requester-1",
      providerUserId: "contractor-user-1",
      contractorId: "contractor-profile-1",
      conversationStatus: "active",
      workRequestId: "request-1",
      assignmentId: "assignment-1",
    });
    if (!result.ok) throw new Error("Expected authority");
    expect(isAuthorizedDirectConnectConversationParticipant(result, "contractor-user-1")).toBe(
      true
    );
    expect(getDirectConnectConversationSenderType(result, "requester-1")).toBe("homeowner");
    expect(getDirectConnectConversationSenderType(result, "contractor-user-1")).toBe("contractor");
  });

  it("authorizes a business provider whose conversation key is its user id", () => {
    const result = evaluateDirectConnectConversationAuthorityCandidate(
      candidate({
        conversation: conversation("business-user-1"),
        eventMetadata: {
          conversationId: "conversation-1",
          responderUserId: "business-user-1",
        },
        eventActorUserId: "business-user-1",
        contractorId: null,
        contractorUserId: null,
        responderUserId: "business-user-1",
      })
    );

    expect(result).toMatchObject({
      ok: true,
      authorizedParticipantUserIds: ["requester-1", "business-user-1"],
      providerUserId: "business-user-1",
      contractorId: null,
    });
  });

  it("rejects a provider user key for a traditional contractor assignment", () => {
    const result = evaluateDirectConnectConversationAuthorityCandidate(
      candidate({
        conversation: conversation("contractor-user-1"),
      })
    );

    expect(result).toEqual({
      ok: false,
      reason: "CONVERSATION_KEY_MISMATCH",
    });
  });

  it("authorizes a worker through workers.userId when no responder user is stored", () => {
    const result = evaluateDirectConnectConversationAuthorityCandidate(
      candidate({
        conversation: conversation("worker-user-1"),
        eventMetadata: {
          conversationId: "conversation-1",
          workerId: "worker-profile-1",
        },
        eventActorUserId: "worker-user-1",
        contractorId: null,
        contractorUserId: null,
        responderUserId: null,
        workerId: "worker-profile-1",
        workerUserId: "worker-user-1",
      })
    );

    expect(result).toMatchObject({
      ok: true,
      authorizedParticipantUserIds: ["requester-1", "worker-user-1"],
      providerUserId: "worker-user-1",
    });
  });

  it("accepts the current worker event shape when responder and worker resolve to one user", () => {
    const result = evaluateDirectConnectConversationAuthorityCandidate(
      candidate({
        conversation: conversation("worker-user-1"),
        eventMetadata: {
          conversationId: "conversation-1",
          responderUserId: "worker-user-1",
        },
        eventActorUserId: "worker-user-1",
        contractorId: null,
        contractorUserId: null,
        responderUserId: "worker-user-1",
        workerId: "worker-profile-1",
        workerUserId: "worker-user-1",
      })
    );

    expect(result).toMatchObject({
      ok: true,
      providerUserId: "worker-user-1",
      assignmentId: "assignment-1",
    });
  });

  it("fails closed before acceptance and for non-Direct Connect requests", () => {
    expect(
      evaluateDirectConnectConversationAuthorityCandidate(candidate({ requestStatus: "routed" }))
    ).toEqual({ ok: false, reason: "CONNECTION_AUTHORITY_MISSING" });
    expect(
      evaluateDirectConnectConversationAuthorityCandidate(
        candidate({ assignmentStatus: "invited" })
      )
    ).toEqual({ ok: false, reason: "CONNECTION_AUTHORITY_MISSING" });
    expect(
      evaluateDirectConnectConversationAuthorityCandidate(candidate({ requestSource: "community" }))
    ).toEqual({ ok: false, reason: "CONNECTION_AUTHORITY_MISSING" });
  });

  it("rejects event, assignment, conversation-key, and provider identity mismatches", () => {
    expect(
      evaluateDirectConnectConversationAuthorityCandidate(
        candidate({ eventMetadata: { conversationId: "different-conversation" } })
      )
    ).toEqual({ ok: false, reason: "EVENT_BINDING_MISMATCH" });

    expect(
      evaluateDirectConnectConversationAuthorityCandidate(
        candidate({
          eventMetadata: {
            conversationId: "conversation-1",
            contractorId: "different-contractor",
          },
        })
      )
    ).toEqual({ ok: false, reason: "EVENT_ASSIGNMENT_MISMATCH" });

    expect(
      evaluateDirectConnectConversationAuthorityCandidate(
        candidate({ conversation: conversation("different-contractor") })
      )
    ).toEqual({ ok: false, reason: "CONVERSATION_KEY_MISMATCH" });

    expect(
      evaluateDirectConnectConversationAuthorityCandidate(
        candidate({
          responderUserId: "different-provider-user",
        })
      )
    ).toEqual({ ok: false, reason: "PROVIDER_IDENTITY_MISMATCH" });

    expect(
      evaluateDirectConnectConversationAuthorityCandidate(
        candidate({
          eventActorUserId: "different-provider-user",
        })
      )
    ).toEqual({ ok: false, reason: "EVENT_ACTOR_MISMATCH" });
  });

  it("does not authorize an unrelated user", () => {
    const result = evaluateDirectConnectConversationAuthorityCandidate(candidate());
    if (!result.ok) throw new Error("Expected authority");

    expect(isAuthorizedDirectConnectConversationParticipant(result, "stranger-1")).toBe(false);
    expect(getDirectConnectConversationSenderType(result, "stranger-1")).toBeNull();
  });

  it("fails closed when a legacy message is not bound to the authorized request", () => {
    expect(isDirectConnectMessageScopedToRequest({ workRequestId: "request-1" }, "request-1")).toBe(
      true
    );
    expect(isDirectConnectMessageScopedToRequest({ workRequestId: "request-2" }, "request-1")).toBe(
      false
    );
    expect(isDirectConnectMessageScopedToRequest({}, "request-1")).toBe(false);
    expect(isDirectConnectMessageScopedToRequest(null, "request-1")).toBe(false);
  });

  it("strips participant attempts to forge staff and request authority metadata", () => {
    expect(
      sanitizeDirectConnectParticipantMessageMetadata({
        kind: "schedule_request",
        staffAssisted: true,
        staffActorUserId: "fake-staff",
        representedProviderUserId: "fake-provider",
        workRequestId: "different-request",
        assignmentId: "different-assignment",
        connectionId: "different-connection",
        _senderType: "staff",
      })
    ).toEqual({ kind: "schedule_request" });
  });

  it("exposes closed conversation state without dropping read authority", () => {
    const closedConversation = {
      ...conversation("contractor-profile-1"),
      status: "completed",
    } as Conversation;
    const result = evaluateDirectConnectConversationAuthorityCandidate(
      candidate({ conversation: closedConversation })
    );

    expect(result).toMatchObject({
      ok: true,
      conversationStatus: "completed",
    });
  });
});
