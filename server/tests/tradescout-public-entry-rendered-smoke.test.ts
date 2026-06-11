import { beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { buildPublicLandingHtml } from "../publicLandingHtml";
import TradeScoutLandingPage from "../../client/src/pages/TradeScoutLandingPage";

let getPostLandingRoute: typeof import("../../client/src/AppRoutes").getPostLandingRoute;

function read(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), "utf8");
}

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
      expect(html).toContain(">Claim Provider Profile</a>");
      expect(html).toContain('href="/direct-connect?source=landing_primary_cta"');
      expect(html).toContain('href="/register?role=provider"');
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

  it("registers public entry server HTML before static shell serving", () => {
    for (const relPath of ["server/index.ts", "server/index.prod.ts"]) {
      const source = read(relPath);
      const routeIndex = source.indexOf('"/landing/"');
      const staticIndex = source.indexOf("express.static(publicDistPath");

      expect(routeIndex).toBeGreaterThan(-1);
      expect(staticIndex).toBeGreaterThan(-1);
      expect(routeIndex).toBeLessThan(staticIndex);
    }
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
