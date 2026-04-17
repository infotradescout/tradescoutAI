import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("ForBusinessesPage acquisition contracts", () => {
  it("targets small local service business SEO without changing trust-first positioning", () => {
    const source = read("client/src/pages/for-businesses.tsx");

    expect(source).toContain('title="TradeScout for Small Local Service Businesses"');
    expect(source).toContain("small local service businesses win more trusted local work");
    expect(source).toContain(
      'keywords="small business marketing for contractors, small local service business growth'
    );
    expect(source).toContain("without pay-to-play lead selling");
  });

  it("keeps business search intent focused on smaller operators", () => {
    const source = read("client/src/lib/popularSearchQueries.ts");

    expect(source).toContain('{ query: "small business contractors", href: "/for-businesses" }');
    expect(source).toContain(
      '{ query: "small business marketing for contractors", href: "/for-businesses" }'
    );
    expect(source).toContain('{ query: "small hvac business leads", href: "/trade/hvac" }');
  });
});
