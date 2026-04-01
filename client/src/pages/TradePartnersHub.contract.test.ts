import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("TradePartnersHub route safety contracts", () => {
  it("normalizes CTA URLs to internal paths and protects partner fallback", () => {
    const source = read("client/src/pages/TradePartnersHub.tsx");

    expect(source).toContain(
      "function normalizeCtaUrl(url: string | undefined, partnerSlug: string): string"
    );
    expect(source).toContain('if (trimmed.startsWith("/"))');
    expect(source).toContain('if (partnerSlug === "cumulus-media")');
    expect(source).toContain('return "/tradepartners/cumulus-media";');
    expect(source).toContain('return "/tradepartners";');
  });

  it("falls back to county landing path when partner CTA is unavailable", () => {
    const source = read("client/src/pages/TradePartnersHub.tsx");

    expect(source).toContain("const fallbackCountyHref = campaign.counties[0]?.slug");
    expect(source).toContain("`/tradepartners/${encodeURIComponent(campaign.counties[0].slug)}`");
    expect(source).toContain(
      'href={partnerHref === "/tradepartners" ? fallbackCountyHref : partnerHref}'
    );
  });
});
