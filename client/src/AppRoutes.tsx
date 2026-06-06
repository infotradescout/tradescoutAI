import React, { lazy, memo, Suspense, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { ErrorBoundary } from "./components/ui/error-boundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./hooks/useAuth";

import { PageLoadingSpinner } from "./components/LoadingSpinner";
import { hasAdminUiAccess } from "./lib/roleChecks";
import { getRecentActivity } from "@/agent/activity";
import {
  getBusinessOnboardingRoute,
  getOnboardingEntryRoute as routeGetOnboardingEntryRoute,
  getPostLandingRoute as routeGetPostLandingRoute,
  isBusinessOnboardingAllowedPath,
  isOnboardingExemptPath,
  isSafeNextPath,
  storeOnboardingNext,
  userHasProfileBasics as routeUserHasProfileBasics,
  userNeedsOnboarding as routeUserNeedsOnboarding,
} from "@/lib/postOnboardingRoute";
import {
  evaluateFeatureUnlocks,
  isFeatureUnlocked,
  type AdvancedFeatureId,
} from "@/lib/progressiveFeatureUnlocks";
import { FEATURE_PROGRESSIVE_EXPOSURE_CORE_NAV_GATING } from "@shared/governanceFlags";

const PageLoader = memo(function PageLoader() {
  return <PageLoadingSpinner message="Loading TradeScout..." />;
});

export const getOnboardingEntryRoute = routeGetOnboardingEntryRoute;
export const getPostLandingRoute = routeGetPostLandingRoute;
export const userNeedsOnboarding = routeUserNeedsOnboarding;
export const userHasProfileBasics = routeUserHasProfileBasics;

function isLegacyRootScoutQuery(rest: string): boolean {
  if (!rest || !rest.startsWith("?")) return false;
  const query = rest.slice(1).split("#", 1)[0] || "";
  if (!query) return false;
  const params = new URLSearchParams(query);
  return params.has("prompt") || params.has("intent");
}

const RedirectTo = memo(function RedirectTo({ to }: { to: string }) {
  const [location, navigate] = useLocation();

  useEffect(() => {
    const raw = String(location || "");
    const restIdx = raw.search(/[?#]/);
    const rest = restIdx >= 0 ? raw.slice(restIdx) : "";
    const mergeTargetWithRest = (target: string, sourceRest: string) => {
      if (!sourceRest) return target;
      if (sourceRest.startsWith("#")) return `${target}${sourceRest}`;
      if (!sourceRest.startsWith("?")) return target;

      const [targetBase, targetHash = ""] = target.split("#", 2);
      const [targetPath, targetQuery = ""] = targetBase.split("?", 2);
      const targetParams = new URLSearchParams(targetQuery);
      const sourceParams = new URLSearchParams(sourceRest.slice(1));

      sourceParams.forEach((value, key) => {
        if (!targetParams.has(key)) {
          targetParams.set(key, value);
        }
      });

      const mergedQuery = targetParams.toString();
      const mergedBase = mergedQuery ? `${targetPath}?${mergedQuery}` : targetPath;
      return targetHash ? `${mergedBase}#${targetHash}` : mergedBase;
    };

    const target = mergeTargetWithRest(to, rest);
    if (raw !== target) navigate(target);
  }, [location, navigate, to]);

  return null;
});

const HardRedirectTo = memo(function HardRedirectTo({ to }: { to: string }) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.location.assign(to);
    }
  }, [to]);

  return null;
});

const AuthenticatedOnboardingGate = memo(function AuthenticatedOnboardingGate() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;

    if (hasAdminUiAccess(user)) return;

    const raw = String(location || "/");
    const restIdx = raw.search(/[?#]/);
    const pathOnly = (restIdx >= 0 ? raw.slice(0, restIdx) : raw).replace(/\/+$/, "") || "/";
    const businessOnboardingExempt = isBusinessOnboardingAllowedPath(
      pathOnly,
      (user as Record<string, any>) || null
    );

    if (!userNeedsOnboarding(user)) {
      if (businessOnboardingExempt) return;
      const businessTarget = getBusinessOnboardingRoute(user as Record<string, any>);
      if (businessTarget && raw !== businessTarget) {
        navigate(businessTarget);
      }
      return;
    }
    if (isOnboardingExemptPath(pathOnly)) return;

    const fullPath = raw.startsWith("/") ? raw : `/${raw}`;
    // Persist the deep-link in sessionStorage so it survives the multi-step funnel
    if (isSafeNextPath(fullPath)) {
      storeOnboardingNext(fullPath);
    }
    const next = encodeURIComponent(fullPath);
    const entryRoute = getOnboardingEntryRoute(user);
    const target = `${entryRoute}?next=${next}`;
    if (raw !== target) {
      navigate(target);
    }
  }, [user, isAuthenticated, isLoading, location, navigate]);

  return null;
});

const LandingAccessGate = memo(function LandingAccessGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <>{children}</>;

  const target = getPostLandingRoute(user);
  return <RedirectTo to={target} />;
});

const ProgressiveFeatureGate = memo(function ProgressiveFeatureGate({
  featureId,
  children,
}: {
  featureId: AdvancedFeatureId;
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  if (!FEATURE_PROGRESSIVE_EXPOSURE_CORE_NAV_GATING) {
    return <>{children}</>;
  }

  if (hasAdminUiAccess(user)) {
    return <>{children}</>;
  }

  const snapshot = evaluateFeatureUnlocks({
    user,
    recentActivity: getRecentActivity(),
  });

  if (isFeatureUnlocked(snapshot, featureId)) {
    return <>{children}</>;
  }

  return <RedirectTo to={`/scout?unlock=${encodeURIComponent(featureId)}`} />;
});

// Root landing router: send non-authenticated users to create account, authenticated users to appropriate dashboard
const RootLanding = memo(function RootLanding() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    const raw = String(location || "");
    const restIdx = raw.search(/[?#]/);
    const pathOnly = (restIdx >= 0 ? raw.slice(0, restIdx) : raw).replace(/\/+$/, "") || "/";
    const rest = restIdx >= 0 ? raw.slice(restIdx) : "";

    // Avoid redirect loops if we're already off root.
    if (pathOnly !== "/") return;

    // Wait for auth to load before redirecting
    if (isLoading) return;

    if (!isAuthenticated) {
      // Back-compat: older Scout links were encoded as '/?prompt=...'
      if (isLegacyRootScoutQuery(rest)) {
        navigate(`/scout${rest}`);
        return;
      }

      // Public users land on the marketing surface; auth starts from CTA buttons.
      navigate(`/landing${rest}`);
    } else {
      navigate(getPostLandingRoute(user));
    }
  }, [user, isAuthenticated, isLoading, location, navigate]);

  return null;
});

// Lazy load all pages by category for better code splitting
const AppShell = React.lazy(() => import("./components/layout/AppShell"));
const CommunityPageShell = React.lazy(() =>
  import("./shells/CommunityPageShell").then((module) => ({
    default: module.CommunityPageShell,
  }))
);
const GroupsShell = React.lazy(() =>
  import("./shells/GroupsShell").then((module) => ({
    default: module.GroupsShell,
  }))
);
const HOADashboardShell = React.lazy(() =>
  import("./shells/HOADashboardShell").then((module) => ({
    default: module.HOADashboardShell,
  }))
);
const HOAManagementShell = React.lazy(() =>
  import("./shells/HOAManagementShell").then((module) => ({
    default: module.HOAManagementShell,
  }))
);
const Foundation = React.lazy(() => import("./pages/foundation"));
const ScoutOS = React.lazy(() => import("./scout"));
const ScoutInfoPage = React.lazy(() => import("./pages/scout-info"));
const SmartHome = React.lazy(() => import("./SmartHome"));
const SupplyRunHome = React.lazy(() => import("./pages/supply-run"));
const SupplyRunNew = React.lazy(() => import("./pages/supply-run-new"));
const SupplyRunDetail = React.lazy(() => import("./pages/supply-run-detail"));
const GruntOrder = React.lazy(() => import("./pages/grunt-order"));
const GruntOrderDetail = React.lazy(() => import("./pages/grunt-order-detail"));
const SupplierProcurementQuote = React.lazy(() => import("./pages/supplier-procurement-quote"));

// Core Pages
// Businesses: canonical path is the licensed/verified business/provider search
const ContractorProfile = React.lazy(() => import("./pages/contractor-profile"));
const DailyDeals = React.lazy(() => import("./pages/daily-deals"));
const TradeDealsPage = React.lazy(() => import("./pages/trade-deals-lucky"));
const HelpDemo = React.lazy(() => import("./pages/help-demo"));
const TestPage = React.lazy(() => import("./pages/test-page"));
const Profile = React.lazy(() => import("./pages/ProfilePage"));

// Authentication & User Management
const Login = React.lazy(() => import("./pages/login"));
const AddressVerification = React.lazy(() => import("./pages/address-verification"));
const VerifyEmail = React.lazy(() => import("./pages/verify-email"));
const CheckEmail = React.lazy(() => import("./pages/check-email"));
const Install = React.lazy(() => import("./pages/install"));
const CreateAccount = React.lazy(() => import("./pages/create-account"));
const HardrockLanding = React.lazy(() => import("./pages/hardrock"));
const Landing = React.lazy(() => import("./pages/landing"));
const PreScoutSetup = React.lazy(() => import("./pages/pre-scout-setup"));
const OnboardingIntent = React.lazy(() => import("./pages/onboarding-intent"));
const OnboardingProfile = React.lazy(() => import("./pages/onboarding-profile"));
const ClaimMyBusiness = React.lazy(() => import("./pages/claim-my-business"));
const ResetPassword = React.lazy(() => import("./pages/reset-password"));
const BusinessDirectoryPage = React.lazy(() => import("./pages/business-directory"));

