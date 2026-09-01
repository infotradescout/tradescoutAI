import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("operator-confirmed public-profile architecture", () => {
  it("extends the canonical repository and pure policy without a second resolver", () => {
    const repository = read("server/repositories/profileRepository.ts");
    const policy = read("server/services/ownerConfirmedDirectProfile.ts");

    expect(
      fs.existsSync(path.resolve(process.cwd(), "server/services/publicProfileAuthority.ts"))
    ).toBe(false);
    expect(repository).toContain("async getProfileBySlugPublic(slug: string)");
    expect(repository).toContain("canServePublishedProfileAtDirectRoute({");
    expect(repository).toContain("businessProfileData: row.businessProfileData");
    expect(repository).toContain("ownerEmailVerified: row.ownerEmailVerified");
    expect(policy).toContain("isOperatorConfirmedTradePartnerProfile(candidate)");
  });

  it("carries exact authority to discovery, SSR, hydration, and Direct Connect", () => {
    const repository = read("server/repositories/profileRepository.ts");
    const routes = read("server/routes/profiles.ts");
    const express = read("server/routes/tradepartner-express.ts");
    const index = read("server/index.ts");

    expect(repository).toContain("MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE");
    expect(repository).toContain("MOULDING_MILLWORK_PROFILE_REVOKED_SOURCE");
    expect(routes).toContain("operatorConfirmedTradePartnerProfile");
    expect(express).toContain("businessProfileData: row?.profileData");
    expect(express).toContain("ownerEmailVerified: row?.ownerEmailVerified");
    expect(index).toContain("businessProfileData: profileRecord.businessProfileData");
    expect(index).toContain("ownerEmailVerified: profileRecord.ownerEmailVerified");
  });
});
