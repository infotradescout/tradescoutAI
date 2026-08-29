import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("HomeID atomic persistence and pending-draft projection contracts", () => {
  it("routes complete graph saves through one transactional service call", () => {
    const route = read("server/routes/homes.ts");
    const service = read("server/services/homeIdPacketAuthority.ts");
    const endpoint = route.indexOf('router.put("/api/homeid/:homeId/persistence"');
    const serviceCall = route.indexOf("await persistHomeIdFullGraph({", endpoint);
    const wrapper = service.indexOf("export async function persistHomeIdFullGraph(");
    const transaction = service.indexOf("db.transaction", wrapper);
    const lock = service.indexOf("FOR UPDATE", transaction);

    expect(endpoint).toBeGreaterThan(-1);
    expect(serviceCall).toBeGreaterThan(endpoint);
    expect(transaction).toBeGreaterThan(wrapper);
    expect(lock).toBeGreaterThan(transaction);
  });

  it("validates the prospective graph before either authority-record write", () => {
    const service = read("server/services/homeIdPacketAuthority.ts");
    const workflow = service.indexOf(
      "export async function persistHomeIdFullGraphWithTransaction("
    );
    const validation = service.indexOf("const graph = parseHomeIdPersistenceGraph({", workflow);
    const detailWrite = service.indexOf("await adapter.writeGraphRecord({", validation);
    const packetWrite = service.indexOf("await adapter.writeGraphRecord({", detailWrite + 1);

    expect(validation).toBeGreaterThan(workflow);
    expect(detailWrite).toBeGreaterThan(validation);
    expect(packetWrite).toBeGreaterThan(detailWrite);
  });

  it("hydrates only owner-scoped private drafts with no assignment or share token", () => {
    const route = read("server/routes/homes.ts");
    const service = read("server/services/homeIdPacketAuthority.ts");
    const workspace = read("client/src/pages/homeid/HomeIdWorkspace.tsx");
    const endpoint = route.indexOf("pending-direct-connect-drafts");
    const ownerCheck = route.indexOf("await requireHomeOwner(userId, homeId)", endpoint);
    const projection = route.indexOf(
      "await listOwnedPendingHomeIdDrafts({ userId, homeId })",
      endpoint
    );

    expect(ownerCheck).toBeGreaterThan(endpoint);
    expect(projection).toBeGreaterThan(ownerCheck);
    expect(service).toContain('eq(workRequests.status, "draft")');
    expect(service).toContain('eq(workRequests.scope, "personal")');
    expect(service).toContain('eq(workRequests.visibility, "private")');
    expect(service).toContain("isNull(workRequests.shareToken)");
    expect(service).toContain("assignedRequestIds.has(requestId)");
    expect(workspace).toContain("resolveOwnedPendingHomeIdDraft(");
    expect(workspace).toContain("setDirectConnectDraft(persistedDirectConnectDraft)");
    expect(workspace).toContain('data-testid="homeid-pending-requester-draft"');
    expect(workspace).toContain("Providers and community surfaces");
  });

  it("uses one combined client PUT instead of sequential authority writes", () => {
    const persistence = read("client/src/lib/homeidPersistence.ts");
    const save = persistence.slice(
      persistence.indexOf("export async function saveHomeIdPersistence")
    );
    expect(save).toContain(
      'fetcher("PUT", `/api/homeid/${encodeURIComponent(homeId)}/persistence`'
    );
    expect(save).not.toContain("/property-details");
    expect(save).not.toContain("/request-packets");
  });
});
