import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  getProfileBySlugPublic: vi.fn(),
  getBusinessPublicById: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: storageMocks,
}));

import {
  buildPublicProfileWebAppManifest,
  createPublicProfileWebAppManifest,
  resolvePublicProfileAppIdentity,
} from "../publicProfileApp";
import {
  buildPublicProfileAppIconPath,
  buildPublicProfileAppManifestPath,
  parsePublicProfileAppManifestFile,
} from "@shared/publicProfileApp";
import { buildPublicProfileHtml } from "../publicProfileHtml";

const templateHtml = `<!doctype html>
<html>
  <head>
    <title>TradeScout</title>
    <meta name="description" content="TradeScout" />
    <meta name="robots" content="index, follow" />
    <meta property="og:title" content="TradeScout" />
    <meta property="og:description" content="TradeScout" />
    <meta property="og:url" content="https://www.thetradescout.com/" />
    <meta property="og:image" content="/tradescout-social-preview.png" />
    <meta property="og:image:secure_url" content="/tradescout-social-preview.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:alt" content="TradeScout" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="TradeScout" />
    <meta name="twitter:description" content="TradeScout" />
    <meta name="twitter:image" content="/tradescout-social-preview.png" />
    <meta name="twitter:image:alt" content="TradeScout" />
    <link rel="canonical" href="https://www.thetradescout.com/" />
    <link rel="manifest" href="/manifest.json?v=11" />
  </head>
  <body><div id="root"></div></body>
</html>`;

describe("public profile app identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.getProfileBySlugPublic.mockResolvedValue({
      id: "profile-jrs",
      slug: "jrs-auto-glass",
      displayName: "JR's Auto Glass",
      headline: "Mobile auto glass repair and replacement.",
      roleContext: "Auto glass service",
      servicesDescription: "Windshield repair, replacement, and mobile installation.",
      businessId: "business-jrs",
      status: "published",
      contentBlocks: [],
      seoMeta: {
        title: "JR's Auto Glass",
        description: "Mobile auto glass service for Ponchatoula and nearby communities.",
        imageUrl: "/images/businesses/jrs-auto-glass/share.webp",
        faviconUrl: "https://www.thetradescout.com/images/businesses/jrs-auto-glass/logo.webp",
        customDomain: "jrsautoglass.example",
      },
    });
    storageMocks.getBusinessPublicById.mockResolvedValue({
      id: "business-jrs",
      name: "JR's Auto Glass",
      categories: ["Auto glass"],
      serviceAreas: ["Ponchatoula, LA"],
      brandColors: { primary: "#a71919", accent: "#d92727" },
    });
  });

  it("builds an individual app instead of reusing the TradeScout install identity", async () => {
    const manifest = await buildPublicProfileWebAppManifest({
      slug: "jrs-auto-glass",
      origin: "https://www.thetradescout.com",
    });

    expect(manifest).toMatchObject({
      id: "/profile-apps/jrs-auto-glass",
      name: "JR's Auto Glass",
      short_name: "JR's Auto Glass",
      start_url: "/u/jrs-auto-glass?entry=profile_app",
      scope: "/u/jrs-auto-glass",
      theme_color: "#d92727",
    });
    expect(manifest?.icons.map((icon) => icon.src)).toEqual([
      "/profile-app-icons/jrs-auto-glass/192.png",
      "/profile-app-icons/jrs-auto-glass/512.png",
    ]);
    expect(JSON.stringify(manifest)).not.toContain("/direct-connect?entry=install");
    expect(JSON.stringify(manifest)).not.toContain("/icon-192.png");
  });

  it("rejects malformed profile app paths before storage or rendering", () => {
    expect(buildPublicProfileAppManifestPath("../admin")).toBeNull();
    expect(buildPublicProfileAppIconPath("profile/name", 192)).toBeNull();
    expect(parsePublicProfileAppManifestFile("%2e%2e%2fadmin.webmanifest")).toBeNull();
    expect(parsePublicProfileAppManifestFile("jrs-auto-glass.webmanifest")).toBe(
      "jrs-auto-glass"
    );
  });

  it("launches a mapped profile-domain app at that domain's root", async () => {
    const identity = await resolvePublicProfileAppIdentity("jrs-auto-glass");
    expect(identity).not.toBeNull();
    if (!identity) return;

    expect(identity.logoUrl).toBe(
      "https://www.thetradescout.com/images/businesses/jrs-auto-glass/logo.webp"
    );
    expect(identity.customDomain).toBe("jrsautoglass.example");

    const manifest = createPublicProfileWebAppManifest({
      identity,
      origin: "https://jrsautoglass.example",
    });
    expect(manifest?.start_url).toBe("/?entry=profile_app");
    expect(manifest?.scope).toBe("/");
    expect(manifest?.id).toBe("/profile-apps/jrs-auto-glass");
  });

  it("replaces the generic manifest link in server-rendered profile HTML", async () => {
    const html = await buildPublicProfileHtml({
      slug: "jrs-auto-glass",
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    expect(html).toContain(
      '<link rel="manifest" href="/profile-manifests/jrs-auto-glass.webmanifest" data-platform-manifest-href="/manifest.json?v=11" />'
    );
    expect(html).not.toContain('rel="manifest" href="/manifest.json?v=11"');
    expect(html).toContain(
      '<link rel="apple-touch-icon" href="/profile-app-icons/jrs-auto-glass/192.png" />'
    );
    expect(html).toContain(
      '<meta name="apple-mobile-web-app-title" content="JR&#39;s Auto Glass" />'
    );
    expect(html).toContain('<meta name="theme-color" content="#d92727" />');
    expect(html).toContain(
      '<link rel="icon" href="https://www.thetradescout.com/images/businesses/jrs-auto-glass/logo.webp" />'
    );
  });
});
