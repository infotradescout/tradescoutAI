import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  RED_GRANITI_BUSINESS_NAME,
  RED_GRANITI_FEATURED_MATERIAL_SLUGS,
  RED_GRANITI_LOGO_URL,
  RED_GRANITI_OFFICIAL_SOURCES,
  RED_GRANITI_PROFILE_CONTENT_BLOCKS,
  RED_GRANITI_PROFILE_CONTROL,
  RED_GRANITI_PROFILE_SLUG,
} from "@shared/redGranitiProfile";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

function block(type: string): any {
  return (RED_GRANITI_PROFILE_CONTENT_BLOCKS as readonly any[]).find(
    (entry) => entry?.type === type
  );
}

describe("R.E.D. Graniti TradeScout profile contract", () => {
  it("keeps the company profile under verified TradeScout admin custody", () => {
    const provisioner = read("server/services/redGranitiProfileProvisioning.ts");
    const bootstrap = read("server/services/steelHomePackagesProfileProvisioning.ts");

    expect(RED_GRANITI_PROFILE_SLUG).toBe("red-graniti");
    expect(RED_GRANITI_BUSINESS_NAME).toBe("R.E.D. Graniti");
    expect(RED_GRANITI_PROFILE_CONTROL).toBe("tradescout_admin_controlled");

    expect(provisioner).toContain("hasVerifiedTradeScoutAdminCustody");
    expect(provisioner).toContain('ne(users.id, jwOwner.id)');
    expect(provisioner).toContain("ownerUserId: adminOwner.id");
    expect(provisioner).toContain('profile_control: RED_GRANITI_PROFILE_CONTROL');
    expect(provisioner).toContain('profile_steward: "tradescout_verified_admin"');
    expect(provisioner).toContain('claimStatus: "admin_managed"');
    expect(provisioner).toContain('publicDiscoveryEnabled: true');
    expect(provisioner).toContain('status: "published"');
    expect(provisioner).toContain('notificationEmail: TRADE_SCOUT_DIRECT_CONNECT_INBOX');
    expect(provisioner).toContain(
      'public_request_routing: "tradescout_admin_manual_dispatch_to_jw_stone"'
    );
    expect(provisioner).toContain("adminOwner.id === jwOwner.id");
    expect(provisioner).not.toContain("ownerUserId: jwOwner.id");
    expect(provisioner).not.toContain("activeBusinessId");
    expect(provisioner).not.toContain("activeProfileId");

    expect(bootstrap).toContain(
      'import { provisionRedGranitiProfile } from "./redGranitiProfileProvisioning"'
    );
    expect(bootstrap).toContain("await provisionRedGranitiProfile();");
    expect(bootstrap).toContain("R.E.D. Graniti provisioning failed");
  });

  it("records JW Stone only as the exclusive first-cut distributor", () => {
    const provisioner = read("server/services/redGranitiProfileProvisioning.ts");
    const serialized = JSON.stringify(RED_GRANITI_PROFILE_CONTENT_BLOCKS);
    const cta = block("cta")?.data;

    expect(provisioner).toContain(
      '"jw_stone_exclusive_first_cut_distributor"'
    );
    expect(provisioner).toContain('distribution_operator: JW_STONE_PROFILE_SLUG');
    expect(provisioner).toContain(
      'territory_scope: "not_publicly_specified"'
    );
    expect(cta?.contactOperatorName).toBe("JW Stone");
    expect(cta?.contactOperatorRole).toBe("exclusive first-cut distributor");
    expect(serialized).toContain("exclusive first-cut distribution through JW Stone");
    expect(serialized).not.toMatch(
      /exclusive\s+(?:u\.s\.|united states|north american|worldwide|global)\s+distribut/i
    );
  });

  it("ships a source-backed quarry catalog without using the Google revenue estimate", () => {
    const inventory = block("inventoryCatalog")?.data;
    const categories = Array.isArray(inventory?.categories) ? inventory.categories : [];
    const stones = categories.flatMap((category: any) => category.stones || []);
    const sourceUrls = stones.map((stone: any) => String(stone.sourceUrl || ""));
    const serialized = JSON.stringify(RED_GRANITI_PROFILE_CONTENT_BLOCKS);

    expect(categories).toHaveLength(4);
    expect(stones).toHaveLength(9);
    expect(new Set(stones.map((stone: any) => stone.slug)).size).toBe(9);
    expect(RED_GRANITI_FEATURED_MATERIAL_SLUGS).toHaveLength(5);
    expect(stones.map((stone: any) => stone.slug)).toEqual(
      expect.arrayContaining([...RED_GRANITI_FEATURED_MATERIAL_SLUGS])
    );
    for (const stone of stones) {
      expect(stone.images).toEqual(
        expect.arrayContaining([RED_GRANITI_LOGO_URL])
      );
      expect(stone.shareImageOrder).toEqual([1, 0]);
      expect(stone.publicKind).toBe("offering");
      expect(stone.materialStatus).toBe("source_folder");
      expect(stone.hideFinishDetails).toBe(true);
    }
    for (const sourceUrl of sourceUrls) {
      expect(sourceUrl).toMatch(/^https:\/\/www\.redgraniti\.com\//);
    }
    expect(RED_GRANITI_OFFICIAL_SOURCES).toHaveLength(4);
    expect(serialized).not.toMatch(/\$?950\s*million|950,?000,?000|annual revenue/i);
  });

  it("uses the locally hosted owner-supplied logo and keeps admin identity out of public sections", () => {
    const presentation = block("profilePresentation")?.data;
    const sections = block("profileSections")?.data?.sections;
    const logoPath = path.resolve(
      process.cwd(),
      "client/public",
      RED_GRANITI_LOGO_URL.replace(/^\//, "")
    );

    expect(RED_GRANITI_LOGO_URL).toBe(
      "/images/businesses/red-graniti/logo/red-graniti.png"
    );
    expect(fs.existsSync(logoPath)).toBe(true);
    expect(fs.statSync(logoPath).size).toBe(2523);
    expect(presentation?.header?.logoUrl).toBe(RED_GRANITI_LOGO_URL);
    expect(presentation?.social?.logoUrl).toBe(RED_GRANITI_LOGO_URL);
    expect(presentation?.social?.profileImageUrl).toBe(RED_GRANITI_LOGO_URL);
    expect(sections?.rolesAndBadges).toBe(false);
    expect(sections?.stats).toBe(false);
    expect(sections?.reviews).toBe(false);
  });

  it("publishes crawlable material and category destinations", () => {
    const discovery = block("publicDiscovery")?.data;
    const categories = discovery?.categories || [];

    expect(discovery?.sitemap).toEqual({
      inventory: true,
      categories: true,
    });
    expect(categories).toHaveLength(4);
    expect(categories.every((category: any) => category.indexable === true)).toBe(true);
    expect(categories.every((category: any) => category.collectionKind === "offerings")).toBe(
      true
    );
    expect(categories.map((category: any) => category.publicSlug)).toEqual([
      "architectural-exotic-stone",
      "black-granite",
      "warm-granite",
      "danby-marble",
    ]);
  });
});
