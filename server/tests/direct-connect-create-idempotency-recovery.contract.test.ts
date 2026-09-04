import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Direct Connect create idempotency recovery", () => {
  it("keeps the rollout compatible while validating operation ids", () => {
    const routes = read("server/routes/direct-connect.ts");

    expect(routes).toContain("const directConnectOperationIdSchema = z");
    expect(routes).toContain("operationId: directConnectOperationIdSchema.optional()");
    expect(routes).toContain("createDirectConnectOperationFingerprint");
    expect(routes).toContain("normalizeForOperationFingerprint");
  });

  it("serializes requester and admin retries with durable replay receipts", () => {
    const routes = read("server/routes/direct-connect.ts");

    expect(routes).toContain("direct-connect-requester-create:");
    expect(routes).toContain("direct-connect-admin-create:");
    expect(routes).toContain("SELECT pg_advisory_lock(hashtextextended($1, 0))");
    expect(routes).toContain("SELECT pg_advisory_unlock(hashtextextended($1, 0))");
    expect(routes).toContain('operation: "requester_create_request"');
    expect(routes).toContain('operation: "admin_create_request"');
    expect(routes).toContain("payloadFingerprint: operationPayloadFingerprint");
    expect(routes).toContain('code: "IDEMPOTENCY_PAYLOAD_CONFLICT"');
    expect(routes).toContain("idempotentReplay: true");
  });

  it("commits the admin replay receipt before attempting account email", () => {
    const routes = read("server/routes/direct-connect.ts");
    const adminRouteStart = routes.indexOf('"/api/admin/direct-connect/requests"');
    const adminRoute = routes.slice(adminRouteStart, routes.indexOf("app.get(", adminRouteStart));
    const transaction = adminRoute.indexOf("const created = await db.transaction");
    const receipt = adminRoute.indexOf(
      "payloadFingerprint: operationPayloadFingerprint",
      transaction
    );
    const email = adminRoute.indexOf("sendAdminDirectConnectAccountEmail({");

    expect(transaction).toBeGreaterThan(-1);
    expect(receipt).toBeGreaterThan(-1);
    expect(email).toBeGreaterThan(receipt);
    expect(adminRoute).toContain('setupEmailSkippedReason: "idempotent_replay_no_resend"');
    expect(adminRoute).toContain('requestEmailSkippedReason: "idempotent_replay_no_resend"');
  });

  it("sends stable operation ids from every live create surface", () => {
    const helper = read("client/src/lib/clientOperationId.ts");
    const shell = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    const tasks = read("client/src/pages/tasks.tsx");
    const scout = read("client/src/scout/ScoutOS.tsx");
    const admin = read("client/src/components/admin/AdminDirectConnectRequestCard.tsx");

    expect(helper).toContain("export function createClientOperationId");
    expect(shell).toContain('createClientOperationId("dc-request")');
    expect(shell).toContain("pendingCreateOperationRef.current.payload");
    expect(tasks).toContain('createClientOperationId("dc-task")');
    expect(scout).toContain('createClientOperationId("dc-scout")');
    expect(admin).toContain('createClientOperationId("dc-admin")');
    for (const source of [shell, tasks, scout, admin]) {
      expect(source).toContain("operationId");
    }
  });
});
