import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

function routeBlock(source: string, method: "get" | "put" | "post", route: string): string {
  const marker = `app.${method}(\n    "${route}"`;
  const start = source.indexOf(marker);
  expect(start, `Missing ${method.toUpperCase()} route ${route}`).toBeGreaterThan(-1);
  const end = source.indexOf("\n  app.", start + route.length);
  return source.slice(start, end === -1 ? source.length : end);
}

describe("Direct Connect message continuity contract", () => {
  const routes = read("server/routes.ts");
  const authority = read("server/services/directConnectConversationAuthority.ts");
  const storage = read("server/storage.ts");

  it("uses one exact accepted-event authority across every legacy message surface", () => {
    const protectedRoutes = [
      ["get", "/api/messages/threads/:threadId"],
      ["put", "/api/messages/threads/:threadId/read"],
      ["get", "/api/messages/threads/:threadId/home-report"],
      ["post", "/api/messages/threads/:threadId/home-report/share"],
      ["post", "/api/messages/threads/:threadId/messages"],
      ["get", "/api/conversations/:id"],
      ["get", "/api/conversations/:id/messages"],
    ] as const;

    for (const [method, route] of protectedRoutes) {
      const block = routeBlock(routes, method, route);
      expect(block).toContain("resolveDirectConnectConversationAuthority");
      expect(block).toContain("isAuthorizedDirectConnectConversationParticipant");
    }
    expect(routes).not.toContain("resolveLegacyConversationConnectionAuthority");
  });

  it("keeps Marketplace participant checks separate and unchanged", () => {
    const threadRead = routeBlock(routes, "get", "/api/messages/threads/:threadId");
    const threadSend = routeBlock(routes, "post", "/api/messages/threads/:threadId/messages");

    expect(threadRead).toContain("marketplaceConversation.buyerId !== userId");
    expect(threadRead).toContain("marketplaceConversation.sellerId !== userId");
    expect(threadSend).toContain("conversation.buyerId !== userId");
    expect(threadSend).toContain("conversation.sellerId !== userId");
  });

  it("binds authority to the exact provider_accepted event and fails closed before contact", () => {
    expect(authority).toContain('eq(workRequestEvents.type, "provider_accepted" as any)');
    expect(authority).toContain("eventActorUserId: workRequestEvents.actorUserId");
    expect(authority).toContain(
      "sql`${workRequestEvents.metadata} ->> 'conversationId' = ${normalizedConversationId}`"
    );
    expect(authority).toContain('candidate.requestSource !== "direct_connect"');
    expect(authority).toContain('"in_progress"');
    expect(authority).toContain('"pending_outcome"');
    expect(authority).toContain('"completed"');

    const requestStatuses = authority.slice(
      authority.indexOf("DIRECT_CONNECT_CONVERSATION_REQUEST_STATUSES"),
      authority.indexOf(
        "] as const;",
        authority.indexOf("DIRECT_CONNECT_CONVERSATION_REQUEST_STATUSES")
      )
    );
    expect(requestStatuses).not.toContain('"routed"');
    expect(requestStatuses).not.toContain('"open"');
    expect(authority).toContain("const [acceptedEvent] =");
    expect(authority).toContain(".orderBy(desc(workRequestEvents.createdAt)");
    expect(authority).toContain(".limit(1)");
    expect(authority).toContain(
      "eq(workRequestAssignments.workRequestId, acceptedEvent.workRequestId)"
    );
    expect(authority).toContain("normalizedId(candidate.eventActorUserId) !== providerUserId");
  });

  it("resolves contractor, responder, and worker provider users and validates both keys", () => {
    expect(authority).toContain("contractorUserId: contractors.userId");
    expect(authority).toContain("responderUserId: workRequestAssignments.responderUserId");
    expect(authority).toContain("workerUserId: workers.userId");
    expect(authority).toContain(".leftJoin(contractors");
    expect(authority).toContain(".leftJoin(workers");
    expect(authority).toContain("candidate.conversation.homeownerId !== requesterUserId");
    expect(authority).toContain(
      "const expectedProviderConversationKey = normalizedId(candidate.contractorId) || providerUserId"
    );
    expect(authority).toContain(
      "candidate.conversation.contractorId !== expectedProviderConversationKey"
    );
    expect(authority).toContain("authorizedParticipantUserIds: [requesterUserId, providerUserId]");
    expect(authority).toContain("assignmentId: candidate.assignmentId");
    expect(authority).toContain("workRequestId: candidate.workRequestId");
  });

  it("lists traditional contractor conversations by contractors.userId without dropping user keys", () => {
    const getThreadsStart = storage.indexOf("async getThreadsForUser(");
    const getThreadsEnd = storage.indexOf("async markMessageAsRead(", getThreadsStart);
    const getThreads = storage.slice(getThreadsStart, getThreadsEnd);

    expect(getThreads).toContain("eq(conversations.homeownerId, userId)");
    expect(getThreads).toContain("eq(conversations.contractorId, userId)");
    expect(getThreads).toContain("eq(contractors.id, conversations.contractorId)");
    expect(getThreads).toContain("eq(contractors.userId, userId)");

    const getConversationsStart = storage.indexOf("async getConversationsByUser(");
    const getConversationsEnd = storage.indexOf("async updateConversation(", getConversationsStart);
    const getConversations = storage.slice(getConversationsStart, getConversationsEnd);

    expect(getConversations).toContain("eq(conversations.contractorId, userId)");
    expect(getConversations).toContain("eq(contractors.id, conversations.contractorId)");
    expect(getConversations).toContain("eq(contractors.userId, userId)");
  });

  it("filters both legacy list surfaces through strict authority before returning content", () => {
    const threadList = routeBlock(routes, "get", "/api/messages/threads");
    const conversationList = routeBlock(routes, "get", "/api/conversations");

    for (const block of [threadList, conversationList]) {
      expect(block).toContain("resolveDirectConnectConversationAuthority");
      expect(block).toContain("isAuthorizedDirectConnectConversationParticipant");
      expect(block).toContain(".filter(Boolean)");
    }
    expect(threadList).toContain("const marketplaceThreads =");
    expect(conversationList).toContain('["homeowner", "contractor"]');
  });

  it("stamps legacy thread sends with the resolved request and assignment", () => {
    const send = routeBlock(routes, "post", "/api/messages/threads/:threadId/messages");
    const share = routeBlock(routes, "post", "/api/messages/threads/:threadId/home-report/share");

    expect(send).toContain("getDirectConnectConversationSenderType");
    expect(send).toContain('authority.conversationStatus !== "active"');
    expect(send).toContain("connectionId: authority.assignmentId");
    expect(send).toContain("assignmentId: authority.assignmentId");
    expect(send).toContain("workRequestId: authority.workRequestId");
    expect(share).toContain('authority.conversationStatus !== "active"');
  });
});
