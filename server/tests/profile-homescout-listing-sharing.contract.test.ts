import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("canonical profile HomeScout listing sharing", () => {
  it("loads active seller, agent, and contact listings through the exposure gate", () => {
    const profiles = read("server/routes/profiles.ts");

    expect(profiles).toContain('eq(homeScoutListings.status, "active")');
    expect(profiles).toContain("eq(homeScoutListings.sellerUserId, ownerUserId)");
    expect(profiles).toContain("eq(homeScoutListings.agentUserId, ownerUserId)");
    expect(profiles).toContain("eq(homeScoutListings.contactUserId, ownerUserId)");
    expect(profiles).toContain("const listingAuthority = await buildExposureAuthorityMap");
    expect(profiles).toContain("buildPublicHomeScoutListingCards(");
    expect(profiles).toContain("homeScoutListings: publicHomeScoutListings");
  });

  it("renders exact-photo property cards with view and share actions only", () => {
    const items = read("client/src/components/profile/PublicProfileItems.tsx");

    expect(items).toContain("items?.homeScoutListings");
    expect(items).toContain("listing.imageUrl");
    expect(items).toContain("listing.detailPath");
    expect(items).toContain("TradeScout HomeScout");
    expect(items).not.toContain("Contact agent");
    expect(items).not.toContain("Message owner");
  });

  it("serves crawler metadata for the same durable listing URL before the SPA fallback", () => {
    const server = read("server/index.ts");
    const route = 'app.get("/homescout/listings/:listingId"';

    expect(server).toContain("buildPublicHomeScoutListingHtml");
    expect(server).toContain(route);
    expect(server.indexOf(route)).toBeLessThan(server.indexOf('app.get("*"'));
    expect(server).toContain("Failed to render HomeScout listing page");
  });
});
