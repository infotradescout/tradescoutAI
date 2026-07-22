import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("canonical owner and profile route ownership", () => {
  it("keeps /business/:slug for directory discovery but removes owner tools beneath it", () => {
    const routes = read("client/src/AppRoutes.tsx");
    const serverIndex = read("server/index.ts");
    const businessProfileRoute = read("server/routes/business-profile.ts");

    expect(routes).toContain('<Route path="/business/:slug">');
    expect(routes).toContain('<Route path="/business/requests">');
    expect(routes).toContain('<RedirectTo to="/direct-connect/inbox" />');
    expect(routes).not.toContain("<LazyPage Component={ContractorLeads} />");
    expect(
      fs.existsSync(path.resolve(process.cwd(), "client/src/pages/contractor-leads.tsx"))
    ).toBe(false);
    expect(serverIndex).toContain("resolveCanonicalBusinessProfileRoute(slug)");
    expect(businessProfileRoute).toContain("resolveCanonicalBusinessProfileRoute(slug)");
    expect(businessProfileRoute).toContain("canonicalProfilePath: canonicalProfile?.path || null");
  });

  it("turns the old business editor into a one-way canonical profile handoff", () => {
    const redirect = read("client/src/pages/BusinessProfileEditor.tsx");

    expect(redirect).toContain("Compatibility-only handoff");
    expect(redirect).toContain("`/u/${encodeURIComponent(canonicalProfile.slug)}/edit`");
    expect(redirect).toContain('queryKey: ["/api/profiles"]');
    expect(redirect).not.toContain("UpdateProfilePayload");
    expect(redirect).not.toContain("/api/business-profile/me");
  });

  it("keeps selling a business inside Exchange and out of owner onboarding", () => {
    const routes = read("client/src/AppRoutes.tsx");
    const claims = read("client/src/scout/claimTypes.ts");
    const roleNavigation = read("client/src/components/navigation/RoleBasedNavigation.tsx");
    const comprehensiveNavigation = read("client/src/components/navigation/ComprehensiveNav.tsx");

    expect(routes).toContain('<Route path="/exchange/sell-business">');
    expect(routes).toContain('<RedirectTo to="/exchange/sell-business" />');
    expect(roleNavigation).toContain(
      '{ label: "Sell a Business", href: "/exchange/sell-business", icon: Building }'
    );
    expect(comprehensiveNavigation).toContain(
      '{ label: "Sell a Business", href: "/exchange/sell-business", icon: Building2 }'
    );
    expect(claims).not.toContain('path: "/business-listing"');
    expect(comprehensiveNavigation).not.toContain('href: "/business/analytics"');
    expect(comprehensiveNavigation).not.toContain('href: "/business/reviews"');
  });

  it("uses canonical owner destinations in active navigation and post-onboarding actions", () => {
    const actions = read("client/src/scout/resolvePostOnboardingActions.ts");
    const navigation = read("client/src/components/navigation/ComprehensiveNav.tsx");
    const routeConstants = read("client/src/lib/routes.ts");

    expect(actions).toContain("`/u/${encodeURIComponent(profileSlug)}`");
    expect(actions).toContain("`/u/${encodeURIComponent(profileSlug)}/edit`");
    expect(actions).not.toContain("`/business/${profile.slug}");
    expect(actions).not.toContain('profile.slug || "my-business"');
    expect(navigation).toContain('href: "/direct-connect/inbox"');
    expect(routeConstants).toContain('BUSINESS_REQUESTS: "/direct-connect/inbox"');
  });
});
