import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("onboarding completion authority", () => {
  it("never infers completion from a legacy county or location record", () => {
    const routes = read("server/routes.ts");
    const backfill = routes.slice(
      routes.indexOf("const shouldBackfillCompletedSetup"),
      routes.indexOf("type UserRoleEnumValue")
    );

    expect(backfill).toContain("(user as any)?.onboardingCompleted === true &&");
    expect(backfill).not.toContain("patch.onboardingCompleted = true");
  });
});