// Business/provider features. Some imported pages retain legacy contractor filenames.
const OfferServices = React.lazy(() => import("./pages/offer-services"));
const ContractorApply = OfferServices;
const ProfilePurchaseStatus = React.lazy(() => import("./pages/profile-purchase-status"));
const ContractorsTop = React.lazy(() => import("./pages/contractors-top"));
const BusinessListing = React.lazy(() => import("./pages/business-listing"));
const BusinessOwnerDashboard = React.lazy(() => import("./pages/business-owner-dashboard"));

// Admin Features (heavy components)
const AdminShell = React.lazy(() => import("./pages/admin"));

// Marketplace & Social
const ContractorLeads = React.lazy(() => import("./pages/contractor-leads"));
const Chat = React.lazy(() => import("./pages/chat"));
const Messages = React.lazy(() => import("./pages/messages"));
const SavedAds = React.lazy(() => import("./pages/saved-ads"));
const Affiliate = React.lazy(() => import("./pages/affiliate"));
const Boosts = React.lazy(() => import("./pages/boosts"));

// HOA & Groups
const Groups = React.lazy(() => import("./pages/groups"));
const GroupDetail = React.lazy(() => import("./pages/group-detail"));
const HoaManagement = React.lazy(() => import("./pages/hoa-management"));
const HoaResidents = React.lazy(() => import("./pages/hoa-residents"));
const HoaMaintenance = React.lazy(() => import("./pages/hoa-maintenance"));

// Community Builder
const CommunityBuilderDashboard = React.lazy(() => import("./pages/community-builder/dashboard"));
const CommunityBuilderNewContribution = React.lazy(
  () => import("./pages/community-builder/new-contribution")
);
const CommunityBuilderContributionDetail = React.lazy(
  () => import("./pages/community-builder/contribution-detail")
);
const CommunityBuilderContributionSuccess = React.lazy(
  () => import("./pages/community-builder/contribution-success")
);
const ProfileCommunity = React.lazy(() => import("./pages/community-builder/profile-community"));
const CountyTransparency = React.lazy(() => import("./pages/county/transparency"));

// Additional Features
const Exchange = React.lazy(() => import("./pages/exchange"));
const MetalsExchange = React.lazy(() => import("./pages/exchange-metals"));
const ExchangeRentalProperty = React.lazy(() => import("./pages/exchange-rental-property"));
const ExchangeRentalEquipment = React.lazy(() => import("./pages/exchange-rental-equipment"));
// Per-category Exchange pages
const ExchangeCategoryBusiness = React.lazy(() => import("./pages/exchange/ExchangeBusinessPage"));
const ExchangeCategoryVehicles = React.lazy(() => import("./pages/exchange/ExchangeVehiclesPage"));
const ExchangeCategoryConstruction = React.lazy(
  () => import("./pages/exchange/ExchangeConstructionPage")
);
const ExchangeCategoryTools = React.lazy(() => import("./pages/exchange/ExchangeToolsPage"));
const ExchangeCategoryFurniture = React.lazy(
  () => import("./pages/exchange/ExchangeFurniturePage")
);
const ExchangeCategoryFarm = React.lazy(() => import("./pages/exchange/ExchangeFarmPage"));
const ExchangeCategoryBusinessEquipment = React.lazy(
  () => import("./pages/exchange/ExchangeBusinessEquipmentPage")
);
const ExchangeCategoryElectronics = React.lazy(
  () => import("./pages/exchange/ExchangeElectronicsPage")
);
const ExchangeCategorySports = React.lazy(() => import("./pages/exchange/ExchangeSportsPage"));
const ExchangeCategoryCollectibles = React.lazy(
  () => import("./pages/exchange/ExchangeCollectiblesPage")
);
const ExchangeCategoryJewelry = React.lazy(() => import("./pages/exchange/ExchangeJewelryPage"));
const ExchangeCategoryLocalFood = React.lazy(
  () => import("./pages/exchange/ExchangeLocalFoodPage")
);
const ExchangeCategoryOther = React.lazy(() => import("./pages/exchange/ExchangeOtherPage"));
const ExchangeListingDetail = React.lazy(() => import("./pages/exchange/ExchangeListingDetail"));
const ExchangeSellerDashboard = React.lazy(
  () => import("./pages/exchange/ExchangeSellerDashboard")
);
const MarketplaceListing = React.lazy(() => import("./pages/marketplace-listing"));
const HandmadeMarketplace = React.lazy(() => import("./pages/handmade-marketplace"));
const Leaderboard = React.lazy(() => import("./pages/leaderboard"));
const TradePartnersHub = React.lazy(() => import("./pages/TradePartnersHub"));
const TradePartnerCountyLanding = React.lazy(() => import("./pages/TradePartnerCountyLanding"));
const TradePartnerCumulusLanding = React.lazy(() => import("./pages/TradePartnerCumulusLanding"));
const PropertyListing = React.lazy(() => import("./pages/property-listing"));
const HomeScoutListing = React.lazy(() => import("./pages/homescout-listing"));
const HomeScoutCounty = React.lazy(() => import("./pages/homescout-county"));
const Accounting = React.lazy(() => import("./pages/accounting"));
const FinancesInvoices = React.lazy(() => import("./pages/finances-invoices"));
const FinancesExpenses = React.lazy(() => import("./pages/finances-expenses"));
// Per-tab finances workspaces
const FinancesClients = React.lazy(() => import("./pages/finances-clients"));
const FinancesMaterials = React.lazy(() => import("./pages/finances-materials"));
const FinancesEstimates = React.lazy(() => import("./pages/finances-estimates"));
const FinancesJobs = React.lazy(() => import("./pages/finances-jobs"));
const FinancesEmployees = React.lazy(() => import("./pages/finances-employees"));
const FinancesPayroll = React.lazy(() => import("./pages/finances-payroll"));
const FinancesVendors = React.lazy(() => import("./pages/finances-vendors"));
const FinancesBankAccounts = React.lazy(() => import("./pages/finances-bank-accounts"));
const FinancesReports = React.lazy(() => import("./pages/finances-reports"));
const FinancesRecords = React.lazy(() => import("./pages/finances-records"));
const FinancesSettings = React.lazy(() => import("./pages/finances-settings"));
const DirectConnectShell = React.lazy(() => import("./pages/direct-connect/DirectConnectShell"));
const DirectConnectSharePage = React.lazy(() => import("./pages/direct-connect-share"));
// NOTE: CommunityFeedOld mock has been quarantined to client/src/playgrounds/CommunityFeedMock.tsx
// and should not be routed. This lazy import is intentionally removed.
const CommunityModerationDemo = React.lazy(() => import("./pages/CommunityModerationDemo"));
const Checkout = React.lazy(() => import("./pages/checkout"));
const PaymentSuccess = React.lazy(() => import("./pages/payment-success"));
const PaymentHistory = React.lazy(() => import("./pages/payment-history"));
const Wallet = React.lazy(() => import("./pages/wallet"));

// Marketing tools (personal)
const ScoutFitters = React.lazy(() => import("./pages/marketing/ScoutFitters"));
const ZeroBaseFeeCamera = React.lazy(() => import("./pages/zero-base-fee-camera"));
const RequestQuote = React.lazy(() => import("./pages/request-quote"));
const CommercialDirectoryPage = React.lazy(() => import("./pages/commercial-directory"));
const CommercialProjectLandingPage = React.lazy(() => import("./pages/commercial-project-landing"));
const SavedContractors = React.lazy(() => import("./pages/saved-contractors"));
const Notifications = React.lazy(() => import("./pages/notifications"));
const Settings = React.lazy(() => import("./pages/settings"));
const ProfileSettings = React.lazy(() => import("./pages/ProfileSettings"));
const PublicProfileView = React.lazy(() => import("./pages/PublicProfileView"));
const BusinessProfileView = React.lazy(() => import("./pages/BusinessProfileView"));
const BusinessProfileEditor = React.lazy(() => import("./pages/BusinessProfileEditor"));
const ProfileSiteView = React.lazy(() => import("./pages/ProfileSiteView"));
const ProfileSiteEditor = React.lazy(() => import("./pages/ProfileSiteEditor"));
const Help = React.lazy(() => import("./pages/help"));
const HowTradeScoutWorks = React.lazy(() => import("./pages/how-tradescout-works"));
const Invite = React.lazy(() => import("./pages/invite"));
const DashboardSettings = React.lazy(() => import("./pages/DashboardSettings"));
const DashboardJobs = React.lazy(() => import("./pages/dashboard-jobs"));
const RecommendationGeneratorPage = React.lazy(
  () => import("./pages/contractor/recommendation-generator")
);

// Role-specific Dashboards (heavy components)
const HomeownerDashboard = React.lazy(() => import("./pages/homeowner-dashboard"));
const RealtorDashboard = React.lazy(() => import("./pages/realtor-dashboard"));
const StoryGeneratorPage = React.lazy(() => import("./pages/StoryGeneratorPage"));
// DealerDashboard deprecated in favor of unified dashboard
// const DealerDashboard = React.lazy(() => import('./pages/dealer-dashboard'));
const CarSalesmanDashboard = React.lazy(() => import("./pages/car-salesman-dashboard"));
const HelperDashboard = React.lazy(() => import("./pages/helper-dashboard"));
const HelperPublicProfile = React.lazy(() => import("./pages/HelperPublicProfile"));
// Role-specific KPI dashboards (insurance/property/mortgage) deprecated
// const InsuranceAgentDashboard = React.lazy(() => import('./pages/insurance-agent-dashboard'));
// const PropertyManagerDashboard = React.lazy(() => import('./pages/property-manager-dashboard'));
// const MortgageBrokerDashboard = React.lazy(() => import('./pages/mortgage-broker-dashboard'));
// const StaffDashboard = React.lazy(() => import('./pages/staff-dashboard'));

