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

describe("Direct Connect routing and Express delivery evidence contracts", () => {
  const directConnect = read("server/routes/direct-connect.ts");
  const express = read("server/routes/tradepartner-express.ts");
  const routingHelper = sectionBetween(
    directConnect,
    "const routeRequestToTopContractors",
    "// Requester-facing: route an open Direct Connect request"
  );
  const adminRoute = sectionBetween(
    directConnect,
    '"/api/admin/direct-connect/requests/:id/route"',
    '"/api/admin/direct-connect/requests/:id/resend-notifications"'
  );
  const adminDetail = sectionBetween(
    directConnect,
    '"/api/admin/direct-connect/requests/:id"',
    '"/api/admin/direct-connect/requests/:id/route"'
  );
  const expressRequest = sectionBetween(
    express,
    '"/api/tradepartner-profiles/:slug/express-request"',
    '"/api/admin/tradepartner-express/test-notification-email"'
  );

  it("never lets expand reach bypass explicit trade verification", () => {
    expect(routingHelper).toContain(
      "if (requirements && hasExplicitRequirements && !bypassVerificationGate)"
    );
    expect(routingHelper).not.toMatch(
      /!expandReach\s*&&\s*requirements\s*&&\s*hasExplicitRequirements/
    );
  });

  it("serializes admin route and expand, mutates atomically, then notifies after commit", () => {
    const lockIndex = adminRoute.indexOf("pg_advisory_xact_lock");
    const rereadIndex = adminRoute.indexOf("const [request] = await tx");
    const routeIndex = adminRoute.indexOf("await routeRequestToTopContractors({");
    const notifyIndex = adminRoute.indexOf(
      "await dispatchDurableDirectConnectNotifications(deferredNotificationIds)"
    );

    expect(adminRoute).toContain("const routingOutcome = await db.transaction(async (tx: any)");
    expect(adminRoute).toContain("hashtextextended(${routingLockKey}, 0)");
    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(rereadIndex).toBeGreaterThan(lockIndex);
    expect(routeIndex).toBeGreaterThan(rereadIndex);
    expect(adminRoute).toContain("mutationTx: tx");
    expect(adminRoute).toContain("deferProviderNotifications: true");
    expect(adminRoute).toContain("deferredNotificationIds = []");
    expect(notifyIndex).toBeGreaterThan(routeIndex);

    expect(routingHelper).toContain("const persistRoutingMutation = async (tx: any)");
    expect(routingHelper).toContain("FOR UPDATE");
    expect(routingHelper).toContain(".insert(workRequestAssignments)");
    expect(routingHelper).toContain(".onConflictDoNothing()");
    expect(routingHelper).toContain("await tx.insert(workRequestEvents).values(insertedEvents)");
    expect(routingHelper).toContain(".update(workRequests)");
    expect(routingHelper).toContain(
      "mutationTx\n      ? await persistRoutingMutation(mutationTx)\n      : await db.transaction(persistRoutingMutation)"
    );
  });

  it("uses one metadata key from Express producer through the admin evidence consumer", () => {
    expect(expressRequest).toContain("workRequestId: String(request.id)");
    expect(expressRequest).not.toContain("requestId: String(request.id),\n            },");
    expect(adminDetail).toContain("n.metadata ->> 'workRequestId' = $1");
    expect(adminDetail).toContain(
      'metadata.operation === "tradepartner_notification_email_dispatch"'
    );
    expect(adminDetail).toContain("errorMessage: metadata.errorMessage || null");
  });

  it("persists both Express email intents and linked evidence in the request transaction", () => {
    const transactionIndex = expressRequest.indexOf("const creationResult = await db.transaction");
    const requestIndex = expressRequest.indexOf(".insert(workRequests)", transactionIndex);
    const assignmentIndex = expressRequest.indexOf(
      ".insert(workRequestAssignments)",
      transactionIndex
    );
    const providerEnqueueIndex = expressRequest.indexOf(
      "enqueueTradePartnerRequestNotification",
      transactionIndex
    );
    const requesterSetupIndex = expressRequest.indexOf(
      "enqueueDirectConnectAccountSetupEmail",
      transactionIndex
    );
    const requesterConfirmationIndex = expressRequest.indexOf(
      "enqueueDirectConnectRequestEmail",
      transactionIndex
    );
    const pendingEvidenceIndex = expressRequest.indexOf(
      'operation: "tradepartner_notification_email_dispatch"'
    );
    const requesterEvidenceIndex = expressRequest.indexOf(
      'operation: "tradepartner_requester_email_dispatch"'
    );
    const commitIndex = expressRequest.indexOf("const created = creationResult.request");
    const dispatchIndex = expressRequest.indexOf(
      "notificationService.dispatchDirectConnectEmail",
      commitIndex
    );

    expect(transactionIndex).toBeGreaterThanOrEqual(0);
    expect(requestIndex).toBeGreaterThan(transactionIndex);
    expect(assignmentIndex).toBeGreaterThan(requestIndex);
    expect(providerEnqueueIndex).toBeGreaterThan(assignmentIndex);
    expect(requesterSetupIndex).toBeGreaterThan(providerEnqueueIndex);
    expect(requesterConfirmationIndex).toBeGreaterThan(providerEnqueueIndex);
    expect(pendingEvidenceIndex).toBeGreaterThan(providerEnqueueIndex);
    expect(requesterEvidenceIndex).toBeGreaterThan(requesterSetupIndex);
    expect(commitIndex).toBeGreaterThan(requesterEvidenceIndex);
    expect(dispatchIndex).toBeGreaterThan(commitIndex);
    expect(expressRequest).toContain("notificationId: providerNotification.notification.id");
    expect(expressRequest).toContain("deliveryIntentId: providerNotification.delivery?.id || null");
    expect(expressRequest).toContain("notificationId: requesterNotification.notification.id");
    expect(expressRequest).not.toContain("emailService.sendEmail");
  });

  it("redacts every provider-visible free-text field and reports submission separately from email", () => {
    expect(expressRequest).toContain("redactContactDetails(body.message)");
    expect(expressRequest).toContain("redactContactDetails(body.name)");
    expect(expressRequest).toContain("redactContactDetails(body.stoneName)");
    expect(expressRequest).toContain("providerVisibleName");
    expect(expressRequest).toContain("providerVisibleStoneName");
    expect(expressRequest).not.toContain("delivered: true");
    expect(expressRequest).toContain("submitted: true");
    expect(expressRequest).toContain("requestPersisted: true");
    expect(expressRequest).toContain("providerNotificationEmail: {");
    expect(expressRequest).toContain("status: providerNotificationEmailStatus");
    const responseBlock = sectionBetween(
      expressRequest,
      "providerNotificationEmail: {",
      "accountCreated: requesterWasCreated"
    );
    expect(responseBlock).not.toContain("provider:");
    expect(responseBlock).not.toContain("messageId:");
  });
});
