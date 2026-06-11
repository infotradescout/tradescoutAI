import { beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { buildPublicLandingHtml } from "../publicLandingHtml";
import TradeScoutLandingPage from "../../client/src/pages/TradeScoutLandingPage";

let getPostLandingRoute: typeof import("../../client/src/AppRoutes").getPostLandingRoute;

beforeAll(async () => {
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    location: { pathname: "/", search: "", assign: vi.fn() },
    history: { replaceState: vi.fn() },
  });

  const mod = await import("../../client/src/AppRoutes");
  getPostLandingRoute = mod.getPostLandingRoute;
});

describe("TradeScout public entry rendered smoke", () => {
  const templateHtml = `<!doctype html>
<html>
  <head><title>TradeScout</title></head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

  it("renders public landing fallback for entry routes", async () => {
    const entryPaths = [
      "/",
      "/landing",
      "/landing/local-operating-system",
      "/lp",
      "/lp/local-operating-system",
    ];

    for (const requestPath of entryPaths) {
      const html = await buildPublicLandingHtml({
        origin: "https://www.thetradescout.com",
        templateHtml,
        requestPath,
      });

      expect(html).toContain("Connection Without Compromise");
      expect(html).toContain(">Start a Request</a>");
      expect(html).not.toContain("Ask Scout");
      expect(html).not.toContain("Scout chatbot");
      expect(html).not.toContain("Direct Connect");
      expect(html).not.toContain("lead marketplace");
      expect(html).not.toContain("lead-selling");
      expect(html).not.toContain("tool catalog");
      expect(html).not.toContain("standalone tools");
    }
  });

  it("keeps canonicalized aliases for /lp paths", async () => {
    const lpHtml = await buildPublicLandingHtml({
      origin: "https://www.thetradescout.com",
      templateHtml,
      requestPath: "/lp",
    });

    const lpVariantHtml = await buildPublicLandingHtml({
      origin: "https://www.thetradescout.com",
      templateHtml,
      requestPath: "/lp/local-operating-system",
    });

    expect(lpHtml).toContain(
      '<link rel="canonical" href="https://www.thetradescout.com/landing" />'
    );
    expect(lpVariantHtml).toContain(
      '<link rel="canonical" href="https://www.thetradescout.com/landing/local-operating-system" />'
    );
  });

  it("renders canonical public landing CTAs with stable targets", () => {
    const html = renderToStaticMarkup(React.createElement(TradeScoutLandingPage));

    expect(html).toContain("Connection Without Compromise");
    expect(html).toContain("Start a Request");
    expect(html).toContain("Claim Provider Profile");

    expect(html).toContain('href="/register?role=provider"');
    expect(html).toContain('href="/community"');
    expect(html).toContain("/direct-connect?source=landing_primary_cta");
  });

  it("keeps authenticated root handoff away from public landing", () => {
    const adminUser = {
      onboardingCompleted: true,
      profileVersion: 999,
      role: "super_admin",
      isSuperAdmin: true,
    };

    const standardUser = {
      onboardingCompleted: true,
      profileVersion: 999,
      role: "homeowner",
    };

    expect(getPostLandingRoute(adminUser)).toBe("/admin");
    expect(getPostLandingRoute(standardUser)).toBe("/direct-connect?entry=auth");
  });
});
