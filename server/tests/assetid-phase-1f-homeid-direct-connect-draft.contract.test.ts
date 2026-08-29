import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("assetid phase 1f homeid -> direct connect draft contracts", () => {
  it("creates Direct Connect draft from HomeID handoff preview", () => {
    const source = read("client/src/pages/homeid/HomeIdWorkspace.tsx");
    expect(source).toContain('apiRequest("POST", "/api/direct-connect/requests", {');
    expect(source).toContain("Create Direct Connect draft");
    expect(source).toContain("autoRoute: false");
    expect(source).toContain('homeContextIntent: "update_from_request"');
  });

  it("preserves HomeID packet/detail references in draft payload", () => {
    const source = read("client/src/pages/homeid/HomeIdWorkspace.tsx");
    expect(source).toContain("homePacketId: packet.id");
    expect(source).toContain("homePacketSelectedDetailIds: [...packet.selectedDetailIds]");
    expect(source).toContain("homePacketReadinessState: preview.packetReadinessState");
  });

  it("keeps draft creation non-dispatch by contract copy", () => {
    const source = read("client/src/pages/homeid/HomeIdWorkspace.tsx");
    const copy = source.replace(/\s+/g, " ");
    expect(copy).toContain("HomeID context can help prepare it");
    expect(copy).toContain("no provider dispatch, routing, or payment happens here.");
  });
});
