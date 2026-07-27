import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sectionBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex, `missing section start: ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `missing section end: ${end}`).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

const routeSection = (source: string, method: string, routePath: string) => {
  const startPattern = new RegExp(`app\\.${method}\\(\\s*["']${escapeRegExp(routePath)}["']`);
  const startMatch = startPattern.exec(source);
  expect(startMatch, `missing ${method.toUpperCase()} ${routePath}`).not.toBeNull();
  const startIndex = startMatch?.index ?? -1;
  const nextRoutePattern = /app\.(?:get|post|put|patch|delete)\(/g;
  nextRoutePattern.lastIndex = startIndex + (startMatch?.[0].length ?? 0);
  const nextRoute = nextRoutePattern.exec(source);
  return source.slice(startIndex, nextRoute?.index ?? source.length);
};

describe("Direct Connect admin operations contracts", () => {
  const source = read("server/routes/direct-connect.ts");
  const notificationService = read("server/notification-service.ts");
  const adminDetailUi = read("client/src/components/admin/AdminDirectConnectRequestDetail.tsx");
  const createRoute = routeSection(source, "post", "/api/admin/direct-connect/requests");
  const queueRoute = routeSection(source, "get", "/api/admin/direct-connect/requests");
  const detailRoute = routeSection(source, "get", "/api/admin/direct-connect/requests/:id");
  const routeRequestRoute = routeSection(
    source,
    "post",
    "/api/admin/direct-connect/requests/:id/route"
  );
  const manualAssignmentRoute = routeSection(
    source,
    "post",
    "/api/admin/direct-connect/requests/:id/manual-assignment"
  );
  const resendRoute = routeSection(
    source,
    "post",
    "/api/admin/direct-connect/requests/:id/resend-notifications"
  );
  const assistedReplyRoute = routeSection(
    source,
    "post",
    "/api/admin/direct-connect/requests/:id/assisted-reply"
  );

  it("authenticates and operator-gates every Direct Connect admin endpoint", () => {
    const registrations = Array.from(
      source.matchAll(
        /app\.(get|post|put|patch|delete)\(\s*["'](\/api\/admin\/direct-connect[^"']*)["']\s*,([\s\S]*?)async\s*\(/g
      )
    );
    const registeredEndpoints = registrations
      .map((match) => `${match[1].toUpperCase()} ${match[2]}`)
      .sort();

    expect(registeredEndpoints).toEqual(
      [
        "POST /api/admin/direct-connect/requests",
        "GET /api/admin/direct-connect/requests",
        "GET /api/admin/direct-connect/requests/:id",
        "POST /api/admin/direct-connect/requests/:id/route",
        "POST /api/admin/direct-connect/requests/:id/manual-assignment",
        "POST /api/admin/direct-connect/requests/:id/resend-notifications",
        "POST /api/admin/direct-connect/requests/:id/assisted-reply",
      ].sort()
    );
    for (const registration of registrations) {
      expect(registration[3].replace(/\s/g, "")).toBe("isAuthenticated,isDirectConnectOperator,");
    }
    expect(source).toContain(
      'const isDirectConnectOperator = requireRole(["ops_admin", "super_admin"]);'
    );
  });

  it("uses only canonical statuses and validates offset pagination", () => {
    const statuses = sectionBetween(
      source,
      "export const DIRECT_CONNECT_ADMIN_STATUSES = [",
      "] as const;"
    );
    expect(Array.from(statuses.matchAll(/"([^"]+)"/g), (match) => match[1])).toEqual([
      "draft",
      "open",
      "routed",
      "in_progress",
      "pending_outcome",
      "completed",
      "cancelled",
    ]);

    const queueSchema = sectionBetween(
      source,
      "const directConnectAdminQueueSchema",
      "const directConnectAdminRouteSchema"
    );
    expect(queueSchema).toContain(
      'status: z.enum(["all", ...DIRECT_CONNECT_ADMIN_STATUSES]).default("all")'
    );
    expect(queueSchema).toContain("offset: z.coerce.number().int().min(0).default(0)");
    expect(queueRoute).toContain("offset: req.query.offset");
    expect(queueRoute).toContain("params.push(offset);");
    expect(queueRoute).toContain("OFFSET $${offsetParameter}");
  });

  it("hard-filters the queue to Direct Connect and uses limit-plus-one pagination", () => {
    expect(queueRoute).toContain(
      "const filters: string[] = [`wr.source::text = 'direct_connect'`];"
    );
    expect(queueRoute).toContain('WHERE ${filters.join(" AND ")}');
    expect(queueRoute).toContain("params.push(limit + 1);");
    expect(queueRoute).toContain("const hasMore = result.rows.length > limit;");
    expect(queueRoute).toContain("const requests = result.rows.slice(0, limit);");
    expect(queueRoute).toContain("hasMore,");
    expect(queueRoute).toContain("nextOffset: hasMore ? offset + requests.length : null");
  });

  it("loads only the exact conversation recorded by a provider-accepted event", () => {
    const exactConversationLoader = sectionBetween(
      source,
      "const loadExactDirectConnectConversation",
      "const resolveAdminAssignmentProviders"
    );
    expect(exactConversationLoader).toContain(
      'eq(workRequestEvents.type, "provider_accepted" as any)'
    );
    expect(exactConversationLoader).toContain(
      'const conversationId = String(metadata.conversationId || "").trim();'
    );
    expect(exactConversationLoader).toContain("eq(conversations.id, conversationId)");
    expect(exactConversationLoader).toContain("eq(conversations.homeownerId, requesterUserId)");
    expect(exactConversationLoader).toContain("return null;");
    expect(exactConversationLoader).not.toContain("conversations.contractorId");
    expect(exactConversationLoader).not.toContain("getOrCreateConversation");
    expect(exactConversationLoader).not.toContain("responderUserId");
    expect(detailRoute).toContain("await loadExactDirectConnectConversation(");
    expect(detailRoute).not.toContain("getOrCreateConversation");
  });

  it("resolves contractor, responder, and worker provider identities", () => {
    const providerResolver = sectionBetween(
      source,
      "const resolveAdminAssignmentProviders",
      "// Direct Connect operations queue"
    );
    expect(providerResolver).toContain("assignment.responderUserId");
    expect(providerResolver).toContain("contractor?.userId");
    expect(providerResolver).toContain("worker?.userId");
    expect(providerResolver).toContain("providerIdentityConflict");
    expect(providerResolver).toContain("entityProviderUserId || responderUserId");
    expect(providerResolver).not.toContain("assignment.responderUserId || contractor?.userId");
    expect(providerResolver).toContain('? "contractor"');
    expect(providerResolver).toContain('? "worker"');
    expect(providerResolver).toContain('? "business_or_user"');
    expect(detailRoute).toContain("contractorId: assignment.contractorId");
    expect(detailRoute).toContain("responderUserId: assignment.responderUserId");
    expect(detailRoute).toContain("workerId: assignment.workerId");
  });

  it("returns provider delivery IDs and failure evidence in request detail", () => {
    expect(detailRoute).toContain('ndl.external_id AS "externalId"');
    expect(detailRoute).toContain('ndl.error_code AS "errorCode"');
    expect(detailRoute).toContain('ndl.error_message AS "errorMessage"');
    expect(detailRoute).toContain("n.metadata ->> 'workRequestId' = $1");
    expect(detailRoute).toContain("deliveries,");
    expect(detailRoute).toContain("deliveryEvidenceIssue,");
  });

  it("loads typed account-setup delivery evidence with request and recipient scoping", () => {
    const deliveryQuery = sectionBetween(
      detailRoute,
      "const deliveryResult = await pool.query(",
      "deliveries = deliveryResult.rows;"
    );
    expect(deliveryQuery).toContain(
      "n.metadata ->> 'emailPurpose' = 'direct_connect_account_setup'"
    );
    expect(deliveryQuery).toContain("n.metadata -> 'emailTemplate' ->> 'kind' =");
    expect(deliveryQuery).toContain("'direct_connect_account_setup'");
    expect(deliveryQuery).toContain("n.metadata -> 'emailTemplate' ->> 'workRequestId' = $1");
    expect(deliveryQuery).toContain("n.user_id = $2");
    expect(deliveryQuery).toContain("[requestId, String(request.createdByUserId)]");
    expect(deliveryQuery).not.toMatch(/\btoken\b|reset-password|verify-email/i);
  });

  it("falls back to request-scoped audit evidence unless the exact durable intent loaded", () => {
    expect(detailRoute).toContain("const loadedDurableEvidenceKeys = new Set(");
    expect(detailRoute).toContain("`${String(delivery.notificationId)}:${String(delivery.id)}`");
    expect(detailRoute).toContain(
      "`${String(metadata.notificationId)}:${String(metadata.deliveryIntentId)}`"
    );
    expect(detailRoute).toContain("loadedDurableEvidenceKeys.has(durableEvidenceKey)");
    expect(detailRoute).not.toContain(
      "if (metadata.notificationId && metadata.deliveryIntentId) continue;"
    );
  });

  it("never enables verification bypass from the admin route operation", () => {
    expect(routeRequestRoute).toContain("await routeRequestToTopContractors({");
    expect(routeRequestRoute).toContain("bypassVerificationGate: false");
    expect(routeRequestRoute).not.toContain("resolveDirectConnectVerificationBypass");
    expect(routeRequestRoute).not.toContain("adminBypassVerification");
  });

  it("assigns one explicit provider without bypassing county, trade, or verification gates", () => {
    expect(manualAssignmentRoute).toContain(
      "directConnectAdminManualAssignmentSchema.safeParse(req.body ?? {})"
    );
    expect(manualAssignmentRoute.indexOf("const [replayEvent] = await db")).toBeLessThan(
      manualAssignmentRoute.indexOf("await loadDirectConnectRequest(requestId)")
    );
    expect(manualAssignmentRoute).toContain("idempotentReplay: true");
    expect(source).toContain('providerType: z.enum(["contractor", "business"])');
    expect(manualAssignmentRoute).toContain(
      "await filterContractorsEligibleForRequest([contractor], request)"
    );
    expect(manualAssignmentRoute).toContain(
      "await filterBusinessesEligibleForRequest([business], request)"
    );
    expect(manualAssignmentRoute).toContain('code: "PROVIDER_NOT_ELIGIBLE"');
    expect(manualAssignmentRoute).toContain("pg_advisory_xact_lock");
    expect(manualAssignmentRoute).toContain("FOR UPDATE");
    expect(manualAssignmentRoute).toContain(
      "await filterContractorsEligibleForRequest([contractor], lockedRequest)"
    );
    expect(manualAssignmentRoute).toContain(
      "await filterBusinessesEligibleForRequest([business], lockedRequest)"
    );
    expect(manualAssignmentRoute).toContain("direct-connect-manual-assignment-operation:");
    expect(manualAssignmentRoute).toContain("direct-connect-manual-assignment-provider:");
    expect(manualAssignmentRoute).toContain(
      "This operationId was already used for a different manual provider assignment."
    );
    expect(manualAssignmentRoute).toContain(
      "eq(workRequestAssignments.providerKey, assignmentProviderKey)"
    );
    expect(manualAssignmentRoute).toContain('["declined", "withdrawn"]');
    expect(manualAssignmentRoute).toContain(".onConflictDoNothing()");
    expect(manualAssignmentRoute).toContain('operation: "staff_manual_provider_assignment"');
    expect(manualAssignmentRoute).toContain('routingMode: "staff_manual"');
    expect(manualAssignmentRoute).toContain('status: "invited" as const');
    expect(manualAssignmentRoute).toContain('emailPurpose: "direct_connect_request"');
    expect(manualAssignmentRoute).toContain('notificationContext: "staff_manual_assignment"');
    expect(manualAssignmentRoute).toContain('action: "admin_direct_connect_manual_assignment"');
    expect(manualAssignmentRoute).not.toContain("bypassVerificationGate: true");
    expect(manualAssignmentRoute).not.toContain("adminBypassVerification");
    expect(adminDetailUi).toContain("Assign a specific provider");
    expect(adminDetailUi).toContain('aria-label="Search provider for manual assignment"');
    expect(adminDetailUi).toContain('aria-label="Reason for manual provider assignment"');
    expect(adminDetailUi).toContain(
      "`/api/admin/direct-connect/requests/${requestId}/manual-assignment`"
    );
    expect(adminDetailUi).toContain("County, trade, and verification gates remain enforced.");
  });

  it("resends provider notifications through email with explicit request metadata", () => {
    expect(resendRoute).toContain("workRequestId: requestId");
    expect(resendRoute).toContain('emailPurpose: "direct_connect_request"');
    expect(resendRoute).toContain('notificationContext: "admin_resend"');
    expect(resendRoute).toContain('deliveryMethods: ["in_app", "email", "push"]');
  });

  it("requires an active accepted conversation for visibly staff-assisted replies", () => {
    expect(assistedReplyRoute).toContain('["in_progress", "pending_outcome"].includes(');
    expect(assistedReplyRoute).toContain(
      "Assisted replies require an active accepted Direct Connect engagement."
    );
    expect(assistedReplyRoute).toContain("await loadExactDirectConnectConversation(");
    expect(assistedReplyRoute).toContain("await resolveDirectConnectConversationAuthority(");
    expect(assistedReplyRoute).toContain('authority.conversationStatus !== "active"');
    expect(assistedReplyRoute).toContain('String(assignment.status || "") !== "accepted"');
    expect(assistedReplyRoute).toContain("No request-linked accepted conversation is available.");
    expect(assistedReplyRoute).toContain(
      "const visibleContent = `TradeScout staff, assisting ${representedProviderName}: ${parsed.data.content}`"
    );
    expect(assistedReplyRoute).toContain("staffAssisted: true");
    expect(assistedReplyRoute).toContain("staffActorUserId: actorUserId");
    expect(assistedReplyRoute).toContain("staffReason: parsed.data.reason");
    expect(assistedReplyRoute).toContain('operation: "staff_assisted_reply"');
    expect(assistedReplyRoute).toContain("operationId,");
    expect(assistedReplyRoute).toContain('action: "admin_direct_connect_assisted_reply"');
    expect(assistedReplyRoute).toContain("conversationId,");
    expect(assistedReplyRoute).toContain("messageId: message.id");
    expect(assistedReplyRoute).toContain("representedProviderUserId,");
    expect(assistedReplyRoute).not.toContain('assignment.status === "accepted"');
    expect(assistedReplyRoute).not.toContain("storage.createMessage");
  });

  it("durably queues admin-created setup email before canonical claim-time rendering", () => {
    const canonicalBase = sectionBetween(
      notificationService,
      "export function resolveCanonicalTradeScoutBaseUrl",
      "export function resolveNotificationEmailActionUrl"
    );
    expect(canonicalBase).toContain("CANONICAL_TRADESCOUT_BASE_URL");
    expect(notificationService).toContain(
      "const canonicalBaseUrl = resolveCanonicalTradeScoutBaseUrl(candidateBaseUrl)"
    );

    const insertIndex = createRoute.indexOf(".insert(workRequests)");
    const setupEnqueueIndex = createRoute.indexOf(
      "notificationService.enqueueDirectConnectAccountSetupEmail"
    );
    const requestEnqueueIndex = createRoute.indexOf(
      "notificationService.enqueueDirectConnectRequestEmail"
    );
    const creationDoneIndex = createRoute.indexOf("const created = creationResult.request");
    const dispatchIndex = createRoute.indexOf("notificationService.dispatchDirectConnectEmail");
    expect(insertIndex).toBeGreaterThanOrEqual(0);
    expect(setupEnqueueIndex).toBeGreaterThan(insertIndex);
    expect(requestEnqueueIndex).toBeGreaterThan(insertIndex);
    expect(setupEnqueueIndex).toBeLessThan(creationDoneIndex);
    expect(requestEnqueueIndex).toBeLessThan(creationDoneIndex);
    expect(dispatchIndex).toBeGreaterThan(creationDoneIndex);
    expect(createRoute.indexOf('deliveryStatus: "pending"')).toBeLessThan(dispatchIndex);
    expect(createRoute).not.toContain("emailService.sendEmail");
    expect(createRoute).not.toContain("passwordResetService.createToken");
    expect(createRoute).not.toContain("emailVerificationService.createToken");
    expect(notificationService).toContain('emailPurpose: "direct_connect_account_setup"');
  });
});
