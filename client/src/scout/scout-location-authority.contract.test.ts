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
});
