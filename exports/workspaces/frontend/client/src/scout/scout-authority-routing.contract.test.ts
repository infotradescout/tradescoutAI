import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("scout authority routing contracts", () => {
  it("removes legacy local business intent branches from ScoutOS", () => {
    const source = read("client/src/scout/ScoutOS.tsx");

    expect(source).not.toContain("providerOfferKeywords");
    expect(source).not.toContain("providerStandingKeywords");
    expect(source).not.toContain("providerPromotionKeywords");
    expect(source).not.toContain("communityBuilderDonationKeywords");
    expect(source).not.toContain("communityAnnouncementKeywords");
    expect(source).not.toContain("marketplaceKeywords");
    expect(source).not.toContain("contractorKeywords");
    expect(source).not.toContain("contactKeywords");
    expect(source).not.toContain("!SCOUT_SERVER_AUTHORITY_MODE");
  });

  it("keeps /api/scout as the business-intent execution path", () => {
    const source = read("client/src/scout/ScoutOS.tsx");

    expect(source).toContain("sendToScout(");
    expect(source).toContain("/api/scout");
  });

  it("retains explicit local UI shortcuts only", () => {
    const source = read("client/src/scout/ScoutOS.tsx");

    expect(source).toContain("resolveExplicitNavigationIntent");
    expect(source).toContain("resolveQuickActionIntent");
  });
});
