import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("assetid phase 1f homeid -> direct connect draft contracts", () => {
  it("opens the real Direct Connect composer with bounded HomeID references", () => {
    const workspace = read("client/src/pages/homeid/HomeIdWorkspace.tsx");
    const handoff = read("client/src/pages/direct-connect/homeIdComposerHandoff.ts");

    expect(workspace).toContain('homeContextIntent: "update_from_request"');
    expect(workspace).toContain('params.set("homePacketId", packetId)');
    expect(workspace).toContain('navigate(`/direct-connect?${params.toString()}`)');
    expect(handoff).toContain("const HANDOFF_ID_PATTERN");
    expect(handoff).toContain("if (!homeId) return null");
  });

  it("loads packet details from owned server persistence before attaching them", () => {
    const shell = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    const handoff = read("client/src/pages/direct-connect/homeIdComposerHandoff.ts");

    expect(shell).toContain(
      '`/api/homeid/${encodeURIComponent(prefillHomeIdHandoff!.homeId)}/persistence`'
    );
    expect(shell).toContain("resolveHomeIdComposerHandoff(prefillHomeIdHandoff");
    expect(handoff).toContain("allowedIds.has(boundedId(detail.id))");
    expect(handoff).toContain("if (!packet) return null");
  });

  it("keeps packet preparation non-dispatch until composer confirmation", () => {
    const workspace = read("client/src/pages/homeid/HomeIdWorkspace.tsx");
    const shell = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(workspace).toContain(
      "Saving this packet does not dispatch, route, charge, or contact a"
    );
    expect(workspace).toContain("Nothing is sent until you review this request and confirm");
    expect(shell).toContain("Review before anything is shared");
    expect(shell).toContain("homePacketSubmissionConfirmed = true");
  });
});
