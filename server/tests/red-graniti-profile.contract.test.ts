import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  RED_GRANITI_BUSINESS_NAME,
  RED_GRANITI_LOGO_URL,
  RED_GRANITI_MANAGED_CONTACT,
  RED_GRANITI_OFFICIAL_SOURCES,
  RED_GRANITI_PROFILE_CONTENT_BLOCKS,
  RED_GRANITI_PROFILE_CONTROL,
  RED_GRANITI_PROFILE_SLUG,
  RED_GRANITI_PUBLIC_IDENTITY,
} from "@shared/redGranitiProfile";
import {
  STONE_CORE_RED_GRANITI_DISTRIBUTION_RIGHT,
  STONE_CORE_RED_GRANITI_MATERIALS,
  STONE_CORE_RED_GRANITI_PUBLICATION_TARGETS,
} from "@shared/stoneCore";
import { resolveProfilePublicMediaObjectKey } from "@shared/profilePublicMedia";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

function block(type: string): any {
  return (RED_GRANITI_PROFILE_CONTENT_BLOCKS as readonly any[]).find(
    (entry) => entry?.type === type
  );
}

describe("R.E.D. Graniti profile and Stone Core separation contract", () => {
  it("keeps the company profile under verified TradeScout admin custody", () => {
    const provisioner = read("server/services/redGranitiProfileProvisioning.ts");
    const bootstrap = read("server/services/steelHomePackagesProfileProvisioning.ts");

    expect(RED_GRANITI_PROFILE_SLUG).toBe("red-graniti");
    expect(RED_GRANITI_BUSINESS_NAME).toBe("R.E.D. Graniti");
    expect(RED_GRANITI_PROFILE_CONTROL).toBe("tradescout_admin_controlled");
    expect(provisioner).toContain("hasVerifiedTradeScoutAdminCustody");
    expect(provisioner).toContain("ne(users.id, jwOwner.id)");
    expect(provisioner).toContain("ownerUserId: adminOwner.id");
    expect(provisioner).toContain("profile_control: RED_GRANITI_PROFILE_CONTROL");
    expect(provisioner).toContain('profile_steward: "tradescout_verified_admin"');
    expect(provisioner).toContain('claimStatus: "admin_managed"');
    expect(provisioner).toContain("publicDiscoveryEnabled: true");
    expect(provisioner).toContain('status: "published"');
    expect(provisioner).toContain("phone: REQUEST_ONLY_PHONE_SENTINEL");
    expect(provisioner).toContain("notificationEmail: TRADE_SCOUT_DIRECT_CONNECT_INBOX");
    expect(provisioner).toContain("email: TRADE_SCOUT_DIRECT_CONNECT_INBOX");
    expect(provisioner).toContain("adminOwner.id === jwOwner.id");
    expect(provisioner).not.toContain("ownerUserId: jwOwner.id");
    expect(provisioner).not.toContain("activeBusinessId");
    expect(provisioner).not.toContain("activeProfileId");

    expect(RED_GRANITI_MANAGED_CONTACT.phone).toBe("(850) 543-0748");
    expect(RED_GRANITI_MANAGED_CONTACT.tel).toBe("+18505430748");
    expect(RED_GRANITI_MANAGED_CONTACT.email).toBe("contact@thetradescout.com");

    expect(bootstrap).toContain(
      'import { provisionRedGranitiProfile } from "./redGranitiProfileProvisioning"'
    );
    expect(bootstrap).toContain("await provisionRedGranitiProfile();");
    expect(bootstrap).toContain("R.E.D. Graniti provisioning failed");
  });

  it("keeps the public profile as company identity instead of a combined catalog", () => {
    const serialized = JSON.stringify(RED_GRANITI_PROFILE_CONTENT_BLOCKS);
    const partnership = block("partnership")?.data;

    expect(block("siteTemplate")?.data?.id).toBe("default");
    expect(block("inventoryCatalog")).toBeUndefined();
    expect(block("publicDiscovery")).toBeUndefined();
    expect(block("profilePresentation")).toBeUndefined();
    expect(partnership?.title).toBe("Exclusive first-cut distributor");
    expect(partnership?.text).toContain(
      "First-cut distribution for R.E.D. Graniti stone is handled by JW Stone"
    );
    expect(serialized).not.toMatch(/selected quarry materials|browse full inventory/i);

    expect(RED_GRANITI_PUBLIC_IDENTITY.profileLabel).toBe("Quarries, blocks and slabs");
    expect(RED_GRANITI_PUBLIC_IDENTITY.stats).toHaveLength(4);
    expect(RED_GRANITI_PUBLIC_IDENTITY.capabilities).toHaveLength(3);
    expect(RED_GRANITI_PUBLIC_IDENTITY.operatingLocations).toHaveLength(3);
    expect(RED_GRANITI_PUBLIC_IDENTITY.quarryCountries).toHaveLength(9);
    expect(RED_GRANITI_PUBLIC_IDENTITY.quarryHighlights).toHaveLength(3);
    expect(RED_GRANITI_PUBLIC_IDENTITY.officialLinks).toHaveLength(4);
    expect(JSON.stringify(RED_GRANITI_PUBLIC_IDENTITY.headquarters)).not.toMatch(
      /info@redgraniti\.com|0585 88471|0585 884848/
    );
  });

  it("stores materials, physical assets, inventory, publications, and rights separately", () => {
    const stoneCore = read("server/services/stoneCoreProvisioning.ts");
    const migration = read("migrations/0122_stone_core_schema.sql");
    const provisioner = read("server/services/redGranitiProfileProvisioning.ts");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS stone_materials");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS stone_asset_passports");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS stone_inventory_positions");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS stone_distribution_rights");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS stone_publications");
    expect(migration).toContain("CREATE OR REPLACE VIEW stone_core_material_map");
    expect(stoneCore).not.toMatch(/CREATE TABLE|ALTER TABLE/);
    expect(provisioner).toContain("await ensureStoneCoreTables();");
    expect(provisioner).toContain("await provisionRedGranitiStoneCore({");
    expect(stoneCore).not.toMatch(/INSERT INTO stone_asset_passports/);
    expect(stoneCore).not.toMatch(/INSERT INTO stone_inventory_positions/);
  });

  it("records nine canonical source materials without claiming inventory", () => {
    expect(STONE_CORE_RED_GRANITI_MATERIALS).toHaveLength(9);
    expect(new Set(STONE_CORE_RED_GRANITI_MATERIALS.map((item) => item.slug)).size).toBe(9);

    for (const material of STONE_CORE_RED_GRANITI_MATERIALS) {
      expect(material.sourceProfileSlug).toBe(RED_GRANITI_PROFILE_SLUG);
      expect(material.sourceUrl).toMatch(/^https:\/\/www\.redgraniti\.com\//);
      expect(material.primaryImageUrl).toMatch(/^https:\/\/www\.redgraniti\.com\//);
      expect(material.materialClass).toBe("natural_stone");
      expect(material.summary).not.toMatch(/available|in stock|inventory|pricing/i);
    }

    expect(JSON.stringify(STONE_CORE_RED_GRANITI_MATERIALS)).not.toMatch(
      /\$?950\s*million|950,?000,?000|annual revenue/i
    );
  });

  it("keeps the JW relationship as one separate exclusive first-cut right", () => {
    expect(STONE_CORE_RED_GRANITI_DISTRIBUTION_RIGHT).toEqual({
      sourceProfileSlug: "red-graniti",
      distributorProfileSlug: "jw-stone",
      rightType: "distribution",
      scope: "first_cut",
      exclusivity: "exclusive",
      territoryStatus: "not_publicly_specified",
      relationshipStatus: "active",
      evidenceType: "operator_confirmed",
    });

    expect(STONE_CORE_RED_GRANITI_PUBLICATION_TARGETS).toHaveLength(2);
    expect(STONE_CORE_RED_GRANITI_PUBLICATION_TARGETS.map((target) => target.profileSlug)).toEqual([
      "red-graniti",
      "jw-stone",
    ]);
    expect(
      STONE_CORE_RED_GRANITI_PUBLICATION_TARGETS.every(
        (target) =>
          target.publicationStatus === "authorized_not_published" &&
          target.inventoryClaim === "none"
      )
    ).toBe(true);
  });

  it("uses server-owned media and keeps admin identity out of public sections", () => {
    const hero = block("hero")?.data;
    const sections = block("profileSections")?.data?.sections;
    expect(resolveProfilePublicMediaObjectKey(RED_GRANITI_LOGO_URL)).toBe(
      `public-media${RED_GRANITI_LOGO_URL}`
    );
    expect(fs.existsSync(path.resolve(process.cwd(), `client/public${RED_GRANITI_LOGO_URL}`))).toBe(
      false
    );
    expect(hero?.logoUrl).toBe(RED_GRANITI_LOGO_URL);
    expect(hero?.presentationVariant).toBe("classic");
    expect(sections?.rolesAndBadges).toBe(false);
    expect(sections?.stats).toBe(false);
    expect(sections?.reviews).toBe(false);
    expect(RED_GRANITI_OFFICIAL_SOURCES).toHaveLength(4);
  });
});
