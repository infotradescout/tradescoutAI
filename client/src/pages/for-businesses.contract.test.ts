import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("ForBusinessesPage acquisition contracts", () => {
  it("presents one human business proposition without exposing acquisition machinery", () => {
    const source = read("client/src/pages/for-businesses.tsx");

    expect(source).toContain('title="TradeScout for Local Businesses"');
    expect(source).toContain("Give people a clear reason to choose your business.");
    expect(source).toContain("Claim or create your business");
    expect(source).toContain("Selective Inheritance");
    expect(source).toContain("No lead fees. No paid placement.");
    expect(source).toContain("Direct Connect");
    expect(source).not.toContain("BUSINESS_POPULAR_QUERIES");
    expect(source).not.toContain("High-intent business queries");
    expect(source).not.toContain("Launch Focus");
    expect(source).not.toContain("Tangipahoa Parish, LA business launch");
    expect(source).not.toContain("Pensacola, FL business launch");
  });

  it("uses the claims-first route as the only business onboarding destination", () => {
    const source = read("client/src/pages/for-businesses.tsx");

    expect(source).toContain(
      'const BUSINESS_ENTRY_HREF = "/claim-my-business?source=for_businesses"'
    );
    expect(source.match(/href={BUSINESS_ENTRY_HREF}/g)?.length).toBe(2);
    expect(source).not.toContain("/businesses/apply");
    expect(source).not.toContain("/onboarding?");
  });
});