// Applications
const RealtorApplication = React.lazy(() => import("./pages/realtor-application"));
const CarSalesmanApplication = React.lazy(() => import("./pages/car-salesman-application"));

// Legal & Info
const Terms = React.lazy(() => import("./pages/terms"));
const Privacy = React.lazy(() => import("./pages/privacy"));
const PrivacyRequest = React.lazy(() => import("./pages/privacy-request"));
const About = React.lazy(() => import("./pages/about"));
const Pricing = React.lazy(() => import("./pages/pricing"));
const HowItWorks = React.lazy(() => import("./pages/how-it-works"));
const ForBusinessesPage = React.lazy(() => import("./pages/for-businesses"));
const FindLocalBusinessesPage = React.lazy(() => import("./pages/find-local-businesses"));
const PensacolaPage = React.lazy(() => import("./pages/pensacola"));
const PensacolaClusterPage = React.lazy(() => import("./pages/pensacola-cluster"));
const TangipahoaPage = React.lazy(() => import("./pages/tangipahoa"));
const TrustModel = React.lazy(() => import("./pages/trust-model"));
const DirectConnectInfo = React.lazy(() => import("./pages/direct-connect-info"));
const GiveawayRules = React.lazy(() => import("./pages/giveaway-rules"));
const CompareHub = React.lazy(() => import("./pages/compare"));
const CompareAngi = React.lazy(() => import("./pages/compare-angi"));
const CompareHomeServices = React.lazy(() => import("./pages/compare-home-services"));
const CompareRealEstate = React.lazy(() => import("./pages/compare-real-estate"));
const CompareCommunity = React.lazy(() => import("./pages/compare-community"));
const CompareLocalBusiness = React.lazy(() => import("./pages/compare-local-business"));
const CompareCoordination = React.lazy(() => import("./pages/compare-coordination"));
const CompareLeadGeneration = React.lazy(() => import("./pages/compare-lead-generation"));
const CompareHomeAdvisor = React.lazy(() => import("./pages/compare-homeadvisor"));
const RemoteNotary = React.lazy(() => import("./pages/legal/remote-notary"));
const NotFound = React.lazy(() => import("./pages/not-found"));
const Unauthorized = React.lazy(() => import("./pages/Unauthorized"));

// Marketing & Promotions
const Promotions = React.lazy(() => import("./pages/promotions"));
const AdCreator = React.lazy(() => import("./pages/ad-creator"));
const Analytics = React.lazy(() => import("./pages/analytics"));
const ProjectTracker = React.lazy(() => import("./pages/lead-management"));

// Additional Missing Pages
const CountyHub = React.lazy(() => import("./pages/county-hub"));
const CountyPage = React.lazy(() => import("./pages/county/CountyPage"));
const TradeDirectoryPage = React.lazy(() => import("./pages/trade/TradeDirectoryPage"));
const TradeOverviewPage = React.lazy(() => import("./pages/trade/TradeOverviewPage"));
const TradeStatePage = React.lazy(() => import("./pages/trade/TradeStatePage"));
const TradeCountyPage = React.lazy(() => import("./pages/trade/TradeCountyPage"));
const TradeCityPage = React.lazy(() => import("./pages/trade/TradeCityPage"));
const CityPage = React.lazy(() => import("./pages/city/CityPage"));
const BestTradeCountyPage = React.lazy(() => import("./pages/best/BestTradeCountyPage"));
const BestTradeCityPage = React.lazy(() => import("./pages/best/BestTradeCityPage"));
const CountyRecentPage = React.lazy(() => import("./pages/recent/CountyRecentPage"));
const CityRecentPage = React.lazy(() => import("./pages/recent/CityRecentPage"));
const TradeCountyRecentPage = React.lazy(() => import("./pages/recent/TradeCountyRecentPage"));
const TradeCityRecentPage = React.lazy(() => import("./pages/recent/TradeCityRecentPage"));
const DatasetsLandingPage = React.lazy(() => import("./pages/datasets/DatasetsLandingPage"));
const DatasetsTradesPage = React.lazy(() => import("./pages/datasets/DatasetsTradesPage"));
const DatasetsCountiesPage = React.lazy(() => import("./pages/datasets/DatasetsCountiesPage"));
const DatasetsCitiesPage = React.lazy(() => import("./pages/datasets/DatasetsCitiesPage"));
const MapsPage = React.lazy(() => import("./pages/maps"));
const Verification = React.lazy(() => import("./pages/verification"));
const IdentityVerification = React.lazy(() => import("./pages/identity-verification"));
const InsuranceVerification = React.lazy(() => import("./pages/insurance-verification"));
const LicenseVerification = React.lazy(() => import("./pages/license-verification"));
const BackgroundCheck = React.lazy(() => import("./pages/background-check"));
const Compliance = React.lazy(() => import("./pages/compliance"));
const Documentation = React.lazy(() => import("./pages/documentation"));

// New Complete Pages
const CRM = React.lazy(() => import("./pages/crm"));
const VehicleMarketplace = React.lazy(() => import("./pages/vehicle-marketplace"));
const HOADashboard = React.lazy(() => import("./pages/hoa-dashboard"));
const RealEstateMarketplace = React.lazy(() => import("./pages/real-estate-marketplace"));
const CoffeeCompany = React.lazy(() => import("./pages/coffee-company"));
const CountyDirectory = React.lazy(() => import("./pages/county-directory"));
const ApplicationTracker = React.lazy(() => import("./pages/application-tracker"));
const ResourceCenter = React.lazy(() => import("./pages/resource-center"));
const MembershipPortal = React.lazy(() => import("./pages/membership-portal"));
const TrainingCenter = React.lazy(() => import("./pages/training-center"));
const RoleHubPage = React.lazy(() => import("./pages/role-hub"));
const NotesPage = React.lazy(() => import("./pages/notes"));

// Debug / experimental views
const ScoutLandingLite = React.lazy(() => import("./experiments/scout-landing-lite"));

// Advanced Social & Integration Features
const SocialIntegration = React.lazy(() => import("./pages/social-integration"));
const CommunityFeed = React.lazy(() => import("./pages/community-feed"));
const CommunityProfile = React.lazy(() => import("./pages/CommunityProfile"));
const ReferralDashboard = React.lazy(() => import("./pages/referral-dashboard"));
const EventManagement = React.lazy(() => import("./pages/event-management"));
const APIIntegrations = React.lazy(() => import("./pages/api-integrations"));

// Interactive Action Pages
const ScheduleConsultation = React.lazy(() => import("./pages/schedule-consultation"));

// Car Sales Pages
const CarSalesNewListing = React.lazy(() => import("./pages/car-sales-new-listing"));
const CarSalesCustomers = React.lazy(() => import("./pages/car-sales-customers"));
const CarSalesFinancing = React.lazy(() => import("./pages/car-sales-financing"));
const CarSalesTradeIn = React.lazy(() => import("./pages/car-sales-trade-in"));
const CarSalesPaymentCalculator = React.lazy(() => import("./pages/car-sales-payment-calculator"));
const CarSalesVinLookup = React.lazy(() => import("./pages/car-sales-vin-lookup"));
const CarSalesAppointments = React.lazy(() => import("./pages/car-sales-appointments"));
const CarSalesFollowUp = React.lazy(() => import("./pages/car-sales-follow-up"));

// Realtor Pages
const RealtorClients = React.lazy(() => import("./pages/realtor-clients"));
const RealtorMarketAnalysis = React.lazy(() => import("./pages/realtor-market-analysis"));
const RealtorConnections = React.lazy(() => import("./pages/realtor-connections"));
const ConnectionsPage = React.lazy(() => import("./pages/connections"));
const RealtorCalculator = React.lazy(() => import("./pages/realtor-calculator"));
const RealtorCMA = React.lazy(() => import("./pages/realtor-cma"));
const RealtorAppointments = React.lazy(() => import("./pages/realtor-appointments"));
const RealtorContacts = React.lazy(() => import("./pages/realtor-contacts"));

// Lazy component wrapper for better error handling
const LazyPage = memo(function LazyPage({
  Component,
  fallback = <PageLoader />,
}: {
  Component: React.LazyExoticComponent<React.ComponentType<object>>;
  fallback?: React.ReactNode;
}) {
  const repairAndReload = async () => {
    try {
      // Reset the chunk recovery session guard so ErrorBoundary can attempt auto-repair again.
      sessionStorage.removeItem("ts_chunk_recovery_attempted");
    } catch {
      // ignore
    }

    // Route through the boot-level reset handler so we clear caches + SW in one place.
    // This prevents "new version flashes then old version" when a stale SW or cache serves old assets.
    const url = new URL(window.location.href);
    url.searchParams.set("__reset", "1");
    window.location.replace(url.toString());
  };

  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-[calc(var(--app-height)-var(--top-nav-h)-var(--bottom-nav-h))] flex items-center justify-center px-4">
          <div className="w-full max-w-lg rounded-2xl border border-tsBorder bg-tsCard p-5 text-tsTextMain shadow-xl">
            <h2 className="text-xl font-semibold text-white">This page hit an error.</h2>
            <p className="mt-2 text-sm text-tsTextMuted">
              Scout is still running. Reload this page or return to Scout to continue.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-tsBorder px-4 py-2 text-xs font-semibold text-tsTextMain hover:bg-white/5"
                onClick={() => window.location.assign("/scout")}
              >
                Go to Scout
              </button>
              <button
                type="button"
                className="rounded-full border border-tsAccent/70 bg-tsAccent/20 px-4 py-2 text-xs font-semibold text-tsTextMain hover:bg-tsAccent/30"
                onClick={() => void repairAndReload()}
              >
                Repair & Reload
              </button>
            </div>
          </div>
        </div>
      }
    >
      <Suspense fallback={fallback}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  );
});

