import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPublicFindLocalBusinessesHtml,
  buildPublicForBusinessesHtml,
  buildPublicTangipahoaHtml,
} from "../publicLandingHtml";
import { preparePublicSeoHtmlForUserAgent } from "../publicSeoHtml";
import {
  BUSINESS_POPULAR_QUERIES,
  HOMEOWNER_POPULAR_QUERIES,
  getPopularQueryHref,
} from "../../client/src/lib/popularSearchQueries";
import {
  parseBusinessesWorkspaceRoute,
  resolveBusinessesWorkspaceState,
} from "../../client/src/pages/direct-connect/businessesWorkspaceState";
import { getDirectConnectSection } from "../../client/src/pages/direct-connect/directConnectRoutes";

const origin = "https://www.thetradescout.com";
const templateHtml = fs.readFileSync(path.resolve("client/index.html"), "utf8");

const pages = [
  {
    path: "/find-local-businesses",
    build: buildPublicFindLocalBusinessesHtml,
    heading: "Find local businesses without the noise",
    lateContent: "Next steps",
    link: "/county/la/tangipahoa-parish",
  },
  {
    path: "/for-businesses",
    build: buildPublicForBusinessesHtml,
    heading: "Give people a clear reason to choose your business.",
    lateContent: "Find my business",
    link: "/claim-my-business?source=for_businesses",
  },
  {
    path: "/tangipahoa",
    build: buildPublicTangipahoaHtml,
    heading: "Tangipahoa Parish first. Built local.",
    lateContent: "Best next move in Tangipahoa Parish",
    link: "/claim-my-business?stateCode=LA&countyFips=22105&source=tangipahoa",
  },
];

const links = (html: string) =>
  [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((match) => match[1].replace(/&amp;/g, "&"));

describe("complete public discovery responses", () => {
  it.each(pages)("serves the full existing content for $path without a browser global", (page) => {
    expect(typeof window).toBe("undefined");
    const raw = page.build({ origin, templateHtml });
    for (const userAgent of [
      "Googlebot/2.1",
      "OAI-SearchBot/1.0",
      "Mozilla/5.0 Chrome/126.0",
      "",
    ]) {
      const html = preparePublicSeoHtmlForUserAgent(raw, userAgent);
      const heading = /<h1\b[^>]*>(.*?)<\/h1>/s.exec(html)?.[1];
      expect(heading).toBe(page.heading);
      expect(html).toContain(page.lateContent);
      expect(links(html)).toContain(page.link);
      expect(html).toContain(`href="${origin}${page.path}"`);
      expect(html).not.toContain("<title>TradeScout</title>");
      expect(html).toMatch(/<meta\b[^>]*name="robots"[^>]*content="index, follow/);
      expect(html).not.toContain("clip:rect(0,0,0,0)");
      expect(html).not.toContain("JavaScript is required");
      expect(html.match(/<link\b[^>]*rel="canonical"/g)).toHaveLength(1);
      expect(html.match(/<meta\b[^>]*name="description"/g)).toHaveLength(1);
    }
    expect(preparePublicSeoHtmlForUserAgent(raw, "Mozilla/5.0 Chrome/126.0")).toMatch(
      /<script\b[^>]*type="module"[^>]*src=/
    );
    expect(preparePublicSeoHtmlForUserAgent(raw, "Googlebot/2.1")).not.toMatch(
      /<script\b[^>]*type="module"[^>]*src=/
    );
  });

  it.each(pages)("renders one anchor per destination without nested anchors at $path", (page) => {
    const html = page.build({ origin, templateHtml });
    let openAnchors = 0;
    for (const tag of html.matchAll(/<\/?a\b[^>]*>/gi)) {
      if (tag[0].startsWith("</")) openAnchors -= 1;
      else openAnchors += 1;
      expect(openAnchors).toBeGreaterThanOrEqual(0);
      expect(openAnchors).toBeLessThanOrEqual(1);
    }
    expect(openAnchors).toBe(0);
  });

  it("keeps all published query links on the real business browser or a stable public hub", () => {
    for (const item of [...HOMEOWNER_POPULAR_QUERIES, ...BUSINESS_POPULAR_QUERIES]) {
      const scope = /^\/trade\/([a-z0-9-]+)(?:\/([a-z]{2}))?$/.exec(item.href);
      const href = getPopularQueryHref(item);
      if (!scope) {
        expect(href).toBe(item.href);
        continue;
      }
      expect(new URL(href, origin).pathname).toBe("/direct-connect/businesses");
      expect(getDirectConnectSection(href)).toBe("pros");
      const route = parseBusinessesWorkspaceRoute(new URL(href, origin).search);
      expect(route.values).toMatchObject({
        tradeSlug: scope[1],
        stateCode: (scope[2] || "").toUpperCase(),
        countyFips: "",
        selectedProviderId: "",
      });
    }
  });

  it("replaces the broken Louisiana trade links in both public discovery bodies", () => {
    for (const build of [buildPublicFindLocalBusinessesHtml, buildPublicTangipahoaHtml]) {
      const hrefs = links(build({ origin, templateHtml }));
      expect(hrefs).not.toContain("/trade/hvac/la");
      expect(hrefs).not.toContain("/trade/electrical/la");
      const searches = hrefs
        .map((href) => new URL(href, origin))
        .filter((url) => url.pathname === "/direct-connect/businesses");
      expect(
        searches.some(
          (url) =>
            url.searchParams.get("trade") === "hvac" && url.searchParams.get("state") === "LA"
        )
      ).toBe(true);
      expect(
        searches.some(
          (url) =>
            url.searchParams.get("trade") === "electrical" && url.searchParams.get("state") === "LA"
        )
      ).toBe(true);
    }
  });

  it("starts a new trade search without restoring a previous county or selected provider", () => {
    const href = getPopularQueryHref({ query: "Louisiana HVAC", href: "/trade/hvac/la" });
    const url = new URL(href, origin);
    const storage = {
      getItem: () =>
        JSON.stringify({
          stateCode: "MD",
          countyFips: "24031",
          tradeSlug: "plumbing",
          searchQuery: "previous business",
          selectedProviderId: "previous-provider",
        }),
    } as unknown as Storage;
    expect(
      resolveBusinessesWorkspaceState({
        search: url.search,
        storage,
        authenticatedUserId: "test-user",
        pathname: url.pathname,
      })
    ).toEqual({
      stateCode: "LA",
      countyFips: "",
      tradeSlug: "hvac",
      searchQuery: "",
      selectedProviderId: "",
    });
  });
});
