import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("assetid phase 1f homeid -> direct connect draft contracts", () => {
  it("creates Direct Connect draft from HomeID handoff preview", () => {
    const source = read("client/src/pages/homes.tsx");
    expect(source).toContain('apiRequest("POST", "/api/direct-connect/requests", payload)');
    expect(source).toContain("Create Direct Connect draft");
    expect(source).toContain("autoRoute: false");
    expect(source).toContain('homeContextIntent: "update_from_request"');
  });

  it("preserves HomeID packet/detail references in draft payload", () => {
    const source = read("client/src/pages/homes.tsx");
    expect(source).toContain("homePacketId: packet.id");
    expect(source).toContain("homePacketSelectedDetailIds: [...packet.selectedDetailIds]");
    expect(source).toContain("homePacketReadinessState: handoffPreview.packetReadinessState");
  });

  it("keeps draft creation non-dispatch by contract copy", () => {
    const source = read("client/src/pages/homes.tsx");
    expect(source).toContain("HomeID context can help prepare it");
    expect(source).toContain("no provider dispatch, routing, or");
    expect(source).toContain("payment happens here.");
  });
});
