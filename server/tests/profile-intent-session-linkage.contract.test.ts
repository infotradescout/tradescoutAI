import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public profile entry-to-intent session linkage", () => {
  it("uses the same tab-scoped anonymous session contract as discovery landings", () => {
    const analytics = read("client/src/lib/analytics.ts");

    expect(analytics).toContain('getOrCreateDiscoveryAnonymousSessionId');
    expect(analytics).toContain('type: "public_profile_direct_connect_opened"');
    expect(analytics).toContain('event.type === "public_profile_direct_connect_opened"');
    expect(analytics).toContain('{ ...event, anonymousSessionId, linkageVersion: 1 }');
    expect(analytics).toContain('headers["X-Anonymous-Session-Id"] = anonymousSessionId');
    expect(analytics).toContain('/^[A-Za-z0-9._:-]+$/');
  });

  it("calculates conversion only from matching profile sessions observed after linkage starts", () => {
    const observatory = read("server/routes/admin-discovery-observatory.ts");

    expect(observatory).toContain("event_type = 'public_profile_direct_connect_opened'");
    expect(observatory).toContain("event_type = 'discovery_landing'");
    expect(observatory).toContain("data->>'linkageVersion' = '1'");
    expect(observatory).toContain("landing.profile_slug = intent.profile_slug");
    expect(observatory).toContain("landing.session_key = intent.session_key");
    expect(observatory).toContain("landing.created_at <= intent.created_at");
    expect(observatory).toContain('label: "Discovery sessions opening Direct Connect"');
    expect(observatory).toContain("linkedOpenRatePercent");
    expect(observatory).toContain("historicalUnlinkedOpenCount");
  });

  it("keeps exact-route conversion separate from profile-level conversion", () => {
    const observatory = read("server/routes/admin-discovery-observatory.ts");

    expect(observatory).toContain("landing.route = intent.route");
    expect(observatory).toContain("split_part(coalesce(data->>'route', ''), '?', 1)");
    expect(observatory).toContain(
      "split_part(coalesce(data->>'canonicalRoute', ''), '?', 1)"
    );
    expect(observatory).toContain('grain: "tab_scoped_profile_discovery_sessions"');
    expect(observatory).toContain("Opens are intent evidence, not submitted requests or provider outcomes");
  });
});
