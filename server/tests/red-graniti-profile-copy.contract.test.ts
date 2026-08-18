import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("R.E.D. Graniti public profile metadata", () => {
  it("keeps search and profile copy company-first", () => {
    const provisioner = read("server/services/redGranitiProfileProvisioning.ts");

    expect(provisioner).toContain("headline: RED_GRANITI_PUBLIC_IDENTITY.headline");
    expect(provisioner).toContain("Call or send first-cut project details.");
    expect(provisioner).not.toContain("Call JW Stone");
  });
});
