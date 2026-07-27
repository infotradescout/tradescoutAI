import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const between = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe("Direct Connect request creation idempotency", () => {
  const routes = read("server/routes/direct-connect.ts");
  const requesterCreate = between(
    routes,
    "// Requester-facing: create a new Direct Connect request",
    '"/api/direct-connect/requests/:id/submit-homeid-draft"'
  );
  const adminCreate = between(
    routes,
    '"/api/admin/direct-connect/requests",',
    '"/api/admin/direct-connect/requests/:id"'
  );

  it("atomically records a stable requester operation with the request", () => {
    expect(routes).toContain("operationId: directConnectOperationIdSchema,");
    expect(routes).not.toContain("operationId: directConnectOperationIdSchema.optional()");
    expect(requesterCreate).toContain("pg_advisory_lock");
    expect(requesterCreate).toContain('operation: "requester_create_request"');
    expect(requesterCreate).toContain("payloadFingerprint: operationPayloadFingerprint");
    expect(requesterCreate).toContain("await db.transaction(async (tx: any)");
    expect(requesterCreate.indexOf(".insert(workRequests)")).toBeLessThan(
      requesterCreate.indexOf(".insert(workRequestEvents)")
    );
    expect(requesterCreate).toContain("pg_advisory_unlock");
  });

  it("rejects operation reuse with changed content and resumes the original request", () => {
    expect(requesterCreate).toContain("IDEMPOTENCY_PAYLOAD_CONFLICT");
    expect(requesterCreate).toContain("existingRequesterOperation?.request ||");
    expect(requesterCreate).toContain(
      "const idempotentReplay = Boolean(existingRequesterOperation)"
    );
    expect(requesterCreate).toContain(
      "created && !idempotentReplay && targetProfile && targetProfileOwnerUserId"
    );
    expect(requesterCreate).toContain("created && idempotentReplay && body.targetProfileSlug");
    expect(requesterCreate).toContain("created && targetProviderIds.length > 0");
    expect(requesterCreate).toContain("created && shouldAutoRoute");
    expect(requesterCreate).toContain("throw e;");
  });

  it("makes explicit profile routing and provider notification replay-safe", () => {
    expect(requesterCreate).toContain(".onConflictDoNothing()");
    expect(requesterCreate).toContain("enqueueRoutedDirectConnectProviderNotifications");
    expect(requesterCreate).toContain("dispatchDurableDirectConnectNotifications");
    expect(routes).toContain("deliveryObligationKey");
    expect(routes).toContain("pg_advisory_xact_lock");
    expect(requesterCreate).toContain("reconcilePersistedRoutingNotifications");
    expect(requesterCreate).toContain("reconcileOnlyExistingAssignments: idempotentReplay");
  });

  it("repairs the durable dispatch parent and foundation events before mutable replay gates", () => {
    const foundationIndex = requesterCreate.indexOf(
      "ensureDirectConnectDispatchFoundation({",
      requesterCreate.indexOf("if (existingRequesterOperation)")
    );
    const viewerGateIndex = requesterCreate.indexOf(
      "// Authenticated requester gates (profile/verification) stay enforced."
    );
    expect(foundationIndex).toBeGreaterThanOrEqual(0);
    expect(foundationIndex).toBeLessThan(viewerGateIndex);
    expect(routes).toContain('eventType: "request_finalized"');
    expect(routes).toContain('eventType: "request_shared"');
    expect(requesterCreate).toContain("executor: tx");
  });

  it("resumes missing admin routing before returning an idempotent replay", () => {
    const replayIndex = adminCreate.indexOf("const replayTargetProviderIds");
    const returnIndex = adminCreate.indexOf("idempotentReplay: true");
    expect(replayIndex).toBeGreaterThanOrEqual(0);
    expect(returnIndex).toBeGreaterThan(replayIndex);
    expect(adminCreate).toContain("reconcileExplicitDirectConnectProviderRouting");
    expect(adminCreate).toContain("routeRequestToTopContractors");
    expect(adminCreate).toContain("reconciledRequest");
    expect(adminCreate).toContain("ensureDirectConnectDispatchFoundation");
    expect(adminCreate).toContain("reconcileOnlyExistingAssignments: true");
  });

  it("threads stable operation IDs through every requester creation surface", () => {
    const sources = [
      read("client/src/pages/direct-connect/DirectConnectShell.tsx"),
      read("client/src/pages/tasks.tsx"),
      read("client/src/pages/homes.tsx"),
      read("client/src/scout/ScoutOS.tsx"),
    ];
    for (const source of sources) {
      expect(source).toContain("createClientOperationId");
      expect(source).toContain("operationId");
    }
    expect(sources[0]).toContain("pendingCreateOperationRef");
    expect(sources[0]).toContain("pendingCreateOperationRef.current.payload");
  });
});
