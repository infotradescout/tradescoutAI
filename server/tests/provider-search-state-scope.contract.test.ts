import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

const readOptional = (relativePath: string) => {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : "";
};

const routeRegistration = read("server/routes.ts");
// Keep this contract valid while the handler is extracted from the large routes file.
const providerRoute =
  readOptional("server/routes/provider-search.ts") ||
  routeRegistration.slice(routeRegistration.indexOf('"/api/business-providers/search"'));

describe("provider search jurisdiction boundary", () => {
  it("sends state for a state-only Direct Connect directory search", () => {
    const client = read("client/src/pages/direct-connect/DirectConnectPros.tsx");
    const query = client.slice(
      client.indexOf("queryFn: async () =>"),
      client.indexOf("const hasResults")
    );

    expect(query).toContain(
      'if (!effectiveCountyFips && hasStateContext) params.set("state", effectiveStateCode)'
    );
    expect(query).toContain('params.set("county", effectiveCountyFips)');
  });

  it("registers the canonical route and legacy alias", () => {
    expect(routeRegistration).toContain('"/api/business-providers/search"');
    expect(routeRegistration).toContain('"/api/providers/search"');
  });

  it("fails closed for missing, malformed, or mismatched jurisdiction", () => {
    expect(providerRoute).toContain("parseProviderSearchScope({ county, state })");
    expect(providerRoute).toContain('requestedScope.kind === "invalid"');
    expect(providerRoute).toContain("res.status(400)");
    expect(providerRoute).toContain('requestedScope.kind === "none"');
    expect(providerRoute).toMatch(
      /requestedScope\.kind === "none"[\s\S]{0,200}return res\.json\(\[\]\)/
    );
    expect(providerRoute).toContain("requestedScope.requestedStateCode");
    expect(providerRoute).toMatch(/requestedStateCode[\s\S]{0,240}return res\.json\(\[\]\)/);
  });

  it("passes an explicit state scope to both provider stores", () => {
    expect(providerRoute).toContain("contractorFilters.stateCode = requestedStateCode");
    expect(providerRoute).toContain("getProvidersByStateAndCategory({");
    expect(providerRoute).toContain("stateCode: requestedStateCode");
    expect(providerRoute).toContain("getProvidersByCountyAndCategory({");
  });

  it("fails closed on unknown trades and passes canonical trade scope to businesses", () => {
    expect(providerRoute).toContain("if (!tradeRecord) return res.json([])");
    expect(providerRoute).toContain(
      "canonicalTradeSlug = String(tradeRecord.slug || trade).trim()"
    );
    expect(providerRoute.match(/tradeSlug: canonicalTradeSlug/g)).toHaveLength(2);
  });

  it("uses state to disambiguate duplicate county names", () => {
    expect(providerRoute).toContain("stateCode: requestedScope.requestedStateCode || undefined");
  });
});

describe("provider search state storage contracts", () => {
  it("scopes contractors through contractor county assignments and canonical counties", () => {
    const storage = read("server/storage.ts");
    const start = storage.indexOf("async getContractors(");
    const method = storage.slice(start, start + 5500);

    expect(method).toContain("stateCode?: string");
    expect(method).toContain(".from(contractorCounties)");
    expect(method).toContain(".innerJoin(counties");
    expect(method).toContain("eq(contractorCounties.contractorId, contractors.id)");
    expect(method).toMatch(/eq\(counties\.stateCode,\s*stateCode\)/);
    expect(method.indexOf("filters?.countyId")).toBeLessThan(method.indexOf("filters?.stateCode"));
  });

  it("scopes businesses through business county assignments while preserving exposure gates", () => {
    const repository = read("server/repositories/businessRepository.ts");
    const start = repository.indexOf("async getProvidersByStateAndCategory");
    const end = repository.indexOf("async getActiveBusinessForUser", start);
    const method = repository.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(method).toContain('eq(businesses.status, "active" as any)');
    expect(method).toContain("eq(businesses.publicDiscoveryEnabled, true)");
    expect(method).toContain("publicBusinessDetailExposureSqlPredicate()");
    expect(method).toContain(".from(businessCounties)");
    expect(method).toContain(".innerJoin(counties");
    expect(method).toContain("eq(businessCounties.businessId, businesses.id)");
    expect(method).toMatch(/eq\(counties\.stateCode,\s*stateCode\)/);
    expect(method.indexOf("publicBusinessDetailExposureSqlPredicate()")).toBeLessThan(
      method.indexOf(".limit(limit)")
    );
    expect(method).toContain("applyPublicProviderBusinessSearchPredicates(predicates, args)");
    expect(method).toContain(".orderBy(asc(businesses.name), asc(businesses.id))");
    expect(method).toContain(".offset(offset)");
  });
});

describe("provider search public/contact boundary", () => {
  it("sanitizes contractor records before returning them", () => {
    expect(providerRoute).toMatch(/sanitizeContractorPublic\((?:c|contractor)\)/);
    expect(providerRoute).not.toMatch(/email:\s*c\./);
    expect(providerRoute).not.toMatch(/phone:\s*c\./);
  });

  it("requires canonical public-profile authority before returning a contractor", () => {
    expect(providerRoute).toContain("loadCanonicalPublicMapProfileUrls(");
    expect(providerRoute).toContain("canonicalProfileUrlByUserId.has(");
    expect(providerRoute.indexOf("canonicalProfileUrlByUserId.has(")).toBeLessThan(
      providerRoute.indexOf("const contractorResults")
    );
  });

  it("continues through Direct Connect rather than exposing direct contact actions", () => {
    const card = read("client/src/components/contractor-card.tsx");
    const connectAction = card.slice(
      card.indexOf("showCallToAction ?"),
      card.indexOf("</CardContent>")
    );

    expect(connectAction).toContain("/direct-connect?intent=connect");
    expect(connectAction).not.toContain("mailto:");
    expect(connectAction).not.toContain("tel:");
  });
});
