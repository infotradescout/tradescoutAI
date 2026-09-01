import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public profile request intent observatory", () => {
  it("adds the canonical panel-open event between entry and submitted request", () => {
    const route = read("server/routes/admin-discovery-observatory.ts");

    expect(route).toContain("addPublicProfileRequestIntent");
    expect(route).toContain("public_profile_direct_connect_opened");
    expect(route).toContain("data->>'profileSlug'");
    expect(route).toContain("created_at >= $1::timestamptz");
    expect(route).toContain('stage: "request_intent"');
    expect(route).toContain('label: "Discovery sessions opening Direct Connect"');
    expect(route).toContain('const entryIndex = funnel.findIndex((stage) => stage?.stage === "entry")');
    expect(route).toContain("const insertionIndex = entryIndex >= 0 ? entryIndex + 1");
    expect(route).toContain("funnel.splice(insertionIndex, 0");
    expect(route).toContain("res.json(await addPublicProfileRequestIntent(snapshot))");
  });

  it("returns and visibly summarizes the per-profile breakdown", () => {
    const route = read("server/routes/admin-discovery-observatory.ts");

    expect(route).toContain("profileRequestIntent");
    expect(route).toContain("openCount");
    expect(route).toContain("mobileOpenCount");
    expect(route).toContain("desktopOpenCount");
    expect(route).toContain('evidenceStrength: "client_correlated_unverified"');
    expect(route).toContain('grain: "tab_scoped_profile_discovery_sessions"');
    expect(route).toContain("visibleProfileSummary");
    expect(route).toContain("Profile totals:");
    expect(route).toContain("not submitted requests or provider outcomes");
  });

  it("keeps unavailable intent evidence unknown instead of reporting zero", () => {
    const route = read("server/routes/admin-discovery-observatory.ts");

    expect(route).toContain('status: "unavailable"');
    expect(route).toContain("was not converted into a zero");
  });
});
