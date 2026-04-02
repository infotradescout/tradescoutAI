import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

function readRepoFile(relativePath: string): string {
  const repoRoot = path.resolve(__dirname, "../..");
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("register county inference regression", () => {
  it("keeps inferCountyFromCityState fallback in handleRegister when countyFips is missing", () => {
    const routesFile = readRepoFile("server/routes.ts");

    expect(routesFile).toContain("const handleRegister = async (req: Request, res: Response) => {");
    expect(routesFile).toContain("[auth/register] Failed to infer county from city/state");
    expect(routesFile).toContain("const inferred = await inferCountyFromCityState({");
    expect(routesFile).toContain("if (inferredCounty) {");
    expect(routesFile).toContain("countyFips = inferredCounty.countyFips;");
  });
});
