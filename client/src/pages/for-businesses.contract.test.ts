import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("ForBusinessesPage acquisition contracts", () => {
  it("targets generic local business SEO without changing trust-first positioning", () => {
    const source = read("client/src/pages/for-businesses.tsx");

    expect(source).toContain('title="TradeScout for Local Businesses"');
    expect(source).toContain("local businesses win more trusted local work and sales");
    expect(source).toContain('keywords="local business growth, small business marketing');
    expect(source).toContain("without pay-to-play lead selling");
    expect(source).toContain("publish fixed-price services or items");
  });

  it("keeps business search intent focused on smaller operators", () => {
    const source = read("client/src/lib/popularSearchQueries.ts");

    expect(source).toContain(
      '{ query: "small local business marketing", href: "/for-businesses" }'
    );
    expect(source).toContain('{ query: "small service business leads", href: "/for-businesses" }');
    expect(source).toContain(
      '{ query: "local business profile platform", href: "/for-businesses" }'
    );
    expect(source).toContain('{ query: "small hvac business leads", href: "/trade/hvac" }');
  });
});
