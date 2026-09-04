import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("assetid phase 1f homeid -> direct connect handoff contracts", () => {
  it("saves a HomeID request packet before opening Direct Connect", () => {
    const source = read("client/src/pages/homeid/HomeIdWorkspace.tsx");
    expect(source).toContain("const savePacket = useMutation");
    expect(source).toContain('apiRequest("PUT", `/api/homeid/${homeId}/request-packets`');
    expect(source).toContain("requestPackets: [packet, ...packets]");
    expect(source).toContain('status: missing.length ? "needs_info" : "ready_for_handoff"');
  });

  it("preserves the saved packet reference through the Direct Connect handoff", () => {
    const homesSource = read("client/src/pages/homeid/HomeIdWorkspace.tsx");
    const shellSource = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(homesSource).toContain('if (packetId) params.set("homePacketId", packetId)');
    expect(homesSource).toContain("onClick={() => open(packet.id)}");
    expect(shellSource).toContain("payload.homePacketId = homePacketHandoff.packetId");
    expect(shellSource).toContain(
      "payload.homePacketSelectedDetailIds = homePacketHandoff.selectedDetailIds"
    );
    expect(shellSource).toContain(
      "payload.homePacketReadinessState = homePacketHandoff.readinessState"
    );
  });

  it("keeps HomeID preparation separate from Direct Connect sharing", () => {
    const source = read("client/src/pages/homeid/HomeIdWorkspace.tsx");
    expect(source).toContain('homeContextIntent: "update_from_request"');
    expect(source).toContain("Open in Direct Connect");
    expect(source).toContain(
      "Choose the HomeID facts that matter, save the packet, then carry that context into Direct Connect."
    );
    expect(source).not.toContain('apiRequest("POST", "/api/direct-connect/requests"');
  });
});
