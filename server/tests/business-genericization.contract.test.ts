import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("generic business profile and tool contracts", () => {
  it("keeps the provider setup role generic while preserving legacy compatibility values", () => {
    const source = read("client/src/pages/profile-setup.tsx");

    expect(source).toContain("I'm a Business");
    expect(source).toContain("Business Profile Setup");
    expect(source).toContain("I sell services, products, or local expertise");
    expect(source).toContain("Publish services or items people can buy");
    expect(source).toContain('setLocation("/business-owner-dashboard")');
    expect(source).toContain('"contractor_user"');
    expect(source).not.toContain("I'm a Contractor");
    expect(source).not.toContain("Contractor Profile Setup");
  });

  it("turns the business owner dashboard into a generic business operations hub", () => {
    const source = read("client/src/pages/business-owner-dashboard.tsx");

    expect(source).toContain("Business demand surfaces");
    expect(source).toContain("Browse Businesses");
    expect(source).toContain("Direct Connect");
    expect(source).toContain("Services & Items");
    expect(source).toContain("Books & Records");
    expect(source).toContain("Estimates & Materials");
    expect(source).toContain("Create Business Profile");
    expect(source).not.toContain("Find Contractors");
  });

  it("describes fixed-price offers and verification for any business, not only trades", () => {
    const source = read("client/src/pages/offer-services.tsx");

    expect(source).toContain("sell offers");
    expect(source).toContain("Add license or credentials");
    expect(source).toContain("customers can inspect you");
    expect(source).toContain("Open Direct Connect");
    expect(source).toContain("work request ready");
    expect(source).not.toContain("trade license");
    expect(source).not.toContain("potential clients");
  });

  it("documents contractor naming as a compatibility exception instead of product direction", () => {
    const audit = read("docs/audits/BUSINESS_PROFILE_GENERICIZATION_AUDIT.md");
    const scoutMatrix = read("docs/audits/SCOUT_2_CATCHUP_MATRIX.md");
    const routes = read("client/src/AppRoutes.tsx");

    expect(audit).toContain("contractor-specific language is allowed only");
    expect(audit).toContain("temporary_exception");
    expect(audit).toContain("Legacy contractor route/table names are compatibility details");
    expect(scoutMatrix).toContain("Business profile/tool language is now being genericized");
    expect(routes).toContain('path="/businesses/apply"');
    expect(routes).toContain('path="/business-dashboard"');
    expect(routes).toContain('to="/business-owner-dashboard"');
  });

  it("genericizes visible business/provider navigation and admin labels", () => {
    const adminTools = read("client/src/admin/adminTools.tsx");
    const comprehensiveNav = read("client/src/components/navigation/ComprehensiveNav.tsx");
    const simpleNav = read("client/src/components/layout/SimpleNavigation.tsx");
    const roleNav = read("client/src/components/navigation/RoleBasedNavigation.tsx");
    const preferenceNav = read(
      "client/src/components/navigation/DragDropNavigationPreferences.tsx"
    );

    expect(adminTools).toContain('label: "Commercial Businesses"');
    expect(adminTools).toContain('label: "Business Provider Settings"');
    expect(adminTools).toContain("business/provider settings");
    expect(adminTools).not.toContain('label: "Commercial Contractors"');
    expect(adminTools).not.toContain('label: "Contractor Settings"');

    expect(comprehensiveNav).toContain('label: "Local Businesses"');
    expect(comprehensiveNav).toContain('label: "Find Local Help"');
    expect(comprehensiveNav).toContain('label: "Business Dashboard"');
    expect(comprehensiveNav).toContain('label: "Apply as Business"');
    expect(comprehensiveNav).not.toContain('label: "Contractors"');
    expect(comprehensiveNav).not.toContain('label: "Contractor Dashboard"');

    expect(simpleNav).toContain('label: "Businesses"');
    expect(simpleNav).toContain('path: "/direct-connect"');
    expect(simpleNav).not.toContain('label: "Contractors"');

    expect(roleNav).toContain('label: "Business Tools"');
    expect(roleNav).toContain('href: "/business-owner-dashboard"');
    expect(roleNav).not.toContain('label: "Contractor Tools"');

    expect(preferenceNav).toContain('label: "For Businesses"');
    expect(preferenceNav).toContain('label: "Business Dashboard"');
    expect(preferenceNav).toContain('label: "Business Access"');
    expect(preferenceNav).not.toContain('label: "For Contractors"');
    expect(preferenceNav).not.toContain('label: "Contractor Dashboard"');
  });

  it("genericizes stale help, onboarding, and tour copy", () => {
    const files = [
      "client/src/components/help/HelpSystem.tsx",
      "client/src/components/onboarding/SubtleHints.tsx",
      "client/src/components/auth/OnboardingFlow.tsx",
      "client/src/components/guest-gate.tsx",
      "client/src/components/simple-floating-help.tsx",
      "client/src/components/floating-help-button.tsx",
      "client/src/components/ProgressFeedback.tsx",
      "client/src/components/auth/RoleSelection.tsx",
      "client/src/components/auth/FacebookSignup.tsx",
      "client/src/components/ui/navigation.tsx",
      "client/src/components/layout/navigation.tsx",
      "client/src/components/onboarding/tours/NewUserTour.tsx",
      "client/src/components/onboarding/tours/FeatureTour.tsx",
      "client/src/components/onboarding/tours/ContractorBoardTour.tsx",
    ];
    const source = files.map(read).join("\n");

    expect(source).toContain("Welcome, Business Owner!");
    expect(source).toContain("Local Help Tour");
    expect(source).toContain("Join as Business");
    expect(source).toContain("public local business surfaces");
    expect(source).toContain("Business Profiles");
    expect(source).not.toContain("Welcome, Contractor!");
    expect(source).not.toContain("Contractor Search Tour");
    expect(source).not.toContain("Join as Contractor");
    expect(source).not.toContain("public contractor board");
    expect(source).not.toContain("Contractor Profiles");
    expect(source).not.toContain("protect our contractors");
  });

  it("genericizes legal, footer, and SEO defaults outside explicit trade helpers", () => {
    const seoHelmet = read("client/src/components/SEOHelmet.tsx");
    const pageHead = read("client/src/components/PageHead.tsx");
    const footer = read("client/src/components/footer/legal-footer.tsx");
    const terms = read("client/src/pages/terms.tsx");
    const legalTerms = read("client/src/pages/legal/terms-of-service.tsx");
    const privacy = read("client/src/pages/legal/privacy-policy.tsx");

    expect(seoHelmet).toContain("local businesses, direct connect, exchange");
    expect(seoHelmet).toContain("verified local businesses");
    expect(seoHelmet).toContain("Find local businesses");
    expect(seoHelmet).toContain("Local Business Services");
    expect(pageHead).toContain("local businesses, direct connect, exchange");
    expect(footer).toContain('href="/direct-connect"');
    expect(footer).toContain("Find Local Help");
    expect(terms).toContain("Business Provider Responsibilities");
    expect(legalTerms).toContain("verified businesses");
    expect(legalTerms).toContain("business/provider credentials");
    expect(privacy).toContain("business/provider accounts");

    const genericSource = [pageHead, footer, terms, legalTerms, privacy].join("\n");
    expect(genericSource).not.toContain("Find Contractors");
    expect(genericSource).not.toContain("Contractor Responsibilities");
    expect(genericSource).not.toContain("contractor accounts");
    expect(genericSource).not.toContain("verified contractors");
  });

  it("captures the legacy contractor naming migration plan in order", () => {
    const migrationPlan = read("docs/audits/LEGACY_CONTRACTOR_NAMING_MIGRATION_PLAN.md");
    const audit = read("docs/audits/BUSINESS_PROFILE_GENERICIZATION_AUDIT.md");
    const scoutMatrix = read("docs/audits/SCOUT_2_CATCHUP_MATRIX.md");

    expect(migrationPlan).toContain(
      "Legacy contractor route, role, and table names remain compatibility handles"
    );
    expect(migrationPlan).toContain("temporary_exception");
    expect(migrationPlan).toContain(
      "Initial aliases are in place for provider search/top-provider lookup"
    );
    expect(migrationPlan).toContain("Helper predicates such as `isBusinessProviderRole`");
    expect(migrationPlan).toContain("Do not break `/contractors/*` routes");
    expect(audit).toContain("LEGACY_CONTRACTOR_NAMING_MIGRATION_PLAN.md");
    expect(scoutMatrix).toContain("Business-provider API aliases are now the preferred path");
  });

  it("prefers business-provider API aliases while keeping legacy compatibility", () => {
    const routes = read("server/routes.ts");
    const directConnectRoutes = read("server/routes/direct-connect.ts");
    const directConnectShell = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    const directConnectPros = read("client/src/pages/direct-connect/DirectConnectPros.tsx");
    const scoutApi = read("client/src/scout/api.ts");
    const scoutTools = read("client/src/agent/tools/scoutTools.ts");
    const adminRequestCard = read("client/src/components/admin/AdminDirectConnectRequestCard.tsx");

    expect(routes).toContain('"/api/business-providers/search"');
    expect(routes).toContain('"/api/providers/search"');
    expect(routes).toContain('"/api/business-providers/top"');
    expect(routes).toContain('"/api/contractors/top"');
    expect(directConnectRoutes).toContain("targetProviderIds");
    expect(directConnectRoutes).toContain("resolveTargetProviderIds");
    expect(directConnectRoutes).toContain("body.targetProviderIds.length > 0");
    expect(directConnectRoutes).toContain("body.targetContractorIds");
    expect(directConnectRoutes).toContain("targetContractorIds");
    expect(directConnectShell).toContain('"/api/business-providers/search"');
    expect(directConnectShell).not.toContain('"/api/providers/search"');
    expect(directConnectShell).toContain("targetProviderIds");
    expect(directConnectPros).toContain('"/api/business-providers/search"');
    expect(directConnectPros).not.toContain('"/api/providers/search"');
    expect(scoutApi).toContain("/business-providers/search");
    expect(scoutTools).toContain("/api/business-providers/search");
    expect(adminRequestCard).toContain("targetProviderIds");
    expect(adminRequestCard).toContain("Target provider IDs");
  });

  it("uses business-provider capability helpers instead of raw contractor role checks", () => {
    const sharedRoles = read("shared/roles.ts");
    const auth = read("server/auth.ts");
    const roleChecks = read("client/src/lib/roleChecks.ts");
    const comprehensiveNav = read("client/src/components/navigation/ComprehensiveNav.tsx");
    const roleBasedNav = read("client/src/components/navigation/RoleBasedNavigation.tsx");
    const navPreferences = read(
      "client/src/components/navigation/DragDropNavigationPreferences.tsx"
    );

    expect(sharedRoles).toContain("BUSINESS_PROVIDER_ROLE_ALIASES");
    expect(sharedRoles).toContain("isBusinessProviderRole");
    expect(sharedRoles).toContain("userHasBusinessProviderTools");
    expect(sharedRoles).toContain('"business_owner"');
    expect(sharedRoles).toContain('"contractor_user"');
    expect(auth).toContain("export const isBusinessProvider");
    expect(auth).toContain("userHasBusinessProviderTools(user)");
    expect(auth).toContain("export const isContractor: RequestHandler = isBusinessProvider");
    expect(roleChecks).toContain("hasBusinessProviderToolAccess");
    expect(comprehensiveNav).toContain("requiresBusinessProvider: true");
    expect(comprehensiveNav).toContain("hasBusinessProviderToolAccess(user)");
    expect(roleBasedNav).toContain("requiresBusinessProvider: true");
    expect(roleBasedNav).toContain("hasBusinessProviderToolAccess(user)");
    expect(navPreferences).toContain("isBusinessProviderRole(userRole)");
  });
});
