import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Scout routing/copy doctrine", () => {
  it("keeps landing explore routed to community and request CTA to direct connect", () => {
    const landing = read("client/src/pages/TradeScoutLandingPage.tsx");

    expect(landing).toContain('href="/community"');
    expect(landing).toContain("Browse Local Activity");
    expect(landing).toContain("`/direct-connect?source=${LANDING_PRIMARY_REQUEST_SOURCE}`");
  });

  it("keeps default authenticated post-onboarding routing in direct connect", () => {
    const onboarding = read("client/src/lib/postOnboardingRoute.ts");

    expect(onboarding).toContain('return resolveDirectConnectLandingRoute({ entry: "auth" });');
    expect(onboarding).not.toContain("return SCOUT_HOME;");
  });

  it("does not route contact support flow to scout intent", () => {
    const contact = read("client/src/pages/contact.tsx");

    expect(contact).toContain("/direct-connect?intent=support&source=contact-page");
    expect(contact).not.toContain("/scout?intent=support");
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
      expect(source).toContain("Search with Scout");
      expect(source).not.toContain("Talk to Scout");
    }
  });
});
