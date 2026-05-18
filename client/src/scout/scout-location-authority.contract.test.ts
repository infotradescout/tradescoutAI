import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("Scout location authority contracts", () => {
  it("county gates use canonical location context rather than legacy user flags", () => {
    const gateSource = read("client/src/components/CountyRequiredGate.tsx");
    const shellSource = read("client/src/components/layout/CommunityShell.tsx");

    expect(gateSource).toContain("const hasCanonicalLocation = hasCountyContext(ctx);");
    expect(gateSource).not.toContain("locationCommitted");
    expect(shellSource).toContain("const locationSet = hasCountyContext(locationCtx);");
  });

  it("Scout only sends county routing hints when canonical county identity exists", () => {
    const osSource = read("client/src/scout/ScoutOS.tsx");
    const apiSource = read("client/src/scout/api.ts");

    expect(osSource).toContain("const countyCommitted = hasCountyContext(locationCtx);");
    expect(osSource).toContain("countyFips: countyCommitted ? locationCtx.countyFips : undefined");
    expect(apiSource).toContain("countyHint: countyFips");
    expect(apiSource).toContain(
      "countyFips && countyName && stateCode ? `${countyName}, ${stateCode}` : undefined"
    );
  });

  it("Scout home does not render a standalone location collection panel", () => {
    const homeSource = read("client/src/scout/ScoutHome.tsx");

    expect(homeSource).toContain("const { location } = useScoutLocation();");
    expect(homeSource).not.toContain("Enter your city or zip code");
    expect(homeSource).not.toContain("Set Location");
    expect(homeSource).not.toContain("Reset");
    expect(homeSource).not.toContain("setManualLocation");
    expect(homeSource).not.toContain("clearLocation");
    expect(homeSource).not.toContain("showLocationInput");
  });

  it("Scout location hook only reads canonical profile or session context", () => {
    const hookSource = read("client/src/scout/hooks/useScoutLocation.ts");

    expect(hookSource).toContain("useLocationContext");
    expect(hookSource).toContain("return { location };");
    expect(hookSource).not.toContain("navigator.geolocation");
    expect(hookSource).not.toContain("ipapi.co");
    expect(hookSource).not.toContain("reverseGeocode");
    expect(hookSource).not.toContain("resolveFromIP");
    expect(hookSource).not.toContain("setSessionLocationOverride");
    expect(hookSource).not.toContain("clearSessionLocationOverride");
    expect(hookSource).not.toContain("setManualLocation");
    expect(hookSource).not.toContain("clearLocation");
  });
});
