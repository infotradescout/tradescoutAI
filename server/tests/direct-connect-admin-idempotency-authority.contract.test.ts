import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const sectionBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex, `missing section start: ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `missing section end: ${end}`).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe("Direct Connect admin idempotency and assisted authority contracts", () => {
  const source = read("server/routes/direct-connect.ts");
  const createRoute = sectionBetween(
    source,
    '"/api/admin/direct-connect/requests"',
    '"/api/admin/direct-connect/requests/:id"'
  );
  const assistedReplyRoute = sectionBetween(
    source,
    '"/api/admin/direct-connect/requests/:id/assisted-reply"',
    '"/api/direct-connect/inbox"'
  );
  const requestCard = read("client/src/components/admin/AdminDirectConnectRequestCard.tsx");
  const requestDetail = read("client/src/components/admin/AdminDirectConnectRequestDetail.tsx");

  it("requires and persists stable client operation IDs across unknown-result retries", () => {
    const adminSchema = sectionBetween(
      source,
      "const adminDirectConnectRequestSchema",
      "const assignmentResponseSchema"
    );
    const assistedSchema = sectionBetween(
      source,
      "const directConnectAdminAssistedReplySchema",
      "const isDirectConnectOperator"
    );
    expect(adminSchema).toContain("operationId: z");
    expect(assistedSchema).toContain("operationId: z");

    expect(requestCard).toContain("const pendingCreateOperationId = useRef<string | null>(null)");
    expect(requestCard).toContain("pendingCreateOperationId.current ||");
    expect(requestCard).toContain("pendingCreateOperationId.current = operationId");
    expect(requestCard).toContain("pendingCreateOperationId.current = null");
    expect(requestDetail).toContain(
      "const pendingAssistedReplyOperationId = useRef<string | null>(null)"
    );
    expect(requestDetail).toContain("pendingAssistedReplyOperationId.current ||");
    expect(requestDetail).toContain("pendingAssistedReplyOperationId.current = operationId");
    expect(requestDetail).toContain("pendingAssistedReplyOperationId.current = null");
  });

  it("deduplicates admin create under a cross-instance lock and rejects key reuse", () => {
    const lockIndex = createRoute.indexOf("pg_advisory_lock");
    const lookupIndex = createRoute.indexOf("const existingOperations = await db");
    const requestInsertIndex = createRoute.indexOf(".insert(workRequests)");
    const operationEventIndex = createRoute.indexOf('operation: "admin_create_request"');

    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(lookupIndex).toBeGreaterThan(lockIndex);
    expect(createRoute).toContain("operationPayloadFingerprint");
    expect(createRoute).toContain("existingOperations.length > 1");
    expect(createRoute).toContain(
      "This operationId was already used with a different request payload."
    );
    expect(createRoute).toContain("const creationResult = await db.transaction(async (tx: any)");
    expect(requestInsertIndex).toBeGreaterThan(lookupIndex);
    expect(operationEventIndex).toBeGreaterThan(requestInsertIndex);
    expect(createRoute).toContain("operationId: body.operationId");
    expect(createRoute).toContain("payloadFingerprint: operationPayloadFingerprint");
    expect(createRoute).toContain("pg_advisory_unlock");
    expect(createRoute).toContain("operationLockClient.release()");
  });

  it("records pending admin email evidence before send and retains errors for operators", () => {
    const pendingIndex = createRoute.indexOf('deliveryStatus: "pending"');
    const sendIndex = createRoute.indexOf("await emailService.sendEmail({");
    const finalIndex = createRoute.indexOf(".update(workRequestEvents)", sendIndex);

    expect(pendingIndex).toBeGreaterThanOrEqual(0);
    expect(sendIndex).toBeGreaterThan(pendingIndex);
    expect(finalIndex).toBeGreaterThan(sendIndex);
    expect(createRoute).toContain("emailProviderErrorMessage = redactContactDetails(");
    expect(createRoute).toContain(".slice(0, 500)");
    expect(createRoute).toContain("errorMessage: emailProviderErrorMessage");
    expect(createRoute).toContain("Admin email dispatch evidence remained pending");
  });

  it("locks and revalidates exact assisted authority before one atomic message/event write", () => {
    const transactionIndex = assistedReplyRoute.indexOf(
      "const outcome = await db.transaction(async (tx: any)"
    );
    const requestLockIndex = assistedReplyRoute.indexOf("FROM work_requests");
    const authorityIndex = assistedReplyRoute.indexOf(
      "await resolveDirectConnectConversationAuthority("
    );
    const assignmentLockIndex = assistedReplyRoute.indexOf("FROM work_request_assignments wra");
    const conversationLockIndex = assistedReplyRoute.indexOf("FROM conversations");
    const messageInsertIndex = assistedReplyRoute.indexOf(".insert(messages)");
    const eventInsertIndex = assistedReplyRoute.indexOf(
      "await tx.insert(workRequestEvents).values",
      messageInsertIndex
    );
    const notifyIndex = assistedReplyRoute.indexOf("await notificationService.createNotification");

    expect(transactionIndex).toBeGreaterThanOrEqual(0);
    expect(assistedReplyRoute).toContain("pg_advisory_xact_lock");
    expect(assistedReplyRoute).toContain("metadata ->> 'operationId' = ${operationId}");
    expect(assistedReplyRoute).toContain("operationPayloadFingerprint");
    expect(assistedReplyRoute).toContain(
      "This operationId was already used with different assisted-reply content."
    );
    expect(assistedReplyRoute).toContain("payloadFingerprint: operationPayloadFingerprint");
    expect(requestLockIndex).toBeGreaterThan(transactionIndex);
    expect(authorityIndex).toBeGreaterThan(requestLockIndex);
    expect(assignmentLockIndex).toBeGreaterThan(authorityIndex);
    expect(conversationLockIndex).toBeGreaterThan(assignmentLockIndex);
    expect(assistedReplyRoute).toContain('String(assignment.status || "") !== "accepted"');
    expect(assistedReplyRoute).toContain('String(lockedConversation.status || "") !== "active"');
    expect(assistedReplyRoute).toContain("String(latestAcceptance.id) !==");
    expect(messageInsertIndex).toBeGreaterThan(conversationLockIndex);
    expect(eventInsertIndex).toBeGreaterThan(messageInsertIndex);
    expect(notifyIndex).toBeGreaterThan(eventInsertIndex);
    expect(assistedReplyRoute).toContain("senderId: actorUserId");
    expect(assistedReplyRoute).toContain('senderType: "staff"');
    expect(assistedReplyRoute).not.toContain("senderId: representedProviderUserId");
    expect(assistedReplyRoute).not.toContain("storage.createMessage");
    expect(assistedReplyRoute).not.toContain('assignment.status === "accepted"');
  });

  it("labels assisted requester notifications as staff activity", () => {
    expect(assistedReplyRoute).toContain('title: "TradeScout staff assisted with your request"');
    expect(assistedReplyRoute).toContain(
      "TradeScout staff sent an assisted update for the accepted provider"
    );
    expect(assistedReplyRoute).not.toContain("${representedProviderName} sent an update");
  });

  it("scopes admin conversation history to the selected request", () => {
    const adminDetail = sectionBetween(
      source,
      '"/api/admin/direct-connect/requests/:id"',
      '"/api/admin/direct-connect/requests/:id/route"'
    );
    expect(adminDetail).toContain("conversationMessageRows.filter");
    expect(adminDetail).toContain(
      'String(metadata.workRequestId || "") === requestId'
    );
  });
});
