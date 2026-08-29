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
    const authorityIndex = routeSource.indexOf(
      "await resolveOwnedReadyHomeIdPacketGraph(",
      claimIndex
    );
    const workRequestInsertIndex = routeSource.indexOf(".insert(workRequests)", authorityIndex);
    expect(claimIndex).toBeGreaterThan(-1);
    expect(authorityIndex).toBeGreaterThan(claimIndex);
    expect(workRequestInsertIndex).toBeGreaterThan(authorityIndex);
    expect(routeSource).toContain('code: "HOMEID_PACKET_GRAPH_INVALID"');
  });

  it("canonicalizes packet and selected-detail ids from persistence", () => {
    expect(routeSource).toContain("body.homeId = authority.homeId");
    expect(routeSource).toContain("body.homePacketId = authority.graph.packet.id");
    expect(routeSource).toContain(
      "body.homePacketSelectedDetailIds = [...authority.graph.packet.selectedDetailIds]"
    );
  });

  it("revalidates the original draft event and persisted graph before submit writes", () => {
    const submitIndex = routeSource.indexOf(
      '"/api/direct-connect/requests/:id/submit-homeid-draft"'
    );
    const authorityIndex = routeSource.indexOf(
      "await resolveHomeIdDraftSubmissionAuthority(",
      submitIndex
    );
    const updateIndex = routeSource.indexOf(".update(workRequests)", authorityIndex);
    expect(submitIndex).toBeGreaterThan(-1);
    expect(authorityIndex).toBeGreaterThan(submitIndex);
    expect(updateIndex).toBeGreaterThan(authorityIndex);
    expect(authoritySource).toContain('event.type === "homeid_draft_created"');
    expect(authoritySource).toContain('event.type === "homeid_draft_submitted"');
    expect(authoritySource).toContain("draftEvents.length !== 1 || alreadySubmitted");
  });

  it("rejects missing or ambiguous server persistence records", () => {
    expect(authoritySource).toContain(
      "detailRecords.length !== 1 || packetRecords.length !== 1"
    );
    expect(authoritySource).toContain("resolveReadyHomeIdPacketGraph({");
    expect(authoritySource).toContain("claimedSelectedDetailIds: metadata?.selectedDetailIds");
    expect(authoritySource).toContain(
      "sameStringSet(params.claimedSelectedDetailIds, owned.graph.packet.selectedDetailIds)"
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
  });

  it("keeps the Direct Connect route under its unchanged monolith ceiling", () => {
    expect(fs.statSync(path.resolve(process.cwd(), "server/routes/direct-connect.ts")).size).toBeLessThanOrEqual(
      412_727
    );
  });
});
