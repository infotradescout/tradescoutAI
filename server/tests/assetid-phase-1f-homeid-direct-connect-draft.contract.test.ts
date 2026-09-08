import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("assetid phase 1f homeid -> direct connect draft contracts", () => {
  it("stages HomeID context for the canonical Direct Connect composer", () => {
    const source = read("client/src/pages/homeid/HomeIdWorkspace.tsx");
    expect(source).toContain("stageDirectConnectEntryContext({");
    expect(source).toContain('homeContextIntent: "update_from_request"');
    expect(source).toContain('source: "homeid_request_packet"');
    expect(source).not.toContain('apiRequest("POST", "/api/direct-connect/requests"');
  });

  it("preserves HomeID packet/detail references in draft payload", () => {
    const workspace = read("client/src/pages/homeid/HomeIdWorkspace.tsx");
    const shell = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(workspace).toContain("homePacketId: packet.id");
    expect(workspace).toContain("homePacketSelectedDetailIds: [...packet.selectedDetailIds]");
    expect(workspace).toContain("homePacketReadinessState: packet.status");
    expect(shell).toContain('dispatch?.homeContextIntent === "update_from_request"');
    expect(shell).toContain("payload.homePacketId = homePacketId");
    expect(shell).toContain("payload.homePacketSelectedDetailIds = Array.from(");
    expect(shell).toContain("payload.homePacketReadinessState = prefillHomePacketReadinessState");
  });

  it("keeps opening HomeID context non-dispatch by code and contract copy", () => {
    const source = read("client/src/pages/homeid/HomeIdWorkspace.tsx");
    expect(source).toMatch(/Direct Connect starts the job only when you\s+submit\./);
    expect(source).toMatch(/no provider dispatch,\s+routing, or payment happens here\./);
    expect(source).not.toContain('navigate("/api/direct-connect/requests"');
  });
});
