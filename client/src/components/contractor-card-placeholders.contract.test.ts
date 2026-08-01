import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("contractor card placeholders", () => {
  it("omits missing trust facts instead of presenting unfinished placeholders", () => {
    const source = read("client/src/components/contractor-card.tsx");

    expect(source).not.toMatch(/pending|calculating/i);
    expect(source).toContain("trustFacts.length > 0");
    expect(source).toContain("Connect");
  });
});
