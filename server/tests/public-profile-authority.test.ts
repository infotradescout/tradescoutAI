import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE,
  MOULDING_MILLWORK_PROFILE_REVOKED_SOURCE,
  MOULDING_MILLWORK_PROFILE_SLUG,
} from "@shared/mouldingMillworkProfile";
import {
  ADMIN_MANAGED_PROFILE_SOURCE,
  JRS_PROFILE_SLUG,
  OWNER_CONFIRMED_PROFILE_SOURCE,
  PRO_FAB_PROFILE_SLUG,
} from "../services/ownerConfirmedDirectProfile";

const state = vi.hoisted(() => ({
  rows: [] as any[],
  selectCalls: 0,
}));

vi.mock("../db", () => ({
  db: {
    select: vi.fn(() => {
      state.selectCalls += 1;
      const chain: any = {
        from: () => chain,
        innerJoin: () => chain,
        leftJoin: () => chain,
        where: async () => state.rows,
      };
      return chain;
    }),
  },
}));

import {
  resolveAuthorizedPublicProfileBySlug,
  resolveAuthorizedPublicProfileSlugs,
} from "../services/publicProfileAuthority";

const profile = {
  id: "profile-1",
  slug: MOULDING_MILLWORK_PROFILE_SLUG,
  ownerUserId: "owner-1",
  businessId: "business-1",
  status: "published",
  displayName: "Moulding & Millwork Supply",
  roleContext: "business_owner",
  headline: null,
  contentBlocks: [],
  ctaConfig: {},
  seoMeta: {},
  updatedAt: new Date("2026-07-20T00:00:00.000Z"),
};

const owner = {
  id: "owner-1",
  provider: "admin_provisioned",
  emailVerified: false,
  verificationStatus: "pending",
  verifiedBadge: false,
  preferences: { profileVisibility: "public" },
  firstName: "Profile",
  lastName: "Owner",
  profileImageUrl: null,
  city: null,
  state: null,
  roles: [],
};

const business = {
  id: "business-1",
  name: "Moulding & Millwork Supply",
  ownerUserId: "owner-1",
  status: "active",
  publicDiscoveryEnabled: true,
  sources: [MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE],
  profileData: { tradePartner: true },
};

function setRow({
  profileOverride = {},
  ownerOverride = {},
  businessOverride = {},
  linkedBusiness = true,
}: {
  profileOverride?: Record<string, unknown>;
  ownerOverride?: Record<string, unknown>;
  businessOverride?: Record<string, unknown>;
  linkedBusiness?: boolean;
} = {}) {
  state.rows = [
    {
      profiles: { ...profile, ...profileOverride },
      users: { ...owner, ...ownerOverride },
      businesses: linkedBusiness ? { ...business, ...businessOverride } : null,
    },
  ];
}

