import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..");

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("direct-connect gate regressions", () => {
  it("uses fail-closed compliance filtering when requirements are explicit", () => {
    const routeFile = readRepoFile("server/routes/direct-connect.ts");

    expect(routeFile).toContain("const hasExplicitRequirements =");
    expect(routeFile).toContain(
      "gatedContractors = baseContractors.filter((c: any) => compliantIds.includes(c.id));"
    );

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
    expect(routeFile).toContain(
      "if (created && body.targetContractorIds && body.targetContractorIds.length > 0)"
    );
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

    expect(directConnectShellFile).toContain(
      'const canMessage = Boolean(r.dcConversationThreadId) || stage === "active_conversation";'
    );
  });

  it("shows open request controls and keeps Odd Jobs wired to the board view", () => {
    const directConnectShellFile = readRepoFile(
      "client/src/pages/direct-connect/DirectConnectShell.tsx"
    );

    expect(directConnectShellFile).toContain(
      'type RequestFilter = "all" | "open" | "routed" | "in_progress" | "completed" | "cancelled";'
    );
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

    expect(directConnectShellFile).toContain("Start a request");
    expect(directConnectShellFile).toContain("Manage your requests");
    expect(directConnectShellFile).toContain("View my requests");
    expect(directConnectShellFile).toContain(
      "Manage mode keeps request state and response state together."
    );
    expect(directConnectShellFile).toContain("Route to more pros");
    expect(directConnectShellFile).toContain("Check replies");
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

  it("keeps the explicit super-admin platform-support auto-link path", () => {
    const helperFile = readRepoFile("server/utils/superAdminConnection.ts");

    expect(helperFile).toContain("insert into user_follows");
    expect(helperFile).toContain("contact_permissions");
    expect(helperFile).toContain("system_super_admin_auto");
    expect(helperFile).toContain("platform_support");
  });
});
