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
  const createRoute = routeSection(source, "post", "/api/admin/direct-connect/requests");
  const queueRoute = routeSection(source, "get", "/api/admin/direct-connect/requests");
  const detailRoute = routeSection(source, "get", "/api/admin/direct-connect/requests/:id");
  const routeRequestRoute = routeSection(
    source,
    "post",
    "/api/admin/direct-connect/requests/:id/route"
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

  it("never enables verification bypass from the admin route operation", () => {
    expect(routeRequestRoute).toContain("await routeRequestToTopContractors({");
    expect(routeRequestRoute).toContain("bypassVerificationGate: false");
    expect(routeRequestRoute).not.toContain("resolveDirectConnectVerificationBypass");
    expect(routeRequestRoute).not.toContain("adminBypassVerification");
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

  it("sends admin-created request email only after persistence using the canonical base", () => {
    const canonicalBase = sectionBetween(
      source,
      "const resolveCanonicalPublicBase",
      "const ensureShareTokenForRequest"
    );
    expect(canonicalBase).toContain("return resolveCanonicalTradeScoutBaseUrl(");
    expect(canonicalBase).toContain("process.env.PUBLIC_WEB_URL");
    expect(canonicalBase).toContain("process.env.APP_URL");
    expect(canonicalBase).toContain("process.env.APP_BASE_URL");
    expect(canonicalBase).not.toContain("parsed.origin");

    const insertIndex = createRoute.indexOf(".insert(workRequests)");
    const emailIndex = createRoute.indexOf("await emailService.sendEmail({");
    expect(insertIndex).toBeGreaterThanOrEqual(0);
    expect(emailIndex).toBeGreaterThan(insertIndex);
    expect(createRoute.indexOf('deliveryStatus: "pending"')).toBeLessThan(emailIndex);
    expect(createRoute).toContain("const publicBase = resolveCanonicalPublicBase();");
    expect(createRoute).toContain('purpose: "direct_connect_account_setup"');
    const emailDispatch = sectionBetween(
      createRoute,
      "if (targetEmailForNotification) {",
      "} else if (shouldSendSetupFlow) {"
    );
    expect(emailDispatch).not.toContain("resolveOrigin(req)");
  });
});
