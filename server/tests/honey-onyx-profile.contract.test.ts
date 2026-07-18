import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  HONEY_ONYX_DISTRIBUTOR_NAME,
  HONEY_ONYX_PROFILE_CONTENT_BLOCKS,
  HONEY_ONYX_PROFILE_IMAGES,
  HONEY_ONYX_PROFILE_SLUG,
} from "@shared/honeyOnyxProfile";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Honey Onyx standalone public profile contract", () => {
  it("publishes Honey Onyx separately while keeping JW Stone as distributor only", () => {
    const provisioner = read("server/services/honeyOnyxProfileProvisioning.ts");
    const entry = read("server/index.ts");

    expect(HONEY_ONYX_PROFILE_SLUG).toBe("honey-onyx");
    expect(HONEY_ONYX_DISTRIBUTOR_NAME).toBe("JW Stone");
    expect(provisioner).toContain('product_ownership: "independent_from_distributor"');
    expect(provisioner).toContain(
      'distributor_relationship: "distribution_and_availability_contact"'
    );
    expect(provisioner).toContain("tradescout_admin_pending_owner_account_transfer");
    expect(provisioner).toContain("claimStatus:");
    expect(provisioner).toContain('status: "published"');
    expect(provisioner).toContain("publicDiscoveryEnabled: true");
    expect(provisioner).not.toContain("activeBusinessId");
    expect(provisioner).not.toContain("activeProfileId");
    expect(entry).toContain("await provisionHoneyOnyxProfile()");
  });

  it("uses all six real product photos on the standalone profile", () => {
    expect(HONEY_ONYX_PROFILE_IMAGES).toHaveLength(6);
    expect(new Set(HONEY_ONYX_PROFILE_IMAGES).size).toBe(6);

    for (const image of HONEY_ONYX_PROFILE_IMAGES) {
      expect(
        fs.existsSync(path.resolve(process.cwd(), "client/public", image.replace(/^\//, ""))),
        image
      ).toBe(true);
    }

    const inventoryBlock = HONEY_ONYX_PROFILE_CONTENT_BLOCKS.find(
      (block) => block.type === "inventoryCatalog"
    );
    expect((inventoryBlock?.data as any)?.categories?.[0]?.stones?.[0]?.images).toHaveLength(6);
  });

  it("renders accurate product copy and distributor-aware Direct Connect", () => {
    const theme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const panel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");
    const profileCopy = JSON.stringify(HONEY_ONYX_PROFILE_CONTENT_BLOCKS);

    expect(profileCopy).toContain("Independently owned product");
    expect(profileCopy).toContain("Distributed by JW Stone");
    expect(profileCopy).toContain("six source photos");
    expect(profileCopy).not.toMatch(/\bbuilt (?:for|to|around)\b/i);
    expect(theme).toContain("text={`${stone.name} from ${displayName}`}");
    expect(theme).toContain("{ctaHeading}");
    expect(theme).toContain("contactOperatorName={contactOperatorName || undefined}");
    expect(theme).not.toContain("Finish not confirmed — ask JW Stone");
    expect(panel).toContain("hasSeparateOperator");
    expect(panel).toContain("Your ${businessName} request was sent to ${operatorName}.");
  });

  it("restores all six Honey Onyx photos to the JW Stone distributor catalog", () => {
    const generated = JSON.parse(read("client/src/data/jwStoneInventory.generated.json"));
    const honeyOnyx = generated.find((stone: any) => stone.slug === "honey-onyx");

    expect(honeyOnyx?.categorySlug).toBe("onyx");
    expect(honeyOnyx?.images).toHaveLength(6);
    expect(honeyOnyx?.sourceFileIds).toHaveLength(6);
  });
});
