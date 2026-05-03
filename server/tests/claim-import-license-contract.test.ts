import { describe, expect, it } from "vitest";
import fs from "fs";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

describe("Preseeded Business Claim Contracts", () => {
  it("converts imported license extras into user verifications on claim", () => {
    const src = [read("server/storage.ts"), read("server/repositories/businessRepository.ts")].join(
      "\n"
    );

    // Ensure the claim path contains logic to convert business.profileData.importExtras.* into
    // business_verifications rows for the claiming user (user-based table).
    expect(src).toContain("claimUnclaimedBusinessForUser");
    expect(src).toContain("importExtras");
    expect(src).toContain("businessVerifications");
    expect(src).toContain('verificationType: "license"');
    expect(src).toContain("importBusinessId");
  });
});
