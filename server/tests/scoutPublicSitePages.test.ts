import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDecisionPipelineBehaviorResponse } from "../scout/scoutBehaviorHandlers";
import { runScoutDecisionPipeline } from "../scout/scoutDecisionPipeline";
import { resolvePublicSitePageQuery } from "../scout/scoutPublicSitePages";
import { inferScoutResultIntentV1 } from "../scout/scoutResultContractV1";

const guestRequest = (message: string) => ({
  message,
  isAuthenticated: false,
  history: [],
});

describe("Scout public Site-page search", () => {
  it("renders notary pages before the generic service offer route", () => {
    const appRoutes = readFileSync("client/src/AppRoutes.tsx", "utf8");
    const serviceOffer = appRoutes.indexOf('<Route path="/services/:offerId">');
    for (const path of ["/services/remote-notary", "/services/mobile-notary"]) {
      const publicPage = appRoutes.indexOf(`<Route path="${path}">`);
      expect(publicPage).toBeGreaterThan(-1);
      expect(publicPage).toBeLessThan(serviceOffer);
    }
  });

  it.each([
    ["Find TradeScout's remote notary page", "/services/remote-notary"],
    ["Search TradeScout for public datasets", "/datasets"],
    ["Find TradeScout's public datasets page for contractors", "/datasets"],
    ["Find TradeScout's remote notary page for contractors", "/services/remote-notary"],
    ["Open the county datasets page", "/datasets/counties"],
    ["Show me the mobile notary page", "/services/mobile-notary"],
    ["Open the Scout help page", "/help/scout"],
    ["Where is the trust model page?", "/trust-model"],
  ])("returns a rendered public destination for %s", (message, expectedPath) => {
    const page = resolvePublicSitePageQuery(message);
    expect(page?.path).toBe(expectedPath);
    const appRoutes = readFileSync("client/src/AppRoutes.tsx", "utf8");
    expect(appRoutes).toContain(`<Route path="${expectedPath}">`);

    const decision = runScoutDecisionPipeline(guestRequest(message));
    expect(decision).toMatchObject({
      type: "server_behavior_handler",
      behaviorKey: "public_site_page_search",
    });
    const response = buildDecisionPipelineBehaviorResponse({
      behaviorKey: decision.behaviorKey || "",
      message,
    });
    expect(response?.actions).toEqual([
      expect.objectContaining({ type: "NAVIGATE", path: expectedPath, to: expectedPath }),
    ]);
    expect(response?.metadata).toMatchObject({
      sourceUsed: "scout_public_site_page_catalog",
      sitePageSearch: {
        coverage: "selected_public_pages",
        liveContentChecked: false,
        privateWorkChecked: false,
      },
    });
    expect(inferScoutResultIntentV1(message, response?.metadata.intent).intent).toBe("site_page_search");
  });

  it.each([
    "Open my messages page",
    "Search TradeScout for payment history",
    "Find my contractor dashboard page",
    "Open the signed share token page",
    "Find remote notary providers near me",
    "Book a remote notary",
  ])("does not turn protected or transactional intent into a public page result: %s", (message) => {
    expect(resolvePublicSitePageQuery(message)).toBeNull();
    expect(runScoutDecisionPipeline(guestRequest(message)).behaviorKey).not.toBe("public_site_page_search");
  });

  it.each([
    "Open my messages page about remote notary",
    "Open my messages page about remote notary contractors",
  ])("keeps private Messages navigation ahead of a matching public page topic: %s", (message) => {
    expect(runScoutDecisionPipeline(guestRequest(message))).toMatchObject({
      type: "blocked",
      reason: "auth_required",
      requiresAuth: true,
    });
    expect(runScoutDecisionPipeline({ ...guestRequest(message), isAuthenticated: true })).toMatchObject({
      type: "deterministic_route",
      behaviorKey: "explicit_navigation",
      metadata: { route: "/messages" },
    });
  });

  it("keeps provider browsing when no public page is requested", () => {
    const message = "Find contractors in Maricopa County";
    expect(resolvePublicSitePageQuery(message)).toBeNull();
    expect(runScoutDecisionPipeline(guestRequest(message))).toMatchObject({
      type: "server_behavior_handler",
      behaviorKey: "contractor_search_routing",
    });
  });
});
