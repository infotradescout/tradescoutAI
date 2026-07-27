import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

function routeBlock(
  source: string,
  method: "get" | "put" | "post" | "patch",
  route: string
): string {
  const markers = [`app.${method}(\n    "${route}"`, `app.${method}("${route}"`];
  const start = markers.map((marker) => source.indexOf(marker)).find((index) => index >= 0) as
    | number
    | undefined;
  expect(start, `Missing ${method.toUpperCase()} route ${route}`).toBeGreaterThan(-1);
  const routeStart = start as number;
  const end = source.indexOf("\n  app.", routeStart + route.length);
  return source.slice(routeStart, end === -1 ? source.length : end);
}

describe("Direct Connect message continuity contract", () => {
  const routes = read("server/routes.ts");
  const authority = read("server/services/directConnectConversationAuthority.ts");
  const messagingService = read("server/messaging-service.ts");
  const messagingHook = read("client/src/hooks/useMessaging.ts");
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
      ["post", "/api/conversations/:id/rate"],
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
    expect(authority).toContain(
      "const eventAssignmentId = normalizedId(acceptedEventMetadata.assignmentId)"
    );
    expect(authority).toContain("eq(workRequestAssignments.id, eventAssignmentId)");
    expect(authority).not.toContain(".limit(50)");
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

  it("filters every participant message history surface to the authorized request", () => {
    const threadList = routeBlock(routes, "get", "/api/messages/threads");
    const threadRead = routeBlock(routes, "get", "/api/messages/threads/:threadId");
    const markRead = routeBlock(routes, "put", "/api/messages/threads/:threadId/read");
    const legacyMessages = routeBlock(routes, "get", "/api/conversations/:id/messages");

    expect(authority).toContain("export function isDirectConnectMessageScopedToRequest");
    for (const block of [threadList, threadRead, markRead, legacyMessages]) {
      expect(block).toContain("isDirectConnectMessageScopedToRequest");
    }
  });

  it("applies the same exact authority and request scope to websocket messaging", () => {
    expect(messagingService).toContain("resolveDirectConnectConversationAuthority");
    expect(messagingService).toContain("isAuthorizedDirectConnectConversationParticipant");
    expect(messagingService).toContain("isDirectConnectMessageScopedToRequest");
    expect(messagingService).toContain("workRequestId: authority.workRequestId");
    expect(messagingService).toContain("assignmentId: authority.assignmentId");
    expect(messagingService).not.toContain("metadata: JSON.stringify(interactionMetadata)");
    expect(messagingService).toContain("sanitizeDirectConnectParticipantMessageMetadata");
    expect(messagingService).toContain(
      "sql`${messages.metadata} ->> 'workRequestId' = ${authority.workRequestId}`"
    );
    expect(messagingService).toContain(".orderBy(desc(messages.createdAt), desc(messages.id))");
    expect(messagingService).toMatch(
      /const newestMessageHistory = await db[\s\S]*?\.limit\(50\);[\s\S]*?const messageHistory = newestMessageHistory[\s\S]*?\.reverse\(\);/
    );
    expect(messagingService).not.toContain(".limit(100)");
    expect(messagingService).not.toContain(".slice(-50)");
  });

  it("only lets the recipient atomically mark an unread scoped message as read", () => {
    const markReadStart = messagingService.indexOf('socket.on("mark_read"');
    const markReadEnd = messagingService.indexOf("// Typing indicator", markReadStart);
    const markRead = messagingService.slice(markReadStart, markReadEnd);

    expect(markReadStart).toBeGreaterThanOrEqual(0);
    expect(markReadEnd).toBeGreaterThan(markReadStart);
    expect(markRead).toContain("String(message.senderId) === userId");
    expect(markRead).toContain("ne(messages.senderId, userId)");
    expect(markRead).toContain("isNull(messages.readAt)");
    expect(markRead).toContain(
      "sql`${messages.metadata} ->> 'workRequestId' = ${authority.workRequestId}`"
    );
    expect(markRead).toContain(".returning({ id: messages.id })");
    expect(markRead).toContain("alreadyRead: true");
    expect(markRead).not.toContain(
      "await db.update(messages).set({ readAt }).where(eq(messages.id, messageId))"
    );
  });

  it("binds every quote and material-list read or mutation to exact conversation authority", () => {
    const protectedArtifactRoutes = [
      ["post", "/api/quotes"],
      ["get", "/api/conversations/:id/quotes"],
      ["put", "/api/quotes/:id"],
      ["get", "/api/conversations/:id/material-lists"],
      ["post", "/api/material-lists"],
      ["post", "/api/material-lists/:id/suggestions"],
      ["patch", "/api/material-lists/:id/items/:itemId/status"],
    ] as const;

    for (const [method, route] of protectedArtifactRoutes) {
      const block = routeBlock(routes, method, route);
      expect(block).toContain("resolveAuthorizedDirectConnectArtifactConversation");
    }

    const quoteCreate = routeBlock(routes, "post", "/api/quotes");
    const quoteUpdate = routeBlock(routes, "put", "/api/quotes/:id");
    const materialCreate = routeBlock(routes, "post", "/api/material-lists");
    const suggestionCreate = routeBlock(routes, "post", "/api/material-lists/:id/suggestions");
    const itemDecision = routeBlock(
      routes,
      "patch",
      "/api/material-lists/:id/items/:itemId/status"
    );

    expect(quoteCreate).toContain("authority.providerUserId");
    expect(quoteCreate).toContain("contractorId: authority.contractorId");
    expect(quoteUpdate).toContain("storage.getQuote(req.params.id)");
    expect(quoteUpdate).toContain("existingQuote.conversationId");
    expect(quoteUpdate).not.toContain("storage.updateQuote(req.params.id, req.body)");
    expect(materialCreate).toContain("conversationId: authority.conversation.id");
    expect(materialCreate).toContain("contractorId: authority.contractorId");
    expect(materialCreate).not.toContain("contractorId: req.body.contractorId");
    expect(suggestionCreate).toContain("storage.getMaterialList(req.params.id)");
    expect(suggestionCreate).toContain("id: randomUUID()");
    expect(suggestionCreate).not.toContain("suggestedBy: req.body.suggestedBy");
    expect(itemDecision).toContain("storage.getMaterialList(req.params.id)");
    expect(itemDecision).toContain("COUNTERPART_DECISION_REQUIRED");
  });

  it("keeps background request rooms from contaminating the selected client thread", () => {
    expect(messagingHook).toContain("currentConversationRef.current");
    expect(messagingHook).toContain("message.conversationId === currentConversationRef.current");
    expect(messagingHook).toContain("prev.some((existing) => existing.id === message.id)");
    expect(messagingHook).toContain(
      "if (currentConversationRef.current !== conversationId) return"
    );
  });
});