export const AppRoutes = memo(function AppRoutes({
  isLiteScoutRoute,
  isLandingRoute,
  isShareRoute,
}: {
  isLiteScoutRoute: boolean;
  isLandingRoute: boolean;
  isShareRoute: boolean;
}) {
  return (
    <>
      {isLiteScoutRoute ? (
        <Switch>
          <Route path="/_scout-lite">
            <LandingAccessGate>
              <LazyPage Component={ScoutLandingLite} />
            </LandingAccessGate>
          </Route>
          <Route path=":rest*">
            <LazyPage Component={NotFound} />
          </Route>
        </Switch>
      ) : isShareRoute ? (
        <Switch>
          <Route path="/r/:shareToken">
            <LazyPage Component={DirectConnectSharePage} />
          </Route>
          <Route path=":rest*">
            <LazyPage Component={NotFound} />
          </Route>
        </Switch>
      ) : isLandingRoute ? (
        <Switch>
          <Route path="/landing">
            <LandingAccessGate>
              <LazyPage Component={Landing} />
            </LandingAccessGate>
          </Route>
          <Route path="/landing/:variant">
            <LandingAccessGate>
              <LazyPage Component={Landing} />
            </LandingAccessGate>
          </Route>
          <Route path="/lp">
            <LandingAccessGate>
              <LazyPage Component={Landing} />
            </LandingAccessGate>
          </Route>
          <Route path="/lp/:variant">
            <LandingAccessGate>
              <LazyPage Component={Landing} />
            </LandingAccessGate>
          </Route>
          <Route path=":rest*">
            <LazyPage Component={NotFound} />
          </Route>
        </Switch>
      ) : (
        <Suspense fallback={<PageLoader />}>
          <AppShell>
            <AuthenticatedOnboardingGate />
            <Switch>
              {/* Root: resolve to CommunityOS for most users, dashboard for admins */}
              <Route path="/" component={RootLanding} />
              <Route path="/landing">
                <LandingAccessGate>
                  <LazyPage Component={Landing} />
                </LandingAccessGate>
              </Route>
              <Route path="/landing/:variant">
                <LandingAccessGate>
                  <LazyPage Component={Landing} />
                </LandingAccessGate>
              </Route>
              <Route path="/lp">
                <LandingAccessGate>
                  <LazyPage Component={Landing} />
                </LandingAccessGate>
              </Route>
              <Route path="/lp/:variant">
                <LandingAccessGate>
                  <LazyPage Component={Landing} />
                </LandingAccessGate>
              </Route>
              <Route path="/scout-info">
                <RedirectTo to="/help/scout" />
              </Route>
              {/* Scout OS: primary AI controller surface */}
              <Route path="/scout" component={ScoutOS} />
              {/* Home routes */}
              <Route path="/home" component={SmartHome} />

              {/* TradeScout Procurement Engine */}
              <Route path="/utilities/supply-run">
                <ProtectedRoute>
                  <LazyPage Component={SupplyRunHome} />
                </ProtectedRoute>
              </Route>
              <Route path="/utilities/supply-run/new">
                <ProtectedRoute>
                  <LazyPage Component={SupplyRunNew} />
                </ProtectedRoute>
              </Route>
              <Route path="/utilities/supply-run/:id">
                <ProtectedRoute>
                  <LazyPage Component={SupplyRunDetail} />
                </ProtectedRoute>
              </Route>
              <Route path="/grunt/order">
                <LazyPage Component={GruntOrder} />
              </Route>
              <Route path="/grunt/order/:id">
                <LazyPage Component={GruntOrderDetail} />
              </Route>
              <Route path="/grunt/admin/orders">
                <ProtectedRoute>
                  <RedirectTo to="/admin/procurement" />
                </ProtectedRoute>
              </Route>
              <Route path="/grunt/admin/orders/:id">
                <ProtectedRoute>
                  <RedirectTo to="/admin/procurement" />
                </ProtectedRoute>
              </Route>
              <Route path="/supplier/procurement/:token">
                <LazyPage Component={SupplierProcurementQuote} />
              </Route>
              <Route path="/admin/procurement">
                <ProtectedRoute adminOnly>
                  <LazyPage Component={AdminShell} />
                </ProtectedRoute>
              </Route>
              <Route path="/admin/procurement/workspaces">
                <ProtectedRoute adminOnly>
                  <LazyPage Component={AdminShell} />
                </ProtectedRoute>
              </Route>
              <Route path="/admin/procurement/workspaces/:id">
                <ProtectedRoute adminOnly>
                  <LazyPage Component={AdminShell} />
                </ProtectedRoute>
              </Route>
              <Route path="/admin/procurement/:id">
                <ProtectedRoute adminOnly>
                  <LazyPage Component={AdminShell} />
                </ProtectedRoute>
              </Route>

              {/* Role hubs for each user type */}
              <Route path="/roles/:roleKey">
                <LazyPage Component={RoleHubPage} />
              </Route>

              {/* Dashboard routes (auth required) */}
              <Route path="/my-tradescout">
                <ProtectedRoute>
                  <RedirectTo to="/direct-connect" />
                </ProtectedRoute>
              </Route>
              <Route path="/dashboard">
                <ProtectedRoute>
                  <RedirectTo to="/direct-connect" />
                </ProtectedRoute>
              </Route>
              <Route path="/dashboard/jobs">
                <ProtectedRoute>
                  <LazyPage Component={DashboardJobs} />
                </ProtectedRoute>
              </Route>
              <Route path="/dashboard-settings">
                <ProtectedRoute>
                  <LazyPage Component={DashboardSettings} />
                </ProtectedRoute>
              </Route>

              {/* Public commercial landing */}
              <Route path="/hardrock">
                <LandingAccessGate>
                  <LazyPage Component={HardrockLanding} />
                </LandingAccessGate>
              </Route>
              <Route path="/commercial/p/:slug">
                <LandingAccessGate>
                  <LazyPage Component={CommercialProjectLandingPage} />
                </LandingAccessGate>
              </Route>

              {/* Auth routes. Canonical entry is /pre-scout-setup; aliases map to explicit modes. */}
              <Route path="/login">
                <RedirectTo to="/pre-scout-setup?mode=signin" />
              </Route>
              <Route path="/login/legacy">
                <LazyPage Component={Login} />
              </Route>
              <Route path="/register">
                <RedirectTo to="/pre-scout-setup?mode=create" />
              </Route>
              <Route path="/signup">
                <RedirectTo to="/pre-scout-setup?mode=create" />
              </Route>
              <Route path="/create-account">
                <RedirectTo to="/pre-scout-setup?mode=create" />
              </Route>
              <Route path="/create-account/legacy">
                <LazyPage Component={CreateAccount} />
              </Route>
              <Route path="/claim-my-business">
                <LazyPage Component={ClaimMyBusiness} />
              </Route>
              <Route path="/reset-password">
                <LazyPage Component={ResetPassword} />
              </Route>
              <Route path="/verify-email">
                <LazyPage Component={VerifyEmail} />
              </Route>
              <Route path="/check-email">
                <LazyPage Component={CheckEmail} />
              </Route>
              <Route path="/install">
                <LazyPage Component={Install} />
              </Route>
              <Route path="/pre-scout-setup">
                <LazyPage Component={PreScoutSetup} />
              </Route>
              {/* Onboarding: profile normalization flow (auth required). */}
              <Route path="/onboarding/profile">
                <ProtectedRoute>
                  <LazyPage Component={OnboardingProfile} />
                </ProtectedRoute>
              </Route>
              <Route path="/onboarding">
                <ProtectedRoute>
                  <LazyPage Component={OnboardingIntent} />
                </ProtectedRoute>
              </Route>
              <Route path="/onboarding/intent">
                <ProtectedRoute>
                  <LazyPage Component={OnboardingIntent} />
                </ProtectedRoute>
              </Route>
              <Route path="/profile-setup">
                <RedirectTo to="/onboarding/profile" />
              </Route>

              {/* Legacy auth URLs map directly to mode-specific pre-scout entry. */}
              <Route path="/auth/login">
                <RedirectTo to="/pre-scout-setup?mode=signin" />
              </Route>
              <Route path="/auth/signup">
                <RedirectTo to="/pre-scout-setup?mode=create" />
              </Route>
              <Route path="/address-verification">
                <ProtectedRoute>
                  <LazyPage Component={AddressVerification} />
                </ProtectedRoute>
              </Route>
              <Route path="/unauthorized">
                <LazyPage Component={Unauthorized} />
              </Route>

              {/* Core pages */}
              {/* Business/provider application. Legacy contractor routes remain compatibility aliases. */}
              <Route path="/businesses/apply">
                {/* Legacy marker retained for contract-guard compatibility: <LazyPage Component={ContractorApply} /> */}
                <RedirectTo to="/onboarding?lane=business" />
              </Route>
              <Route path="/contractor-signup">
                <RedirectTo to="/onboarding?lane=offer_services" />
              </Route>
              <Route path="/provider-setup">
                <RedirectTo to="/onboarding?lane=offer_services" />
              </Route>
              <Route path="/contractors/apply">
                <RedirectTo to="/onboarding?lane=offer_services" />
              </Route>
              <Route path="/contractors/top">
                <LazyPage Component={ContractorsTop} />
              </Route>
              {/* Legacy alias: older pages link to /contractors/board for contractor search */}
              <Route path="/contractors/board">
                <RedirectTo to="/direct-connect" />
              </Route>
              <Route path="/contractors/:slug">
                <LazyPage Component={ContractorProfile} />
              </Route>
              <Route path="/contractors">
                <RedirectTo to="/direct-connect" />
              </Route>

              {/* Business/provider project requests. Legacy contractor paths remain compatibility aliases. */}
              <Route path="/business/requests">
                <ProtectedRoute>
                  <LazyPage Component={ContractorLeads} />
                </ProtectedRoute>
              </Route>
              <Route path="/contractor-leads">
                <RedirectTo to="/business/requests" />
              </Route>
              <Route path="/contractor/leads">
                <RedirectTo to="/business/requests" />
              </Route>

              {/* Helpers + Direct Connect */}
              <Route path="/helpers/:id">
                <LazyPage Component={HelperPublicProfile} />
              </Route>
              <Route path="/helpers">
                <RedirectTo to="/direct-connect" />
              </Route>
              <Route path="/trade-deals">
                <ProgressiveFeatureGate featureId="trade_deals">
                  <LazyPage Component={TradeDealsPage} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/daily-deals/:rest*">
                <LazyPage Component={DailyDeals} />
              </Route>
              <Route path="/help-demo/:rest*">
                <LazyPage Component={HelpDemo} />
              </Route>
              <Route path="/test-page/:rest*">
                <LazyPage Component={TestPage} />
              </Route>
              <Route path="/profile">
                <ProtectedRoute>
                  <LazyPage Component={Profile} />
                </ProtectedRoute>
              </Route>
              <Route path="/profile/:userId">
                <LazyPage Component={PublicProfileView} />
              </Route>
              <Route path="/u/:slug">
                <LazyPage Component={ProfileSiteView} />
              </Route>
              <Route path="/p/:slug">
                <LazyPage Component={ProfileSiteView} />
              </Route>
              <Route path="/p/:slug/edit">
                <ProtectedRoute>
                  <LazyPage Component={ProfileSiteEditor} />
                </ProtectedRoute>
              </Route>
              <Route path="/u/:slug/edit">
                <ProtectedRoute>
                  <LazyPage Component={ProfileSiteEditor} />
                </ProtectedRoute>
              </Route>
              <Route path="/business/:slug">
                <LazyPage Component={BusinessProfileView} />
              </Route>
              <Route path="/business/:slug/edit">
                <ProtectedRoute>
                  <LazyPage Component={BusinessProfileEditor} />
                </ProtectedRoute>
              </Route>
              <Route path="/directory/businesses">
                <LazyPage Component={BusinessDirectoryPage} />
              </Route>

              {/* Business routes */}
              <Route path="/contractor-board">
                <RedirectTo to="/business-dashboard" />
              </Route>
              <Route path="/commercial-directory">
                <ProtectedRoute>
                  <LazyPage Component={CommercialDirectoryPage} />
                </ProtectedRoute>
              </Route>
              <Route path="/admin/commercial-directory">
                <ProtectedRoute adminOnly>
                  <LazyPage Component={AdminShell} />
                </ProtectedRoute>
              </Route>
              <Route path="/admin/commercial-contractors">
                <ProtectedRoute adminOnly>
                  <LazyPage Component={AdminShell} />
                </ProtectedRoute>
              </Route>
              <Route path="/contractor-apply">
                <RedirectTo to="/businesses/apply" />
              </Route>
              <Route path="/offer-services">
                <ProtectedRoute>
                  <LazyPage Component={OfferServices} />
                </ProtectedRoute>
              </Route>
              <Route path="/profile-purchases/:id">
                <ProtectedRoute>
                  <LazyPage Component={ProfilePurchaseStatus} />
                </ProtectedRoute>
              </Route>
              <Route path="/business-listing">
                <LazyPage Component={BusinessListing} />
              </Route>
              <Route path="/business-dashboard">
                <LazyPage Component={BusinessOwnerDashboard} />
              </Route>
              <Route path="/business-owner-dashboard">
                <RedirectTo to="/business-dashboard" />
              </Route>

              {/* Marketplace routes */}
              <Route path="/worker-marketplace">
                <RedirectTo to="/direct-connect" />
              </Route>
              <Route path="/marketplace">
                <RedirectTo to="/exchange" />
              </Route>
              <Route path="/marketplace/new">
                <ProtectedRoute>
                  <LazyPage Component={MarketplaceListing} />
                </ProtectedRoute>
              </Route>
              <Route path="/exchange/list">
                <RedirectTo to="/exchange" />
              </Route>
              <Route path="/vehicle-marketplace">
                <LazyPage Component={VehicleMarketplace} />
              </Route>
              <Route path="/homescout-listings">
                <RedirectTo to="/exchange/real-estate" />
              </Route>
              <Route path="/real-estate-marketplace">
                <RedirectTo to="/exchange/real-estate" />
              </Route>
              <Route path="/exchange/real-estate">
                <ProgressiveFeatureGate featureId="exchange">
                  <LazyPage Component={RealEstateMarketplace} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/homescout/listings/:id">
                <ProgressiveFeatureGate featureId="home_scout_listings">
                  <LazyPage Component={HomeScoutListing} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/homescout/:stateCode/:countyFips">
                <LazyPage Component={HomeScoutCounty} />
              </Route>
              <Route path="/homescout/new">
                <ProtectedRoute>
                  <LazyPage Component={PropertyListing} />
                </ProtectedRoute>
              </Route>
              <Route path="/homes">
                <ProtectedRoute>
                  <LazyPage Component={lazy(() => import("./pages/homes"))} />
                </ProtectedRoute>
              </Route>
              <Route path="/vehicles">
                <ProtectedRoute>
                  <LazyPage Component={lazy(() => import("./pages/vehicles"))} />
                </ProtectedRoute>
              </Route>
              <Route path="/property-listing">
                <RedirectTo to="/homescout/new" />
              </Route>
              <Route path="/handmade-marketplace">
                <LazyPage Component={HandmadeMarketplace} />
              </Route>
              <Route path="/exchange/metals">
                <ProgressiveFeatureGate featureId="exchange">
                  <LazyPage Component={MetalsExchange} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/exchange/rental-property">
                <ProgressiveFeatureGate featureId="exchange">
                  <LazyPage Component={ExchangeRentalProperty} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/exchange/rental-equipment">
                <ProgressiveFeatureGate featureId="exchange">
                  <LazyPage Component={ExchangeRentalEquipment} />
                </ProgressiveFeatureGate>
              </Route>
              {/* Seller dashboard */}
              <Route path="/exchange/seller-dashboard">
                <ProtectedRoute>
                  <LazyPage Component={ExchangeSellerDashboard} />
                </ProtectedRoute>
              </Route>
              {/* Per-category Exchange pages */}
              <Route path="/exchange/:category/:listingId">
                <ProgressiveFeatureGate featureId="exchange">
                  <LazyPage Component={ExchangeListingDetail} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/exchange/business">
                <ProgressiveFeatureGate featureId="exchange">
                  <LazyPage Component={ExchangeCategoryBusiness} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/exchange/vehicles">
                <ProgressiveFeatureGate featureId="exchange">
                  <LazyPage Component={ExchangeCategoryVehicles} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/exchange/construction">
                <ProgressiveFeatureGate featureId="exchange">
                  <LazyPage Component={ExchangeCategoryConstruction} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/exchange/tools">
                <ProgressiveFeatureGate featureId="exchange">
                  <LazyPage Component={ExchangeCategoryTools} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/exchange/furniture">
                <ProgressiveFeatureGate featureId="exchange">
                  <LazyPage Component={ExchangeCategoryFurniture} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/exchange/farm">
                <ProgressiveFeatureGate featureId="exchange">
                  <LazyPage Component={ExchangeCategoryFarm} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/exchange/business-equipment">
                <ProgressiveFeatureGate featureId="exchange">
                  <LazyPage Component={ExchangeCategoryBusinessEquipment} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/exchange/electronics">
                <ProgressiveFeatureGate featureId="exchange">
                  <LazyPage Component={ExchangeCategoryElectronics} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/exchange/sports">
                <ProgressiveFeatureGate featureId="exchange">
                  <LazyPage Component={ExchangeCategorySports} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/exchange/collectibles">
                <ProgressiveFeatureGate featureId="exchange">
                  <LazyPage Component={ExchangeCategoryCollectibles} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/exchange/jewelry">
                <ProgressiveFeatureGate featureId="exchange">
                  <LazyPage Component={ExchangeCategoryJewelry} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/exchange/local-food">
                <ProgressiveFeatureGate featureId="exchange">
                  <LazyPage Component={ExchangeCategoryLocalFood} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/exchange/other">
                <ProgressiveFeatureGate featureId="exchange">
                  <LazyPage Component={ExchangeCategoryOther} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/exchange">
                <ProgressiveFeatureGate featureId="exchange">
                  <LazyPage Component={Exchange} />
                </ProgressiveFeatureGate>
              </Route>
              {/* Groups routes */}
              <Route path="/groups">
                <GroupsShell>
                  <LazyPage Component={Groups} />
                </GroupsShell>
              </Route>
              <Route path="/group/:id">
                <LazyPage Component={GroupDetail} />
              </Route>
              <Route path="/hoa-management">
                <ProtectedRoute>
                  <HOAManagementShell>
                    <LazyPage Component={HoaManagement} />
                  </HOAManagementShell>
                </ProtectedRoute>
              </Route>
              <Route path="/hoa/residents">
                <ProtectedRoute>
                  <LazyPage Component={HoaResidents} />
                </ProtectedRoute>
              </Route>
              <Route path="/hoa/maintenance">
                <ProtectedRoute>
                  <LazyPage Component={HoaMaintenance} />
                </ProtectedRoute>
              </Route>
              {/* Community canonical route is /community-feed; keep /community as a legacy alias */}
              <Route path="/community">
                <RedirectTo to="/community-feed" />
              </Route>
              <Route path="/community-feed">
                <CommunityPageShell>
                  <LazyPage Component={CommunityFeed} />
                </CommunityPageShell>
              </Route>
              <Route path="/community/u/:userId">
                <LazyPage Component={CommunityProfile} />
              </Route>
              <Route path="/community-moderation">
                <LazyPage Component={CommunityModerationDemo} />
              </Route>

              {/* Social features: discovery, friends, messaging */}
              <Route path="/discover-people">
                <ProtectedRoute>
                  <LazyPage Component={lazy(() => import("./components/social/SocialDiscovery"))} />
                </ProtectedRoute>
              </Route>
              <Route path="/conversations">
                <ProtectedRoute>
                  <LazyPage Component={lazy(() => import("./components/messages/MessagesPanel"))} />
                </ProtectedRoute>
              </Route>

              {/* Community Builder routes */}
              <Route path="/profile/:profileId/community">
                <LazyPage Component={ProfileCommunity} />
              </Route>
              <Route path="/community-builder/dashboard">
                <ProtectedRoute>
                  <LazyPage Component={CommunityBuilderDashboard} />
                </ProtectedRoute>
              </Route>
              <Route path="/community-builder/contributions/new">
                <ProtectedRoute>
                  <LazyPage Component={CommunityBuilderNewContribution} />
                </ProtectedRoute>
              </Route>
              <Route path="/community-builder/contributions/:id">
                <ProtectedRoute>
                  <LazyPage Component={CommunityBuilderContributionDetail} />
                </ProtectedRoute>
              </Route>
              <Route path="/community-builder/setup">
                <ProtectedRoute>
                  <RedirectTo to="/community-builder/dashboard" />
                </ProtectedRoute>
              </Route>
              <Route path="/community-builder/verify">
                <ProtectedRoute>
                  <RedirectTo to="/community-builder/dashboard" />
                </ProtectedRoute>
              </Route>
              {/* Community Builder setup route temporarily disabled until page is restored */}
              <Route path="/community-builder/contributions/:id/success">
                <ProtectedRoute>
                  <LazyPage Component={CommunityBuilderContributionSuccess} />
                </ProtectedRoute>
              </Route>
              <Route path="/county/:countyId/transparency">
                <LazyPage Component={CountyTransparency} />
              </Route>

              {/* Admin routes (gated by user.isAdmin === true) */}
              <Route path="/admin">
                <ProtectedRoute adminOnly>
                  <LazyPage Component={AdminShell} />
                </ProtectedRoute>
              </Route>
              <Route path="/admin-panel">
                <ProtectedRoute adminOnly>
                  <RedirectTo to="/admin/panel" />
                </ProtectedRoute>
              </Route>
              <Route path="/admin-dashboard">
                <ProtectedRoute adminOnly>
                  <RedirectTo to="/admin" />
                </ProtectedRoute>
              </Route>
              <Route path="/admin/dashboard">
                <ProtectedRoute adminOnly>
                  <RedirectTo to="/admin" />
                </ProtectedRoute>
              </Route>
              <Route path="/admin-users">
                <ProtectedRoute adminOnly>
                  <RedirectTo to="/admin/users" />
                </ProtectedRoute>
              </Route>
              <Route path="/admin/:rest*">
                <ProtectedRoute adminOnly>
                  <LazyPage Component={AdminShell} />
                </ProtectedRoute>
              </Route>

              {/* Admin Observability Dashboard (Phase 2) */}
              <Route path="/admin-observability">
                <ProtectedRoute adminOnly>
                  <RedirectTo to="/admin/live-stream" />
                </ProtectedRoute>
              </Route>

              {/* Dashboard routes (auth required) */}
              <Route path="/contractor-dashboard">
                <RedirectTo to="/business-dashboard" />
              </Route>
              <Route path="/homeowner-dashboard">
                <ProtectedRoute>
                  <LazyPage Component={HomeownerDashboard} />
                </ProtectedRoute>
              </Route>
              <Route path="/realtor-dashboard">
                <ProtectedRoute>
                  <LazyPage Component={RealtorDashboard} />
                </ProtectedRoute>
              </Route>
              <Route path="/car-salesman-dashboard">
                <ProtectedRoute>
                  <LazyPage Component={CarSalesmanDashboard} />
                </ProtectedRoute>
              </Route>
              <Route path="/helper-dashboard">
                <ProtectedRoute>
                  <LazyPage Component={HelperDashboard} />
                </ProtectedRoute>
              </Route>
              {/* Role-specific KPI dashboards (dealer/insurance/property/mortgage) have been
                      deprecated in favor of the unified, action-aware dashboard. Routes are
                      intentionally removed to avoid exposing mock performance metrics. */}
              {/* Staff dashboard route is disabled for now while we stabilize core flows */}
              {/*
                  <Route path="/staff-dashboard">
                    <ProtectedRoute>
                      <LazyPage Component={StaffDashboard} />
                    </ProtectedRoute>
                  </Route>
                  */}

              <Route path="/staff/hardrock-directory">
                <ProtectedRoute adminOnly>
                  <RedirectTo to="/admin/commercial-directory" />
                </ProtectedRoute>
              </Route>
              <Route path="/staff/share-links">
                <ProtectedRoute adminOnly>
                  <RedirectTo to="/admin/share-links" />
                </ProtectedRoute>
              </Route>
              <Route path="/staff/inspection-intelligence">
                <ProtectedRoute adminOnly>
                  <RedirectTo to="/admin/inspection-intelligence" />
                </ProtectedRoute>
              </Route>

              {/* Common pages */}
              <Route path="/chat">
                <ProtectedRoute>
                  <LazyPage Component={Chat} />
                </ProtectedRoute>
              </Route>
              <Route path="/messages">
                <ProtectedRoute>
                  <CommunityPageShell>
                    <LazyPage Component={Messages} />
                  </CommunityPageShell>
                </ProtectedRoute>
              </Route>
              <Route path="/saved-ads">
                <ProtectedRoute>
                  <LazyPage Component={SavedAds} />
                </ProtectedRoute>
              </Route>
              {/* Back-compat: right panel links */}
              <Route path="/saved">
                <ProtectedRoute>
                  <RedirectTo to="/saved-ads" />
                </ProtectedRoute>
              </Route>
              <Route path="/saved-contractors">
                <ProtectedRoute>
                  <LazyPage Component={SavedContractors} />
                </ProtectedRoute>
              </Route>
              <Route path="/affiliate">
                <ProgressiveFeatureGate featureId="share">
                  <LazyPage Component={Affiliate} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/share">
                <ProgressiveFeatureGate featureId="share">
                  <LazyPage Component={Affiliate} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/notifications">
                <ProtectedRoute>
                  <LazyPage Component={Notifications} />
                </ProtectedRoute>
              </Route>
              <Route path="/settings">
                <ProtectedRoute>
                  <LazyPage Component={Settings} />
                </ProtectedRoute>
              </Route>
              <Route path="/profile-settings">
                <ProtectedRoute>
                  <LazyPage Component={ProfileSettings} />
                </ProtectedRoute>
              </Route>
              <Route path="/help">
                <LazyPage Component={Help} />
              </Route>
              <Route path="/help/scout">
                <LazyPage Component={ScoutInfoPage} />
              </Route>
              <Route path="/help/how-tradescout-works">
                <LazyPage Component={HowTradeScoutWorks} />
              </Route>
              <Route path="/invite">
                <ProtectedRoute>
                  <LazyPage Component={Invite} />
                </ProtectedRoute>
              </Route>
              <Route path="/checkout">
                <ProtectedRoute>
                  <LazyPage Component={Checkout} />
                </ProtectedRoute>
              </Route>
              <Route path="/payment-success">
                <ProtectedRoute>
                  <LazyPage Component={PaymentSuccess} />
                </ProtectedRoute>
              </Route>
              <Route path="/payment-history">
                <ProtectedRoute>
                  <LazyPage Component={PaymentHistory} />
                </ProtectedRoute>
              </Route>
              <Route path="/wallet">
                <ProtectedRoute>
                  <LazyPage Component={Wallet} />
                </ProtectedRoute>
              </Route>

              {/* Business Tools */}
              <Route path="/boosts">
                <LazyPage Component={Boosts} />
              </Route>
              <Route path="/analytics">
                <LazyPage Component={Analytics} />
              </Route>
              <Route path="/crm">
                <LazyPage Component={CRM} />
              </Route>
              <Route path="/marketing/scoutfitters">
                <ProtectedRoute>
                  <LazyPage Component={ScoutFitters} />
                </ProtectedRoute>
              </Route>
              {/* Finances workspace (aliases /finances and /accounting for back-compat) */}
              <Route path="/finances">
                <ProtectedRoute>
                  <LazyPage Component={Accounting} />
                </ProtectedRoute>
              </Route>
              <Route path="/finances/invoices">
                <ProtectedRoute>
                  <LazyPage Component={FinancesInvoices} />
                </ProtectedRoute>
              </Route>
              <Route path="/finances/expenses">
                <ProtectedRoute>
                  <LazyPage Component={FinancesExpenses} />
                </ProtectedRoute>
              </Route>
              <Route path="/finances/clients">
                <ProtectedRoute>
                  <LazyPage Component={FinancesClients} />
                </ProtectedRoute>
              </Route>
              <Route path="/finances/materials">
                <ProtectedRoute>
                  <LazyPage Component={FinancesMaterials} />
                </ProtectedRoute>
              </Route>
              <Route path="/finances/estimates">
                <ProtectedRoute>
                  <LazyPage Component={FinancesEstimates} />
                </ProtectedRoute>
              </Route>
              <Route path="/finances/jobs">
                <ProtectedRoute>
                  <LazyPage Component={FinancesJobs} />
                </ProtectedRoute>
              </Route>
              <Route path="/finances/employees">
                <ProtectedRoute>
                  <LazyPage Component={FinancesEmployees} />
                </ProtectedRoute>
              </Route>
              <Route path="/finances/payroll">
                <ProtectedRoute>
                  <LazyPage Component={FinancesPayroll} />
                </ProtectedRoute>
              </Route>
              <Route path="/finances/vendors">
                <ProtectedRoute>
                  <LazyPage Component={FinancesVendors} />
                </ProtectedRoute>
              </Route>
              <Route path="/finances/bank-accounts">
                <ProtectedRoute>
                  <LazyPage Component={FinancesBankAccounts} />
                </ProtectedRoute>
              </Route>
              <Route path="/finances/reports">
                <ProtectedRoute>
                  <LazyPage Component={FinancesReports} />
                </ProtectedRoute>
              </Route>
              <Route path="/finances/records">
                <ProtectedRoute>
                  <LazyPage Component={FinancesRecords} />
                </ProtectedRoute>
              </Route>
              <Route path="/finances/settings">
                <ProtectedRoute>
                  <LazyPage Component={FinancesSettings} />
                </ProtectedRoute>
              </Route>
              <Route path="/accounting">
                <ProtectedRoute>
                  <LazyPage Component={Accounting} />
                </ProtectedRoute>
              </Route>
              <Route path="/project-tracker">
                <LazyPage Component={ProjectTracker} />
              </Route>
              <Route path="/lead-management">
                <LazyPage Component={ProjectTracker} />
              </Route>
              <Route path="/ad-creator">
                <LazyPage Component={AdCreator} />
              </Route>
              <Route path="/promotions">
                <LazyPage Component={Promotions} />
              </Route>
              <Route path="/quote-calculator">
                <RedirectTo to="/scout?intent=estimate" />
              </Route>
              <Route path="/quote">
                <RedirectTo to="/scout?intent=estimate" />
              </Route>
              <Route path="/recommendations">
                <ProtectedRoute>
                  <LazyPage Component={RecommendationGeneratorPage} />
                </ProtectedRoute>
              </Route>

              {/* Community & Geographic */}
              <Route path="/datasets">
                <LazyPage Component={DatasetsLandingPage} />
              </Route>
              <Route path="/datasets/trades">
                <LazyPage Component={DatasetsTradesPage} />
              </Route>
              <Route path="/datasets/counties">
                <LazyPage Component={DatasetsCountiesPage} />
              </Route>
              <Route path="/datasets/cities">
                <LazyPage Component={DatasetsCitiesPage} />
              </Route>
              <Route path="/best/:tradeSlug/:stateCode/city/:citySlug">
                <LazyPage Component={BestTradeCityPage} />
              </Route>
              <Route path="/best/:tradeSlug/:stateCode/:countySlug">
                <LazyPage Component={BestTradeCountyPage} />
              </Route>
              <Route path="/trade">
                <LazyPage Component={TradeDirectoryPage} />
              </Route>
              <Route path="/trade/:tradeSlug/:stateCode/city/:citySlug/recent">
                <LazyPage Component={TradeCityRecentPage} />
              </Route>
              <Route path="/trade/:tradeSlug/:stateCode/city/:citySlug">
                <LazyPage Component={TradeCityPage} />
              </Route>
              <Route path="/trade/:tradeSlug/:stateCode/:countySlug/recent">
                <LazyPage Component={TradeCountyRecentPage} />
              </Route>
              <Route path="/trade/:tradeSlug/:stateCode/:countySlug">
                <LazyPage Component={TradeCountyPage} />
              </Route>
              <Route path="/trade/:tradeSlug/:stateCode">
                <LazyPage Component={TradeStatePage} />
              </Route>
              <Route path="/trade/:tradeSlug">
                <LazyPage Component={TradeOverviewPage} />
              </Route>
              <Route path="/city/:stateCode/:citySlug/recent">
                <LazyPage Component={CityRecentPage} />
              </Route>
              <Route path="/city/:stateCode/:citySlug">
                <LazyPage Component={CityPage} />
              </Route>
              <Route path="/county/:stateCode/:countySlug/recent">
                <LazyPage Component={CountyRecentPage} />
              </Route>
              <Route path="/county/:stateCode/:countySlug">
                <LazyPage Component={CountyPage} />
              </Route>
              <Route path="/county-directory">
                <LazyPage Component={CountyDirectory} />
              </Route>
              <Route path="/county-hub">
                <LazyPage Component={CountyHub} />
              </Route>
              <Route path="/maps">
                <ProgressiveFeatureGate featureId="maps">
                  <LazyPage Component={MapsPage} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/leaderboard">
                <ProgressiveFeatureGate featureId="leaderboard">
                  <LazyPage Component={Leaderboard} />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/foundation">
                <ProgressiveFeatureGate featureId="foundation">
                  <Foundation />
                </ProgressiveFeatureGate>
              </Route>
              <Route path="/tradepartners">
                <LazyPage Component={TradePartnersHub} />
              </Route>
              <Route path="/tradepartners/cumulus-media">
                <LazyPage Component={TradePartnerCumulusLanding} />
              </Route>
              <Route path="/tradepartners/cumulus-media/mobile-county-al">
                <LazyPage Component={TradePartnerCumulusLanding} />
              </Route>
              <Route path="/tradepartners/cumulus-media/escambia-county-fl">
                <LazyPage Component={TradePartnerCumulusLanding} />
              </Route>
              <Route path="/tradepartners/cumulus-media/okaloosa-county-fl">
                <LazyPage Component={TradePartnerCumulusLanding} />
              </Route>
              <Route path="/tradepartners/:countySlug/:categorySlug">
                <LazyPage Component={TradePartnerCountyLanding} />
              </Route>
              <Route path="/tradepartners/:countySlug/:rest*">
                {(params) => (
                  <RedirectTo
                    to={`/tradepartners/${encodeURIComponent(String(params?.countySlug || ""))}`}
                  />
                )}
              </Route>
              <Route path="/tradepartners/:countySlug">
                <LazyPage Component={TradePartnerCountyLanding} />
              </Route>
              <Route path="/coffee-company">
                <LazyPage Component={CoffeeCompany} />
              </Route>
              <Route path="/resource-center">
                <LazyPage Component={ResourceCenter} />
              </Route>

              {/* Additional Features */}
              <Route path="/hoa-dashboard">
                <ProtectedRoute>
                  <HOADashboardShell>
                    <LazyPage Component={HOADashboard} />
                  </HOADashboardShell>
                </ProtectedRoute>
              </Route>
              <Route path="/hoa-dashboard/:hoaId">
                <ProtectedRoute>
                  <HOADashboardShell>
                    <LazyPage Component={HOADashboard} />
                  </HOADashboardShell>
                </ProtectedRoute>
              </Route>
              <Route path="/membership-portal">
                <LazyPage Component={MembershipPortal} />
              </Route>
              <Route path="/training-center">
                <LazyPage Component={TrainingCenter} />
              </Route>
              <Route path="/application-tracker">
                <LazyPage Component={ApplicationTracker} />
              </Route>
              <Route path="/administrative-dashboard">
                <ProtectedRoute adminOnly>
                  <RedirectTo to="/admin" />
                </ProtectedRoute>
              </Route>
              <Route path="/advanced-search">
                <RedirectTo to="/direct-connect" />
              </Route>
              <Route path="/search">
                <RedirectTo to="/direct-connect" />
              </Route>

              {/* Applications */}
              <Route path="/realtor-application">
                <LazyPage Component={RealtorApplication} />
              </Route>
              <Route path="/car-salesman-application">
                <LazyPage Component={CarSalesmanApplication} />
              </Route>

              {/* Car Sales Features */}
              <Route path="/car-sales-new-listing">
                <LazyPage Component={CarSalesNewListing} />
              </Route>
              <Route path="/car-sales-customers">
                <LazyPage Component={CarSalesCustomers} />
              </Route>
              <Route path="/car-sales-financing">
                <LazyPage Component={CarSalesFinancing} />
              </Route>
              <Route path="/car-sales-trade-in">
                <LazyPage Component={CarSalesTradeIn} />
              </Route>
              <Route path="/car-sales-payment-calculator">
                <LazyPage Component={CarSalesPaymentCalculator} />
              </Route>
              <Route path="/car-sales-vin-lookup">
                <LazyPage Component={CarSalesVinLookup} />
              </Route>
              <Route path="/car-sales-appointments">
                <LazyPage Component={CarSalesAppointments} />
              </Route>
              <Route path="/car-sales-follow-up">
                <LazyPage Component={CarSalesFollowUp} />
              </Route>

              {/* Realtor Features */}
              <Route path="/realtor-clients">
                <LazyPage Component={RealtorClients} />
              </Route>
              <Route path="/realtor-market-analysis">
                <LazyPage Component={RealtorMarketAnalysis} />
              </Route>
              <Route path="/realtor-connections">
                <LazyPage Component={RealtorConnections} />
              </Route>
              <Route path="/connections">
                <ProtectedRoute>
                  <LazyPage Component={ConnectionsPage} />
                </ProtectedRoute>
              </Route>
              <Route path="/realtor-calculator">
                <LazyPage Component={RealtorCalculator} />
              </Route>
              <Route path="/realtor-cma">
                <LazyPage Component={RealtorCMA} />
              </Route>
              <Route path="/realtor-appointments">
                <LazyPage Component={RealtorAppointments} />
              </Route>
              <Route path="/realtor-contacts">
                <LazyPage Component={RealtorContacts} />
              </Route>

              {/* Verification & Compliance */}
              <Route path="/verification">
                <LazyPage Component={Verification} />
              </Route>
              <Route path="/identity-verification">
                <LazyPage Component={IdentityVerification} />
              </Route>
              <Route path="/insurance-verification">
                <LazyPage Component={InsuranceVerification} />
              </Route>
              <Route path="/license-verification">
                <LazyPage Component={LicenseVerification} />
              </Route>
              <Route path="/background-check">
                <LazyPage Component={BackgroundCheck} />
              </Route>
              <Route path="/compliance">
                <LazyPage Component={Compliance} />
              </Route>
              <Route path="/documentation">
                <LazyPage Component={Documentation} />
              </Route>

              {/* Advanced Admin */}
              <Route path="/contractor-verification">
                <ProtectedRoute adminOnly>
                  <RedirectTo to="/admin/professional-verification" />
                </ProtectedRoute>
              </Route>
              <Route path="/content-moderation">
                <ProtectedRoute adminOnly>
                  <RedirectTo to="/admin/moderation" />
                </ProtectedRoute>
              </Route>
              <Route path="/system-settings">
                <ProtectedRoute adminOnly>
                  <RedirectTo to="/admin/site-settings" />
                </ProtectedRoute>
              </Route>
              <Route path="/support-tickets">
                <ProtectedRoute adminOnly>
                  <RedirectTo to="/admin/errors" />
                </ProtectedRoute>
              </Route>
              <Route path="/platform-analytics">
                <ProtectedRoute adminOnly>
                  <RedirectTo to="/admin/platform-analytics" />
                </ProtectedRoute>
              </Route>
              <Route path="/manage-users">
                <ProtectedRoute adminOnly>
                  <RedirectTo to="/admin/users" />
                </ProtectedRoute>
              </Route>
              <Route path="/payment-processing">
                <ProtectedRoute adminOnly>
                  <RedirectTo to="/admin/payment-model" />
                </ProtectedRoute>
              </Route>
              <Route path="/file-management">
                <ProtectedRoute adminOnly>
                  <RedirectTo to="/admin/attachments" />
                </ProtectedRoute>
              </Route>

              {/* Social & Integration */}
              <Route path="/social-integration">
                <LazyPage Component={SocialIntegration} />
              </Route>
              <Route path="/referral-dashboard">
                <LazyPage Component={ReferralDashboard} />
              </Route>
              <Route path="/event-management">
                <LazyPage Component={EventManagement} />
              </Route>
              <Route path="/api-integrations">
                <LazyPage Component={APIIntegrations} />
              </Route>

              {/* Interactive Pages */}
              <Route path="/schedule-consultation">
                <LazyPage Component={ScheduleConsultation} />
              </Route>
              <Route path="/request-quote">
                <LazyPage Component={RequestQuote} />
              </Route>
              <Route path="/zero-base-fee">
                <ProtectedRoute
                  requiredRoles={[
                    "support_agent",
                    "content_moderator",
                    "territory_manager",
                    "contractor_success",
                    "content_seo",
                    "analytics_specialist",
                    "marketing_specialist",
                    "moderator",
                    "ops_admin",
                    "super_admin",
                  ]}
                >
                  <LazyPage Component={ZeroBaseFeeCamera} />
                </ProtectedRoute>
              </Route>
              <Route path="/zero-base-fee/camera">
                <ProtectedRoute
                  requiredRoles={[
                    "support_agent",
                    "content_moderator",
                    "territory_manager",
                    "contractor_success",
                    "content_seo",
                    "analytics_specialist",
                    "marketing_specialist",
                    "moderator",
                    "ops_admin",
                    "super_admin",
                  ]}
                >
                  <LazyPage Component={ZeroBaseFeeCamera} />
                </ProtectedRoute>
              </Route>
              <Route path="/direct-connect">
                <LazyPage Component={DirectConnectShell} />
              </Route>
              <Route path="/direct-connect/:rest*">
                <LazyPage Component={DirectConnectShell} />
              </Route>
              <Route path="/tasks">
                <RedirectTo to="/direct-connect" />
              </Route>

              {/* Notes */}
              <Route path="/notes">
                <LazyPage Component={NotesPage} />
              </Route>

              {/* Legal pages */}
              <Route path="/pricing">
                <LazyPage Component={Pricing} />
              </Route>
              <Route path="/how-it-works">
                <LazyPage Component={HowItWorks} />
              </Route>
              <Route path="/for-businesses">
                <LazyPage Component={ForBusinessesPage} />
              </Route>
              <Route path="/find-local-businesses">
                <LazyPage Component={FindLocalBusinessesPage} />
              </Route>
              <Route path="/pensacola">
                <LazyPage Component={PensacolaPage} />
              </Route>
              <Route path="/pensacola/:clusterSlug">
                <LazyPage Component={PensacolaClusterPage} />
              </Route>
              <Route path="/tangipahoa">
                <LazyPage Component={TangipahoaPage} />
              </Route>
              <Route path="/trust-model">
                <LazyPage Component={TrustModel} />
              </Route>
              <Route path="/direct-connect-info">
                <LazyPage Component={DirectConnectInfo} />
              </Route>
              <Route path="/giveaway-rules">
                <LazyPage Component={GiveawayRules} />
              </Route>
              <Route path="/compare">
                <LazyPage Component={CompareHub} />
              </Route>
              <Route path="/compare/angi">
                <LazyPage Component={CompareAngi} />
              </Route>
              <Route path="/compare/home-services">
                <LazyPage Component={CompareHomeServices} />
              </Route>
              <Route path="/compare/real-estate">
                <LazyPage Component={CompareRealEstate} />
              </Route>
              <Route path="/compare/community">
                <LazyPage Component={CompareCommunity} />
              </Route>
              <Route path="/compare/local-business">
                <LazyPage Component={CompareLocalBusiness} />
              </Route>
              <Route path="/compare/coordination">
                <LazyPage Component={CompareCoordination} />
              </Route>
              <Route path="/compare/lead-generation">
                <LazyPage Component={CompareLeadGeneration} />
              </Route>
              <Route path="/compare/homeadvisor">
                <LazyPage Component={CompareHomeAdvisor} />
              </Route>
              <Route path="/terms">
                <LazyPage Component={Terms} />
              </Route>
              <Route path="/privacy">
                <LazyPage Component={Privacy} />
              </Route>
              <Route path="/privacy-request">
                <LazyPage Component={PrivacyRequest} />
              </Route>
              <Route path="/legal/remote-notary">
                <LazyPage Component={RemoteNotary} />
              </Route>
              <Route path="/services/remote-notary">
                <LazyPage Component={RemoteNotary} />
              </Route>
              <Route path="/legal/mobile-notary">
                <LazyPage Component={RemoteNotary} />
              </Route>
              <Route path="/services/mobile-notary">
                <LazyPage Component={RemoteNotary} />
              </Route>
              <Route path="/about">
                <LazyPage Component={About} />
              </Route>
              <Route path="/contact">
                <RedirectTo to="/scout?intent=support&source=contact-route" />
              </Route>

              {/* Story Generator */}
              <Route path="/story-generator">
                <LazyPage Component={StoryGeneratorPage} />
              </Route>

              {/* Back-compat aliases for legacy buttons/links */}
              <Route path="/settings/profile">
                <RedirectTo to="/profile-settings" />
              </Route>
              <Route path="/settings/location">
                <RedirectTo to="/settings?tab=profile" />
              </Route>
              <Route path="/contractor/dashboard">
                <RedirectTo to="/business-dashboard" />
              </Route>
              <Route path="/contractor-profile">
                <RedirectTo to="/contractors" />
              </Route>
              <Route path="/payments/history">
                <RedirectTo to="/payment-history" />
              </Route>
              <Route path="/saved">
                <RedirectTo to="/saved-ads" />
              </Route>
              <Route path="/community-builder">
                <RedirectTo to="/community-builder/dashboard" />
              </Route>
              <Route path="/county/transparency">
                <RedirectTo to="/county-hub" />
              </Route>
              <Route path="/contractors/signup">
                <RedirectTo to="/businesses/apply" />
              </Route>
              <Route path="/contractor-join">
                <RedirectTo to="/businesses/apply" />
              </Route>
              <Route path="/contractors/accelerator">
                <RedirectTo to="/businesses/apply" />
              </Route>
              <Route path="/payroll-helper">
                <RedirectTo to="/finances/payroll" />
              </Route>
              <Route path="/cookie-preferences">
                <RedirectTo to="/privacy" />
              </Route>
              <Route path="/auth/logout">
                <HardRedirectTo to="/api/auth/logout" />
              </Route>
              <Route path="/logout">
                <HardRedirectTo to="/api/auth/logout" />
              </Route>
              <Route path="/tools/estimate-calculator">
                <RedirectTo to="/quote-calculator" />
              </Route>
              <Route path="/tools/invoice-calculator">
                <RedirectTo to="/finances/invoices" />
              </Route>
              <Route path="/tools/expense-helper">
                <RedirectTo to="/finances/expenses" />
              </Route>
              <Route path="/legal/privacy-policy">
                <RedirectTo to="/privacy" />
              </Route>
              <Route path="/legal/giveaway-rules">
                <RedirectTo to="/giveaway-rules" />
              </Route>
              <Route path="/legal/cookie-policy">
                <RedirectTo to="/privacy" />
              </Route>
              <Route path="/legal/compliance">
                <RedirectTo to="/compliance" />
              </Route>
              <Route path="/legal/accessibility">
                <RedirectTo to="/compliance" />
              </Route>
              <Route path="/legal/seller-agreement">
                <RedirectTo to="/terms" />
              </Route>
              <Route path="/legal/community-guidelines">
                <RedirectTo to="/terms" />
              </Route>
              <Route path="/legal/dispute-resolution">
                <RedirectTo to="/terms" />
              </Route>
              {/* Legacy commerce URL aliases (old storefront links). */}
              <Route path="/collections/:collectionSlug/products/:productSlug">
                <RedirectTo to="/trade-deals" />
              </Route>
              <Route path="/collections/:rest*">
                <RedirectTo to="/trade-deals" />
              </Route>
              <Route path="/products/:productSlug">
                <RedirectTo to="/trade-deals" />
              </Route>

              {/* 404 - this should be last */}
              <Route path="/:rest*">
                <LazyPage Component={NotFound} />
              </Route>
            </Switch>
          </AppShell>
        </Suspense>
      )}
    </>
  );
});
