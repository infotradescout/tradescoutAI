import React from "react";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import postcss from "postcss";
import * as routes from "@shared/issaBuildRoutes";
import { PENSACOLA_DISCOVERY, PENSACOLA_PROJECTS, pensacolaProjectRequestHref } from "@shared/pensacolaDiscovery";
import { ISSA_BUILD_PROFILE_CONTENT_BLOCKS } from "@shared/issaBuildProfile";
import PensacolaContent from "../../client/src/pages/pensacola-content";
import { prepareSitemapUrlSetEntries } from "../sitemapUrlSet";

vi.mock("../storage", () => ({ storage: {} }));
vi.mock("../repositories/sitemapRepository", () => ({ SitemapRepository: class {} }));
import { collectProfileImageSitemapEntries, buildProfileImageSitemapXml } from "../profileImageSitemap";

const origin = "https://www.thetradescout.com";
const canonicalize = (url: string) => routes.canonicalizeIssaBuildPublicUrl(url);

describe("ISSA canonical discovery without new page copy", () => {
  it.each([
    ["/u/issa-build", "/issa-build"],
    ["/p/issa-build", "/issa-build"],
    ["/u/issa-build/categories/onyx", "/issa-build/onyx"],
    ["/u/honey-onyx", "/issa-build/onyx"],
    ["/u/issa-build/inventory/honey-onyx", "/issa-build/onyx/inventory/honey-onyx"],
    ["/u/issa-build/inventory/multi-green-onyx", "/issa-build/onyx/inventory/multi-green-onyx"],
    ["/u/issa-build?stone=honey-onyx&photo=2#details", "/issa-build/onyx?stone=honey-onyx&photo=2#details"],
    ["/u/issa-build?source=local#profile-services", "/issa-build?source=local#profile-services"],
  ])("maps only the supported public identity %s", (before, after) => {
    expect(canonicalize(origin + before)).toBe(origin + after);
    expect(canonicalize(origin + after)).toBe(origin + after);
  });

  it.each([
    origin + "/api/u/issa-build",
    origin + "/u/jw-stone",
    origin + "/u/issa-build/services/kitchen-projects",
    origin + "/u/issa-build/inventory/not-a-public-product",
    origin + "/u/issa-build-private",
    "https://custom.example/u/issa-build",
    "https://www.thetradescout.com.evil.example/u/issa-build",
    "https://user@www.thetradescout.com/u/issa-build",
    "https://www.thetradescout.com:444/u/issa-build",
    "javascript:alert(1)",
    "/u/issa-build",
    "//www.thetradescout.com/u/issa-build",
  ])("does not reassign APIs, custom hosts or unknown identities: %s", (value) => {
    expect(canonicalize(value)).toBe(value);
  });

  it("deduplicates canonical sitemap locations without changing dates or the input records", () => {
    const entries = [
      { loc: origin + "/u/issa-build", lastmod: "2026-09-06", priority: "0.8" },
      { loc: origin + "/issa-build", lastmod: "2026-09-05", priority: "0.7" },
      { loc: origin + "/u/issa-build/categories/onyx", lastmod: "2026-09-04" },
    ];
    const before = JSON.stringify(entries);
    const result = prepareSitemapUrlSetEntries(entries);
    expect(result.map((entry) => entry.loc)).toEqual([origin + "/issa-build", origin + "/issa-build/onyx"]);
    expect(result[0].lastmod).toBe("2026-09-06");
    expect(result[0].priority).toBe("0.8");
    expect(JSON.stringify(entries)).toBe(before);
  });

  it("retains governed stone images and places them on the actual business and product addresses", () => {
    const entries = collectProfileImageSitemapEntries({ candidate: {
      slug: "issa-build", contentBlocks: ISSA_BUILD_PROFILE_CONTENT_BLOCKS,
      seoMeta: { imageUrl: "/images/businesses/issa-build/logo/issa-build.png" },
      updatedAt: "2026-09-06T00:00:00Z",
    } });
    expect(entries.map((entry) => entry.pageUrl)).toEqual(expect.arrayContaining([
      origin + "/issa-build", origin + "/issa-build/onyx",
      origin + "/issa-build/onyx/inventory/honey-onyx",
      origin + "/issa-build/onyx/inventory/multi-green-onyx",
    ]));
    expect(entries.some((entry) => /\/u\/issa-build(?:$|\/)/.test(entry.pageUrl))).toBe(false);
    const xml = buildProfileImageSitemapXml(entries);
    expect(xml).toContain("<image:image>");
    expect(xml).not.toMatch(/<image:(?:caption|title|geo_location)>/);
    expect(entries.every((entry) => entry.imageUrls.length > 0 && entry.lastmod === "2026-09-06")).toBe(true);
  });

  it("does not create pages from the title-only service records in the live profile", () => {
    const entries = collectProfileImageSitemapEntries({ candidate: {
      slug: "issa-build", seoMeta: { imageUrl: "/images/logo.png" },
      contentBlocks: [{ type: "services", data: { items: [{ slug: "kitchen-projects", title: "Kitchen projects in Pensacola" }] } }],
    } });
    expect(entries.some((entry) => entry.pageUrl.includes("/services/"))).toBe(false);
  });

  it("retains custom domains instead of replacing them with the platform host", () => {
    const entries = collectProfileImageSitemapEntries({ candidate: {
      slug: "sample-provider", seoMeta: { customDomain: "provider.example", imageUrl: "/logo.png" }, contentBlocks: [],
    } });
    expect(entries).toHaveLength(1);
    expect(entries[0].pageUrl).toBe("https://provider.example/");
    expect(entries[0].imageUrls).toEqual(["https://provider.example/logo.png"]);
  });

  it("links all four local services to existing content, not unavailable thin service pages", () => {
    const dom = new JSDOM(renderToStaticMarkup(<PensacolaContent />));
    const doc = dom.window.document;
    expect(PENSACOLA_DISCOVERY.profileHref).toBe("/issa-build");
    const links = [...doc.querySelectorAll('section[aria-label="Kitchen and bathroom services"] h2 a')];
    expect(links).toHaveLength(4);
    expect(links.every((link) => link.getAttribute("href") === "/issa-build#profile-services")).toBe(true);
    expect(doc.querySelector('figure a')?.getAttribute('href')).toBe('/issa-build/onyx');
    expect(doc.body.textContent).not.toMatch(/Country of origin|Thickness: 2 cm/);
    expect(doc.querySelectorAll('h1')).toHaveLength(1);
    dom.window.close();
  });

  it("keeps selected service, inquiry ownership and actual-location collection in each request link", () => {
    for (const kind of PENSACOLA_DISCOVERY.projectKinds) {
      const url = new URL(pensacolaProjectRequestHref(kind), origin);
      expect(url.pathname).toBe("/direct-connect");
      expect(url.searchParams.get("profile")).toBe("issa-build");
      expect(url.searchParams.get("subject")).toBe("service");
      expect(url.searchParams.get("title")).toBe(PENSACOLA_PROJECTS[kind].title);
      expect(url.searchParams.get("description")).toContain("Project city or ZIP:");
      expect(url.searchParams.has("county")).toBe(false);
    }
  });
});

describe("footer-only presentation boundary", () => {
  it("loads the footer rules through the shared business layout without changing preserved variants", () => {
    const source = fs.readFileSync(path.resolve('client/src/pages/profile-sites/DefaultProfileTheme.tsx'), 'utf8');
    expect(source).toContain('import "./BusinessProfileFooter.css"');
    expect(source).toContain('props.presentationVariant === "first-deliverable" || props.profileKind === "community"');
    expect(source).toContain('<PreservedDefaultProfileTheme {...props} />');
  });
  it("limits every new rule to lower-page business details or the footer and hides no controls", () => {
    const file = path.resolve('client/src/pages/profile-sites/BusinessProfileFooter.css');
    expect(fs.existsSync(file)).toBe(true);
    const css = fs.readFileSync(file, 'utf8');
    postcss.parse(css).walkRules((rule) => {
      expect(rule.selector).toMatch(/^\.business-profile \.(?:bp-aside|bp-trust|bp-footer)(?:\b|\s)/);
    });
    expect(css).not.toMatch(/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0\b/);
    expect(css).toContain('color: var(--bp-muted)');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('min-height: 44px');
  });
});
