import { describe, expect, it } from "vitest";
import {
  JRS_PROFILE_SLUG,
  OWNER_CONFIRMED_PROFILE_SOURCE,
  isOwnerConfirmedDirectProfile,
} from "../services/ownerConfirmedDirectProfile";

const approvedCandidate = {
  profileSlug: JRS_PROFILE_SLUG,
  profileStatus: "published",
  profileOwnerUserId: "owner-1",
  businessStatus: "active",
  businessOwnerUserId: "owner-1",
  publicDiscoveryEnabled: false,
  businessSources: [OWNER_CONFIRMED_PROFILE_SOURCE],
};

describe("owner-confirmed direct profile authority", () => {
  it("allows only the explicitly provisioned JR profile without general directory exposure", () => {
    expect(isOwnerConfirmedDirectProfile(approvedCandidate)).toBe(true);
  });

  it.each([
    ["another profile", { profileSlug: "another-profile" }],
    ["draft profile", { profileStatus: "draft" }],
    ["inactive business", { businessStatus: "suspended" }],
    ["directory-discoverable business", { publicDiscoveryEnabled: true }],
    ["mismatched owner", { businessOwnerUserId: "owner-2" }],
    ["missing authority marker", { businessSources: [] }],
  ])("rejects %s", (_label, override) => {
    expect(isOwnerConfirmedDirectProfile({ ...approvedCandidate, ...override })).toBe(false);
  });
});
