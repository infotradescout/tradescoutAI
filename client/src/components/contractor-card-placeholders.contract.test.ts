import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("contractor card placeholders", () => {
  it("uses intentional pending-state copy for incomplete directory profiles", () => {
    const source = read("client/src/components/contractor-card.tsx");

    expect(source).toContain("Local service area pending");
    expect(source).toContain("Profile age pending");
    expect(source).toContain("Response signal pending");
    expect(source).toContain("Recommendations pending");
    expect(source).toContain("CVS calculating");
    expect(source).not.toContain("Service area not specified");
    expect(source).not.toContain("Years in business n/a");
    expect(source).not.toContain("Response time n/a");
    expect(source).not.toContain("CVS Pending");
  });
});