describe("canonical public profile authority", () => {
  beforeEach(() => {
    state.selectCalls = 0;
    setRow();
  });

  it("authorizes the exact active operator-confirmed TradePartner profile", async () => {
    const result = await resolveAuthorizedPublicProfileBySlug(MOULDING_MILLWORK_PROFILE_SLUG);

    expect(result?.profile.slug).toBe(MOULDING_MILLWORK_PROFILE_SLUG);
    expect(result?.ownerUserId).toBe("owner-1");
    expect(result?.operatorConfirmedTradePartnerProfile).toBe(true);
    expect(state.selectCalls).toBe(1);
  });

  it("authorizes a normally approved business owner", async () => {
    setRow({
      profileOverride: { slug: "approved-business" },
      ownerOverride: { provider: "local", verificationStatus: "approved" },
      businessOverride: {
        name: "Approved Business",
        sources: [],
        profileData: {},
      },
    });

    await expect(resolveAuthorizedPublicProfileBySlug("approved-business")).resolves.toMatchObject({
      profile: { slug: "approved-business" },
      ownerUserId: "owner-1",
    });
  });

  it.each([
    ["JR's Auto Glass", JRS_PROFILE_SLUG, OWNER_CONFIRMED_PROFILE_SOURCE],
    ["Pro Fab", PRO_FAB_PROFILE_SLUG, ADMIN_MANAGED_PROFILE_SOURCE],
  ])("authorizes the exact %s provisioned exception", async (_label, slug, source) => {
    setRow({
      profileOverride: { slug },
      businessOverride: {
        publicDiscoveryEnabled: false,
        sources: [source],
        profileData: {},
      },
    });

    const result = await resolveAuthorizedPublicProfileBySlug(slug);
    expect(result?.ownerConfirmedDirectProfile).toBe(true);
  });

  it.each([
    ["missing linked business", { linkedBusiness: false }],
    ["suspended linked business", { businessOverride: { status: "suspended" } }],
    [
      "revoked operator authority",
      {
        businessOverride: {
          sources: [
            MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE,
            MOULDING_MILLWORK_PROFILE_REVOKED_SOURCE,
          ],
        },
      },
    ],
    ["draft profile", { profileOverride: { status: "draft" } }],
  ])("rejects %s", async (_label, overrides) => {
    setRow(overrides);

    await expect(
      resolveAuthorizedPublicProfileBySlug(MOULDING_MILLWORK_PROFILE_SLUG)
    ).resolves.toBeNull();
  });

  it.each(["private", "unlisted"])("rejects %s profile visibility", async (visibility) => {
    setRow({ ownerOverride: { preferences: { profileVisibility: visibility } } });

    await expect(
      resolveAuthorizedPublicProfileBySlug(MOULDING_MILLWORK_PROFILE_SLUG)
    ).resolves.toBeNull();
  });

  it.each(["rejected", "expired", "suspended"])(
    "rejects a %s owner account",
    async (verificationStatus) => {
      setRow({ ownerOverride: { verificationStatus } });

      await expect(
        resolveAuthorizedPublicProfileBySlug(MOULDING_MILLWORK_PROFILE_SLUG)
      ).resolves.toBeNull();
    }
  );

  it("rejects an uncontrolled matching-email account", async () => {
    setRow({ ownerOverride: { provider: "local" } });

    await expect(
      resolveAuthorizedPublicProfileBySlug(MOULDING_MILLWORK_PROFILE_SLUG)
    ).resolves.toBeNull();
  });

  it("rejects a stale verified badge after approval is revoked to pending", async () => {
    setRow({
      profileOverride: { slug: "revoked-approved-business" },
      ownerOverride: {
        emailVerified: true,
        provider: "local",
        verifiedBadge: true,
        verificationStatus: "pending",
      },
      businessOverride: { sources: [], profileData: {} },
    });

    await expect(
      resolveAuthorizedPublicProfileBySlug("revoked-approved-business")
    ).resolves.toBeNull();
  });

  it("rejects a generally approved owner linked to someone else's business", async () => {
    setRow({
      profileOverride: { slug: "mismatched-approved-business" },
      ownerOverride: { provider: "local", verificationStatus: "approved" },
      businessOverride: {
        ownerUserId: "victim-owner",
        sources: [],
        profileData: {},
      },
    });

    await expect(
      resolveAuthorizedPublicProfileBySlug("mismatched-approved-business")
    ).resolves.toBeNull();
  });

  it("rejects the Moulding marker on any other slug", async () => {
    setRow({ profileOverride: { slug: "another-profile" } });

    await expect(resolveAuthorizedPublicProfileBySlug("another-profile")).resolves.toBeNull();
  });

  it("batch-evaluates discovery candidates with one joined query", async () => {
    state.rows = [
      {
        profiles: { ...profile, slug: "first-approved" },
        users: { ...owner, verificationStatus: "approved" },
        businesses: { ...business, sources: [], profileData: {} },
      },
      {
        profiles: { ...profile, id: "profile-2", slug: "second-revoked" },
        users: { ...owner, verificationStatus: "pending", verifiedBadge: true },
        businesses: { ...business, sources: [], profileData: {} },
      },
    ];

    const authorized = await resolveAuthorizedPublicProfileSlugs([
      "first-approved",
      "second-revoked",
    ]);

    expect([...authorized]).toEqual(["first-approved"]);
    expect(state.selectCalls).toBe(1);
  });
});
