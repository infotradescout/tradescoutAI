import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUSINESS_IDENTITY_VERIFICATION_SCOPE,
  FULLY_VERIFIED_BUSINESS_PERCENT,
  FULLY_VERIFIED_BUSINESS_STATUS,
  LOCATION_CONFIRMED_PER_REQUEST_SERVICE_AREA_MODE,
  hasExactBusinessLevelVerification,
  hasLocationFlexibleDiscoveryAuthority,
} from "@shared/businessDiscoveryAuthority";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

const verificationSource = "operator_verified_business_profile";
const verifiedLocationFlexibleProfileData = {
  importExtras: {
    business_verification: FULLY_VERIFIED_BUSINESS_STATUS,
    verification_percent: FULLY_VERIFIED_BUSINESS_PERCENT,
    verification_source: verificationSource,
    verification_scope: [BUSINESS_IDENTITY_VERIFICATION_SCOPE, "full_service_capability"],
    service_area_mode: LOCATION_CONFIRMED_PER_REQUEST_SERVICE_AREA_MODE,
  },
};

describe("business discovery authority", () => {
  it("requires the complete business-level verification record and its backing source", () => {
    expect(
      hasExactBusinessLevelVerification({
        profileData: verifiedLocationFlexibleProfileData,
        sources: [verificationSource],
      })
    ).toBe(true);

    expect(
      hasExactBusinessLevelVerification({
        profileData: verifiedLocationFlexibleProfileData,
        sources: [],
      })
    ).toBe(false);
    expect(
      hasExactBusinessLevelVerification({
        profileData: {
          importExtras: {
            ...verifiedLocationFlexibleProfileData.importExtras,
            verification_percent: 99,
          },
        },
        sources: [verificationSource],
      })
    ).toBe(false);
    expect(
      hasExactBusinessLevelVerification({
        profileData: {
          importExtras: {
            ...verifiedLocationFlexibleProfileData.importExtras,
            verification_scope: ["full_service_capability"],
          },
        },
        sources: [verificationSource],
      })
    ).toBe(false);
  });

  it("allows no-fixed-county discovery only when location is confirmed through requests", () => {
    expect(
      hasLocationFlexibleDiscoveryAuthority({
        profileData: verifiedLocationFlexibleProfileData,
        sources: [verificationSource],
      })
    ).toBe(true);

    expect(
      hasLocationFlexibleDiscoveryAuthority({
        profileData: {
          importExtras: {
            ...verifiedLocationFlexibleProfileData.importExtras,
            service_area_mode: "fixed_county",
          },
        },
        sources: [verificationSource],
      })
    ).toBe(false);
  });

  it("keeps the prune rule generic and retains verified freshness expiration", () => {
    const pruneJob = read("server/services/seoPublicationPruneJob.ts");

    expect(pruneJob).not.toContain("issa-build");
    expect(pruneJob).toContain("publication_verified");
    expect(pruneJob).toContain("location_confirmed_per_request");
    expect(pruneJob).toMatch(/not\s+\(publication_verified and location_confirmed_per_request\)/);
    expect(pruneJob).toMatch(
      /publication_verified\s+and updated_at < \(now\(\) - \(\$\{staleVerifiedDays\}/
    );
    expect(pruneJob).toContain("stale_by_publication_rules");
  });

  it("persists ISSA Build's project-location review mode without inventing a territory", () => {
    const normalizer = read("server/services/issaBuildVerifiedProfileNormalization.ts");
    const sourceRecord = read("docs/profile-sources/ISSA_BUILD.md");

    expect(normalizer).toContain(
      "service_area_mode: LOCATION_CONFIRMED_PER_REQUEST_SERVICE_AREA_MODE"
    );
    expect(normalizer).toContain(
      'service_area_resolution: "project_location_reviewed_through_request"'
    );
    expect(sourceRecord).toContain("A project address or service territory should be confirmed");
    expect(sourceRecord).toContain("Do not invent a fixed geographic boundary");
  });
});
