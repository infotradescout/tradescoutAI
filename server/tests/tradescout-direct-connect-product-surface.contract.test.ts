import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("TradeScout Direct Connect primary product surface", () => {
  const appRoutes = read("client/src/AppRoutes.tsx");
  const publicLanding = read("client/src/pages/TradeScoutLandingPage.tsx");
  const serverLanding = read("server/publicLandingHtml.ts");
  const postOnboardingRoute = read("client/src/lib/postOnboardingRoute.ts");
  const navConfig = read("client/src/config/nav.ts");
  const roleNav = read("client/src/components/navigation/RoleBasedNavigation.tsx");
  const businessProfileView = read("client/src/pages/BusinessProfileView.tsx");

  it("treats Direct Connect as the named public request product", () => {
    expect(publicLanding).toContain("Direct Connect");
    expect(serverLanding).toContain("Direct Connect");
    expect(publicLanding).toContain("`/direct-connect?source=${LANDING_PRIMARY_REQUEST_SOURCE}`");
    expect(serverLanding).toContain('href="/direct-connect?source=landing_primary_cta"');
    expect(publicLanding).toContain("Make A Request");
    expect(serverLanding).toContain("Make A Request");
  });

  it("keeps Direct Connect routes available as the request-start surface", () => {
    expect(appRoutes).toContain("const DirectConnectShell = React.lazy");
    expect(appRoutes).toContain('<Route path="/direct-connect">');
    expect(appRoutes).toContain('<Route path="/direct-connect/:rest*">');
    expect(appRoutes).toContain("<LazyPage Component={DirectConnectShell} />");
    expect(appRoutes).toContain('<RedirectTo to="/direct-connect" />');
  });

  it("keeps authenticated standard users landing in Direct Connect by default", () => {
    expect(postOnboardingRoute).toContain('export const DIRECT_CONNECT_HOME = "/direct-connect"');
    expect(postOnboardingRoute).toContain("export const DEFAULT_LANDING = DIRECT_CONNECT_HOME");
    expect(postOnboardingRoute).toContain(
      'return resolveDirectConnectLandingRoute({ entry: "auth" });'
    );
    expect(postOnboardingRoute).toContain(
      "return withDirectConnectEntry(DIRECT_CONNECT_HOME, entry);"
    );
  });

  it("keeps provider claim/profile paths available beside Direct Connect", () => {
    expect(publicLanding).toContain("/claim-my-business?source=landing_business");
    expect(serverLanding).toContain('href="/claim-my-business?source=landing_business"');
    expect(appRoutes).toContain('<Route path="/claim-my-business">');
    expect(businessProfileView).toContain("const directConnectUrl = `/direct-connect?");
    expect(businessProfileView).toContain("const claimUrl = `/claim-my-business?");
    expect(businessProfileView).toContain("Claim or connect");
    expect(businessProfileView).toContain("Direct Connect");
  });

  it("keeps community/explore secondary to Direct Connect as the primary product CTA", () => {
    const requestCtaIndex = publicLanding.indexOf("LANDING_PRIMARY_REQUEST_SOURCE");
    const communityHrefIndex = publicLanding.indexOf('href="/community-feed"');

    expect(requestCtaIndex).toBeGreaterThan(-1);
    expect(communityHrefIndex).toBeGreaterThan(-1);
    expect(requestCtaIndex).toBeLessThan(communityHrefIndex);
    expect(publicLanding).toContain("Open Community");
  });

  it("places Direct Connect in primary navigation understanding", () => {
    expect(navConfig).toContain('{ label: "Direct Connect", href: "/direct-connect" }');
    expect(roleNav).toContain('label: "Direct Connect"');
    expect(roleNav).toContain('href: "/direct-connect"');
  });

  it("blocks internal architecture descriptions while allowing the product name", () => {
    const publicCopy = [publicLanding, serverLanding].join("\n\n").toLowerCase();

    expect(publicCopy).toContain("direct connect");
    expect(publicCopy).not.toContain("routing algorithm");
    expect(publicCopy).not.toContain("authority layer");
    expect(publicCopy).not.toContain("handoff doctrine");
    expect(publicCopy).not.toContain("backend routing system");
    expect(publicCopy).not.toContain("operating system architecture");
  });
});
