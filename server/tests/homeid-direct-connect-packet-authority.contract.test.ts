import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const routeSource = read("server/routes/direct-connect.ts");
const homesRouteSource = read("server/routes/homes.ts");
const authoritySource = read("server/services/homeIdPacketAuthority.ts");
const workspaceSource = read("client/src/pages/homeid/HomeIdWorkspace.tsx");

describe("HomeID -> Direct Connect packet authority", () => {
  it("resolves a complete owned persisted graph before creating the work request", () => {
    const claimIndex = routeSource.indexOf("const hasHomePacketClaim");
    const authorityIndex = routeSource.indexOf("await createHomeIdPacketDraft({", claimIndex);
    const workRequestInsertIndex = routeSource.indexOf(".insert(workRequests)", authorityIndex);
    expect(claimIndex).toBeGreaterThan(-1);
    expect(authorityIndex).toBeGreaterThan(claimIndex);
    expect(workRequestInsertIndex).toBeGreaterThan(authorityIndex);
    expect(routeSource).toContain('code: "HOMEID_PACKET_GRAPH_INVALID"');
  });

  it("canonicalizes packet and selected-detail ids from persistence", () => {
    expect(authoritySource).toContain("homeId: authority.homeId");
    expect(authoritySource).toContain("homePacketId: authority.graph.packet.id");
    expect(authoritySource).toContain(
      "selectedDetailIds: [...authority.graph.packet.selectedDetailIds]"
    );
    expect(authoritySource).toContain('status: "draft"');
    expect(authoritySource).toContain('scope: "personal"');
    expect(authoritySource).toContain('visibility: "private"');
    expect(authoritySource).toContain("shareToken: null");
  });

  it("returns the dedicated private draft before any live-create side effect", () => {
    const endpoint = routeSource.indexOf('"/api/direct-connect/requests"');
    const branch = routeSource.indexOf("if (hasHomePacketClaim)", endpoint);
    const draftCreate = routeSource.indexOf("await createHomeIdPacketDraft({", branch);
    const branchReturn = routeSource.indexOf("return res.status(201).json", draftCreate);
    const targetLookup = routeSource.indexOf("const targetProfile =", branchReturn);
    const requestShared = routeSource.indexOf('eventType: "request_shared"', branchReturn);
    const autoRoute = routeSource.indexOf("await routeRequestToTopContractors({", branchReturn);
    const shareToken = routeSource.indexOf("await ensureShareTokenForRequest", branchReturn);
    const adminNotification = routeSource.indexOf(
      "await notifySuperAdminsOfDirectConnectRequest",
      branchReturn
    );

    expect(branch).toBeGreaterThan(endpoint);
    expect(draftCreate).toBeGreaterThan(branch);
    expect(branchReturn).toBeGreaterThan(draftCreate);
    for (const sideEffect of [
      targetLookup,
      requestShared,
      autoRoute,
      shareToken,
      adminNotification,
    ]) {
      expect(sideEffect).toBeGreaterThan(branchReturn);
    }
    expect(authoritySource).toContain("createHomeIdPacketDraftWithTransaction(");
    expect(authoritySource).toContain("db.transaction(async (tx: any)");
  });

  it("revalidates the original draft event and persisted graph before submit writes", () => {
    const submitIndex = routeSource.indexOf(
      '"/api/direct-connect/requests/:id/submit-homeid-draft"'
    );
    const authorityIndex = routeSource.indexOf("await submitHomeIdPacketDraft({", submitIndex);
    const transactionIndex = authoritySource.indexOf("submitHomeIdPacketDraftWithTransaction(");
    const lockIndex = authoritySource.indexOf("FOR UPDATE", transactionIndex);
    expect(submitIndex).toBeGreaterThan(-1);
    expect(authorityIndex).toBeGreaterThan(submitIndex);
    expect(transactionIndex).toBeGreaterThan(-1);
    expect(lockIndex).toBeGreaterThan(transactionIndex);
    expect(authoritySource).toContain('event.type === "homeid_draft_created"');
    expect(authoritySource).toContain('event.type === "homeid_draft_submitted"');
    expect(authoritySource).toContain("createdEvents.length !== 1");
    expect(authoritySource).toContain("transitionDraftToOpen");
  });

  it("rejects missing or ambiguous server persistence records", () => {
    expect(authoritySource).toContain("detailRecords.length !== 1 || packetRecords.length !== 1");
    expect(authoritySource).toContain("resolveReadyHomeIdPacketGraph({");
    expect(authoritySource).toContain(
      "claimedSelectedDetailIds: createdMetadata?.selectedDetailIds"
    );
    expect(authoritySource).toContain(
      "sameStringSet(input.claimedSelectedDetailIds, authority.graph.packet.selectedDetailIds)"
    );
    expect(homesRouteSource).toContain("parseHomeIdPersistenceGraph({");
    expect(homesRouteSource).toContain(
      'throw new Error("Stored HomeID detail/request-packet graph is invalid")'
    );
  });

  it("uses the same strict graph resolver before the client creates a draft", () => {
    expect(workspaceSource).toContain("parseHomeIdPersistenceGraph({");
    expect(workspaceSource).toContain("resolveReadyHomeIdPacketGraph({");
    expect(workspaceSource).toContain("buildHomeIdHandoffPreview({");
    expect(workspaceSource).toContain('homeContextIntent: "update_from_request"');
    expect(workspaceSource).toContain("pending-direct-connect-drafts");
  });

  it("keeps the Direct Connect route under its unchanged monolith ceiling", () => {
    expect(
      fs.statSync(path.resolve(process.cwd(), "server/routes/direct-connect.ts")).size
    ).toBeLessThanOrEqual(412_727);
  });
});
