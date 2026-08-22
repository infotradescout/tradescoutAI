import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  INTERNAL_ADMIN_PROFILE_SLUGS,
  isInternalAdminProfileSlug,
  shouldIndexPublicProfileSlug,
} from "../../shared/publicProfileIndexing";

const mocks = vi.hoisted(() => ({
  profiles: new Map<string, any>(),
}));

vi.mock("../storage", () => ({
  storage: {
    getProfileBySlugPublic: vi.fn(async (slug: string) => mocks.profiles.get(slug) || null),
    getBusinessPublicById: vi.fn(async () => null),
  },
}));

import { buildPublicProfileHtml, buildPublicProfileSitemapXml } from "../publicProfileHtml";

const templateHtml = `<!doctype html>
<html>
  <head>
    <title>TradeScout</title>
    <meta name="description" content="TradeScout" />
    <meta name="robots" content="index, follow" />
  </head>
  <body><div id="root"></div></body>
</html>`;

function profile(slug: string) {
  return {
    id: `profile-${slug}`,
    isDiscoverable: !isInternalAdminProfileSlug(slug),
    slug,
    displayName: slug,
    headline: null,
    roleContext: "admin",
    contentBlocks: [],
    ctaConfig: {},
    seoMeta: {},
    businessId: null,
    updatedAt: "2026-07-29T12:00:00.000Z",
    profileSections: null,
    profileBooking: null,
    ownerFirstName: null,
    ownerLastName: null,
    ownerProfileImageUrl: null,
    ownerCity: null,
    ownerState: null,
    ownerRoles: ["admin"],
    servicesDescription: null,
  };
}

describe("internal admin public profile indexing", () => {
  beforeEach(() => {
    mocks.profiles.clear();
    for (const slug of INTERNAL_ADMIN_PROFILE_SLUGS) {
      mocks.profiles.set(slug, profile(slug));
    }
    mocks.profiles.set("local-electrician", profile("local-electrician"));
  });

  it("recognizes only the reserved internal admin profile slugs", () => {
    expect(isInternalAdminProfileSlug(" TradeScout-Admin ")).toBe(true);
    expect(isInternalAdminProfileSlug("SUPER-ADMIN")).toBe(true);
    expect(isInternalAdminProfileSlug("local-electrician")).toBe(false);
    expect(shouldIndexPublicProfileSlug("local-electrician")).toBe(true);
  });

  it.each(INTERNAL_ADMIN_PROFILE_SLUGS)(
    "marks /u/%s noindex while leaving the public page reachable",
    async (slug) => {
      const html = await buildPublicProfileHtml({
        slug,
        origin: "https://www.thetradescout.com",
        templateHtml,
      });

      expect(html).toContain('<meta name="robots" content="noindex, follow" />');
      expect(html).toContain(
        `<link rel="canonical" href="https://www.thetradescout.com/u/${slug}" />`
      );
    }
  );

  it.each(INTERNAL_ADMIN_PROFILE_SLUGS)(
    "does not emit a host-local sitemap for %s",
    async (slug) => {
      await expect(
        buildPublicProfileSitemapXml({
          slug,
          origin: "https://admin.example.com",
        })
      ).resolves.toBeNull();
    }
  );

  it("excludes the reserved slugs from the platform profile sitemap query", () => {
    const repository = fs.readFileSync(
      path.resolve(process.cwd(), "server/repositories/sitemapRepository.ts"),
      "utf8"
    );
    const profileRoutes = fs.readFileSync(
      path.resolve(process.cwd(), "server/routes/profiles.ts"),
      "utf8"
    );

    expect(repository).toContain("notInArray(profiles.slug, [...INTERNAL_ADMIN_PROFILE_SLUGS])");
    expect(profileRoutes).toContain(
      "if (!shouldIndexPublicProfileSlug(target.profileSlug)) return null;"
    );
  });

  it("keeps unrelated published profiles indexable and eligible for host-local sitemaps", async () => {
    const html = await buildPublicProfileHtml({
      slug: "local-electrician",
      origin: "https://www.thetradescout.com",
      templateHtml,
    });
    const sitemap = await buildPublicProfileSitemapXml({
      slug: "local-electrician",
      origin: "https://electrician.example.com",
    });

    expect(html).toContain(
      '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />'
    );
    expect(sitemap).toContain("<loc>https://electrician.example.com/</loc>");
  });
});
