import { describe, expect, it } from "vitest";
import {
  BusinessIdentityRequiredError,
  BusinessProfileSelectionRequiredError,
  BusinessSelectionRequiredError,
  buildOutcomeProfileContentBlocks,
  completeOutcomeOnboarding,
  deriveBusinessNameFromLinks,
  enforceCanonicalBusinessIdentityResolution,
  normalizeOutcomeBusinessEvidence,
  safeOutcomeNextPath,
  type StorageLike,
} from "../services/onboardingService";
import {
  buildOutcomeSelectionErrorPayload,
  completeOutcomeOnboardingSchema,
} from "../routes/onboarding";

type FakeState = {
  user: Record<string, any>;
  businesses: Array<Record<string, any>>;
  profiles: Array<Record<string, any>>;
  userPatches: Array<Record<string, unknown>>;
  events: Array<{ type: string; payload: Record<string, unknown> }>;
};

function createFakeStorage(seed?: Partial<FakeState>): StorageLike & { state: FakeState } {
  const state: FakeState = {
    user: {
      id: "user-1",
      onboardingCompleted: false,
      profileVersion: 0,
      verificationStatus: "approved",
      addressVerified: true,
      badges: ["legacy-trust"],
      preferences: { existingPreference: "keep" },
      ...(seed?.user ?? {}),
    },
    businesses: [...(seed?.businesses ?? [])],
    profiles: [...(seed?.profiles ?? [])],
    userPatches: [],
    events: [],
  };

  const storage: StorageLike & { state: FakeState } = {
    state,
    async getUser(id) {
      return id === state.user.id ? { ...state.user } : undefined;
    },
    async updateUser(id, patch) {
      if (id !== state.user.id) throw new Error("User not found");
      state.userPatches.push({ ...patch });
      state.user = { ...state.user, ...patch };
      return { ...state.user };
    },
    async getActiveBusinessForUser(userId) {
      const activeId = state.user.activeBusinessId;
      return (
        state.businesses.find(
          (business) => business.ownerUserId === userId && business.id === activeId
        ) ??
        state.businesses.find(
          (business) => business.ownerUserId === userId && business.status === "active"
        )
      );
    },
    async listBusinessesByOwner(ownerUserId) {
      return state.businesses.filter((business) => business.ownerUserId === ownerUserId);
    },
    async listUnclaimedOutcomeBusinesses() {
      return state.businesses.filter(
        (business) => !business.ownerUserId && business.claimStatus === "unclaimed"
      );
    },
    async listProfilesByOwner(ownerUserId) {
      return state.profiles.filter((profile) => profile.ownerUserId === ownerUserId);
    },
    async createBusinessForOwner(ownerUserId, data) {
      const created = {
        ...data,
        id: `business-${state.businesses.length + 1}`,
        ownerUserId,
        slug: String(data.slug || data.name)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, ""),
        claimStatus: "claimed",
      };
      state.businesses.push(created);
      return created;
    },
    async updateBusinessForOwner(ownerUserId, businessId, updates) {
      const index = state.businesses.findIndex(
        (business) => business.id === businessId && business.ownerUserId === ownerUserId
      );
      if (index < 0) throw new Error("Business not found");
      state.businesses[index] = { ...state.businesses[index], ...updates };
      return state.businesses[index];
    },
    async createProfileForOwner(ownerUserId, data) {
      const created = {
        ...data,
        id: `profile-${state.profiles.length + 1}`,
        ownerUserId,
      };
      state.profiles.push(created);
      return created;
    },
    async updateProfileForOwner(ownerUserId, profileId, updates) {
      const index = state.profiles.findIndex(
        (profile) => profile.id === profileId && profile.ownerUserId === ownerUserId
      );
      if (index < 0) throw new Error("Profile not found");
      state.profiles[index] = { ...state.profiles[index], ...updates };
      return state.profiles[index];
    },
    async logEvent(type, payload) {
      state.events.push({ type, payload });
    },
  };
  return storage;
}

function publicBlocks(storage: ReturnType<typeof createFakeStorage>): string {
  return JSON.stringify(storage.state.profiles[0]?.contentBlocks ?? []);
}

