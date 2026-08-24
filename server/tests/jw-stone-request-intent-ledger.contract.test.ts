import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("JW Stone request intent ledger", () => {
  it("records request-panel opens before submission without blocking Direct Connect", () => {
    const marketplace = read("client/src/features/jw-stone/JWStoneMarketplace.tsx");

    expect(marketplace).toContain('type: "public_profile_action_selected"');
    expect(marketplace).toContain('profileSlug: "jw-stone"');
    expect(marketplace).toContain('action: "request"');
    expect(marketplace).toContain('"jw_selected_material_request"');
    expect(marketplace).toContain('"jw_general_material_request"');
    expect(marketplace).toContain('if (requestContext === null) return;');
    expect(marketplace).toContain('trackJwStoneRequestIntent(requestTargets.length)');
    expect(marketplace).toContain('navigator.sendBeacon(');
    expect(marketplace).toContain('fetch("/api/analytics/shell"');
    expect(marketplace).toContain("Opening Direct Connect must never be blocked by telemetry.");
  });
});
