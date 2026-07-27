import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("TradePartner Express durable email outbox contract", () => {
  const route = read("server/routes/tradepartner-express.ts");
  const notifications = read("server/notification-service.ts");
  const requestRouteStart = route.indexOf('"/api/tradepartner-profiles/:slug/express-request"');
  const requestRouteEnd = route.indexOf(
    '"/api/admin/tradepartner-express/test-notification-email"',
    requestRouteStart
  );
  const requestRoute = route.slice(requestRouteStart, requestRouteEnd);

  it("commits request state and both required email intents in one transaction", () => {
    const transactionStart = requestRoute.indexOf("const creationResult = await db.transaction");
    const requestInsert = requestRoute.indexOf(".insert(workRequests)", transactionStart);
    const assignmentInsert = requestRoute.indexOf(
      ".insert(workRequestAssignments)",
      transactionStart
    );
    const providerEnqueue = requestRoute.indexOf(
      "enqueueTradePartnerRequestNotification",
      transactionStart
    );
    const requesterSetupEnqueue = requestRoute.indexOf(
      "enqueueDirectConnectAccountSetupEmail",
      transactionStart
    );
    const requesterConfirmationEnqueue = requestRoute.indexOf(
      "enqueueDirectConnectRequestEmail",
      transactionStart
    );
    const eventInsert = requestRoute.indexOf(".insert(workRequestEvents)", transactionStart);
    const transactionCommitted = requestRoute.indexOf(
      "const created = creationResult.request",
      transactionStart
    );
    const outboxDispatch = requestRoute.indexOf(
      "notificationService.dispatchDirectConnectEmail",
      transactionCommitted
    );

    expect(transactionStart).toBeGreaterThan(-1);
    expect(requestInsert).toBeGreaterThan(transactionStart);
    expect(assignmentInsert).toBeGreaterThan(requestInsert);
    expect(providerEnqueue).toBeGreaterThan(assignmentInsert);
    expect(requesterSetupEnqueue).toBeGreaterThan(providerEnqueue);
    expect(requesterConfirmationEnqueue).toBeGreaterThan(providerEnqueue);
    expect(eventInsert).toBeGreaterThan(requesterSetupEnqueue);
    expect(transactionCommitted).toBeGreaterThan(eventInsert);
    expect(outboxDispatch).toBeGreaterThan(transactionCommitted);
  });

  it("preserves a shared business inbox as a typed owner-bound recipient", () => {
    expect(requestRoute).toContain("normalizeEmail(target.notificationEmail)");
    expect(requestRoute).toContain("normalizeEmail(target.ownerEmail)");
    expect(requestRoute).toContain("recipientEmail: providerRecipientEmail");
    expect(notifications).toContain('kind: "tradepartner_profile_request"');
    expect(notifications).toContain("ownerUserId,");
    expect(notifications).toContain("recipientEmail,");
    expect(notifications).toContain("templateOwnerUserId !== notificationUserId");
    expect(notifications).toContain("templateOwnerUserId !== recipientUserId");
    expect(notifications).toContain("to: recipientEmail");
  });

  it("keeps setup credentials claim-time only and never logs provider echoes", () => {
    const setupEnqueueStart = notifications.indexOf("async enqueueDirectConnectAccountSetupEmail");
    const setupEnqueueEnd = notifications.indexOf(
      "async enqueueTradePartnerRequestNotification",
      setupEnqueueStart
    );
    const setupEnqueue = notifications.slice(setupEnqueueStart, setupEnqueueEnd);
    const dispatchStart = requestRoute.indexOf("const dispatchDurableEmail");
    const dispatchEnd = requestRoute.indexOf("const requestWorkspaceParams", dispatchStart);
    const dispatch = requestRoute.slice(dispatchStart, dispatchEnd);

    expect(setupEnqueue).toContain('kind: "direct_connect_account_setup"');
    expect(setupEnqueue).toContain("userId,");
    expect(setupEnqueue).toContain("workRequestId,");
    expect(setupEnqueue).not.toMatch(/\btoken\b|reset-password|verify-email/i);
    expect(requestRoute).not.toContain("emailService.sendEmail");
    expect(requestRoute).not.toContain("passwordResetService.createToken");
    expect(requestRoute).not.toContain("emailVerificationService.createToken");
    expect(requestRoute).not.toMatch(/token=|reset-password\\?token|verify-email\\?token/i);
    expect(dispatch).toContain("[tradepartner-express] durable email remains queued");
    expect(dispatch).not.toContain("error,");
    expect(notifications).toContain('purpose !== "tradepartner_request_notification"');
    expect(notifications).toContain(
      'new Error("Operational Direct Connect email provider request failed.")'
    );
  });

  it("derives setup from durable requester state so a retry cannot strand a provisional user", () => {
    expect(requestRoute).toContain("const requesterNeedsSetup =");
    expect(requestRoute).toContain('typeof requester.password !== "string"');
    expect(requestRoute).toContain("requester.password.length === 0");
    expect(requestRoute).toContain("requester.emailVerified !== true");
    expect(requestRoute).toContain("const requesterNotification = requesterNeedsSetup");
    expect(requestRoute).toContain("const onboardingPath = requesterNeedsSetup");
    expect(requestRoute).toContain("accountNeedsSetup: requesterNeedsSetup");
  });
});
