import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Scout routing/copy doctrine", () => {
  it("keeps landing explore routed to community and request CTA to direct connect", () => {
    const landing = read("client/src/pages/TradeScoutLandingPage.tsx");

    expect(landing).toContain('href="/community-feed"');
    expect(landing).toContain("Open Community");
    expect(landing).toContain("`/direct-connect?source=${LANDING_PRIMARY_REQUEST_SOURCE}`");
  });

  it("keeps default authenticated post-onboarding routing in direct connect", () => {
    const onboarding = read("client/src/lib/postOnboardingRoute.ts");

    expect(onboarding).toContain('return resolveDirectConnectLandingRoute({ entry: "auth" });');
    expect(onboarding).not.toContain("return SCOUT_HOME;");
  });

  it("does not route contact support flow to scout intent", () => {
    const contact = read("client/src/pages/contact.tsx");
    const routes = read("client/src/AppRoutes.tsx");

    expect(contact).toContain("/direct-connect?intent=support&source=contact-page");
    expect(contact).not.toContain("/scout?intent=support");
    expect(routes).toContain('RedirectTo to="/direct-connect?intent=support&source=contact-route"');
    expect(routes).not.toContain('RedirectTo to="/scout?intent=support&source=contact-route"');
  });

  it("removes chatbot/help framing labels from compare scout CTAs", () => {
    const files = [
      "client/src/pages/compareCategoryPage.tsx",
      "client/src/pages/compare-angi.tsx",
      "client/src/pages/compare-homeadvisor.tsx",
      "client/src/pages/compare-lead-generation.tsx",
    ];

    for (const file of files) {
      const source = read(file);
      expect(source).toContain("Search");
      expect(source).not.toContain("Search with Scout");
      expect(source).not.toContain("Talk to Scout");
    }
  });

  it("keeps banned chatbot/help Scout labels out of key runtime surfaces", () => {
    const files = [
      "client/src/scout/ScoutOS.tsx",
      "client/src/scout/ScoutThread.tsx",
      "client/src/scout/scoutIntentSorter.ts",
      "client/src/components/scout/ScoutContinueBanner.tsx",
      "client/src/pages/contact.tsx",
    ];

    const banned = [
      "Talk to Scout",
      "Ask Scout",
      "Search with Scout",
      "Continue in Scout",
      "AI chatbot",
      "help bot",
      "support bot",
      "Scout says",
      "Scout thinks",
      "Scout will contact",
      "autonomous matching",
      "auto-contact",
      "contacted for you",
    ];

    for (const file of files) {
      const source = read(file);
      for (const phrase of banned) {
        expect(source).not.toContain(phrase);
      }
    }
  });
});
