import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LOCAL_BUSINESS_DISCOVERY } from "../../client/src/lib/popularSearchQueries";
import { getDirectConnectSection } from "../../client/src/pages/direct-connect/directConnectRoutes";
import { parseDirectConnectEntryContext } from "../../client/src/pages/direct-connect/directConnectEntryContext";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("TradeScout public discovery and business entry surfaces", () => {
  const findLocalBusinesses = read("client/src/pages/find-local-businesses.tsx");
  const forBusinesses = read("client/src/pages/for-businesses.tsx");

  it.each([
    [LOCAL_BUSINESS_DISCOVERY.tangipahoaRequestHref, "22105", "tangipahoa-launch"],
    [LOCAL_BUSINESS_DISCOVERY.pensacolaRequestHref, "12033", "pensacola-launch"],
  ])(
    "opens the request composer with the advertised county and source: %s",
    (href, countyFips, source) => {
      expect(getDirectConnectSection(href)).toBe("post");
      expect(parseDirectConnectEntryContext(href)).toMatchObject({
        countyFips,
        source,
      });
    }
  );

  it("frames find-local-businesses as a broad local business entry surface", () => {
    expect(LOCAL_BUSINESS_DISCOVERY.heading).toBe("Find local businesses without the noise");
    expect(LOCAL_BUSINESS_DISCOVERY.introduction).toContain(
      "local businesses, services, and professionals"
    );
    expect(findLocalBusinesses).toContain("LOCAL_BUSINESS_DISCOVERY.heading");
    expect(findLocalBusinesses).toContain("LOCAL_BUSINESS_DISCOVERY.introduction");
    expect(findLocalBusinesses).toContain("TradeScout Direct Connect");
    expect(LOCAL_BUSINESS_DISCOVERY.introduction).toContain("trade and county context");
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
    expect(forBusinesses).toContain("Give people a clear reason to choose your business.");
    expect(forBusinesses).toContain("Claim or create your business");
    expect(forBusinesses).toContain("/claim-my-business?source=for_businesses");
    expect(forBusinesses).toContain("Selective Inheritance");
    expect(forBusinesses).toContain("Direct Connect");
    expect(forBusinesses).toContain("customer requests");
    expect(forBusinesses).not.toContain("/businesses/apply");
    expect(forBusinesses).not.toContain("BUSINESS_POPULAR_QUERIES");
    expect(forBusinesses).not.toContain("High-intent business queries");
    expect(forBusinesses).not.toContain("Launch Focus");

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
    expect(normalized).not.toContain("built for");
  });
});
