import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("TradeScout public discovery and business entry surfaces", () => {
  const findLocalBusinesses = read("client/src/pages/find-local-businesses.tsx");
  const forBusinesses = read("client/src/pages/for-businesses.tsx");

  it("frames find-local-businesses as a broad local business entry surface", () => {
    expect(findLocalBusinesses).toContain("Find local businesses without the noise");
    expect(findLocalBusinesses).toContain("local businesses, services, and professionals");
    expect(findLocalBusinesses).toContain("TradeScout Direct Connect");
    expect(findLocalBusinesses).toContain("trade and county context");
    expect(findLocalBusinesses).toContain("trusted local businesses and contractors");
    expect(findLocalBusinesses).toContain(
      'canonical="https://www.thetradescout.com/find-local-businesses"'
    );

    const normalized = findLocalBusinesses.toLowerCase();
    expect(normalized).not.toContain("only contractors");
    expect(normalized).not.toContain("only homeowners");
    expect(normalized).not.toContain("scout chatbot");
    expect(normalized).not.toContain("ai chatbot");
    expect(normalized).not.toContain("lead marketplace");
    expect(normalized).not.toContain("lead-selling");
    expect(normalized).not.toContain("routing algorithm");
    expect(normalized).not.toContain("authority layer");
    expect(normalized).not.toContain("handoff doctrine");
    expect(normalized).not.toContain("backend routing system");
    expect(normalized).not.toContain("operating system architecture");
  });

  it("keeps contractor wording on find-local-businesses as a subset or search-intent detail", () => {
    expect(findLocalBusinesses).toContain("trusted local businesses and contractors");
    expect(findLocalBusinesses).toContain("Browse contractor-heavy trades");
    expect(findLocalBusinesses).toContain("contractor search");
    expect(findLocalBusinesses).not.toContain("TradeScout is only for contractors");
  });

  it("frames for-businesses as a broad business entry surface", () => {
    expect(forBusinesses).toContain("TradeScout for Local Businesses");
    expect(forBusinesses).toContain("help, services, or products");
    expect(forBusinesses).toContain("publish fixed-price services or items");
    expect(forBusinesses).toContain("without pay-to-play lead selling");
    expect(forBusinesses).toContain("Claim Tangipahoa coverage");
    expect(forBusinesses).toContain("/businesses/apply");
    expect(forBusinesses).toContain("Direct Connect");
    expect(forBusinesses).toContain("local requests");

    const normalized = forBusinesses.toLowerCase();
    expect(normalized).not.toContain("only contractors");
    expect(normalized).not.toContain("contractors only");
    expect(normalized).not.toContain("scout chatbot");
    expect(normalized).not.toContain("ai chatbot");
    expect(normalized).not.toContain("routing algorithm");
    expect(normalized).not.toContain("authority layer");
    expect(normalized).not.toContain("handoff doctrine");
    expect(normalized).not.toContain("backend routing system");
    expect(normalized).not.toContain("operating system architecture");
  });
});
