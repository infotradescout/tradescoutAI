import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("landing SEO contracts", () => {
  it("self-canonicalizes stable landing variants and noindexes only aliases/query variants", () => {
    const source = read("client/src/pages/landing.tsx");

    expect(source).toContain('pathOnly.startsWith("/lp/")');
    expect(source).toContain('pathOnly.startsWith("/landing/")');
    expect(source).toContain('const hasQueryParams = rawLocation.includes("?")');
    expect(source).toContain(
      "const shouldIndexLandingPage = !isAliasLandingPath && !hasQueryParams"
    );
    expect(source).toContain("canonical={canonicalLandingUrl}");
    expect(source).toContain("noIndex={!shouldIndexLandingPage}");
  });
});
