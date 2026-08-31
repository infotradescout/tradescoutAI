import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  JRS_PROFILE_SLUG,
  OWNER_CONFIRMED_PROFILE_SOURCE,
} from "../services/ownerConfirmedDirectProfile";

const mocks = vi.hoisted(() => ({
  rows: [] as any[],
  publicRead: vi.fn(),
  getBusinessPublicById: vi.fn(),
}));

vi.mock("../db", () => {
  const query: any = {};
  query.select = vi.fn(() => query);
  query.from = vi.fn(() => query);
  query.innerJoin = vi.fn(() => query);
  query.leftJoin = vi.fn(() => query);
  query.where = vi.fn(() => query);
  query.limit = vi.fn(async () => mocks.rows);
  return { db: query };
});

vi.mock("../storage", () => ({
  storage: {
    getProfileBySlugPublic: (...args: any[]) => mocks.publicRead(...args),
    getBusinessPublicById: (...args: any[]) => mocks.getBusinessPublicById(...args),
  },
}));

import { ProfileRepository } from "../repositories/profileRepository";
import {
  buildPublicProfileHtml,
  buildPublicProfileLlmsText,
  buildPublicProfileSitemapXml,
} from "../publicProfileHtml";

const templateHtml =
  '<!doctype html><html><head><title>TradeScout</title></head><body><div id="root"></div></body></html>';

function linkedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "profile-onboarding-1",
    slug: "pending-onboarding-business",
    displayName: "PRIVATE ONBOARDING EVIDENCE",
    headline: "PRIVATE EVIDENCE HEADLINE",
    roleContext: "business_owner",
    contentBlocks: [{ type: "about", data: { body: "PRIVATE PROFILE BODY" } }],
    ctaConfig: {},
    seoMeta: { description: "PRIVATE SEO EVIDENCE", customDomain: "pending.example" },
    businessId: "business-onboarding-1",
    updatedAt: new Date("2026-07-31T12:00:00.000Z"),
    profileSections: null,
    legacyProfileBooking: null,
    ownerFirstName: "Private",
    ownerLastName: "Owner",
    ownerProfileImageUrl: null,
    ownerCity: null,
    ownerState: null,
    ownerRoles: ["business_owner"],
    servicesDescription: "PRIVATE SERVICES EVIDENCE",
    profileOwnerUserId: "owner-1",
    ownerVerifiedBadge: false,
    ownerVerificationStatus: "pending",
    ownerProvider: "local",
    ownerPreferences: { publicProfileIds: ["profile-onboarding-1"] },
    businessStatus: "active",
    businessOwnerUserId: "owner-1",
    publicDiscoveryEnabled: true,
    businessSources: ["selective_intelligence_onboarding"],
    businessClaimStatus: "claimed",
    ...overrides,
  };
}

