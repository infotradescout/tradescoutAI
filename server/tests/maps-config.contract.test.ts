import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("maps config and auth-failure contracts", () => {
  it("maps page falls back to the canonical host public-config endpoint", () => {
    const source = read("client/src/pages/maps.tsx");

    expect(source).toContain("https://www.thetradescout.com/api/public-config");
    expect(source).toContain("buildPublicConfigCandidates");
    expect(source).toContain("fetchPublicConfigWithFallback");
  });

  it("maps page traps Google auth failures into a TradeScout-controlled error state", () => {
    const source = read("client/src/pages/maps.tsx");

    expect(source).toContain(
      'const GOOGLE_MAPS_AUTH_FAILURE_EVENT = "ts:google-maps-auth-failure"'
    );
    expect(source).toContain(
      "window.dispatchEvent(new CustomEvent(GOOGLE_MAPS_AUTH_FAILURE_EVENT));"
    );
    expect(source).toContain(
      'setScriptError("Google Maps auth failed (check HTTP referrer restrictions)")'
    );
  });

  it("public-config route remains available from the API layer", () => {
    const routesSource = read("server/routes.ts");

    expect(routesSource).toContain('app.get("/api/public-config"');
    expect(routesSource).toContain("process.env.TRADESCOUT_GOOGLE_MAPS_API_KEY");
    expect(routesSource).toContain("res.json({ googleMapsApiKey });");
  });
});
