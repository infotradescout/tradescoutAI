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
      'status === "in_progress" || status === "completed" || Boolean(r.dcConversationThreadId)'
    );
  });

  it("shows open request controls and keeps Odd Jobs wired to the board view", () => {
    const directConnectShellFile = readRepoFile(
      "client/src/pages/direct-connect/DirectConnectShell.tsx"
    );

    expect(directConnectShellFile).toContain('"all" | "open" | "routed"');
    expect(directConnectShellFile).toContain('const canSend = status === "open";');
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

    expect(directConnectShellFile).toContain("Start a governed request");
    expect(directConnectShellFile).toContain("Manage live requests");
    expect(directConnectShellFile).toContain(
      "Every posted request lands on Your Requests immediately."
    );
    expect(directConnectShellFile).toContain("Post to your request board");
  });

  it("supports request photo attachments in Direct Connect", () => {
    const routeFile = readRepoFile("server/routes/direct-connect.ts");
    const directConnectShellFile = readRepoFile(
      "client/src/pages/direct-connect/DirectConnectShell.tsx"
    );

    expect(routeFile).toContain(
      "attachments: z.array(z.string().trim().min(3).max(600)).max(8).optional()"
    );
    expect(routeFile).toContain('"/api/direct-connect/requests/:id/attachments/:index"');
    expect(routeFile).toContain("attachmentCount: getAttachmentCount(requestRow)");
    expect(directConnectShellFile).toContain("uploadPrivateObject(attachment.file)");
    expect(directConnectShellFile).toContain("Request photos");
    expect(directConnectShellFile).toContain("buildRequestAttachmentUrl");
  });
});
