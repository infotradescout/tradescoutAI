import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("scout authority routing contracts", () => {
  it("keeps server-authoritative gating enabled for local domain intent branches", () => {
    const source = read("client/src/scout/ScoutOS.tsx");

    expect(source).toContain("SCOUT_SERVER_AUTHORITY_MODE");
    expect(source).toContain("!SCOUT_SERVER_AUTHORITY_MODE && providerOfferKeywords");
    expect(source).toContain("!SCOUT_SERVER_AUTHORITY_MODE && providerStandingKeywords");
    expect(source).toContain("!SCOUT_SERVER_AUTHORITY_MODE && providerPromotionKeywords");
    expect(source).toContain("!SCOUT_SERVER_AUTHORITY_MODE && marketplaceKeywords");
    expect(source).toContain("!SCOUT_SERVER_AUTHORITY_MODE && contractorKeywords");
  });
});
