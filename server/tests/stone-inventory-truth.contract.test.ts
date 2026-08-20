import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  STONE_CURRENT_INVENTORY_AVAILABLE_STATUS,
  STONE_CURRENT_INVENTORY_FRESHNESS_DAYS,
  STONE_CURRENT_INVENTORY_PUBLIC_STATUS,
  STONE_CURRENT_INVENTORY_VERIFIED_STATUS,
  isStoneInventoryConfirmationFresh,
  normalizePublicStoneInventoryImageUrls,
} from "@shared/stoneInventory";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

describe("stone inventory truth and freshness", () => {
  it("publishes physical stock only inside both freshness windows", () => {
    const now = new Date("2026-08-20T12:00:00.000Z");

    expect(
      isStoneInventoryConfirmationFresh({
        lastConfirmedAt: "2026-08-19T12:00:00.000Z",
        confirmationExpiresAt: "2026-09-18T12:00:00.000Z",
        now,
      })
    ).toBe(true);

    expect(
      isStoneInventoryConfirmationFresh({
        lastConfirmedAt: "2026-08-19T12:00:00.000Z",
        confirmationExpiresAt: "2026-08-20T12:00:00.000Z",
        now,
      })
    ).toBe(false);

    expect(
      isStoneInventoryConfirmationFresh({
        lastConfirmedAt: "2026-08-21T12:00:00.000Z",
        confirmationExpiresAt: "2026-09-01T12:00:00.000Z",
        now,
      })
    ).toBe(false);

    expect(
      isStoneInventoryConfirmationFresh({
        lastConfirmedAt: "2026-06-01T12:00:00.000Z",
        confirmationExpiresAt: "2026-09-01T12:00:00.000Z",
        now,
      })
    ).toBe(false);
  });

  it("accepts only safe public image references", () => {
    expect(
      normalizePublicStoneInventoryImageUrls([
        "/images/stone.webp",
        "https://example.com/stone.jpg",
        "http://example.com/not-allowed.jpg",
        "javascript:alert(1)",
        "//evil.example/image.jpg",
        "/images/stone.webp",
        "/images/bad\\name.jpg",
      ])
    ).toEqual(["/images/stone.webp", "https://example.com/stone.jpg"]);
  });

  it("uses explicit public physical-stock statuses", () => {
    expect(STONE_CURRENT_INVENTORY_FRESHNESS_DAYS).toBe(45);
    expect(STONE_CURRENT_INVENTORY_AVAILABLE_STATUS).toBe("available");
    expect(STONE_CURRENT_INVENTORY_PUBLIC_STATUS).toBe("published_current");
    expect(STONE_CURRENT_INVENTORY_VERIFIED_STATUS).toBe("verified");
  });

  it("presents JW's static catalog as a Material Library", () => {
    const presentation = read("client/src/data/jwStoneProfilePresentation.ts");
    const collection = read("client/src/features/jw-stone/StoneCollection.tsx");
    const marketplace = read("client/src/features/jw-stone/JWStoneMarketplace.tsx");
    const crawlerHtml = read("server/publicJwStoneMarketplaceHtml.ts");

    expect(presentation).toContain('inventoryTitle: "Material Library"');
    expect(presentation).toContain("material library");
    expect(presentation).not.toContain("· current inventory");
    expect(collection).toContain('title="Material Library"');
    expect(collection).toContain('id="material-library"');
    expect(collection).not.toContain('title="Full inventory"');
    expect(marketplace).toContain("<CurrentInventorySection");
    expect(crawlerHtml).toContain("<h2>Material Library</h2>");
    expect(crawlerHtml).not.toContain("Browse current selections by photo");
  });

  it("keeps current stock separate, dated, and requestable", () => {
    const currentInventory = read("client/src/features/jw-stone/CurrentInventorySection.tsx");
    const manager = read("client/src/components/profile/JwStoneCurrentInventoryManager.tsx");
    const routes = read("server/routes/profiles.ts");

    expect(currentInventory).toContain("Physically confirmed stock");
    expect(currentInventory).toContain("active recheck window");
    expect(currentInventory).toContain("The Material Library below is broader");
    expect(currentInventory).toContain("Ask about this stock");
    expect(manager).toContain("Confirm current stock");
    expect(manager).toContain("confirmationExpiresAt");
    expect(routes).toContain('router.get("/api/u/:slug/stone-inventory/current"');
    expect(routes).toContain('router.post("/api/u/:slug/stone-inventory/current"');
    expect(routes).toContain('router.delete("/api/u/:slug/stone-inventory/current/:passportId"');
    expect(routes).toContain("isStoneInventoryConfirmationFresh");
    expect(routes).toContain("STONE_CURRENT_INVENTORY_PUBLIC_STATUS");
    expect(routes).toContain("STONE_CURRENT_INVENTORY_VERIFIED_STATUS");
  });

  it("does not convert R.E.D. source materials or distribution rights into physical stock", () => {
    const redProvisioner = read("server/services/redGranitiProfileProvisioning.ts");
    const stoneCoreProvisioner = read("server/services/stoneCoreProvisioning.ts");
    const architecture = read("docs/architecture/STONE_CORE.md");

    expect(redProvisioner).not.toContain("INSERT INTO stone_inventory_positions");
    expect(stoneCoreProvisioner).toContain("Intentionally no physical passport/position insert here");
    expect(architecture).toContain("JW Stone's photo catalog is a **Material Library**");
    expect(architecture).toContain("R.E.D. Graniti source materials never become JW Stone inventory");
  });

  it("marks JW static share pages as material offerings rather than stock", () => {
    const canonical = read("server/jwStoneCanonicalInventory.ts");
    const sharing = read("shared/profileItemShare.ts");

    expect(canonical).toContain('publicKind: "offering"');
    expect(canonical).toContain("part of JW Stone's material library");
    expect(sharing).toContain('item.publicKind === "offering"');
  });
});