describe("anonymous public-profile HTML trust boundary", () => {
  beforeEach(() => {
    mocks.rows = [linkedRow()];
    mocks.publicRead.mockReset();
    mocks.getBusinessPublicById.mockReset();
  });

  it("rejects a pending linked onboarding profile at the repository boundary", async () => {
    const repository = new ProfileRepository();
    await expect(
      repository.getProfileBySlugPublic("pending-onboarding-business")
    ).resolves.toBeUndefined();

    // The authenticated API can resolve the published row and then apply its
    // explicit owner/staff preview authorization. This method is not used by
    // anonymous HTML, sitemap, or LLM surfaces.
    await expect(
      repository.getProfileBySlugPublished("pending-onboarding-business")
    ).resolves.toMatchObject({
      slug: "pending-onboarding-business",
      displayName: "PRIVATE ONBOARDING EVIDENCE",
    });
  });

  it("keeps unlinked community profiles and verified linked profiles public", async () => {
    const repository = new ProfileRepository();

    mocks.rows = [linkedRow({ businessId: null, roleContext: "community_builder" })];
    await expect(repository.getProfileBySlugPublic("community-member")).resolves.toMatchObject({
      displayName: "PRIVATE ONBOARDING EVIDENCE",
    });

    mocks.rows = [linkedRow({ ownerVerificationStatus: "approved" })];
    await expect(repository.getProfileBySlugPublic("verified-business")).resolves.toMatchObject({
      businessId: "business-onboarding-1",
    });
  });

  it("keeps only the exact established direct-profile exception", async () => {
    const repository = new ProfileRepository();
    mocks.rows = [
      linkedRow({
        slug: JRS_PROFILE_SLUG,
        publicDiscoveryEnabled: false,
        businessSources: [OWNER_CONFIRMED_PROFILE_SOURCE],
      }),
    ];
    await expect(repository.getProfileBySlugPublic(JRS_PROFILE_SLUG)).resolves.toMatchObject({
      slug: JRS_PROFILE_SLUG,
    });

    mocks.rows = [
      linkedRow({
        slug: "lookalike",
        publicDiscoveryEnabled: false,
        businessSources: [OWNER_CONFIRMED_PROFILE_SOURCE],
      }),
    ];
    await expect(repository.getProfileBySlugPublic("lookalike")).resolves.toBeUndefined();
  });

  it("returns no SSR HTML, host-local llms guidance, or host-local sitemap for pending evidence", async () => {
    const repository = new ProfileRepository();
    mocks.publicRead.mockImplementation((slug: string) => repository.getProfileBySlugPublic(slug));

    const [html, llms, sitemap] = await Promise.all([
      buildPublicProfileHtml({
        slug: "pending-onboarding-business",
        origin: "https://pending.example",
        templateHtml,
      }),
      buildPublicProfileLlmsText({
        slug: "pending-onboarding-business",
        origin: "https://pending.example",
      }),
      buildPublicProfileSitemapXml({
        slug: "pending-onboarding-business",
        origin: "https://pending.example",
      }),
    ]);

    expect(html).toBeNull();
    expect(llms).toBeNull();
    expect(sitemap).toBeNull();
    expect(JSON.stringify([html, llms, sitemap])).not.toContain("PRIVATE");
    expect(mocks.getBusinessPublicById).not.toHaveBeenCalled();
  });

  it("gates every custom-domain mechanics path before HTML, robots, sitemap, or llms handling", () => {
    const source = fs
      .readFileSync(path.resolve(process.cwd(), "server/index.ts"), "utf8")
      .replace(/\r\n/g, "\n");
    const customDomainHandler = source.slice(
      source.indexOf("async function serveCustomDomainProfilePath"),
      source.indexOf(
        "app.use(async (req, res, next) =>",
        source.indexOf("async function serveCustomDomainProfilePath")
      )
    );
    const gate = customDomainHandler.indexOf("await storage.getProfileBySlugPublic(slug)");

    expect(gate).toBeGreaterThan(-1);
    expect(customDomainHandler.indexOf('if (path === "/robots.txt")')).toBeGreaterThan(gate);
    expect(customDomainHandler.indexOf('if (path === "/sitemap.xml")')).toBeGreaterThan(gate);
    expect(customDomainHandler.indexOf('if (path === "/llms.txt")')).toBeGreaterThan(gate);

    const customDomainMiddleware = source.slice(
      source.indexOf(
        "app.use(async (req, res, next) =>",
        source.indexOf("async function serveCustomDomainProfilePath")
      ),
      source.indexOf("// Core allowed origins for production surfaces")
    );
    expect(customDomainMiddleware).toContain(
      "const publicProfileDomain = profileSlug\n      ? await storage.getProfileBySlugPublic(profileSlug)"
    );
    expect(customDomainMiddleware).toContain("if (profileSlug && publicProfileDomain)");
    expect(customDomainMiddleware).toContain(
      "const publicAliasProfile = aliasProfileSlug\n      ? await storage.getProfileBySlugPublic(aliasProfileSlug)"
    );
    expect(customDomainMiddleware).toContain(
      "if (aliasProfileSlug && aliasCanonicalHost && publicAliasProfile)"
    );
  });
});
