import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("assetid phase 1g homeid draft submit contracts", () => {
  it("exposes submit endpoint for HomeID-generated Direct Connect drafts", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain('"/api/direct-connect/requests/:id/submit-homeid-draft"');
    expect(source).toContain('type: "homeid_draft_reviewed"');
    expect(source).toContain('type: "homeid_draft_submitted"');
  });

  it("writes HomeID backlink record when draft is submitted", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain('title: "homeid:direct_connect_request_submitted"');
    expect(source).toContain('event: "direct_connect_request_submitted"');
    expect(source).toContain('source: "homeid_packet"');
  });

  it("hands HomeID packet review and submission to the Direct Connect owner surface", () => {
    const homesSource = read("client/src/pages/homeid/HomeIdWorkspace.tsx");
    const shellSource = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(homesSource).toContain('params.set("homePacketId", packetId)');
    expect(homesSource).toContain('navigate(`/direct-connect?${params.toString()}`)');
    expect(shellSource).toContain('data-testid="direct-connect-homeid-handoff"');
    expect(shellSource).toContain("Review before anything is shared");
    expect(shellSource).toContain('apiRequest("POST", "/api/direct-connect/requests", payload)');
  });
});
