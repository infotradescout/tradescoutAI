import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { buildPublicPensacolaHtml } from "../publicLandingHtml";
import { preparePublicSeoHtmlForUserAgent } from "../publicSeoHtml";
import {
  PENSACOLA_DISCOVERY,
  PENSACOLA_PROJECTS,
  pensacolaProjectMessage,
  pensacolaProjectRequestHref,
  type PensacolaProjectKind,
} from "../../shared/pensacolaDiscovery";
import { getDirectConnectSection } from "../../client/src/pages/direct-connect/directConnectRoutes";
import { parseDirectConnectEntryContext } from "../../client/src/pages/direct-connect/directConnectEntryContext";

const templateHtml = fs.readFileSync(path.resolve("client/index.html"), "utf8");
const html = buildPublicPensacolaHtml({ origin: "https://www.thetradescout.com", templateHtml });
const kinds = Object.keys(PENSACOLA_PROJECTS) as PensacolaProjectKind[];

describe("Pensacola ISSA Build entry", () => {
  it.each([undefined, "Mozilla/5.0 Chrome/131.0", "Googlebot/2.1", "bingbot/2.0"])(
    "serves the same useful kitchen and bathroom entry before JavaScript for %s",
    (userAgent) => {
      const document = new JSDOM(preparePublicSeoHtmlForUserAgent(html, userAgent)).window.document;
      expect(document.querySelectorAll("#root h1")).toHaveLength(1);
      expect(document.querySelector("#root h1")?.textContent).toBe(PENSACOLA_DISCOVERY.heading);
      const links = Array.from(document.querySelectorAll("a"));
      for (const kind of kinds) {
        expect(
          links.find((link) => link.getAttribute("href") === pensacolaProjectRequestHref(kind))
            ?.textContent
        ).toBe(PENSACOLA_PROJECTS[kind].label);
      }
      expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toMatch(
        /^index, follow/
      );
      expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
        "https://www.thetradescout.com/pensacola"
      );
      expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(
        PENSACOLA_DISCOVERY.title
      );
      expect(document.querySelector("#root")?.textContent).toContain("ISSA Build");
      expect(document.querySelector("#root")?.textContent).not.toMatch(
        /Ground Zero|Conversion move|demand intent|Popular search behavior/
      );
      expect(document.querySelector('meta[name="tradescout-discovery-attribution"]')).toBeNull();
    }
  );

  it.each(kinds)(
    "keeps %s attached to ISSA Build even when opening the link in a new tab",
    (kind) => {
      const href = pensacolaProjectRequestHref(kind);
      expect(getDirectConnectSection(href)).toBe("post");
      const context = parseDirectConnectEntryContext(href);
      expect(context).toMatchObject({
        contextType: "profile",
        contextId: "issa-build",
        targetSelector: "issa-build",
        targetName: "ISSA Build",
        subjectType: "service",
        source: "pensacola-kitchen-bath",
        title: PENSACOLA_PROJECTS[kind].title,
        description: pensacolaProjectMessage(kind),
      });
      expect(context.countyFips).toBeUndefined();
      expect(context.location).toBeUndefined();
      expect(context.description).toContain("Project city or ZIP:");
    }
  );

  it("does not send these projects to JW Stone or manufacture fulfillment promises", () => {
    const document = new JSDOM(html).window.document;
    expect(document.querySelector('a[href*="jw-stone"]')).toBeNull();
    expect(document.querySelector('a[href*="steel-home-packages"]')).toBeNull();
    expect(document.querySelector('a[href="/pensacola/kitchen-remodel"]')).toBeNull();
    expect(html).not.toMatch(/same-day|in stock|Monday delivery|best-rated|five-star/i);
    expect(document.querySelector("#root")?.textContent).toContain(
      "before a quote or schedule is confirmed"
    );
  });

  it("publishes the canonical page and redirects the old kitchen entry before the SPA fallback", () => {
    const source = fs.readFileSync(path.resolve("server/index.ts"), "utf8");
    expect(source.indexOf('app.get("/pensacola"')).toBeGreaterThan(0);
    expect(source.indexOf('app.get("/pensacola"')).toBeLessThan(
      source.indexOf("express.static(publicDistPath")
    );
    expect(source).toContain('app.get("/pensacola/kitchen-remodel"');
    expect(source).toContain('res.redirect(301, "/pensacola")');
    const runtimeSitemap = fs.readFileSync(path.resolve("server/routes/profiles.ts"), "utf8");
    expect(runtimeSitemap.match(/const CORE_STATIC_PATHS = \[[\s\S]*?\];/)?.[0]).toContain(
      '"/pensacola"'
    );
    expect(fs.readFileSync(path.resolve("scripts/generate-sitemap-core.mjs"), "utf8")).toContain(
      "path: '/pensacola'"
    );
  });
});
