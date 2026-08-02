import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("tradepartner public campaigns list contract", () => {
  it("registers public campaigns list route before partner slug route", () => {
    const routesSource = read("server/routes/commercial-promotions.ts");

    expect(routesSource).toContain(
      'app.get("/api/tradepartner-campaigns", listTradePartnerCampaignsPublicHandler as any);'
    );
    expect(routesSource).toContain(
      'app.get("/api/tradepartner-campaigns/:partnerSlug", getTradePartnerCampaignPublicHandler as any);'
    );
  });

  it("exposes an active-only public list handler with safe fallback", () => {
    const source = read("server/routes/tradepartner-campaigns.ts");

    expect(source).toContain("export async function listTradePartnerCampaignsPublicHandler");
    expect(source).toContain("WHERE is_active = TRUE");
    expect(source).toContain(
      "Promise.all(activeSlugs.map((partnerSlug) => fetchCampaignBySlug(partnerSlug)))"
    );
    expect(source).toContain("return res.json({ items: campaigns });");
    expect(source).toContain('const fallback = buildFallbackCampaign("cumulus-media")');
    expect(source).toContain("return res.json({ items: [fallback] });");
  });
});
