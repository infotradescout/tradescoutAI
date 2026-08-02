import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPublicContractorPromoCards,
  buildPublicContractorPromoDetail,
  createContractorPromoShareMetadata,
  isContractorPromoPubliclyAvailable,
} from "../../shared/contractorPromoShare";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const activePromo = {
  id: "promo-1",
  slug: "summer-roof-special",
  title: "Summer roof special",
  description: "Save now. Call 555-867-5309 or email roof@example.com",
  offerDetails: "20% off qualifying work",
  discountType: "percentage",
  discountValue: "20",
  minimumJobValue: "500",
  promoCode: "ROOF20",
  isActive: true,
  currentUses: 2,
  maxUses: 20,
  expiresAt: "2030-08-01T00:00:00.000Z",
  imageUrl: "/objects/promo-roof.webp",
};

const provider = {
  id: "contractor-1",
  companyName: "Trusted Roof Co",
  slug: "trusted-roof-co",
  photos: ["/objects/provider-work.jpg"],
  verifiedLicensed: true,
  verifiedInsured: true,
};

describe("contractor promotion sharing", () => {
  it("keeps only active, unexpired, available promotions", () => {
    const now = new Date("2029-01-01T00:00:00.000Z");
    expect(isContractorPromoPubliclyAvailable(activePromo, now)).toBe(true);
    expect(isContractorPromoPubliclyAvailable({ ...activePromo, isActive: false }, now)).toBe(
      false
    );
    expect(
      isContractorPromoPubliclyAvailable({ ...activePromo, expiresAt: "2028-01-01" }, now)
    ).toBe(false);
    expect(isContractorPromoPubliclyAvailable({ ...activePromo, currentUses: 20 }, now)).toBe(
      false
    );
  });

  it("uses the exact promotion image first and redacts contact text", () => {
    const [card] = buildPublicContractorPromoCards({
      promos: [activePromo],
      providerPhotos: provider.photos,
    });

    expect(card.imageUrl).toBe("/objects/promo-roof.webp");
    expect(card.imageSource).toBe("promotion");
    expect(card.detailPath).toBe("/promo/summer-roof-special");
    expect(card.discountLabel).toBe("20% off");
    expect(card.description).not.toContain("555-867-5309");
    expect(card.description).not.toContain("roof@example.com");
    expect(card.description).toContain("Continue through TradeScout");
  });

  it("falls back honestly to the provider work photo for legacy promotions", () => {
    const [card] = buildPublicContractorPromoCards({
      promos: [{ ...activePromo, imageUrl: null }],
      providerPhotos: provider.photos,
    });

    expect(card.imageUrl).toBe("/objects/provider-work.jpg");
    expect(card.imageSource).toBe("provider");
  });

  it("builds a public detail and social preview", () => {
    const detail = buildPublicContractorPromoDetail({ promo: activePromo, provider });
    expect(detail?.provider.profilePath).toBe("/contractors/trusted-roof-co");
    expect(detail?.contactAccess.mode).toBe("direct_connect_required");

    const meta = createContractorPromoShareMetadata({
      promo: activePromo,
      provider,
      origin: "https://www.thetradescout.com",
    });
    expect(meta?.canonical).toBe("https://www.thetradescout.com/promo/summer-roof-special");
    expect(meta?.imageUrl).toBe("https://www.thetradescout.com/objects/promo-roof.webp");
    expect(meta?.description).not.toContain("contact details");
    expect(meta?.description.length).toBeLessThanOrEqual(220);
  });

  it("wires the real page, profile cards, Trust/CVS gate, image upload, and migration", () => {
    const routes = read("server/routes/contractor-promos.ts");
    const profiles = read("server/routes/profiles.ts");
    const items = read("client/src/components/profile/PublicProfileItems.tsx");
    const appRoutes = read("client/src/AppRoutes.tsx");
    const serverIndex = read("server/index.ts");
    const form = read("client/src/pages/contractor-promos.tsx");
    const imageMigration = read("migrations/0103_contractor_promo_image.sql");
    const requestCountMigration = read(
      "migrations/0105_contractor_promo_project_request_count.sql"
    );
    const testDbBootstrap = read("scripts/bootstrap-test-db.mjs");

    expect(routes).toContain('app.get("/api/promo/:slug", sendPublicPromoJson)');
    expect(routes).toContain("hasExposureAuthority(authorityUserId)");
    expect(routes).toContain('accept.includes("text/html")');
    expect(profiles).toContain("buildPublicContractorPromoCards({");
    expect(profiles).toContain("contractorPromos: publicContractorPromos");
    expect(items).toContain("items?.contractorPromos");
    expect(items).toContain("promo.imageUrl");
    expect(items).toContain("promo.detailPath");
    expect(items).not.toContain("Call provider");
    expect(appRoutes).toContain('<Route path="/promo/:slug">');
    expect(serverIndex).toContain('app.get("/promo/:slug"');
    expect(serverIndex).toContain("buildPublicContractorPromoHtml");
    expect(form).toContain('name="imageUrl"');
    expect(form).toContain("uploadObject(file)");
    expect(imageMigration).toContain("ADD COLUMN IF NOT EXISTS image_url VARCHAR(2048)");
    expect(requestCountMigration).toContain(
      "ADD COLUMN IF NOT EXISTS project_request_count INTEGER DEFAULT 0"
    );
    expect(testDbBootstrap).toContain('"contractor_promos"');
    expect(testDbBootstrap).toContain(
      "ALTER TABLE contractor_promos ADD COLUMN IF NOT EXISTS image_url varchar(2048)"
    );
    expect(testDbBootstrap).toContain(
      "ALTER TABLE contractor_promos ADD COLUMN IF NOT EXISTS project_request_count integer DEFAULT 0"
    );
  });
});
