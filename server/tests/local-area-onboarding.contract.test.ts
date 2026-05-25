import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("local area onboarding county normalization contracts", () => {
  it("normalizes geocoder county/parish aliases before rendering warnings", () => {
    const source = read("client/src/pages/pre-scout-setup.tsx");
    expect(source).toContain("resolveCanonicalCountyForState");
    expect(source).toContain('Found "${normalizedFound.countyName}" — confirm your county below.');
  });

  it("keeps continue enabled when canonical county fips resolves", () => {
    const source = read("client/src/pages/pre-scout-setup.tsx");
    expect(source).toContain("if (!presenceType || !stateCode || !countyFips) return false;");
    expect(source).toContain("setCountyFips(canonicalFromPlace.countyFips);");
    expect(source).toContain("setCountyFips(canonicalFromBusinessPlace.countyFips);");
  });
});