describe("outcome-first onboarding", () => {
  it("creates one linked, published default profile from sparse explicit evidence and is idempotent", async () => {
    const storage = createFakeStorage();
    const request = {
      userId: "user-1",
      kind: "business_profile" as const,
      goal: "Build a useful public presence",
      business: {
        name: "Acme Works",
        notes: "Family-run repairs. Call 850-555-0199",
        services: ["Repairs", "Installations", "Repairs"],
        links: ["https://acme.example/work", "https://instagram.com/acmeworks"],
        photoUrls: ["https://cdn.example/one.jpg", "/objects/two.jpg"],
      },
    };

    const first = await completeOutcomeOnboarding(storage, request);
    const second = await completeOutcomeOnboarding(storage, request);

    expect(first).toEqual({
      kind: "business_profile",
      resultRoute: "/u/acme-works?edit=1",
      outcomeTitle: "Your public profile is ready",
      profile: {
        id: "profile-1",
        slug: "acme-works",
        businessId: "business-1",
        saved: true,
        published: true,
        discovery: "verification_gated",
      },
    });
    expect(second.profile.id).toBe(first.profile.id);
    expect(storage.state.businesses).toHaveLength(1);
    expect(storage.state.profiles).toHaveLength(1);
    expect(storage.state.profiles[0]).toMatchObject({
      businessId: "business-1",
      status: "published",
      ctaConfig: {},
      seoMeta: { title: "Acme Works" },
    });
    expect(storage.state.businesses[0].profileData).toMatchObject({
      description: "Family-run repairs. Call Continue through TradeScout",
      services: ["Repairs", "Installations"],
      website: "https://acme.example/work",
      publicWebsiteEnabled: false,
    });
    expect(publicBlocks(storage)).toContain('"id":"default"');
    expect(publicBlocks(storage)).toContain("https://cdn.example/one.jpg");
    expect(publicBlocks(storage)).not.toContain("acme.example/work");
    expect(publicBlocks(storage)).not.toContain("instagram.com");
    expect(publicBlocks(storage).match(/cdn\.example\/one\.jpg/g)).toHaveLength(2);
    expect(publicBlocks(storage).match(/objects\/two\.jpg/g)).toHaveLength(1);
    expect(storage.state.user).toMatchObject({
      activeBusinessId: "business-1",
      activeProfileId: "profile-1",
      onboardingCompleted: true,
      profileVersion: 1,
      verificationStatus: "approved",
      addressVerified: true,
      badges: ["legacy-trust"],
    });
    expect(storage.state.user.preferences).toMatchObject({
      existingPreference: "keep",
      publicProfileIds: ["profile-1"],
      onboardingOutcome: {
        kind: "business_profile",
        provenance: {
          evidence: {
            links: ["https://acme.example/work", "https://instagram.com/acmeworks"],
          },
        },
      },
    });
    for (const patch of storage.state.userPatches) {
      expect(patch).not.toHaveProperty("verificationStatus");
      expect(patch).not.toHaveProperty("addressVerified");
      expect(patch).not.toHaveProperty("badges");
    }
    expect(storage.state.events.map((event) => event.type)).not.toContain("verification_started");
  });

  it("enriches an existing canonical pair without replacing owner-authored fields or order", async () => {
    const originalCta = { primary: { label: "Request", kind: "message", value: "direct" } };
    const originalSeo = {
      title: "Owner title",
      description: "Owner description",
      customDomain: "owner.example",
    };
    const storage = createFakeStorage({
      user: { activeBusinessId: "biz-existing", activeProfileId: "profile-existing" },
      businesses: [
        {
          id: "biz-existing",
          ownerUserId: "user-1",
          name: "Owner Name",
          slug: "owner-slug",
          roleContext: "vendor",
          status: "active",
          profileData: {
            description: "Owner-written description",
            services: ["Existing service"],
            website: "https://owner.example",
            publicWebsiteEnabled: true,
            publicContactEnabled: true,
            category: "Owner category",
            brandColors: { primary: "#123456" },
          },
        },
      ],
      profiles: [
        {
          id: "profile-existing",
          ownerUserId: "user-1",
          businessId: "biz-existing",
          slug: "owner-profile-slug",
          displayName: "Owner Display",
          headline: "Owner headline",
          roleContext: "vendor",
          status: "draft",
          contentBlocks: [
            { type: "siteTemplate", data: { id: "videographer" } },
            { type: "custom", data: { title: "Owner section", body: "Keep this" } },
            { type: "about", data: { body: "Owner-written about" } },
            { type: "services", data: { items: [{ title: "Existing service", icon: "x" }] } },
            { type: "gallery", data: { images: [{ imageUrl: "/owner-1.jpg", caption: "One" }] } },
          ],
          ctaConfig: originalCta,
          seoMeta: originalSeo,
        },
      ],
    });

    const result = await completeOutcomeOnboarding(
      storage,
      {
        userId: "user-1",
        kind: "business_profile",
        goal: "Refresh my profile",
        business: {
          name: "Owner Name",
          notes: "Replacement description",
          services: ["Existing service", "New service"],
          links: ["https://replacement.example"],
          photoUrls: ["/owner-1.jpg", "/new-2.jpg"],
        },
      },
      {
        businessProfileAnalyzer: {
          id: "preservation_test",
          async analyze() {
            return {
              description: {
                text: "Generated replacement must not overwrite owner copy.",
                sourceUrls: ["https://replacement.example/"],
              },
              about: {
                text: "Generated about must not overwrite owner copy.",
                sourceUrls: ["https://replacement.example/"],
              },
              services: [
                {
                  name: "Sourced new service",
                  sourceUrls: ["https://replacement.example/"],
                },
              ],
            };
          },
        },
      }
    );

    expect(result.resultRoute).toBe("/u/owner-profile-slug?edit=1");
    expect(storage.state.businesses[0]).toMatchObject({
      name: "Owner Name",
      slug: "owner-slug",
      profileData: {
        description: "Owner-written description",
        services: ["Existing service", "New service", "Sourced new service"],
        website: "https://owner.example",
        publicWebsiteEnabled: true,
        publicContactEnabled: true,
        category: "Owner category",
        brandColors: { primary: "#123456" },
      },
    });
    expect(storage.state.profiles[0]).toMatchObject({
      slug: "owner-profile-slug",
      displayName: "Owner Display",
      headline: "Owner headline",
      ctaConfig: originalCta,
      seoMeta: originalSeo,
      status: "published",
    });
    expect(storage.state.profiles[0].contentBlocks.map((block: any) => block.type)).toEqual([
      "siteTemplate",
      "custom",
      "about",
      "services",
      "gallery",
      "hero",
    ]);
    expect(storage.state.profiles[0].contentBlocks[0]).toEqual({
      type: "siteTemplate",
      data: { id: "videographer" },
    });
    expect(storage.state.profiles[0].contentBlocks[2].data.body).toBe("Owner-written about");
    expect(storage.state.profiles[0].contentBlocks[3].data.items).toEqual([
      { title: "Existing service", icon: "x" },
      "New service",
      "Sourced new service",
    ]);
    expect(storage.state.profiles[0].contentBlocks[4].data.images).toEqual([
      { imageUrl: "/owner-1.jpg", caption: "One" },
      { imageUrl: "/new-2.jpg" },
    ]);
  });

  it("derives a neutral new-business identity only from an attributable business domain", async () => {
    const storage = createFakeStorage();
    const result = await completeOutcomeOnboarding(storage, {
      userId: "user-1",
      kind: "business_profile",
      goal: "Create my presence",
      business: { links: ["north-star.com/work"] },
    });

    expect(storage.state.businesses[0].name).toBe("North Star");
    expect(result.resultRoute).toBe("/u/north-star?edit=1");
  });

  it("reuses an owned draft business and its clearly business-context active unlinked profile", async () => {
    const storage = createFakeStorage({
      user: { activeProfileId: "draft-profile" },
      businesses: [
        {
          id: "draft-business",
          ownerUserId: "user-1",
          name: "Draft Works",
          slug: "draft-works",
          roleContext: "business_owner",
          status: "draft",
          profileData: {},
        },
      ],
      profiles: [
        {
          id: "draft-profile",
          ownerUserId: "user-1",
          businessId: null,
          roleContext: "business_owner",
          slug: "keep-this-profile-slug",
          displayName: "Draft Works",
          status: "draft",
          contentBlocks: [{ type: "siteTemplate", data: { id: "electrician-solo" } }],
          ctaConfig: { secondary: { label: "Owner CTA", kind: "message", value: "keep" } },
          seoMeta: { customDomain: "draft.example" },
        },
      ],
    });

    const result = await completeOutcomeOnboarding(storage, {
      userId: "user-1",
      kind: "business_profile",
      goal: "Finish my draft",
      business: { services: ["Explicit service"] },
    });

    expect(storage.state.businesses).toHaveLength(1);
    expect(storage.state.businesses[0].status).toBe("active");
    expect(storage.state.profiles).toHaveLength(1);
    expect(storage.state.profiles[0]).toMatchObject({
      id: "draft-profile",
      businessId: "draft-business",
      slug: "keep-this-profile-slug",
      status: "published",
      ctaConfig: { secondary: { label: "Owner CTA", kind: "message", value: "keep" } },
      seoMeta: { customDomain: "draft.example" },
    });
    expect(result.resultRoute).toBe("/u/keep-this-profile-slug?edit=1");
  });

  it("does not hijack an active profile that belongs to a different owned business", async () => {
    const storage = createFakeStorage({
      user: { activeBusinessId: "target-business", activeProfileId: "other-profile" },
      businesses: [
        {
          id: "target-business",
          ownerUserId: "user-1",
          name: "Target Works",
          slug: "target-works",
          roleContext: "business_owner",
          status: "active",
          profileData: {},
        },
        {
          id: "other-business",
          ownerUserId: "user-1",
          name: "Other Works",
          slug: "other-works",
          roleContext: "business_owner",
          status: "active",
          profileData: {},
        },
      ],
      profiles: [
        {
          id: "other-profile",
          ownerUserId: "user-1",
          businessId: "other-business",
          roleContext: "business_owner",
          slug: "other-profile",
          displayName: "Other Works",
          status: "published",
          contentBlocks: [{ type: "custom", data: { body: "Other content" } }],
          ctaConfig: { primary: { label: "Keep", kind: "message", value: "keep" } },
          seoMeta: { title: "Other" },
        },
      ],
    });

    const result = await completeOutcomeOnboarding(storage, {
      userId: "user-1",
      kind: "business_profile",
      goal: "Finish the target business",
      business: { targetBusinessId: "target-business", services: ["Target service"] },
    });

    expect(storage.state.profiles).toHaveLength(2);
    expect(storage.state.profiles[0]).toMatchObject({
      id: "other-profile",
      businessId: "other-business",
      slug: "other-profile",
      contentBlocks: [{ type: "custom", data: { body: "Other content" } }],
    });
    expect(storage.state.profiles[1]).toMatchObject({
      id: "profile-2",
      businessId: "target-business",
      slug: "target-works",
      status: "published",
    });
    expect(result.resultRoute).toBe("/u/target-works?edit=1");
  });

  it("does not mutate an arbitrary business when multiple owned businesses are ambiguous", async () => {
    const businesses = [
      {
        id: "biz-a",
        ownerUserId: "user-1",
        name: "Alpha Works",
        slug: "alpha-works",
        roleContext: "business_owner",
        status: "active",
        profileData: { services: ["Alpha original"] },
      },
      {
        id: "biz-b",
        ownerUserId: "user-1",
        name: "Beta Works",
        slug: "beta-works",
        roleContext: "business_owner",
        status: "active",
        profileData: { services: ["Beta original"] },
      },
    ];
    const storage = createFakeStorage({
      user: { activeBusinessId: "biz-a" },
      businesses,
    });

    let selectionError: any;
    try {
      await completeOutcomeOnboarding(storage, {
        userId: "user-1",
        kind: "business_profile",
        goal: "Add a new service",
        business: { services: ["Do not guess"] },
      });
    } catch (error) {
      selectionError = error;
    }
    expect(selectionError).toMatchObject({
      name: "BusinessSelectionRequiredError",
      code: "BUSINESS_SELECTION_REQUIRED",
      missing: ["business.targetBusinessId", "business.name"],
      candidates: [
        { id: "biz-a", name: "Alpha Works", slug: "alpha-works" },
        { id: "biz-b", name: "Beta Works", slug: "beta-works" },
      ],
    } satisfies Partial<BusinessSelectionRequiredError>);

    expect(storage.state.businesses).toEqual(businesses);
    expect(storage.state.profiles).toHaveLength(0);
    expect(storage.state.userPatches).toHaveLength(0);

    const recovered = await completeOutcomeOnboarding(storage, {
      userId: "user-1",
      kind: "business_profile",
      goal: "Add a new service",
      business: {
        targetBusinessId: "biz-b",
        name: "Beta Works",
        services: ["Selected service"],
      },
    });
    expect(recovered).toMatchObject({ profile: { businessId: "biz-b" } });
    expect(storage.state.businesses[0].profileData.services).toEqual(["Alpha original"]);
    expect(storage.state.businesses[1].profileData.services).toEqual([
      "Beta original",
      "Selected service",
    ]);
  });

  it("uses the supplied exact name to target the matching non-active owned business", async () => {
    const storage = createFakeStorage({
      user: { activeBusinessId: "biz-a" },
      businesses: [
        {
          id: "biz-a",
          ownerUserId: "user-1",
          name: "Alpha Works",
          slug: "alpha-works",
          roleContext: "business_owner",
          status: "active",
          profileData: { services: ["Alpha original"] },
        },
        {
          id: "biz-b",
          ownerUserId: "user-1",
          name: "Beta & Works",
          slug: "beta-works",
          roleContext: "business_owner",
          status: "draft",
          profileData: { services: ["Beta original"] },
        },
      ],
    });

    const result = await completeOutcomeOnboarding(storage, {
      userId: "user-1",
      kind: "business_profile",
      goal: "Finish Beta",
      business: { name: "beta works", services: ["Beta new"] },
    });

    expect(storage.state.businesses[0].profileData.services).toEqual(["Alpha original"]);
    expect(storage.state.businesses[1]).toMatchObject({
      id: "biz-b",
      status: "active",
      profileData: { services: ["Beta original", "Beta new"] },
    });
    expect(result).toMatchObject({
      kind: "business_profile",
      profile: { businessId: "biz-b" },
    });
  });

  it("fails closed on a forged business target and exposes only current-owner candidates", async () => {
    const storage = createFakeStorage({
      businesses: [
        {
          id: "owned-business",
          ownerUserId: "user-1",
          name: "Owned Works",
          slug: "owned-works",
          roleContext: "business_owner",
          status: "active",
          profileData: {},
        },
        {
          id: "foreign-business",
          ownerUserId: "other-user",
          name: "Foreign Works",
          slug: "foreign-works",
          roleContext: "business_owner",
          status: "active",
          profileData: {},
        },
      ],
    });

    await expect(
      completeOutcomeOnboarding(storage, {
        userId: "user-1",
        kind: "business_profile",
        goal: "Update a business",
        business: { targetBusinessId: "foreign-business" },
      })
    ).rejects.toMatchObject({
      code: "BUSINESS_SELECTION_REQUIRED",
      candidates: [{ id: "owned-business", name: "Owned Works", slug: "owned-works" }],
    });
    expect(storage.state.profiles).toHaveLength(0);
    expect(storage.state.userPatches).toHaveLength(0);
  });

  it("uses an exact attributable website domain to target an owned business despite a rebrand", async () => {
    const storage = createFakeStorage({
      user: { activeBusinessId: "biz-a" },
      businesses: [
        {
          id: "biz-a",
          ownerUserId: "user-1",
          name: "Alpha Works",
          slug: "alpha-works",
          roleContext: "business_owner",
          status: "active",
          profileData: { website: "https://alpha.com", services: ["Alpha"] },
        },
        {
          id: "biz-b",
          ownerUserId: "user-1",
          name: "Old Beta Name",
          slug: "old-beta",
          roleContext: "business_owner",
          status: "active",
          profileData: { website: "https://beta.com", services: ["Beta original"] },
        },
      ],
    });

    const result = await completeOutcomeOnboarding(storage, {
      userId: "user-1",
      kind: "business_profile",
      goal: "Refresh the renamed Beta business",
      business: { name: "New Beta Brand", links: ["www.beta.com"], services: ["Beta new"] },
    });

    expect(storage.state.businesses[0].profileData.services).toEqual(["Alpha"]);
    expect(storage.state.businesses[1].profileData.services).toEqual(["Beta original", "Beta new"]);
    expect(result).toMatchObject({ profile: { businessId: "biz-b" } });
  });

  it("hands an exact canonical unclaimed match to claims-first without mutating onboarding state", async () => {
    const directoryBusiness = {
      id: "directory-acme",
      ownerUserId: null,
      name: "Acme Works, LLC",
      slug: "acme-works",
      roleContext: "business_owner",
      claimStatus: "unclaimed",
      status: "active",
      profileData: { website: "https://acme.com", services: ["Directory service"] },
    };
    const storage = createFakeStorage({ businesses: [directoryBusiness] });

    const result = await completeOutcomeOnboarding(storage, {
      userId: "user-1",
      kind: "business_profile",
      goal: "Build my profile",
      business: {
        name: "acme works llc",
        links: ["www.acme.com/about"],
        services: ["Should remain pending"],
      },
    });

    expect(result).toEqual({
      kind: "business_claim_required",
      resultRoute: "/claim-my-business?source=outcome_onboarding_match&businessId=directory-acme",
      outcomeTitle: "Claim this existing business before we build its profile",
      claim: { businessId: "directory-acme", name: "Acme Works, LLC", slug: "acme-works" },
    });
    expect(storage.state.businesses).toEqual([directoryBusiness]);
    expect(storage.state.profiles).toHaveLength(0);
    expect(storage.state.userPatches).toHaveLength(0);
    expect(storage.state.events).toHaveLength(0);
  });

  it("treats an exact attributable domain as canonical even when the supplied name is shortened", async () => {
    const storage = createFakeStorage({
      businesses: [
        {
          id: "directory-beta",
          ownerUserId: null,
          name: "Beta Plumbing and Heating, LLC",
          slug: "beta-plumbing-heating",
          roleContext: "business_owner",
          claimStatus: "unclaimed",
          status: "active",
          profileData: { website: "https://beta.com" },
        },
      ],
    });

    const result = await completeOutcomeOnboarding(storage, {
      userId: "user-1",
      kind: "business_profile",
      goal: "Build Beta",
      business: { name: "Beta", links: ["https://www.beta.com/new-brand"] },
    });

    expect(result).toMatchObject({
      kind: "business_claim_required",
      claim: { businessId: "directory-beta" },
    });
    expect(storage.state.profiles).toHaveLength(0);
    expect(storage.state.userPatches).toHaveLength(0);
  });

  it("does not collapse exact-name businesses when both attributable domains disagree", async () => {
    const storage = createFakeStorage({
      businesses: [
        {
          id: "directory-acme",
          ownerUserId: null,
          name: "Acme Works",
          slug: "directory-acme",
          roleContext: "business_owner",
          claimStatus: "unclaimed",
          status: "active",
          profileData: { website: "https://different-acme.com" },
        },
      ],
    });

    const result = await completeOutcomeOnboarding(storage, {
      userId: "user-1",
      kind: "business_profile",
      goal: "Build my distinct profile",
      business: { name: "Acme Works", links: ["acme.com"] },
    });

    expect(result.kind).toBe("business_profile");
    expect(storage.state.businesses).toHaveLength(2);
    expect(storage.state.businesses[0].ownerUserId).toBeNull();
    expect(storage.state.businesses[1].ownerUserId).toBe("user-1");
  });

  it("uses an identifiable active unlinked profile as identity, but never attaches a conflicting one", async () => {
    const matching = createFakeStorage({
      user: { activeProfileId: "profile-draft" },
      profiles: [
        {
          id: "profile-draft",
          ownerUserId: "user-1",
          businessId: null,
          roleContext: "business_owner",
          slug: "known-works",
          displayName: "Known Works",
          status: "draft",
          contentBlocks: [{ type: "businessDraft", data: {} }],
          ctaConfig: { primary: { label: "Keep" } },
          seoMeta: {},
        },
      ],
    });
    const matchingResult = await completeOutcomeOnboarding(matching, {
      userId: "user-1",
      kind: "business_profile",
      goal: "Finish this profile",
      business: { services: ["Known service"] },
    });
    expect(matching.state.businesses).toHaveLength(1);
    expect(matching.state.businesses[0].name).toBe("Known Works");
    expect(matching.state.profiles).toHaveLength(1);
    expect(matching.state.profiles[0].businessId).toBe(matching.state.businesses[0].id);
    expect(matchingResult.resultRoute).toBe("/u/known-works?edit=1");

    const conflicting = createFakeStorage({
      user: { activeProfileId: "profile-other" },
      profiles: [
        {
          id: "profile-other",
          ownerUserId: "user-1",
          businessId: null,
          roleContext: "business_owner",
          slug: "other-works",
          displayName: "Other Works",
          status: "draft",
          contentBlocks: [{ type: "businessDraft", data: { owner: "keep" } }],
          ctaConfig: { primary: { label: "Keep" } },
          seoMeta: {},
        },
      ],
    });
    const conflictingResult = await completeOutcomeOnboarding(conflicting, {
      userId: "user-1",
      kind: "business_profile",
      goal: "Build Target",
      business: { name: "Target Works" },
    });
    expect(conflicting.state.businesses[0].name).toBe("Target Works");
    expect(conflicting.state.profiles).toHaveLength(2);
    expect(conflicting.state.profiles[0]).toMatchObject({
      id: "profile-other",
      businessId: null,
      displayName: "Other Works",
      status: "draft",
    });
    expect(conflicting.state.profiles[1].businessId).toBe(conflicting.state.businesses[0].id);
    expect(conflictingResult.resultRoute).toBe("/u/target-works?edit=1");
  });

  it("reuses the single exact non-active unlinked business profile instead of creating a duplicate", async () => {
    const storage = createFakeStorage({
      user: { activeBusinessId: "biz-acme", activeProfileId: "personal-profile" },
      businesses: [
        {
          id: "biz-acme",
          ownerUserId: "user-1",
          name: "Acme Works",
          slug: "acme-works-business",
          roleContext: "business_owner",
          status: "active",
          profileData: {},
        },
      ],
      profiles: [
        {
          id: "personal-profile",
          ownerUserId: "user-1",
          businessId: null,
          roleContext: "community_member",
          slug: "personal",
          displayName: "Person",
          status: "draft",
          contentBlocks: [],
          ctaConfig: {},
          seoMeta: {},
        },
        {
          id: "non-active-acme-profile",
          ownerUserId: "user-1",
          businessId: null,
          roleContext: "business_owner",
          slug: "keep-acme-profile",
          displayName: "Acme Works",
          status: "draft",
          contentBlocks: [{ type: "businessDraft", data: { owner: "keep" } }],
          ctaConfig: { primary: { label: "Keep" } },
          seoMeta: { title: "Keep SEO" },
        },
      ],
    });

    const result = await completeOutcomeOnboarding(storage, {
      userId: "user-1",
      kind: "business_profile",
      goal: "Finish Acme",
      business: { name: "Acme Works", services: ["Repair"] },
    });

    expect(storage.state.profiles).toHaveLength(2);
    expect(storage.state.profiles[0]).toMatchObject({ id: "personal-profile", businessId: null });
    expect(storage.state.profiles[1]).toMatchObject({
      id: "non-active-acme-profile",
      businessId: "biz-acme",
      slug: "keep-acme-profile",
      status: "published",
      ctaConfig: { primary: { label: "Keep" } },
      seoMeta: { title: "Keep SEO" },
    });
    expect(result.resultRoute).toBe("/u/keep-acme-profile?edit=1");
  });

  it("rejects ambiguous exact unlinked business profiles instead of choosing or duplicating", async () => {
    const storage = createFakeStorage({
      user: { activeBusinessId: "biz-acme", activeProfileId: null },
      businesses: [
        {
          id: "biz-acme",
          ownerUserId: "user-1",
          name: "Acme Works",
          slug: "acme-works",
          roleContext: "business_owner",
          status: "active",
          profileData: {},
        },
      ],
      profiles: ["one", "two"].map((id) => ({
        id: `profile-${id}`,
        ownerUserId: "user-1",
        businessId: null,
        roleContext: "business_owner",
        slug: `acme-${id}`,
        displayName: "Acme Works",
        status: "draft",
        contentBlocks: [{ type: "businessDraft", data: { id } }],
        ctaConfig: {},
        seoMeta: {},
      })),
    });

    await expect(
      completeOutcomeOnboarding(storage, {
        userId: "user-1",
        kind: "business_profile",
        goal: "Finish Acme",
        business: { name: "Acme Works" },
      })
    ).rejects.toMatchObject({
      code: "BUSINESS_PROFILE_SELECTION_REQUIRED",
      missing: ["business.targetProfileId"],
      candidates: [
        { id: "profile-one", displayName: "Acme Works", slug: "acme-one" },
        { id: "profile-two", displayName: "Acme Works", slug: "acme-two" },
      ],
    });
    expect(storage.state.profiles).toHaveLength(2);
    expect(storage.state.profiles.every((profile) => !profile.businessId)).toBe(true);
    expect(storage.state.userPatches).toHaveLength(0);

    const recovered = await completeOutcomeOnboarding(storage, {
      userId: "user-1",
      kind: "business_profile",
      goal: "Finish Acme",
      business: { name: "Acme Works", targetProfileId: "profile-two" },
    });
    expect(recovered.resultRoute).toBe("/u/acme-two?edit=1");
    expect(storage.state.profiles[0].businessId).toBeNull();
    expect(storage.state.profiles[1].businessId).toBe("biz-acme");
  });

  it("fails closed on a forged profile target and returns only matching owned profiles", async () => {
    const storage = createFakeStorage({
      user: { activeBusinessId: "biz-acme" },
      businesses: [
        {
          id: "biz-acme",
          ownerUserId: "user-1",
          name: "Acme Works",
          slug: "acme",
          roleContext: "business_owner",
          status: "active",
          profileData: {},
        },
      ],
      profiles: [
        {
          id: "owned-profile",
          ownerUserId: "user-1",
          businessId: null,
          roleContext: "business_owner",
          slug: "owned-acme",
          displayName: "Acme Works",
          status: "draft",
          contentBlocks: [],
          ctaConfig: {},
          seoMeta: {},
        },
        {
          id: "foreign-profile",
          ownerUserId: "other-user",
          businessId: null,
          roleContext: "business_owner",
          slug: "foreign-acme",
          displayName: "Acme Works",
          status: "draft",
          contentBlocks: [],
          ctaConfig: {},
          seoMeta: {},
        },
      ],
    });

    await expect(
      completeOutcomeOnboarding(storage, {
        userId: "user-1",
        kind: "business_profile",
        goal: "Finish Acme",
        business: { name: "Acme Works", targetProfileId: "foreign-profile" },
      })
    ).rejects.toMatchObject({
      code: "BUSINESS_PROFILE_SELECTION_REQUIRED",
      candidates: [{ id: "owned-profile", displayName: "Acme Works", slug: "owned-acme" }],
    });
    expect(storage.state.profiles[0].businessId).toBeNull();
    expect(storage.state.userPatches).toHaveLength(0);
  });

  it("prioritizes a foreign claimed identity conflict over a duplicate unclaimed row", () => {
    const matches = [
      {
        id: "unclaimed",
        ownerUserId: null,
        claimStatus: "unclaimed",
        status: "active",
        name: "Acme Works",
      },
      {
        id: "claimed",
        ownerUserId: "other-user",
        claimStatus: "claimed",
        status: "active",
        name: "Acme Works",
      },
    ];

    expect(() =>
      enforceCanonicalBusinessIdentityResolution(matches, { userId: "user-1" })
    ).toThrowError(expect.objectContaining({ code: "BUSINESS_OWNERSHIP_CONFLICT" }));
  });

  it("preserves global privacy and unrelated published profiles when completing one business", async () => {
    const preferences = {
      profileVisibility: "private",
      privacy: { showProfile: false, allowMessages: false },
    };
    const unrelatedProfile = {
      id: "personal-profile",
      ownerUserId: "user-1",
      businessId: null,
      roleContext: "community_member",
      slug: "personal-profile",
      displayName: "Private Person",
      status: "published",
      contentBlocks: [{ type: "custom", data: { body: "Private owner content" } }],
      ctaConfig: {},
      seoMeta: {},
    };
    const storage = createFakeStorage({
      user: { preferences, activeBusinessId: "biz-target", activeProfileId: "biz-profile" },
      businesses: [
        {
          id: "biz-target",
          ownerUserId: "user-1",
          name: "Target Works",
          slug: "target-works",
          roleContext: "business_owner",
          status: "active",
          profileData: {},
        },
      ],
      profiles: [
        {
          id: "biz-profile",
          ownerUserId: "user-1",
          businessId: "biz-target",
          roleContext: "business_owner",
          slug: "target-works",
          displayName: "Target Works",
          status: "draft",
          contentBlocks: [],
          ctaConfig: {},
          seoMeta: {},
        },
        unrelatedProfile,
      ],
    });

    await completeOutcomeOnboarding(storage, {
      userId: "user-1",
      kind: "business_profile",
      goal: "Publish the business profile",
      business: { targetBusinessId: "biz-target", name: "Target Works" },
    });

    expect(storage.state.user.preferences).toMatchObject({
      ...preferences,
      publicProfileIds: ["biz-profile"],
    });
    expect(storage.state.user.preferences.publicProfileIds).not.toContain("personal-profile");
    expect(storage.state.profiles[1]).toEqual(unrelatedProfile);
  });

  it("requires a name for hosted or unknown-suffix links and handles compound/bare domains safely", async () => {
    expect(deriveBusinessNameFromLinks(["acme.co.za"])).toBe("Acme");
    expect(deriveBusinessNameFromLinks(["acme.com.mx/path"])).toBe("Acme");
    expect(deriveBusinessNameFromLinks(["https://square.site/acme"])).toBe("");
    expect(deriveBusinessNameFromLinks(["https://owner.wixsite.com/acme"])).toBe("");
    expect(deriveBusinessNameFromLinks(["https://north-star.example/work"])).toBe("");
    expect(
      normalizeOutcomeBusinessEvidence({ links: ["www.acme.com", "not a url"] }).links
    ).toEqual(["https://www.acme.com/"]);

    const storage = createFakeStorage();
    await expect(
      completeOutcomeOnboarding(storage, {
        userId: "user-1",
        kind: "business_profile",
        goal: "Build from this page",
        business: { links: ["https://square.site/acme"] },
      })
    ).rejects.toMatchObject({ code: "BUSINESS_IDENTITY_REQUIRED" });
    expect(storage.state.businesses).toHaveLength(0);
    expect(storage.state.userPatches).toHaveLength(0);
  });

  it("does not enrich the sole owned business when a strong link identifies a different business", async () => {
    const storage = createFakeStorage({
      businesses: [
        {
          id: "oldco",
          ownerUserId: "user-1",
          name: "OldCo",
          slug: "oldco",
          roleContext: "business_owner",
          status: "active",
          profileData: { website: "https://oldco.com", services: ["Keep"] },
        },
      ],
    });
    const result = await completeOutcomeOnboarding(storage, {
      userId: "user-1",
      kind: "business_profile",
      goal: "Build the new business",
      business: { links: ["newco.com"], services: ["New"] },
    });
    expect(storage.state.businesses).toHaveLength(2);
    expect(storage.state.businesses[0].profileData.services).toEqual(["Keep"]);
    expect(storage.state.businesses[1].name).toBe("Newco");
    expect(result).toMatchObject({ profile: { businessId: "business-2" } });
  });

  it("lets a strong new domain outrank an unrelated active unlinked-profile fallback", async () => {
    const storage = createFakeStorage({
      user: { activeProfileId: "old-profile" },
      profiles: [
        {
          id: "old-profile",
          ownerUserId: "user-1",
          businessId: null,
          roleContext: "business_owner",
          slug: "oldco",
          displayName: "OldCo",
          status: "draft",
          contentBlocks: [{ type: "businessDraft", data: {} }],
          ctaConfig: {},
          seoMeta: {},
        },
      ],
    });
    const result = await completeOutcomeOnboarding(storage, {
      userId: "user-1",
      kind: "business_profile",
      goal: "Build NewCo",
      business: { links: ["newco.com"] },
    });
    expect(storage.state.businesses[0].name).toBe("Newco");
    expect(storage.state.profiles).toHaveLength(2);
    expect(storage.state.profiles[0]).toMatchObject({ id: "old-profile", businessId: null });
    expect(result.resultRoute).toBe("/u/newco?edit=1");
  });

  it("blocks suspended exact identities without mutating or creating a replacement", async () => {
    const storage = createFakeStorage({
      businesses: [
        {
          id: "suspended-acme",
          ownerUserId: "user-1",
          name: "Acme Works",
          slug: "acme-works",
          roleContext: "business_owner",
          claimStatus: "claimed",
          status: "suspended",
          profileData: { website: "https://acme.com" },
        },
      ],
    });
    await expect(
      completeOutcomeOnboarding(storage, {
        userId: "user-1",
        kind: "business_profile",
        goal: "Recreate Acme",
        business: { name: "Acme Works", links: ["acme.com"] },
      })
    ).rejects.toMatchObject({ code: "BUSINESS_SUSPENDED" });
    expect(storage.state.businesses).toHaveLength(1);
    expect(storage.state.profiles).toHaveLength(0);
    expect(storage.state.userPatches).toHaveLength(0);
  });

  it("hands duplicate unclaimed matches to a query-scoped claim resolution", async () => {
    let analysisCalls = 0;
    const storage = createFakeStorage({
      businesses: ["one", "two"].map((id) => ({
        id,
        ownerUserId: null,
        name: "Duplicate Works",
        slug: `duplicate-${id}`,
        roleContext: "business_owner",
        claimStatus: "unclaimed",
        status: "active",
        profileData: {},
      })),
    });
    const result = await completeOutcomeOnboarding(
      storage,
      {
        userId: "user-1",
        kind: "business_profile",
        goal: "Build Duplicate Works",
        business: {
          name: "Duplicate Works",
          links: ["https://duplicate.example/work"],
        },
      },
      {
        businessProfileAnalyzer: {
          async analyze() {
            analysisCalls += 1;
            return null;
          },
        },
      }
    );
    expect(result).toMatchObject({
      kind: "business_claim_required",
      claim: { name: "Duplicate Works" },
    });
    expect(result.resultRoute).toBe(
      "/claim-my-business?source=outcome_onboarding_match&q=Duplicate+Works"
    );
    expect(result.kind === "business_claim_required" && result.claim.businessId).toBeUndefined();
    expect(analysisCalls).toBe(0);
    expect(storage.state.businesses).toHaveLength(2);
    expect(storage.state.userPatches).toHaveLength(0);
  });

  it("returns the minimal identity error before any mutation for image-only evidence", async () => {
    const storage = createFakeStorage();

    await expect(
      completeOutcomeOnboarding(storage, {
        userId: "user-1",
        kind: "business_profile",
        goal: "Create my presence",
        business: { photoUrls: ["/objects/photo.jpg"] },
      })
    ).rejects.toMatchObject({
      name: "BusinessIdentityRequiredError",
      code: "BUSINESS_IDENTITY_REQUIRED",
      missing: ["business.name"],
    } satisfies Partial<BusinessIdentityRequiredError>);

    expect(storage.state.businesses).toHaveLength(0);
    expect(storage.state.profiles).toHaveLength(0);
    expect(storage.state.userPatches).toHaveLength(0);
    expect(storage.state.events).toHaveLength(0);
  });

  it("completes express onboarding at the exact safe result path and rejects external/loop escapes", async () => {
    const originalPreferences = {
      existingPreference: "keep",
      profileVisibility: "private",
      privacy: { showProfile: false, allowMessages: false },
    };
    const storage = createFakeStorage({ user: { preferences: originalPreferences } });
    const exact = "/exchange/items/abc?mode=buy#details";
    const result = await completeOutcomeOnboarding(storage, {
      userId: "user-1",
      kind: "express_result",
      goal: "Buy this item",
      next: exact,
    });

    expect(result).toEqual({
      kind: "express_result",
      resultRoute: exact,
      outcomeTitle: "Your TradeScout result is ready",
    });
    expect(storage.state.user).toMatchObject({
      onboardingCompleted: true,
      profileVersion: 1,
      verificationStatus: "approved",
    });
    const { onboardingOutcome, ...unchangedPreferences } = storage.state.user.preferences;
    expect(unchangedPreferences).toEqual(originalPreferences);
    expect(onboardingOutcome).toMatchObject({
      kind: "express_result",
      resultRoute: exact,
    });
    expect(safeOutcomeNextPath("https://evil.example/phish")).toBe("");
    expect(safeOutcomeNextPath("//evil.example/phish")).toBe("");
    expect(safeOutcomeNextPath("/%2f%2fevil.example/phish")).toBe("");
    expect(safeOutcomeNextPath("/https:%2f%2fevil.example/phish")).toBe("");
    expect(safeOutcomeNextPath("/onboarding?next=/exchange/items/abc")).toBe("");
    expect(safeOutcomeNextPath("/logout")).toBe("");

    const fallbackStorage = createFakeStorage();
    const fallback = await completeOutcomeOnboarding(fallbackStorage, {
      userId: "user-1",
      kind: "express_result",
      goal: "Find a roof repair specialist",
      next: "https://evil.example",
    });
    expect(fallback).toMatchObject({
      kind: "express_result",
      resultRoute: "/scout?source=onboarding_result",
      resultPrompt: "Find a roof repair specialist",
    });
    expect(fallbackStorage.state.user.preferences.onboardingOutcome.resultRoute).toBe(
      "/scout?source=onboarding_result"
    );
  });

  it("validates the locked completion payload and keeps links out of profile blocks", () => {
    expect(
      completeOutcomeOnboardingSchema.safeParse({
        kind: "business_profile",
        goal: "Populate my profile",
        business: {
          targetBusinessId: "business-1",
          targetProfileId: "profile-1",
          name: "Sparse Co",
          links: ["https://sparse.example"],
          photoUrls: [],
        },
      }).success
    ).toBe(true);
    expect(
      completeOutcomeOnboardingSchema.safeParse({ kind: "express_result", goal: "" }).success
    ).toBe(false);
    expect(
      completeOutcomeOnboardingSchema.safeParse({
        kind: "business_profile",
        goal: "Populate",
        extraLane: "business",
      }).success
    ).toBe(false);

    const evidence = normalizeOutcomeBusinessEvidence({
      name: "Sparse Co",
      notes: "Explicit description",
      links: ["javascript:alert(1)", "https://sparse.example"],
    });
    const blocks = buildOutcomeProfileContentBlocks([], {
      displayName: evidence.name,
      evidence,
      isNew: true,
    });
    expect(evidence.links).toEqual(["https://sparse.example/"]);
    expect(JSON.stringify(blocks)).not.toContain("sparse.example");
    expect(JSON.stringify(blocks)).not.toMatch(/license|insurance|review|pricing|trust/i);
  });

  it("serializes only safe owned selection metadata in the 422 route payload", () => {
    expect(
      buildOutcomeSelectionErrorPayload(
        new BusinessSelectionRequiredError([
          { id: "biz-1", name: "Acme", slug: "acme", privateField: "never" },
        ])
      )
    ).toEqual({
      message: "Choose the business to update, or enter its exact business name.",
      code: "BUSINESS_SELECTION_REQUIRED",
      missing: ["business.targetBusinessId", "business.name"],
      candidates: [{ id: "biz-1", name: "Acme", slug: "acme" }],
    });
    expect(
      buildOutcomeSelectionErrorPayload(
        new BusinessProfileSelectionRequiredError([
          {
            id: "profile-1",
            displayName: "Acme",
            slug: "acme-profile",
            contentBlocks: [{ secret: true }],
          },
        ])
      )
    ).toEqual({
      message:
        "Multiple unlinked business profiles match this business. Choose the profile to reuse.",
      code: "BUSINESS_PROFILE_SELECTION_REQUIRED",
      missing: ["business.targetProfileId"],
      candidates: [{ id: "profile-1", displayName: "Acme", slug: "acme-profile" }],
    });
  });

  it("turns link-only evidence into a sourced profile and reuses the same policy output on retry", async () => {
    const storage = createFakeStorage();
    let analysisCalls = 0;
    const analyzer = {
      id: "test_responses_analyzer",
      async analyze() {
        analysisCalls += 1;
        return {
          description: {
            text: "Custom woodworking and built-in cabinetry.",
            sourceUrls: ["https://north-star.com/work"],
          },
          about: {
            text: "North Star builds made-to-fit woodwork for residential spaces.",
            sourceUrls: ["https://north-star.com/work"],
          },
          services: [
            { name: "Custom cabinetry", sourceUrls: ["https://north-star.com/work"] },
            { name: "Built-in shelving", sourceUrls: ["https://north-star.com/work"] },
            // Unsupported and uncited values are discarded before persistence.
            { name: "Uncited service", sourceUrls: ["https://untrusted.example/"] },
          ],
          license: "LIC-123",
          verified: true,
          rating: 5,
          pricing: "$100",
          phone: "850-555-0100",
          category: "Carpenter",
          location: "Pensacola",
          ownership: "Jane Doe",
        };
      },
    };
    const request = {
      userId: "user-1",
      kind: "business_profile" as const,
      goal: "Build my public profile",
      business: { links: ["https://north-star.com/work"] },
    };

    await completeOutcomeOnboarding(storage, request, { businessProfileAnalyzer: analyzer });
    await completeOutcomeOnboarding(storage, request, { businessProfileAnalyzer: analyzer });

    expect(analysisCalls).toBe(1);
    expect(storage.state.businesses).toHaveLength(1);
    expect(storage.state.profiles).toHaveLength(1);
    expect(storage.state.businesses[0].profileData).toMatchObject({
      description: "Services include Custom cabinetry, Built-in shelving.",
      services: ["Custom cabinetry", "Built-in shelving"],
      website: "https://north-star.com/work",
      publicWebsiteEnabled: false,
    });
    expect(storage.state.profiles[0].contentBlocks).toEqual(
      expect.arrayContaining([
        {
          type: "about",
          data: {
            body: "Services include Custom cabinetry, Built-in shelving.",
          },
        },
        {
          type: "services",
          data: { items: ["Custom cabinetry", "Built-in shelving"] },
        },
      ])
    );
    const publicProfile = JSON.stringify(storage.state.profiles[0]);
    expect(publicProfile).not.toContain("north-star.com/work");
    expect(publicProfile).not.toMatch(
      /LIC-123|verified|rating|\$100|850-555|Carpenter|Pensacola|Jane Doe/
    );
    expect(storage.state.user.preferences.onboardingOutcome.provenance).toMatchObject({
      evidence: {
        links: ["https://north-star.com/work"],
        services: [],
        photoUrls: [],
      },
      enrichment: {
        source: "selective_intelligence_profile_enrichment",
        analyzer: "test_responses_analyzer",
        output: {
          services: [
            { name: "Custom cabinetry", sourceUrls: ["https://north-star.com/work"] },
            { name: "Built-in shelving", sourceUrls: ["https://north-star.com/work"] },
          ],
        },
      },
    });
    expect(JSON.stringify(storage.state.user.preferences)).not.toMatch(
      /LIC-123|verified|rating|\$100|850-555|Carpenter|Pensacola|Jane Doe/
    );
  });

  it("uses an uploaded object photo as sourced vision evidence without changing its original provenance", async () => {
    const storage = createFakeStorage();
    const previousPublicUrl = process.env.PUBLIC_WEB_URL;
    process.env.PUBLIC_WEB_URL = "https://preview.tradescout.example/app";
    let analyzerInput: any;
    try {
      await completeOutcomeOnboarding(
        storage,
        {
          userId: "user-1",
          kind: "business_profile",
          goal: "Build my profile from this project photo",
          business: { name: "Photo Works", photoUrls: ["/objects/project-one.jpg"] },
        },
        {
          businessProfileAnalyzer: {
            id: "vision_test",
            async analyze(input) {
              analyzerInput = input;
              return {
                description: { text: "", sourceUrls: [] },
                about: {
                  text: "Project photos show custom built-in storage work.",
                  sourceUrls: ["https://preview.tradescout.example/objects/project-one.jpg"],
                },
                services: [
                  {
                    name: "Built-in storage",
                    sourceUrls: ["https://preview.tradescout.example/objects/project-one.jpg"],
                  },
                ],
              };
            },
          },
        }
      );
    } finally {
      if (previousPublicUrl === undefined) delete process.env.PUBLIC_WEB_URL;
      else process.env.PUBLIC_WEB_URL = previousPublicUrl;
    }

    expect(analyzerInput.photoUrls).toEqual([
      "https://preview.tradescout.example/objects/project-one.jpg",
    ]);
    expect(storage.state.user.preferences.onboardingOutcome.provenance.evidence.photoUrls).toEqual([
      "/objects/project-one.jpg",
    ]);
    expect(storage.state.businesses[0].profileData.services).toEqual(["Built-in storage"]);
    expect(publicBlocks(storage)).toContain("Services include Built-in storage.");
    expect(publicBlocks(storage)).toContain("/objects/project-one.jpg");
    expect(publicBlocks(storage)).not.toContain("preview.tradescout.example");
  });

  it("fails soft to deterministic supplied evidence when profile analysis is unavailable", async () => {
    const storage = createFakeStorage();
    const result = await completeOutcomeOnboarding(
      storage,
      {
        userId: "user-1",
        kind: "business_profile",
        goal: "Publish what I supplied",
        business: {
          name: "Steady Works",
          notes: "Owner-supplied repair description.",
          services: ["Owner-supplied repairs"],
          links: ["https://steady.example/work"],
          photoUrls: ["/objects/steady.jpg"],
        },
      },
      {
        businessProfileAnalyzer: {
          id: "failing_test_analyzer",
          async analyze() {
            throw new Error("simulated analyzer outage with private evidence");
          },
        },
      }
    );

    expect(result.kind).toBe("business_profile");
    expect(storage.state.user.onboardingCompleted).toBe(true);
    expect(storage.state.businesses[0].profileData).toMatchObject({
      description: "Owner-supplied repair description.",
      services: ["Owner-supplied repairs"],
    });
    expect(publicBlocks(storage)).toContain("Owner-supplied repair description.");
    expect(publicBlocks(storage)).toContain("Owner-supplied repairs");
    expect(storage.state.user.preferences.onboardingOutcome.provenance).not.toHaveProperty(
      "enrichment"
    );
  });

  it("single-flights concurrent enrichment so divergent retries cannot merge model output", async () => {
    const storage = createFakeStorage();
    const atomicArgs: any[] = [];
    storage.completeOutcomeBusinessProfile = async (args) => {
      atomicArgs.push(args);
      return {
        business: { id: "race-business" },
        profile: { id: "race-profile", slug: "race-works" },
      };
    };
    let analysisCalls = 0;
    let releaseAnalysis!: () => void;
    const analysisStarted = new Promise<void>((resolve) => {
      releaseAnalysis = resolve;
    });
    const analyzer = {
      id: "concurrent_test",
      async analyze() {
        analysisCalls += 1;
        await analysisStarted;
        const suffix = analysisCalls === 1 ? "First" : "Divergent";
        return {
          description: { text: "", sourceUrls: [] },
          about: {
            text: `${suffix} sourced description`,
            sourceUrls: ["https://race.example/work"],
          },
          services: [{ name: `${suffix} service`, sourceUrls: ["https://race.example/work"] }],
        };
      },
    };
    const request = {
      userId: "user-1",
      kind: "business_profile" as const,
      goal: "Build one stable profile",
      business: { name: "Race Works", links: ["https://race.example/work"] },
    };

    const first = completeOutcomeOnboarding(storage, request, {
      businessProfileAnalyzer: analyzer,
    });
    const second = completeOutcomeOnboarding(storage, request, {
      businessProfileAnalyzer: analyzer,
    });
    await Promise.resolve();
    releaseAnalysis();
    await Promise.all([first, second]);

    expect(analysisCalls).toBe(1);
    expect(atomicArgs).toHaveLength(2);
    expect(atomicArgs.map((args) => args.enrichment.services)).toEqual([
      [{ name: "First service", sourceUrls: ["https://race.example/work"] }],
      [{ name: "First service", sourceUrls: ["https://race.example/work"] }],
    ]);
    expect(JSON.stringify(atomicArgs)).not.toContain("Divergent");
  });
});
