import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("contractor project photo sharing contract", () => {
  it("renders each project photo with an exact share action and selected state", () => {
    const page = read("client/src/pages/contractor-profile.tsx");

    expect(page).toContain("listContractorProjectPhotos(contractor?.photos)");
    expect(page).toContain("createContractorPhotoShareMetadata({");
    expect(page).toContain("contractor-project-photo-${photo.slug}");
    expect(page).toContain("buildContractorPhotoShareSearch(photo.slug)");
    expect(page).toContain("Shared image");
    expect(page).toContain("<ShareButton");
    expect(page).toContain("<img");
  });

  it("renders exact crawler metadata before the SPA fallback", () => {
    const serverIndex = read("server/index.ts");
    const publicHtml = read("server/publicContractorProfileHtml.ts");

    expect(serverIndex).toContain('app.get("/contractors/:slug"');
    expect(serverIndex).toContain("buildPublicContractorProfileHtml({");
    expect(serverIndex).toContain("gallerySlug: req.query.gallery");
    expect(publicHtml).toContain("createContractorPhotoShareMetadata({");
    expect(publicHtml).toContain('itemShare ? "article" : "profile"');
    expect(publicHtml).toContain('"@type": "ImageObject"');
    expect(publicHtml).toContain('kind: "redirect"');
  });

  it("publishes only approved recommendations and strips private contractor fields", () => {
    const routes = read("server/routes.ts");
    const mapper = read("server/publicContractorRecommendations.ts");

    expect(routes).toContain("toPublicContractorRecommendations(recommendationRows)");
    expect(routes).toContain("userId, businessId, insuranceDocUrl");
    expect(mapper).toContain('row?.isPublic === true && row?.moderationStatus === "approved"');
    expect(mapper).not.toContain("customerEmail: row.customerEmail");
    expect(mapper).not.toContain("customerPhone: row.customerPhone");
    expect(mapper).not.toContain("moderatedBy: row.moderatedBy");
  });

  it("leaves the protected Direct Connect path and sign-in gates in place", () => {
    const page = read("client/src/pages/contractor-profile.tsx");

    expect(page).toContain("const directConnectHref = `/direct-connect?intent=hire");
    expect(page).toContain("/pre-scout-setup?mode=create&next=");
    expect(page).toContain("/pre-scout-setup?mode=signin&next=");
    expect(page).toContain("Sign In");
    expect(page).toContain("Contact is protected to prevent spam.");
    expect(page).toContain("Start a request to route work through TradeScout's trust policy.");
  });
});
