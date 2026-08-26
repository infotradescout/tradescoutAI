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

  it("presents JW's maintained catalog as Browse Full Inventory", () => {
    const presentation = read("client/src/data/jwStoneProfilePresentation.ts");
    const collection = read("client/src/features/jw-stone/StoneCollection.tsx");
    const marketplace = read("client/src/features/jw-stone/JWStoneMarketplace.tsx");
    const crawlerHtml = read("server/publicJwStoneMarketplaceHtml.ts");

    expect(presentation).toContain('inventoryTitle: "Browse Full Inventory"');
    expect(presentation).toContain("full inventory");
    expect(presentation).not.toContain("Material Library");
    expect(presentation).not.toContain("· current inventory");
    expect(collection).toContain('title="Browse Full Inventory"');
    expect(collection).toContain('id="current-inventory"');
    expect(collection).not.toContain('title="Material Library"');
    expect(marketplace).toContain("<CurrentInventorySection");
    expect(crawlerHtml).toContain("<h2>First Cut Exclusives</h2>");
    expect(crawlerHtml).toContain("<h2>Browse Full Inventory</h2>");
    expect(crawlerHtml).toContain("<h2>Browse by Color</h2>");
    expect(crawlerHtml).toContain("<h2>Browse by Material</h2>");
    expect(crawlerHtml).not.toContain("<h2>Material Library</h2>");
    expect(crawlerHtml).not.toContain("<h2>New Arrivals</h2>");
    expect(crawlerHtml).not.toContain("Browse current selections by photo");
  });

  it("shows only explicitly selected New Arrivals and disappears when there are none", () => {
    const publicSlot = read("client/src/features/jw-stone/CurrentInventorySection.tsx");
    const manager = read("client/src/components/profile/JwStoneCurrentInventoryManager.tsx");
    const routes = read("server/routes/stone-inventory.ts");
    const routeRegistration = read("server/routes.ts");
    const inventoryService = read("server/services/stoneInventoryService.ts");
    const arrivalsService = read("server/services/stoneNewArrivalsService.ts");

    expect(publicSlot).toContain("export function NewArrivalsSection");
    expect(publicSlot).toContain("New Arrivals");
    expect(publicSlot).toContain("Just arrived");
    expect(publicSlot).toContain("/api/u/jw-stone/stone-inventory/new-arrivals");
    expect(publicSlot).toMatch(/items\.length === 0\) return null/);
    expect(publicSlot).not.toContain(">Current Inventory<");
    expect(publicSlot).not.toContain("Refresh");
    expect(manager).toContain("Show in New Arrivals");
    expect(manager).toContain("Remove from New Arrivals");
    expect(manager).toContain("New Arrivals is a separate choice");
    expect(routes).toContain('app.get("/api/u/:slug/stone-inventory/current"');
    expect(routes).toContain('app.get("/api/u/:slug/stone-inventory/new-arrivals"');
    expect(routes).toContain('"/api/u/:slug/stone-inventory/new-arrivals/manage"');
    expect(routes).toContain('"/api/u/:slug/stone-inventory/current/:publicId/new-arrival"');
    expect(routeRegistration).toContain("registerStoneInventoryRoutes(app)");
    expect(inventoryService).toContain("isStoneInventoryConfirmationFresh");
    expect(inventoryService).toContain("STONE_CURRENT_INVENTORY_PUBLIC_STATUS");
    expect(inventoryService).toContain("STONE_CURRENT_INVENTORY_VERIFIED_STATUS");
    expect(arrivalsService).toContain("showAsNewArrival");
    expect(arrivalsService).toContain("listPublicCurrentStoneInventory");
    expect(arrivalsService).toContain("never promotes a");
    expect(arrivalsService).not.toContain("received_at >");
  });

  it("does not convert R.E.D. source materials or distribution rights into physical stock", () => {
    const redProvisioner = read("server/services/redGranitiProfileProvisioning.ts");
    const stoneCoreProvisioner = read("server/services/stoneCoreProvisioning.ts");
    const architecture = read("docs/architecture/STONE_CORE.md");

    expect(redProvisioner).not.toContain("INSERT INTO stone_inventory_positions");
    expect(redProvisioner).not.toContain("INSERT INTO stone_asset_passports");
    expect(stoneCoreProvisioner).not.toContain("INSERT INTO stone_inventory_positions");
    expect(stoneCoreProvisioner).not.toContain("INSERT INTO stone_asset_passports");
    expect(architecture).toContain("JW Stone's photo catalog is a **Material Library**");
    expect(architecture).toContain(
      "R.E.D. Graniti source materials never become JW Stone inventory"
    );
  });

  it("marks JW static share pages as material offerings rather than stock", () => {
    const canonical = read("server/jwStoneCanonicalInventory.ts");
    const sharing = read("shared/profileItemShare.ts");

    expect(canonical).toContain('publicKind: "offering"');
    expect(canonical).toContain("part of JW Stone's material library");
    expect(sharing).toContain('item.publicKind === "offering"');
  });
});
