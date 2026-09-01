import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..");

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/\r\n/g, "\n");
}

describe("direct-connect gate regressions", () => {
  it("uses fail-closed compliance filtering when requirements are explicit", () => {
    const routeFile = readRepoFile("server/routes/direct-connect.ts");

    expect(routeFile).toContain("const hasExplicitRequirements =");
    expect(routeFile).toContain(
      "gatedContractors = baseContractors.filter((c: any) => compliantIds.includes(c.id));"
    );
    expect(routeFile).toContain("businessCandidates = [];");

    // Regression guard: this previously caused fail-open behavior.
    expect(routeFile).not.toContain("if (compliantIds.length > 0)");
  });

  it("resolves county context from requester profile before routing", () => {
    const routeFile = readRepoFile("server/routes/direct-connect.ts");

    expect(routeFile).toContain("const requesterCountyIdRaw");
    expect(routeFile).toContain(".from(counties)");
    expect(routeFile).toContain("if (countyRecord && countyFips) {");
  });

  it("only allows expanded fallback routing when bypass mode is active", () => {
    const routeFile = readRepoFile("server/routes/direct-connect.ts");

    expect(routeFile).toContain("if (!countyRecord && !bypassVerificationGate) {");
    expect(routeFile).toContain("if (!baseContractors.length && bypassVerificationGate) {");
  });

  it("returns verification-required as non-2xx with explicit code", () => {
    const routeFile = readRepoFile("server/routes/direct-connect.ts");

    expect(routeFile).toContain("return res.status(428).json({");
    expect(routeFile).toContain('code: "VERIFICATION_REQUIRED"');
  });

  it("locks environment bypass in production and restricts manual bypass to admin paths", () => {
    const routeFile = readRepoFile("server/routes/direct-connect.ts");

    expect(routeFile).toContain(
      "const productionMode = isDirectConnectBypassProductionLockEnabled();"
    );
    expect(routeFile).toContain('const isAdminPath = req.path.startsWith("/api/admin/");');
    expect(routeFile).toContain('deniedReason: "manual_requires_admin_route"');
    expect(routeFile).toContain('deniedReason: "manual_disabled_in_production"');
    expect(routeFile).toContain('deniedReason: "environment_disabled_in_production"');
  });

  it("audits both bypass applied and bypass denied outcomes", () => {
    const routeFile = readRepoFile("server/routes/direct-connect.ts");

    expect(routeFile).toContain('"direct_connect_verification_bypass_applied"');
    expect(routeFile).toContain('"direct_connect_verification_bypass_denied"');
    expect(routeFile).toContain("bypassDeniedReason");
    expect(routeFile).toContain("productionMode");
  });

  it("keeps verification gate before request insertion path", () => {
    const routeFile = readRepoFile("server/routes/direct-connect.ts");

    const gateReturnIndex = routeFile.indexOf("return res.status(428).json({");
    const insertIndex = routeFile.indexOf(".insert(workRequests)");

    expect(gateReturnIndex).toBeGreaterThan(-1);
    expect(insertIndex).toBeGreaterThan(-1);
    expect(gateReturnIndex).toBeLessThan(insertIndex);
  });

  it("client request composers handle VERIFICATION_REQUIRED explicitly", () => {
    const tasksFile = readRepoFile("client/src/pages/tasks.tsx");
    const directConnectShellFile = readRepoFile(
      "client/src/pages/direct-connect/DirectConnectShell.tsx"
    );

    expect(tasksFile).toContain(
      'String(err?.code || "").toUpperCase() === "VERIFICATION_REQUIRED"'
    );
    expect(tasksFile).toContain("err?.status === 428");
    expect(tasksFile).toContain('navigate("/verification")');

    expect(directConnectShellFile).toContain(
      'String(error?.code || "").toUpperCase() === "VERIFICATION_REQUIRED"'
    );
    expect(directConnectShellFile).toContain("error?.status === 428");
    expect(directConnectShellFile).toContain('navigate("/verification")');
  });

  it("enforces fail-closed compliance for automatic top-contractor routing", () => {
    const routesFile = readRepoFile("server/routes.ts");

    expect(routesFile).toContain(
      "Automatic routing must fail closed when requirements are not met."
    );
    expect(routesFile).toContain(
      "const hasExplicitRequirements = requiresLicense || requiresInsurance || requiresEin;"
    );
    expect(routesFile).toContain(
      "gatedContractors = contractors.filter((c: any) => compliantIds.includes(c.id));"
    );

    // Regression guard: this used to fail open when no compliant providers existed.
    expect(routesFile).not.toContain("if (compliantIds.length > 0)");
  });

  it("preserves explicit user/staff targeting as a separate non-automatic path", () => {
    const routeFile = readRepoFile("server/routes/direct-connect.ts");

    expect(routeFile).toContain(
      "Explicit targeting preserves requester choice; this is not automatic routing."
    );
    expect(routeFile).toContain(
      "Staff-directed explicit targeting preserves individual choice for this request."
    );
    expect(routeFile).toContain("if (created && targetProviderIds.length > 0)");
    expect(routeFile).toContain("resolveTargetProviderIds(body)");
  });

  it("scopes direct-connect request listing to direct_connect source", () => {
    const routeFile = readRepoFile("server/routes/direct-connect.ts");

    expect(routeFile).toContain('eq(workRequests.source, "direct_connect" as any)');
  });

  it("uses supported expand reach API contract from the direct-connect shell", () => {
    const directConnectShellFile = readRepoFile(
      "client/src/pages/direct-connect/DirectConnectShell.tsx"
    );

    expect(directConnectShellFile).toContain(
      "`/api/direct-connect/requests/${requestId}/route?expand=true`"
    );
    expect(directConnectShellFile).not.toContain(
      "`/api/direct-connect/requests/${requestId}/expand`"
    );
  });

  it("unlocks request-card messaging when a request is actively accepted/in-progress", () => {
    const directConnectShellFile = readRepoFile(
      "client/src/pages/direct-connect/DirectConnectShell.tsx"
    );

    expect(directConnectShellFile).toMatch(
      /const canMessage\s*=\s*Boolean\(r\.dcConversationThreadId\)\s*\|\|\s*stage === "active_conversation";/
    );
  });

  it("shows open request controls and keeps Odd Jobs wired to the board view", () => {
    const directConnectShellFile = readRepoFile(
      "client/src/pages/direct-connect/DirectConnectShell.tsx"
    );

    expect(directConnectShellFile).toContain("type RequestFilter =");
    expect(directConnectShellFile).toContain('| "pending_outcome"');
    expect(directConnectShellFile).toContain("const REQUEST_FILTERS: RequestFilter[] = [");
    expect(directConnectShellFile).toContain('const canSend = stage === "ready_to_send";');
    expect(directConnectShellFile).toContain(
      '<TasksHub defaultCountyFips={defaultCountyFips} embedded defaultTab="browse" />'
    );
  });

  it("allows cancellation for open direct-connect requests", () => {
    const routeFile = readRepoFile("server/routes/direct-connect.ts");

    expect(routeFile).toContain('requestRow.status !== "open"');
    expect(routeFile).toContain("Only open, routed, or in-progress requests can be cancelled");
  });

  it("keeps Direct Connect organized around start and manage modes", () => {
    const directConnectShellFile = readRepoFile(
      "client/src/pages/direct-connect/DirectConnectShell.tsx"
    );

    expect(directConnectShellFile).toContain("Post a request");
    expect(directConnectShellFile).toContain("Manage requests");
    expect(directConnectShellFile).toContain('engagements: "My Requests"');
    expect(directConnectShellFile).toContain("Track your requests.");
    expect(directConnectShellFile).toContain(
      "See each request's status, replies, and next action in one place."
    );
    expect(directConnectShellFile).toContain("Review incoming work.");
    expect(directConnectShellFile).toContain(
      "Review incoming opportunities and continue accepted conversations in Messages."
    );
    expect(directConnectShellFile).toContain("Send to more pros");
    expect(directConnectShellFile).toContain("Review replies");
  });

  it("supports request photo attachments in Direct Connect", () => {
    const routeFile = readRepoFile("server/routes/direct-connect.ts");
    const directConnectShellFile = readRepoFile(
      "client/src/pages/direct-connect/DirectConnectShell.tsx"
    );

    expect(routeFile).toContain("const isPrivateAttachmentObjectKey =");
    expect(routeFile).toContain('if (!trimmed.startsWith("private/")) return false;');
    expect(routeFile).toContain("if (/^https?:\\/\\//i.test(trimmed)) return false;");
    expect(routeFile).toContain('"/api/direct-connect/requests/:id/attachments/:index"');
    expect(routeFile).toContain("attachmentCount: getAttachmentCount(requestRow)");
    expect(routeFile).not.toContain("return res.redirect(302, objectKey);");
    expect(directConnectShellFile).toContain("uploadPrivateObject(attachment.file)");
    expect(directConnectShellFile).toContain("Request photos");
    expect(directConnectShellFile).toContain("buildRequestAttachmentUrl");
  });

  it("requires structured fields when accepting a direct-connect reply", () => {
    const routeFile = readRepoFile("server/routes/direct-connect.ts");

    expect(routeFile).toContain("availabilityWindow: z.string().min(3).max(160).optional()");
    expect(routeFile).toContain(
      'priceBand: z.enum(["budget", "standard", "premium", "custom_quote"]).optional()'
    );
    expect(routeFile).toContain("scopeNote: z.string().min(10).max(400).optional()");
    expect(routeFile).toContain('if (payload.decision !== "accept") return true;');
    expect(routeFile).toContain("responseSummary");
  });

  it("keeps first-class reply actions visible in inbox", () => {
    const directConnectShellFile = readRepoFile(
      "client/src/pages/direct-connect/DirectConnectShell.tsx"
    );

    expect(directConnectShellFile).toContain("Structured reply");
    expect(directConnectShellFile).toContain("Open Messages");
    expect(directConnectShellFile).toContain("Archive");
    expect(directConnectShellFile).toContain("direct_connect_reply_accepted");
    expect(directConnectShellFile).toContain("direct_connect_moved_to_conversation");
    expect(directConnectShellFile).toContain('inbox: "Inbox"');
  });

  it("shows a request lifecycle rail and neutral local directory language", () => {
    const directConnectShellFile = readRepoFile(
      "client/src/pages/direct-connect/DirectConnectShell.tsx"
    );
    const directoryFile = readRepoFile("client/src/pages/direct-connect/DirectConnectPros.tsx");

    expect(directConnectShellFile).toContain("Request lifecycle");
    expect(directConnectShellFile).toContain('pros: "Businesses"');
    expect(directConnectShellFile).toContain('board: "Board"');
    expect(directoryFile).toContain("Find and inspect businesses");
    expect(directoryFile).toContain(
      'title={searchActive ? "Best nearby matches" : "Businesses near you"}'
    );
    expect(directoryFile).toContain(
      "Select a row to inspect one public profile without losing your place."
    );
    expect(directoryFile).toContain("No local businesses found for that search yet.");
    expect(directoryFile.match(/<ProviderCard\b/g)).toHaveLength(1);
    expect(directoryFile).toContain('aria-label="Business results"');
    expect(directoryFile).toContain('role="region"');
  });

  it("requires sender to choose direct targets or top-count dispatch before sending", () => {
    const directConnectShellFile = readRepoFile(
      "client/src/pages/direct-connect/DirectConnectShell.tsx"
    );

    expect(directConnectShellFile).toContain("Sign in to send");
    expect(directConnectShellFile).toContain("currentReturnPath");
    expect(directConnectShellFile).toContain("/pre-scout-setup?mode=signin&next=");
    expect(directConnectShellFile).toContain("Choose who can receive this request");
    expect(directConnectShellFile).toContain("Send to top local companies");
    expect(directConnectShellFile).toContain("How many companies should receive this request?");
    expect(directConnectShellFile).toMatch(
      /Ordered by distance, service fit, and available\s+trust evidence\./
    );
    expect(directConnectShellFile).not.toContain("Ordered by distance first, then CVS.");
    expect(directConnectShellFile).toContain("Continue without selection");
    expect(directConnectShellFile).toContain("targetProviderIds");
  });

  it("keeps admin/staff request creation manual by default with explicit auto-route skip", () => {
    const adminCardFile = readRepoFile(
      "client/src/components/admin/AdminDirectConnectRequestCard.tsx"
    );

    expect(adminCardFile).toContain("Create request (manual routing)");
    expect(adminCardFile).toContain("Skip manual routing and auto-route");
    expect(adminCardFile).toContain("payload.autoRoute = options.autoRoute;");
  });

  it("enforces eligibility-aware direct routing and exposes board eligibility metadata", () => {
    const routeFile = readRepoFile("server/routes/direct-connect.ts");
    const tasksFile = readRepoFile("client/src/pages/tasks.tsx");

    expect(routeFile).toContain("filterContractorsEligibleForRequest");
    expect(routeFile).toContain("filterBusinessesEligibleForRequest");
    expect(routeFile).toContain("outside_request_county");
    expect(routeFile).toContain("filterEligibleContractorsByTradeRequirements");
    expect(routeFile).toContain("excludedTargets");
    expect(routeFile).toContain("canSelectForResponse");
    expect(routeFile).toContain("viewerEligibility");
    expect(tasksFile).toContain("Eligible to respond");
    expect(tasksFile).toContain("Verification needed:");
  });

  it("keeps auto-routed requests open until assignments are actually created", () => {
    const routeFile = readRepoFile("server/routes/direct-connect.ts");

    expect(routeFile).toContain('status: "open" as const');
    expect(routeFile).toContain("routeRequestToTopContractors({");
    expect(routeFile).toContain('.set({ status: "routed", updatedAt: now })');
    expect(routeFile).not.toContain(
      'status: shouldAutoRoute ? ("routed" as const) : ("open" as const)'
    );
  });

  it("records giveaway eligibility without blocking Direct Connect request creation", () => {
    const routeFile = readRepoFile("server/routes/direct-connect.ts");
    const schemaFile = readRepoFile("shared/schema.ts");
    const migrationFile = readRepoFile("migrations/0097_direct_connect_giveaway_entries.sql");

    expect(schemaFile).toContain("export const directConnectGiveawayEntries = pgTable");
    expect(schemaFile).toContain('boolean("is_eligible").notNull().default(false)');
    expect(migrationFile).toContain("is_eligible boolean NOT NULL DEFAULT false");
    expect(routeFile).toContain('DIRECT_CONNECT_GIVEAWAY_ELIGIBLE_STATE = "FL"');
    expect(routeFile).toContain("residencyStateCode === DIRECT_CONNECT_GIVEAWAY_ELIGIBLE_STATE");
    expect(routeFile).toContain(".insert(directConnectGiveawayEntries)");
    expect(routeFile).toContain(
      "[direct-connect] Failed to record giveaway eligibility entry; continuing with request"
    );
  });

  it("rate-limits direct-connect write paths with the shared Postgres store", () => {
    const routeFile = readRepoFile("server/routes/direct-connect.ts");

    expect(routeFile).toContain("prefix: `rl:direct_connect:${prefix}`");
    expect(routeFile).toContain("DIRECT_CONNECT_CREATE_LIMIT_15M");
    expect(routeFile).toContain("DIRECT_CONNECT_WORKFLOW_LIMIT_1M");
    expect(routeFile).toContain("DIRECT_CONNECT_PROVIDER_RESPONSE_LIMIT_10M");
    expect(routeFile).toContain('readPositiveIntegerEnv("DIRECT_CONNECT_CREATE_LIMIT_15M", 12)');
    expect(routeFile).toContain('readPositiveIntegerEnv("DIRECT_CONNECT_WORKFLOW_LIMIT_1M", 90)');
    expect(routeFile).toContain(
      'readPositiveIntegerEnv("DIRECT_CONNECT_PROVIDER_RESPONSE_LIMIT_10M", 60)'
    );
    expect(routeFile).toContain('"DIRECT_CONNECT_RATE_LIMITED"');
    expect(routeFile).toContain(
      '"/api/direct-connect/requests",\n    isAuthenticated,\n    directConnectCreateLimiter'
    );
    expect(routeFile).toContain(
      '"/api/direct-connect/requests/:id/route",\n    isAuthenticated,\n    directConnectWorkflowLimiter'
    );
    expect(routeFile).toContain(
      '"/api/direct-connect/requests/:id/contact-gate",\n    isAuthenticated,\n    directConnectWorkflowLimiter'
    );
    expect(routeFile).toContain(
      '"/api/direct-connect/assignments/:id/contact",\n    isAuthenticated,\n    directConnectProviderResponseLimiter'
    );
    expect(routeFile).toContain(
      '"/api/direct-connect/assignments/:id/respond",\n    isAuthenticated,\n    directConnectProviderResponseLimiter'
    );
    expect(routeFile).toContain(
      '"/api/direct-connect/requests/:id/express-interest",\n    isAuthenticated,\n    directConnectProviderResponseLimiter'
    );
  });

  it("allows universal provider assignments to view direct-connect attachments", () => {
    const routeFile = readRepoFile("server/routes/direct-connect.ts");

    expect(routeFile).toContain("canResponderUserAccessRequest");
    expect(routeFile).toContain(
      "eq((workRequestAssignments as any).responderUserId, String(userId))"
    );
    expect(routeFile).toContain("const hasAccess = await canResponderUserAccessRequest");
  });

  it("keeps support discovery separate from governed contact authority", () => {
    const helperFile = readRepoFile("server/utils/superAdminConnection.ts");

    expect(helperFile).toContain("insert into user_follows");
    expect(helperFile).not.toContain("contact_permissions");
    expect(helperFile).not.toContain("system_super_admin_auto");
    expect(helperFile).not.toContain("platform_support");
  });
});
