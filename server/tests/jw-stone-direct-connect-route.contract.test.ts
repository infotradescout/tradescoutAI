import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("JW Stone multi-selection Direct Connect route contract", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, "server/routes/tradepartner-express.ts"),
    "utf8"
  );

  it("keeps the scalar request contract and adds a bounded sanitized selection path", () => {
    expect(source).toContain("stoneName: z.string().trim().max(180).optional()");
    expect(source).toContain("itemId: z");
    expect(source).toContain("stoneSelections: z");
    expect(source).toContain(".max(JW_STONE_DIRECT_CONNECT_SELECTION_LIMIT)");
    expect(source).toContain("sanitizeJwStoneDirectConnectSelections({");
    expect(source).toContain("stoneSelections: publicStoneSelections");
    expect(source).toContain("body.stoneSelections && (body.itemId || body.stoneName)");
  });

  it("keeps multi-selection identities out of continuation URLs", () => {
    expect(source).toContain(
      'requestWorkspaceParams.set("selectionCount", String(publicStoneSelections.length));'
    );
    expect(source).not.toContain('requestWorkspaceParams.set("stoneSelections"');
    expect(source).not.toContain('requestWorkspaceParams.set("stoneIds"');
  });
});
