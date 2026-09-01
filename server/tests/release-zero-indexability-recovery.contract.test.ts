import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COMPREHENSIVE_TRADES } from "@shared/trades-data";
import {
  resolvePublicLandingIndexability,
  STABLE_PUBLIC_LANDING_BASE_VARIANTS,
} from "@shared/publicLandingIndexability";
import {
  applyPrivateShellNoindex,
  isPrivateAppShellPath,
  PRIVATE_APP_SHELL_PREFIXES,
} from "../privateShellIndexability";
import { deriveTradeSlugFromProfileData } from "../publicationBusiness";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Release 0 discovery indexability recovery", () => {
  it("indexes only reviewed base and exact trade landing variants", () => {
    expect(STABLE_PUBLIC_LANDING_BASE_VARIANTS).toEqual([
      "contractor",
      "homeowner",
      "realtor",
      "hoa",
      "property-manager",
      "lender",
      "insurance-agent",
      "supplier",
      "affiliate",
      "local-operating-system",
    ]);

    for (const variant of STABLE_PUBLIC_LANDING_BASE_VARIANTS) {
      expect(
        resolvePublicLandingIndexability({ requestPath: `/landing/${variant}` })
      ).toEqual({
        canonicalPath: `/landing/${variant}`,
        indexable: true,
        stableVariant: variant,
      });
    }

    for (const trade of COMPREHENSIVE_TRADES) {
      expect(
        resolvePublicLandingIndexability({ requestPath: `/landing/${trade.slug}` }).indexable
      ).toBe(true);
    }
  });

  it("noindexes aliases, query variants, and unreviewed campaign slugs", () => {
    expect(resolvePublicLandingIndexability({ requestPath: "/lp/realtor" })).toEqual({
      canonicalPath: "/landing/realtor",
      indexable: false,
      stableVariant: "realtor",
    });
    expect(
      resolvePublicLandingIndexability({ requestPath: "/landing/realtor?campaign=video-1" })
    ).toEqual({
      canonicalPath: "/landing/realtor",
      indexable: false,
      stableVariant: "realtor",
    });
    expect(
      resolvePublicLandingIndexability({ requestPath: "/landing/realtor-austin-video-1" })
    ).toEqual({
      canonicalPath: "/",
      indexable: false,
      stableVariant: null,
    });
  });

  it("applies noindex at both private shell boundaries", () => {
    expect(PRIVATE_APP_SHELL_PREFIXES).toEqual([
      "/scout",
      "/auth",
      "/dashboard",
      "/account",
    ]);
    for (const prefix of PRIVATE_APP_SHELL_PREFIXES) {
      expect(isPrivateAppShellPath(prefix)).toBe(true);
      expect(isPrivateAppShellPath(`${prefix}/settings?tab=profile`)).toBe(true);
    }
    expect(isPrivateAppShellPath("/SCOUT/history")).toBe(true);
    expect(isPrivateAppShellPath("/%73cout/history#latest")).toBe(true);
    expect(isPrivateAppShellPath("/scouting")).toBe(false);
    expect(isPrivateAppShellPath("/public-profile")).toBe(false);

    const replaced = applyPrivateShellNoindex(
      '<html><head><meta name="robots" content="index,follow" /></head><body></body></html>'
    );
    const inserted = applyPrivateShellNoindex("<html><head></head><body></body></html>");
    expect(replaced).toContain('content="noindex,nofollow,noarchive"');
    expect(replaced).not.toContain('content="index,follow"');
    expect(inserted).toContain('content="noindex,nofollow,noarchive"');
    expect(applyPrivateShellNoindex("<main>Private shell</main>")).toContain(
      'content="noindex,nofollow,noarchive"'
    );
  });

  it("wires recent empty states and sitemap rows to crawlability gates", () => {
    const recentSource = read("server/publicRecentHtml.ts");
    const repositorySource = read("server/repositories/sitemapRepository.ts");
    const publicationSource = read("server/publicationBusiness.ts");
    const serverSource = read("server/index.ts");

    expect(recentSource.match(/items\.length > 0/g)).toHaveLength(4);
    expect(recentSource).toContain('content="noindex,follow"');
    expect(repositorySource.match(/publicBusinessSitemapCrawlabilitySqlPredicate\(/g)).toHaveLength(
      2
    );
    expect(publicationSource).toContain("listingStaleDaysUnclaimed");
    expect(publicationSource).toContain("listingStaleDaysVerified");
    expect(publicationSource).toContain("PUBLIC_TRADE_INPUT_SLUGS");
    expect(publicationSource).toContain("WITH ORDINALITY");
    expect(publicationSource).toContain("LIMIT 8");
    expect(serverSource).toContain('res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive")');
    expect(serverSource).toContain("applyPrivateShellNoindex(templateHtml)");
  });

  it("keeps the sitemap trade bound identical to the public business renderer", () => {
    const sevenUnknownServices = Array.from({ length: 7 }, (_, index) => `unknown-${index}`);
    expect(
      deriveTradeSlugFromProfileData({
        services: [...sevenUnknownServices, "plumbing"],
      })
    ).toBe("plumbing");
    expect(
      deriveTradeSlugFromProfileData({
        services: [...sevenUnknownServices, "unknown-7", "plumbing"],
      })
    ).toBeNull();
  });
});
