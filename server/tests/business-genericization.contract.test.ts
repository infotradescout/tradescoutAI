import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("generic business profile and tool contracts", () => {
  it("retires the old role-based profile setup module into universal onboarding", () => {
    const source = read("client/src/pages/profile-setup.tsx");

    expect(source).toContain('<Redirect to="/onboarding" replace />');
    expect(source).not.toContain("setup-profile");
    expect(source).not.toContain("contractor_user");
  });

  it("turns the business owner dashboard into a generic business operations hub", () => {
    const source = read("client/src/pages/business-owner-dashboard.tsx");

    expect(source).toContain("Run the work behind your profile");
    expect(source).toContain("Direct Connect inbox");
    expect(source).toContain("Services & items");
    expect(source).toContain("Books & records");
    expect(source).toContain("Estimates");
    expect(source).toContain("Create public profile");
    expect(source).toContain('queryKey: ["/api/accounting/job-flows"]');
    expect(source).toContain('queryKey: ["/api/accounting/reports/summary"]');
    expect(source).toContain('queryKey: ["/api/profile-booking/requests/incoming"]');
    expect(source).toContain('queryKey: ["/api/direct-connect/inbox", "business-dashboard"]');
    expect(source).toContain("`/api/u/${encodeURIComponent(primaryProfile!.slug!)}/views`");
    expect(source).not.toContain("$45,250");
    expect(source).not.toContain("+15.3%");
    expect(source).not.toContain('href="/business-listing"');
    expect(source).not.toContain('href="/utilities/supply-run"');
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
    const redirects = read("client/src/routing/compatibilityRedirects.ts");

    expect(audit).toContain("contractor-specific language is allowed only");
    expect(audit).toContain("temporary_exception");
    expect(audit).toContain("Legacy contractor route/table names are compatibility details");
    expect(scoutMatrix).toContain("Business profile/tool language is now being genericized");
    expect(routes).toContain('path="/businesses/apply"');
    expect(routes).toContain('path="/business-dashboard"');
    expect(routes).toContain('path="/business/requests"');
    expect(redirects).toContain('to: "/claim-my-business?source=contractor_apply_legacy"');
    expect(redirects).toContain('to: "/business-dashboard"');
    expect(redirects).toContain('to: "/direct-connect/inbox"');
  });

  it("prefers generic business routes while preserving legacy contractor compatibility", () => {
    const routes = read("client/src/AppRoutes.tsx");
    const routeConstants = read("client/src/lib/routes.ts");
    const redirects = read("client/src/routing/compatibilityRedirects.ts");

    expect(routes).toContain('path="/businesses/apply"');
    expect(routes).toContain(
      '<RedirectTo to="/claim-my-business?source=businesses_apply_legacy" />'
    );
    expect(redirects).toContain('from: "/contractors/apply"');
    expect(redirects).toContain('to: "/claim-my-business?source=contractors_apply_legacy"');
    expect(redirects).toContain('from: "/contractor-apply"');
    expect(redirects).toContain('to: "/claim-my-business?source=contractor_apply_legacy"');
    expect(routes).toContain('path="/business-dashboard"');
    expect(routes).toContain("<LazyPage Component={BusinessOwnerDashboard} />");
    expect(redirects).toContain('from: "/business-owner-dashboard"');
    expect(redirects).toContain('to: "/business-dashboard"');
    expect(routes).toContain('path="/business/requests"');
    expect(routes).toContain('<RedirectTo to="/direct-connect/inbox" />');
    expect(redirects).toContain('from: "/contractor-leads"');
    expect(redirects).toContain('from: "/contractor/leads"');
    expect(redirects).toContain('to: "/direct-connect/inbox"');

    expect(routeConstants).toContain('BUSINESS_DASHBOARD: "/business-dashboard"');
    expect(routeConstants).toContain('BUSINESS_APPLY: "/claim-my-business"');
    expect(routeConstants).toContain('BUSINESS_REQUESTS: "/direct-connect/inbox"');
    expect(routeConstants).toContain("ALIASES: COMPATIBILITY_REDIRECT_ALIASES");
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
    expect(adminTools).toContain('path: "/admin/business-provider-settings"');
    expect(adminTools).toContain('path: "/admin/contractors"');
    expect(adminTools).toContain('to="/admin/business-provider-settings"');
    expect(adminTools).toContain("business/provider settings");
    expect(adminTools).not.toContain('label: "Commercial Contractors"');
    expect(adminTools).not.toContain('label: "Contractor Settings"');

    expect(comprehensiveNav).toContain('label: "Local Businesses"');
    expect(comprehensiveNav).toContain('label: "Find Local Help"');
    expect(comprehensiveNav).toContain('label: "Business Dashboard"');
    expect(comprehensiveNav).toContain('label: "Claim or Create Business"');
    expect(comprehensiveNav).toContain(
      'href: "/claim-my-business?source=comprehensive_navigation"'
    );
    expect(comprehensiveNav).not.toContain('label: "Contractors"');
    expect(comprehensiveNav).not.toContain('label: "Contractor Dashboard"');

    expect(simpleNav).toContain('label: "Businesses"');
    expect(simpleNav).toContain('path: "/direct-connect"');
    expect(simpleNav).not.toContain('label: "Contractors"');

    expect(roleNav).toContain('label: "Business Tools"');
    expect(roleNav).toContain('href: "/business-dashboard"');
    expect(roleNav).not.toContain('label: "Contractor Tools"');

    expect(preferenceNav).toContain('label: "For Businesses"');
    expect(preferenceNav).toContain('label: "Business Dashboard"');
    expect(preferenceNav).toContain('label: "Business Access"');
    expect(preferenceNav).not.toContain('label: "For Contractors"');
    expect(preferenceNav).not.toContain('label: "Contractor Dashboard"');
  });

  it("genericizes legacy business-tool dashboard, request, and profile prompts", () => {
    const accounting = read("client/src/pages/accounting.tsx");
    const contractors = read("client/src/pages/contractors.tsx");
    const contractorSignup = read("client/src/pages/contractor-signup.tsx");
    const myTradeScout = read("client/src/pages/my-tradescout.tsx");
    const tasks = read("client/src/pages/tasks.tsx");
    const commercialDirectory = read("client/src/pages/commercial-directory.tsx");

    const source = [
      accounting,
      contractors,
      contractorSignup,
      myTradeScout,
      tasks,
      commercialDirectory,
    ].join("\n");

    expect(source).toContain("business tools");
    expect(source).toContain("Business Dashboard");
    expect(source).toContain("local business network");
    expect(source).toContain("business provider");
    expect(source).toContain("Browse local requests");
    expect(source).toContain("provider requests through Direct Connect");
    expect(source).toContain("business profile");
    expect(source).toContain("Create Business Profile");
    expect(source).not.toContain("contractor tools");
    expect(source).not.toContain("Contractor Dashboard");
    expect(source).not.toContain("contractor board");
    expect(source).not.toContain("contractor leads");
    expect(source).not.toContain("contractor requests through Direct Connect");
    expect(source).not.toContain("contractor profile before");
    expect(source).not.toContain("Create Contractor Profile");
  });

  it("genericizes local-help calls to action outside explicit contractor SEO surfaces", () => {
    const homeTips = read("client/src/components/HomeownerTipsRotator.tsx");
    const contractorSearch = read("client/src/components/search/ContractorSearch.tsx");
    const advancedSearch = read("client/src/pages/advanced-search.tsx");
    const simpleHome = read("client/src/pages/SimpleHome.tsx");
    const home = read("client/src/pages/home.tsx");
    const about = read("client/src/pages/about.tsx");
    const landingVariants = read("client/src/pages/landingVariants.ts");

    const source = [
      homeTips,
      contractorSearch,
      advancedSearch,
      simpleHome,
      home,
      about,
      landingVariants,
    ].join("\n");

    expect(source).toContain("Find Local Help");
    expect(source).toContain("Local Help Search");
    expect(source).toContain("verified TradeScout local help directory");
    expect(source).toContain("For Businesses & Providers");
    expect(source).toContain("For Businesses");
    expect(source).not.toContain("Find Contractors");
    expect(source).not.toContain("Contractor Search");
    expect(source).not.toContain("Discover verified local contractors");
    expect(source).not.toContain("Become a Contractor");
    expect(source).not.toContain("For Contractors");
  });

  it("genericizes comparison CTAs and legacy provider tool access copy", () => {
    const compareAngi = read("client/src/pages/compare-angi.tsx");
    const compareHomeAdvisor = read("client/src/pages/compare-homeadvisor.tsx");
    const compareLeadGeneration = read("client/src/pages/compare-lead-generation.tsx");
    const recommendationGenerator = read(
      "client/src/pages/contractor/recommendation-generator.tsx"
    );
    const documentation = read("client/src/pages/documentation.tsx");

    const source = [
      compareAngi,
      compareHomeAdvisor,
      compareLeadGeneration,
      recommendationGenerator,
      documentation,
    ].join("\n");

    expect(source).toContain("Find Local Help");
    expect(source).toContain("Business Provider Access Only");
    expect(source).toContain("hasBusinessProviderToolAccess(user)");
    expect(source).toContain('Link href="/business-dashboard"');
    expect(source).toContain("business profile");
    expect(source).not.toContain(">Find Contractors<");
    expect(source).not.toContain("Contractor Access Only");
    expect(source).not.toContain('user.role !== "contractor_user"');
    expect(source).not.toContain("contractor profile");
  });

  it("splits county SEO contractor intent from generic local-help action copy", () => {
    const countyPage = read("client/src/pages/county/CountyPage.tsx");
    const migrationPlan = read("docs/audits/LEGACY_CONTRACTOR_NAMING_MIGRATION_PLAN.md");
    const scoutMatrix = read("docs/audits/SCOUT_2_CATCHUP_MATRIX.md");

    expect(countyPage).toContain("How do I find contractors near");
    expect(countyPage).toContain("verified contractors");
    expect(countyPage).toContain("trusted contractors");
    expect(countyPage).toContain("Find local help near");
    expect(countyPage).toContain("Find Local Help");
    expect(countyPage).toContain("verified local providers");
    expect(countyPage).toContain("local businesses, neighbors, and professionals");
    expect(countyPage).not.toContain("Find Contractors");
    expect(countyPage).not.toContain("Find contractors near {marketName}");
    expect(countyPage).not.toContain("Join neighbors, contractors, and professionals");
    expect(migrationPlan).toContain("generic local-help/provider language");
    expect(scoutMatrix).toContain("County SEO pages now split explicit contractor keyword");
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
      "client/src/components/layout/AppShellCore.tsx",
      "client/src/components/onboarding/tours/NewUserTour.tsx",
      "client/src/components/onboarding/tours/FeatureTour.tsx",
      "client/src/components/onboarding/tours/ContractorBoardTour.tsx",
    ];
    const source = files.map(read).join("\n");

    expect(
      fs.existsSync(path.resolve(process.cwd(), "client/src/components/ui/navigation.tsx"))
    ).toBe(false);
    expect(
      fs.existsSync(path.resolve(process.cwd(), "client/src/components/layout/navigation.tsx"))
    ).toBe(false);

    expect(source).toContain("Welcome, Business Owner!");
    expect(source).toContain("Local Help Tour");
    expect(source).toContain("Set up or manage my business");
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
    expect(migrationPlan).toContain("Remaining Contractor-Language Classification");
    expect(migrationPlan).toContain("County SEO pages");
    expect(migrationPlan).toContain("Public contractor profile pages");
    expect(migrationPlan).toContain("Competitor comparison pages");
    expect(migrationPlan).toContain("Genericize broad discovery CTAs");
    expect(audit).toContain("LEGACY_CONTRACTOR_NAMING_MIGRATION_PLAN.md");
    expect(audit).toContain("Remaining contractor-language surfaces are now classified");
    expect(scoutMatrix).toContain("Business-provider API aliases are now the preferred path");
    expect(scoutMatrix).toContain("Remaining contractor-language surfaces are now classified");
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
    expect(routes).toContain('"/api/admin/business-provider-settings"');
    expect(routes).toContain('"/api/admin/contractor-settings"');
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
