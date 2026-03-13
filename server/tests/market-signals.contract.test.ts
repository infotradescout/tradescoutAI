import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("market signals contracts", () => {
  it("keeps the real v1 market signal routes wired in server routes", () => {
    const source = read("server/routes.ts");

    expect(source).toContain('app.get("/api/market-signals/v1/counties/:countyFips/demand"');
    expect(source).toContain('app.get("/api/market-signals/v1/homescout-listings/inventory"');
    expect(source).toContain('app.get("/api/market-signals/v1/activation-readiness"');
    expect(source).toContain(
      'app.get("/api/market-signals/v1/partners/:partnerSlug/county-observation"'
    );
    expect(source).toContain("from scout_interactions");
    expect(source).toContain("from home_scout_market_buckets");
    expect(source).toContain("from home_scout_listing_events e");
    expect(source).toContain("from objectives");
    expect(source).toContain("from county_metrics");
    expect(source).toContain("getPartnerCountyObservationSnapshots");
  });

  it("requires governed access instead of exposing raw public feeds", () => {
    const source = read("server/routes.ts");

    expect(source).toContain("MARKET_SIGNALS_API_KEY");
    expect(source).toContain("ENABLE_PARTNER_MARKET_SIGNALS_KEYS");
    expect(source).toContain("MARKET_SIGNALS_PARTNER_KEYS_JSON");
    expect(source).toContain('return res.status(401).json({ message: "Authentication required" })');
    expect(source).toContain(
      'return res.status(403).json({ message: "Market signals access denied" })'
    );
    expect(source).toContain("Partner-scoped market signals access denied");
    expect(source).toContain("collectAuthorityRoles(user as any)");
    expect(source).toContain("roles.some((role) => isAdminTierRole(role))");
  });

  it("enforces aggregation thresholds instead of returning household-scale outputs", () => {
    const source = read("server/routes.ts");

    expect(source).toContain(
      'return res.json({ status: "suppressed", reason: "minimum_threshold_not_met" });'
    );
    expect(source).toContain("if (interactionCount < 25)");
    expect(source).toContain("if (listingCount < 25)");
  });

  it("keeps market signal schemas in the shared layer", () => {
    const source = read("shared/marketSignals.ts");

    expect(source).toContain("export interface CountyDemandSnapshot");
    expect(source).toContain("export interface HomeScoutListingsInventorySnapshot");
    expect(source).toContain("export interface ActivationReadinessSnapshot");
    expect(source).toContain("export interface CountyCrawlerObservationSnapshot");
    expect(source).toContain("export type MarketSignalResponse =");
  });

  it("backs partner county observation with stored snapshots", () => {
    const source = read("server/services/partnerCountyObservationSnapshotService.ts");

    expect(source).toContain(
      "CREATE TABLE IF NOT EXISTS tradepartner_county_observation_snapshots"
    );
    expect(source).toContain("from crawler_request_hourly_rollups");
    expect(source).toContain("refreshPartnerCountyObservationSnapshots");
    expect(source).toContain("getPartnerCountyObservationSnapshots");
  });
});
