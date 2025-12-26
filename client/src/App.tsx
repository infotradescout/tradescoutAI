import React, { memo, Suspense, useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Link, Router, Route, Switch, useLocation } from 'wouter';
import { MessageCircle, SlidersHorizontal, X } from 'lucide-react';
import { queryClient } from './lib/queryClient';
import { trackShellEvent } from './lib/analytics';
import { ErrorBoundary } from './components/ui/error-boundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { SessionProvider } from './contexts/SessionContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './hooks/useAuth';
import { AppShell } from './components/layout/AppShell';
import { resolveDefaultHomeRoute } from './lib/homeRoute';
import ScoutOS from './scout';

// Only load essential components eagerly
import SmartHome from './SmartHome';
import ScoutLanding from './pages/ScoutLanding';
import SimpleMobileGestures from './components/SimpleMobileGestures';
import SimpleSubtleHints from './components/onboarding/SimpleSubtleHints';
import SimpleBugReportTool from './components/SimpleBugReportTool';
import SimpleFloatingHelp from './components/ui/simple-floating-help';
import ComingSoon from './pages/coming-soon';

// Loading component for lazy-loaded pages
import { PageLoadingSpinner } from './components/LoadingSpinner';

const PageLoader = memo(function PageLoader() {
  return <PageLoadingSpinner message="Loading TradeScout..." />;
});

const RedirectTo = memo(function RedirectTo({ to }: { to: string }) {
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (location !== to) navigate(to);
  }, [location, navigate, to]);

  return null;
});

// Toggle to gate unfinished full-site features behind a Coming Soon screen
const FULL_SITE_PAUSED = false;

// Lazy load all pages by category for better code splitting
// Core Pages
// Contractors: canonical path is the licensed/verified contractor search
const FindContractors = React.lazy(() => import('./pages/find-contractors'));
const ContractorProfile = React.lazy(() => import('./pages/contractor-profile'));
const DailyDeals = React.lazy(() => import('./pages/daily-deals'));
const HelpDemo = React.lazy(() => import('./pages/help-demo'));
const TestPage = React.lazy(() => import('./pages/test-page'));
const Profile = React.lazy(() => import('./pages/ProfilePage'));

// Authentication & User Management
const Login = React.lazy(() => import('./pages/login'));
const AddressVerification = React.lazy(() => import('./pages/address-verification'));
const Register = React.lazy(() => import('./pages/register'));
const Signup = React.lazy(() => import('./pages/signup'));

// Contractor Features
const ContractorApply = React.lazy(() => import('./pages/contractor-apply'));
const ContractorBoard = React.lazy(() => import('./pages/contractor-board'));
const BusinessListing = React.lazy(() => import('./pages/business-listing'));
const BusinessOwnerDashboard = React.lazy(() => import('./pages/business-owner-dashboard'));
const Accelerator = React.lazy(() => import('./pages/accelerator'));

// Admin Features (heavy components)
const AdminPanel = React.lazy(() => import('./pages/admin-panel'));
const AdminDashboard = React.lazy(() => import('./pages/admin-dashboard'));
const AdminUserManagement = React.lazy(() => import('./pages/AdminUserManagement'));
const AdminUsers = React.lazy(() => import('./pages/admin-users'));
const AdminWorkspace = React.lazy(() => import('./pages/admin-workspace'));
const AdminErrorReports = React.lazy(() => import('./pages/admin-error-reports'));
const AdminTestingControls = React.lazy(() => import('./pages/admin-testing-controls'));
const AdminAddressVerifications = React.lazy(() => import('./pages/admin-address-verifications'));
const AdminProfessionalVerification = React.lazy(() => import('./pages/admin-professional-verification'));
const AdminListings = React.lazy(() => import('./pages/admin-listings'));
const AdminAttachments = React.lazy(() => import('./pages/admin-attachments'));
const AdminPricingAnalytics = React.lazy(() => import('./pages/admin-pricing-analytics'));
const AdminCreateAccount = React.lazy(() => import('./pages/admin-create-account'));
const AdminAffiliates = React.lazy(() => import('./pages/admin-affiliates'));
const PromptAdminPage = React.lazy(() =>
  import('./pages/PromptAdminPage').then(mod => ({ default: (mod as any).default || (mod as any).PromptAdminPage }))
);

// Marketplace & Social
const WorkerMarketplace = React.lazy(() => import('./pages/worker-marketplace'));
const ContractorLeads = React.lazy(() => import('./pages/contractor-leads'));
const Chat = React.lazy(() => import('./pages/chat'));
const Messages = React.lazy(() => import('./pages/messages'));
const SavedAds = React.lazy(() => import('./pages/saved-ads'));
const Affiliate = React.lazy(() => import('./pages/affiliate'));
const GrowthPack = React.lazy(() => import('./pages/growth-pack'));
const Boosts = React.lazy(() => import('./pages/boosts'));
const AdvancedSearch = React.lazy(() => import('./pages/advanced-search'));

// HOA & Groups
const Groups = React.lazy(() => import('./pages/groups'));
const GroupDetail = React.lazy(() => import('./pages/group-detail'));
const HoaManagement = React.lazy(() => import('./pages/hoa-management'));
const Community = React.lazy(() => import('./pages/community'));

// Community Builder
const CommunityBuilderDashboard = React.lazy(() => import('./pages/community-builder/dashboard'));
const CommunityBuilderContributionSuccess = React.lazy(() => import('./pages/community-builder/contribution-success'));
const ProfileCommunity = React.lazy(() => import('./pages/community-builder/profile-community'));
const CountyTransparency = React.lazy(() => import('./pages/county/transparency'));
const AdminCommunityBuilderReconciliation = React.lazy(() => import('./pages/admin/community-builder-reconciliation'));
const AdminCommunityBuilderBuilders = React.lazy(() => import('./pages/admin/community-builder-builders'));

// Additional Features
const Exchange = React.lazy(() => import('./pages/exchange'));
const HandmadeMarketplace = React.lazy(() => import('./pages/handmade-marketplace'));
const Leaderboard = React.lazy(() => import('./pages/leaderboard'));
const Foundation = React.lazy(() => import('./pages/foundation'));
const Accounting = React.lazy(() => import('./pages/accounting'));
const FinancesInvoices = React.lazy(() => import('./pages/finances-invoices'));
const FinancesExpenses = React.lazy(() => import('./pages/finances-expenses'));
// Per-tab finances workspaces
const FinancesClients = React.lazy(() => import('./pages/finances-clients'));
const FinancesMaterials = React.lazy(() => import('./pages/finances-materials'));
const FinancesEstimates = React.lazy(() => import('./pages/finances-estimates'));
const FinancesJobs = React.lazy(() => import('./pages/finances-jobs'));
const FinancesEmployees = React.lazy(() => import('./pages/finances-employees'));
const FinancesPayroll = React.lazy(() => import('./pages/finances-payroll'));
const FinancesVendors = React.lazy(() => import('./pages/finances-vendors'));
const FinancesBankAccounts = React.lazy(() => import('./pages/finances-bank-accounts'));
const FinancesReports = React.lazy(() => import('./pages/finances-reports'));
const FinancesSettings = React.lazy(() => import('./pages/finances-settings'));
const TasksHub = React.lazy(() => import('./pages/tasks'));
const DealRoomPage = React.lazy(() => import('./pages/deal-room'));
// NOTE: CommunityFeedOld mock has been quarantined to client/src/playgrounds/CommunityFeedMock.tsx
// and should not be routed. This lazy import is intentionally removed.
const CommunityModerationDemo = React.lazy(() => import('./pages/CommunityModerationDemo'));
const Checkout = React.lazy(() => import('./pages/checkout'));
const PaymentSuccess = React.lazy(() => import('./pages/payment-success'));
const PaymentHistory = React.lazy(() => import('./pages/payment-history'));
const Wallet = React.lazy(() => import('./pages/wallet'));
const RequestQuote = React.lazy(() => import('./pages/request-quote'));
const SavedContractors = React.lazy(() => import('./pages/saved-contractors'));
const Notifications = React.lazy(() => import('./pages/notifications'));
const Settings = React.lazy(() => import('./pages/settings'));
const ProfileSettings = React.lazy(() => import('./pages/ProfileSettings'));
const PublicProfileView = React.lazy(() => import('./pages/PublicProfileView'));
const BusinessProfileView = React.lazy(() => import('./pages/BusinessProfileView'));
const BusinessProfileEditor = React.lazy(() => import('./pages/BusinessProfileEditor'));
const ProfileSiteView = React.lazy(() => import('./pages/ProfileSiteView'));
const ProfileSiteEditor = React.lazy(() => import('./pages/ProfileSiteEditor'));
const Help = React.lazy(() => import('./pages/help'));
const Invite = React.lazy(() => import('./pages/invite'));
const CustomDashboard = React.lazy(() => import('./pages/Dashboard'));
const DashboardSettings = React.lazy(() => import('./pages/DashboardSettings'));
const RoleDashboardRouter = React.lazy(() => import('./components/RoleDashboardRouter'));
const DashboardJobs = React.lazy(() => import('./pages/dashboard-jobs'));
const RecommendationGeneratorPage = React.lazy(() => import('./pages/contractor/recommendation-generator'));

// Role-specific Dashboards (heavy components)
const ContractorDashboard = React.lazy(() => import('./pages/contractor-dashboard-simple'));
const HomeownerDashboard = React.lazy(() => import('./pages/homeowner-dashboard'));
const RealtorDashboard = React.lazy(() => import('./pages/realtor-dashboard'));
const StoryGeneratorPage = React.lazy(() => import('./pages/StoryGeneratorPage'));
const DealerDashboard = React.lazy(() => import('./pages/dealer-dashboard'));
const CarSalesmanDashboard = React.lazy(() => import('./pages/car-salesman-dashboard'));
const HelperDashboard = React.lazy(() => import('./pages/helper-dashboard'));
const InsuranceAgentDashboard = React.lazy(() => import('./pages/insurance-agent-dashboard'));
const PropertyManagerDashboard = React.lazy(() => import('./pages/property-manager-dashboard'));
const MortgageBrokerDashboard = React.lazy(() => import('./pages/mortgage-broker-dashboard'));
// const StaffDashboard = React.lazy(() => import('./pages/staff-dashboard'));

// Applications
const RealtorApplication = React.lazy(() => import('./pages/realtor-application'));
const CarSalesmanApplication = React.lazy(() => import('./pages/car-salesman-application'));

// Legal & Info
const Terms = React.lazy(() => import('./pages/terms'));
const Privacy = React.lazy(() => import('./pages/privacy'));
const PrivacyRequest = React.lazy(() => import('./pages/privacy-request'));
const About = React.lazy(() => import('./pages/about'));
const Contact = React.lazy(() => import('./pages/contact'));
const Pricing = React.lazy(() => import('./pages/pricing'));
const NotFound = React.lazy(() => import('./pages/not-found'));
const Unauthorized = React.lazy(() => import('./pages/Unauthorized'));

// Marketing & Promotions
const Promotions = React.lazy(() => import('./pages/promotions'));
const AdCreator = React.lazy(() => import('./pages/ad-creator'));
const Analytics = React.lazy(() => import('./pages/analytics'));
const ProjectTracker = React.lazy(() => import('./pages/lead-management'));

// Additional Missing Pages
const CountyHub = React.lazy(() => import('./pages/county-hub'));
const Verification = React.lazy(() => import('./pages/verification'));
const InsuranceVerification = React.lazy(() => import('./pages/insurance-verification'));
const LicenseVerification = React.lazy(() => import('./pages/license-verification'));
const BackgroundCheck = React.lazy(() => import('./pages/background-check'));
const Compliance = React.lazy(() => import('./pages/compliance'));
const Documentation = React.lazy(() => import('./pages/documentation'));

// New Complete Pages
const CRM = React.lazy(() => import('./pages/crm'));
const VehicleMarketplace = React.lazy(() => import('./pages/vehicle-marketplace'));
const HOADashboard = React.lazy(() => import('./pages/hoa-dashboard'));
const RealEstateMarketplace = React.lazy(() => import('./pages/real-estate-marketplace'));
const CoffeeCompany = React.lazy(() => import('./pages/coffee-company'));
const AdministrativeDashboard = React.lazy(() => import('./pages/administrative-dashboard'));
const CountyDirectory = React.lazy(() => import('./pages/county-directory'));
const ApplicationTracker = React.lazy(() => import('./pages/application-tracker'));
const ResourceCenter = React.lazy(() => import('./pages/resource-center'));
const MembershipPortal = React.lazy(() => import('./pages/membership-portal'));
const TrainingCenter = React.lazy(() => import('./pages/training-center'));
const RoleHubPage = React.lazy(() => import('./pages/role-hub'));
const NotesPage = React.lazy(() => import('./pages/notes'));

// Debug / experimental views
const ScoutLandingLite = React.lazy(() => import('./experiments/scout-landing-lite'));

// Advanced Social & Integration Features
const SocialIntegration = React.lazy(() => import('./pages/social-integration'));
const CommunityFeed = React.lazy(() => import('./pages/community-feed'));
const CommunityProfile = React.lazy(() => import('./pages/CommunityProfile'));
const AdvancedSearchNew = React.lazy(() => import('./pages/advanced-search'));
const ReferralDashboard = React.lazy(() => import('./pages/referral-dashboard'));
const EventManagement = React.lazy(() => import('./pages/event-management'));
const APIIntegrations = React.lazy(() => import('./pages/api-integrations'));
const MealScoutPage = React.lazy(() => import('./pages/mealscout'));

// Admin Interactive Features
const ContractorVerification = React.lazy(() => import('./pages/contractor-verification'));
const ContentModeration = React.lazy(() => import('./pages/content-moderation'));
const SystemSettings = React.lazy(() => import('./pages/system-settings'));
const SupportTickets = React.lazy(() => import('./pages/support-tickets'));

// Interactive Action Pages
const ScheduleConsultation = React.lazy(() => import('./pages/schedule-consultation'));
const ApplyAccelerator = React.lazy(() => import('./pages/apply-accelerator'));
const PlatformAnalytics = React.lazy(() => import('./pages/platform-analytics'));
const ManageUsers = React.lazy(() => import('./pages/manage-users'));
const PaymentProcessing = React.lazy(() => import('./pages/payment-processing'));
const FileManagement = React.lazy(() => import('./pages/file-management'));

// Car Sales Pages
const CarSalesNewListing = React.lazy(() => import('./pages/car-sales-new-listing'));
const CarSalesCustomers = React.lazy(() => import('./pages/car-sales-customers'));
const CarSalesFinancing = React.lazy(() => import('./pages/car-sales-financing'));
const CarSalesTradeIn = React.lazy(() => import('./pages/car-sales-trade-in'));
const CarSalesPaymentCalculator = React.lazy(() => import('./pages/car-sales-payment-calculator'));
const CarSalesVinLookup = React.lazy(() => import('./pages/car-sales-vin-lookup'));
const CarSalesAppointments = React.lazy(() => import('./pages/car-sales-appointments'));
const CarSalesFollowUp = React.lazy(() => import('./pages/car-sales-follow-up'));

// Realtor Pages
const RealtorClients = React.lazy(() => import('./pages/realtor-clients'));
const RealtorMarketAnalysis = React.lazy(() => import('./pages/realtor-market-analysis'));
const RealtorConnections = React.lazy(() => import('./pages/realtor-connections'));
const ConnectionsPage = React.lazy(() => import('./pages/connections'));
const RealtorCalculator = React.lazy(() => import('./pages/realtor-calculator'));
const RealtorCMA = React.lazy(() => import('./pages/realtor-cma'));
const RealtorAppointments = React.lazy(() => import('./pages/realtor-appointments'));
const RealtorContacts = React.lazy(() => import('./pages/realtor-contacts'));

// Lazy component wrapper for better error handling
const LazyPage = memo(function LazyPage({ 
  Component, 
  fallback = <PageLoader />
}: { 
  Component: React.LazyExoticComponent<React.ComponentType<any>>;
  fallback?: React.ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      <Component />
    </Suspense>
  );
});

// Main app layout component
const AppLayout = memo(function AppLayout() {
  const [location, setLocation] = useLocation();
  // Lite / experimental Scout surfaces can still run outside AppShell,
  // but the main Scout experience lives at /scout inside the app frame.
  const isLiteScoutRoute = location === '/_scout-lite';
  const isLlmRoute = location.startsWith('/scout');

  const { user, isAuthenticated, isLoading } = useAuth();

  const [showBetaNotice, setShowBetaNotice] = useState(false);

  useEffect(() => {
    const dismissed = typeof window !== 'undefined' ? sessionStorage.getItem('ts_beta_notice_dismissed_session') : null;
    if (!dismissed) {
      setShowBetaNotice(true);
    }
  }, []);

  // Identity funnel telemetry: emit once per browser session
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isLoading) return;

    const flagKey = 'ts_identity_session_logged';
    if (sessionStorage.getItem(flagKey) === '1') return;

    const currentPath = location || window.location.pathname + window.location.search;

    let entryRoute: 'login' | 'register' | 'oauth' | 'other' = 'other';
    if (currentPath.startsWith('/login')) {
      entryRoute = 'login';
    } else if (currentPath.startsWith('/register') || currentPath.startsWith('/signup')) {
      entryRoute = 'register';
    } else if (
      currentPath.startsWith('/profile-settings') &&
      window.location.search.includes('onboarding=1')
    ) {
      entryRoute = 'oauth';
    }

    const roles: string[] = (() => {
      if (!user) return [];
      const anyUser = user as any;
      if (Array.isArray(anyUser.roles) && anyUser.roles.length > 0) {
        return anyUser.roles as string[];
      }
      if (typeof anyUser.role === 'string' && anyUser.role.length > 0) {
        return [anyUser.role as string];
      }
      return [];
    })();

    const hasCompletedProfileBasics = !!(user && (user as any).onboardingCompleted);

    trackShellEvent({
      type: 'identity_session',
      isAuthenticated: !!user,
      entryRoute,
      userTypesCount: roles.length,
      userTypes: roles,
      hasCompletedProfileBasics,
    });

    sessionStorage.setItem(flagKey, '1');
  }, [location, isLoading, user, isAuthenticated]);

  // Back-compat: older Scout links were encoded as '/?prompt=...'
  useEffect(() => {
    if (location.startsWith('/?')) {
      setLocation(`/scout${location.substring(1)}`);
    }
  }, [location, setLocation]);

  // Respect user default home page preference when landing on '/'
  useEffect(() => {
    if (!isAuthenticated || !user?.preferences?.defaultHomePage) return;

    const defaultPage = user.preferences.defaultHomePage as any;
    const targetRoute = resolveDefaultHomeRoute(defaultPage);

    if (targetRoute && location === '/') {
      setLocation(targetRoute);
    }
  }, [isAuthenticated, user, location, setLocation]);

  const dismissBetaNotice = () => {
    sessionStorage.setItem('ts_beta_notice_dismissed_session', 'true');
    setShowBetaNotice(false);
  };

  const appBackgroundClass = 'bg-tsBg';
  const mainClassName = isLiteScoutRoute
    ? 'flex-1 relative w-full bg-tsBg'
    : 'flex-1 relative w-full bg-tsBg';

  const ContractorsBoardLegacy = memo(function ContractorsBoardLegacy() {
    const [, setLocationInner] = useLocation();

    useEffect(() => {
      if (isLoading) return;
      if (isAuthenticated) {
        setLocationInner('/dashboard/jobs');
      }
    }, [isAuthenticated, isLoading, setLocationInner]);

    if (isLoading) return null;
    if (isAuthenticated) return null;

    return <LazyPage Component={FindContractors} />;
  });

  return (
    <SimpleMobileGestures>
      <div className={`min-h-screen ${appBackgroundClass} text-tsTextMain font-sans flex flex-col`}>
        {showBetaNotice && (
          <div
            className="fixed left-1/2 bottom-24 z-50 max-w-md w-full -translate-x-1/2 rounded-2xl border border-orange-500 bg-[color:var(--theme-accent-primary)] shadow-2xl shadow-orange-500/30 p-6 flex flex-col items-center justify-center"
            style={{
              color: 'var(--theme-on-accent, #fff)',
              background: 'var(--theme-accent-primary, #ff6600)',
              borderColor: 'var(--theme-accent-primary, #ff6600)',
              boxShadow: '0 4px 32px 0 rgba(249,115,22,0.25)',
            }}
          >
            <div className="flex items-center gap-3 w-full justify-center">
              <div className="h-2 w-2 rounded-full bg-orange-300 shadow-[0_0_0_4px_rgba(249,115,22,0.25)]" />
              <p className="font-bold tracking-wide text-lg" style={{color: 'var(--theme-on-accent, #fff)'}}>TradeScout is in active beta</p>
              <button
                aria-label="Dismiss beta notice"
                onClick={dismissBetaNotice}
                className="ml-auto text-white hover:text-orange-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="leading-relaxed mt-3 text-center font-medium" style={{color: 'var(--theme-on-accent, #fff)'}}>
              You may encounter rough edges, non-working features, or intermittent errors.<br />
              Add TradeScout to your home screen from your browser so it lives like an app, and please share issues so we can polish fast.
            </p>
          </div>
        )}

        <main className={mainClassName}>
          <ErrorBoundary fallback={<PageLoader />}>
            {isLiteScoutRoute ? (
              <Switch>
                <Route path="/_scout-lite">
                  <LazyPage Component={ScoutLandingLite} />
                </Route>
                <Route path=":rest*"><LazyPage Component={NotFound} /></Route>
              </Switch>
            ) : (
              <AppShell>
                <Switch>
                  {/* Scout OS: primary AI controller surface and landing page */}
                  <Route path="/" component={ScoutOS} />
                  <Route path="/scout" component={ScoutOS} />
                  {/* Home routes */}
                  <Route path="/home" component={SmartHome} />

              {/* Role hubs for each user type */}
              <Route path="/roles/:roleKey">
                <LazyPage Component={RoleHubPage} />
              </Route>

              {/* Dashboard routes (auth required) */}
              <Route path="/dashboard">
                <ProtectedRoute>
                  <LazyPage Component={RoleDashboardRouter} />
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

                {/* Auth routes */}
                  <Route path="/login"><LazyPage Component={Login} /></Route>
                  <Route path="/register"><LazyPage Component={Register} /></Route>
                  <Route path="/signup"><LazyPage Component={Signup} /></Route>

                  {/* Legacy auth URLs: redirect old /auth/* paths to current routes */}
                  <Route path="/auth/login">
                    <RedirectTo to="/login" />
                  </Route>
                  <Route path="/auth/signup">
                    <RedirectTo to="/register" />
                  </Route>
                  <Route path="/address-verification"><LazyPage Component={AddressVerification} /></Route>
                  <Route path="/unauthorized"><LazyPage Component={Unauthorized} /></Route>

                  {/* Legacy guard: hard-redirect any old profile setup links into the dashboard */}
                  <Route path="/profile-setup">
                    <RedirectTo to="/dashboard" />
                  </Route>
                  
                  {/* Core pages */}
                  {/* Contractors: licensed/verified contractor search + profiles */}
                  <Route path="/contractors/apply"><LazyPage Component={ContractorApply} /></Route>
                  {/* Legacy alias: older pages link to /contractors/board for contractor search */}
                  <Route path="/contractors/board"><ContractorsBoardLegacy /></Route>
                  <Route path="/contractors/:slug"><LazyPage Component={ContractorProfile} /></Route>
                  <Route path="/contractors"><LazyPage Component={FindContractors} /></Route>

                  {/* Contractor project requests / leads */}
                  <Route path="/contractor-leads">
                    <ProtectedRoute>
                      <LazyPage Component={ContractorLeads} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/contractor/leads">
                    <RedirectTo to="/contractor-leads" />
                  </Route>

                  {/* Helpers + Tasks */}
                  <Route path="/helpers"><LazyPage Component={WorkerMarketplace} /></Route>
                  <Route path="/daily-deals/:rest*"><LazyPage Component={DailyDeals} /></Route>
                  <Route path="/help-demo/:rest*"><LazyPage Component={HelpDemo} /></Route>
                  <Route path="/test-page/:rest*"><LazyPage Component={TestPage} /></Route>
                  <Route path="/profile">
                    <ProtectedRoute>
                      <LazyPage Component={Profile} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/profile/:userId"><LazyPage Component={PublicProfileView} /></Route>
                  <Route path="/p/:slug"><LazyPage Component={ProfileSiteView} /></Route>
                  <Route path="/p/:slug/edit">
                    <ProtectedRoute>
                      <LazyPage Component={ProfileSiteEditor} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/business/:slug"><LazyPage Component={BusinessProfileView} /></Route>
                  <Route path="/business/:slug/edit">
                    <ProtectedRoute>
                      <LazyPage Component={BusinessProfileEditor} />
                    </ProtectedRoute>
                  </Route>
                  
                  {/* Business routes */}
                  <Route path="/contractor-board">
                    <RedirectTo to="/contractor-dashboard" />
                  </Route>
                  <Route path="/contractor-apply"><LazyPage Component={ContractorApply} /></Route>
                  <Route path="/business-listing"><LazyPage Component={BusinessListing} /></Route>
                  <Route path="/business-owner-dashboard"><LazyPage Component={BusinessOwnerDashboard} /></Route>
                  <Route path="/accelerator"><LazyPage Component={Accelerator} /></Route>
                  
                  {/* Marketplace routes */}
                  <Route path="/worker-marketplace"><LazyPage Component={WorkerMarketplace} /></Route>
                  <Route path="/marketplace"><RedirectTo to="/exchange" /></Route>
                  <Route path="/exchange/list"><RedirectTo to="/exchange" /></Route>
                  <Route path="/vehicle-marketplace"><LazyPage Component={VehicleMarketplace} /></Route>
                  <Route path="/real-estate-marketplace"><LazyPage Component={RealEstateMarketplace} /></Route>
                  <Route path="/handmade-marketplace"><LazyPage Component={HandmadeMarketplace} /></Route>
                  <Route path="/exchange"><LazyPage Component={Exchange} /></Route>
                  <Route path="/mealscout">
                    <ProtectedRoute>
                      <LazyPage Component={MealScoutPage} />
                    </ProtectedRoute>
                  </Route>
                  
                  {/* Groups routes */}
                  <Route path="/groups"><LazyPage Component={Groups} /></Route>
                  <Route path="/group/:id"><LazyPage Component={GroupDetail} /></Route>
                  <Route path="/hoa-management">
                    <ProtectedRoute>
                      <LazyPage Component={HoaManagement} />
                    </ProtectedRoute>
                  </Route>
                  {/* Community tab should show the rich Nextdoor-style feed */}
                  <Route path="/community"><LazyPage Component={CommunityFeed} /></Route>
                  <Route path="/community-feed"><LazyPage Component={CommunityFeed} /></Route>
                  <Route path="/community/u/:userId"><LazyPage Component={CommunityProfile} /></Route>
                  <Route path="/community-moderation"><LazyPage Component={CommunityModerationDemo} /></Route>
                  
                  {/* Community Builder routes */}
                  <Route path="/profile/:profileId/community">
                    <LazyPage Component={ProfileCommunity} />
                  </Route>
                  <Route path="/community-builder/dashboard">
                    <ProtectedRoute>
                      <LazyPage Component={CommunityBuilderDashboard} />
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
                  <Route path="/admin-panel">
                    <ProtectedRoute adminOnly>
                      <LazyPage Component={AdminPanel} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/admin/panel">
                    <ProtectedRoute adminOnly>
                      <LazyPage Component={AdminPanel} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/admin/users">
                    <ProtectedRoute adminOnly>
                      <LazyPage Component={AdminUsers} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/admin/user-management">
                    <ProtectedRoute adminOnly>
                      <LazyPage Component={AdminUserManagement} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/admin/workspace">
                    <ProtectedRoute adminOnly>
                      <LazyPage Component={AdminWorkspace} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/admin/error-reports">
                    <ProtectedRoute adminOnly>
                      <LazyPage Component={AdminErrorReports} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/admin/testing">
                    <ProtectedRoute adminOnly>
                      <LazyPage Component={AdminTestingControls} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/admin/address-verifications">
                    <ProtectedRoute adminOnly>
                      <LazyPage Component={AdminAddressVerifications} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/admin/professional-verification">
                    <ProtectedRoute adminOnly>
                      <LazyPage Component={AdminProfessionalVerification} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/admin/listings">
                    <ProtectedRoute adminOnly>
                      <LazyPage Component={AdminListings} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/admin/attachments">
                    <ProtectedRoute adminOnly>
                      <LazyPage Component={AdminAttachments} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/admin/pricing-analytics">
                    <ProtectedRoute adminOnly>
                      <LazyPage Component={AdminPricingAnalytics} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/admin/create-account">
                    <ProtectedRoute adminOnly>
                      <LazyPage Component={AdminCreateAccount} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/admin/affiliates">
                    <ProtectedRoute adminOnly>
                      <LazyPage Component={AdminAffiliates} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/admin/system-prompt">
                    <ProtectedRoute adminOnly>
                      <LazyPage Component={PromptAdminPage} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/admin/community-builder/reconciliation">
                    <ProtectedRoute adminOnly>
                      <LazyPage Component={AdminCommunityBuilderReconciliation} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/admin/community-builder/builders">
                    <ProtectedRoute adminOnly>
                      <LazyPage Component={AdminCommunityBuilderBuilders} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/admin/:rest*">
                    <ProtectedRoute adminOnly>
                      <LazyPage Component={AdminDashboard} />
                    </ProtectedRoute>
                  </Route>
                  
                  {/* Dashboard routes (auth required) */}
                  <Route path="/contractor-dashboard">
                    <ProtectedRoute>
                      <LazyPage Component={ContractorDashboard} />
                    </ProtectedRoute>
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
                  <Route path="/dealer-dashboard">
                    <ProtectedRoute>
                      <LazyPage Component={DealerDashboard} />
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
                  <Route path="/insurance-agent-dashboard">
                    <ProtectedRoute>
                      <LazyPage Component={InsuranceAgentDashboard} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/property-manager-dashboard">
                    <ProtectedRoute>
                      <LazyPage Component={PropertyManagerDashboard} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/mortgage-broker-dashboard">
                    <ProtectedRoute>
                      <LazyPage Component={MortgageBrokerDashboard} />
                    </ProtectedRoute>
                  </Route>
                  {/* Staff dashboard route is disabled for now while we stabilize core flows */}
                  {/*
                  <Route path="/staff-dashboard">
                    <ProtectedRoute>
                      <LazyPage Component={StaffDashboard} />
                    </ProtectedRoute>
                  </Route>
                  */}
                  
                  {/* Common pages */}
                  <Route path="/chat">
                    <ProtectedRoute>
                      <LazyPage Component={Chat} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/messages">
                    <ProtectedRoute>
                      <LazyPage Component={Messages} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/saved-ads">
                    <ProtectedRoute>
                      <LazyPage Component={SavedAds} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/saved-contractors">
                    <ProtectedRoute>
                      <LazyPage Component={SavedContractors} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/affiliate"><LazyPage Component={Affiliate} /></Route>
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
                  <Route path="/help"><LazyPage Component={Help} /></Route>
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
                  <Route path="/boosts"><LazyPage Component={Boosts} /></Route>
                  <Route path="/analytics"><LazyPage Component={Analytics} /></Route>
                  <Route path="/crm"><LazyPage Component={CRM} /></Route>
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
                  <Route path="/finances/settings">
                    <ProtectedRoute>
                      <LazyPage Component={FinancesSettings} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/deal-room">
                    <ProtectedRoute>
                      <LazyPage Component={DealRoomPage} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/accounting">
                    <ProtectedRoute>
                      <LazyPage Component={Accounting} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/project-tracker"><LazyPage Component={ProjectTracker} /></Route>
                  <Route path="/lead-management"><LazyPage Component={ProjectTracker} /></Route>
                  <Route path="/ad-creator"><LazyPage Component={AdCreator} /></Route>
                  <Route path="/promotions"><LazyPage Component={Promotions} /></Route>
                  <Route path="/growth-pack"><LazyPage Component={GrowthPack} /></Route>
                  <Route path="/quote-calculator"><RedirectTo to="/scout?intent=estimate" /></Route>
                  <Route path="/quote"><RedirectTo to="/scout?intent=estimate" /></Route>
                  <Route path="/recommendations">
                    <ProtectedRoute>
                      <LazyPage Component={RecommendationGeneratorPage} />
                    </ProtectedRoute>
                  </Route>
                  
                  {/* Community & Geographic */}
                  <Route path="/county-directory"><LazyPage Component={CountyDirectory} /></Route>
                  <Route path="/county-hub"><LazyPage Component={CountyHub} /></Route>
                  <Route path="/leaderboard"><LazyPage Component={Leaderboard} /></Route>
                  <Route path="/foundation"><LazyPage Component={Foundation} /></Route>
                  <Route path="/coffee-company"><LazyPage Component={CoffeeCompany} /></Route>
                  <Route path="/resource-center"><LazyPage Component={ResourceCenter} /></Route>
                  
                  {/* Additional Features */}
                  <Route path="/hoa-dashboard">
                    <ProtectedRoute>
                      <LazyPage Component={HOADashboard} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/hoa-dashboard/:hoaId">
                    <ProtectedRoute>
                      <LazyPage Component={HOADashboard} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/membership-portal"><LazyPage Component={MembershipPortal} /></Route>
                  <Route path="/training-center"><LazyPage Component={TrainingCenter} /></Route>
                  <Route path="/application-tracker"><LazyPage Component={ApplicationTracker} /></Route>
                  <Route path="/administrative-dashboard"><LazyPage Component={AdministrativeDashboard} /></Route>
                  <Route path="/advanced-search"><RedirectTo to="/contractors" /></Route>
                  <Route path="/search"><RedirectTo to="/contractors" /></Route>
                  
                  {/* Applications */}
                  <Route path="/realtor-application"><LazyPage Component={RealtorApplication} /></Route>
                  <Route path="/car-salesman-application"><LazyPage Component={CarSalesmanApplication} /></Route>
                  
                  {/* Car Sales Features */}
                  <Route path="/car-sales-new-listing"><LazyPage Component={CarSalesNewListing} /></Route>
                  <Route path="/car-sales-customers"><LazyPage Component={CarSalesCustomers} /></Route>
                  <Route path="/car-sales-financing"><LazyPage Component={CarSalesFinancing} /></Route>
                  <Route path="/car-sales-trade-in"><LazyPage Component={CarSalesTradeIn} /></Route>
                  <Route path="/car-sales-payment-calculator"><LazyPage Component={CarSalesPaymentCalculator} /></Route>
                  <Route path="/car-sales-vin-lookup"><LazyPage Component={CarSalesVinLookup} /></Route>
                  <Route path="/car-sales-appointments"><LazyPage Component={CarSalesAppointments} /></Route>
                  <Route path="/car-sales-follow-up"><LazyPage Component={CarSalesFollowUp} /></Route>
                  
                  {/* Realtor Features */}
                  <Route path="/realtor-clients"><LazyPage Component={RealtorClients} /></Route>
                  <Route path="/realtor-market-analysis"><LazyPage Component={RealtorMarketAnalysis} /></Route>
                  <Route path="/realtor-connections"><LazyPage Component={RealtorConnections} /></Route>
                  <Route path="/connections"><LazyPage Component={ConnectionsPage} /></Route>
                  <Route path="/realtor-calculator"><LazyPage Component={RealtorCalculator} /></Route>
                  <Route path="/realtor-cma"><LazyPage Component={RealtorCMA} /></Route>
                  <Route path="/realtor-appointments"><LazyPage Component={RealtorAppointments} /></Route>
                  <Route path="/realtor-contacts"><LazyPage Component={RealtorContacts} /></Route>
                  
                  {/* Verification & Compliance */}
                  <Route path="/verification"><LazyPage Component={Verification} /></Route>
                  <Route path="/insurance-verification"><LazyPage Component={InsuranceVerification} /></Route>
                  <Route path="/license-verification"><LazyPage Component={LicenseVerification} /></Route>
                  <Route path="/background-check"><LazyPage Component={BackgroundCheck} /></Route>
                  <Route path="/compliance"><LazyPage Component={Compliance} /></Route>
                  <Route path="/documentation"><LazyPage Component={Documentation} /></Route>
                  
                  {/* Advanced Admin */}
                  <Route path="/contractor-verification"><LazyPage Component={ContractorVerification} /></Route>
                  <Route path="/content-moderation"><LazyPage Component={ContentModeration} /></Route>
                  <Route path="/system-settings"><LazyPage Component={SystemSettings} /></Route>
                  <Route path="/support-tickets"><LazyPage Component={SupportTickets} /></Route>
                  <Route path="/platform-analytics"><LazyPage Component={PlatformAnalytics} /></Route>
                  <Route path="/manage-users"><LazyPage Component={ManageUsers} /></Route>
                  <Route path="/payment-processing"><LazyPage Component={PaymentProcessing} /></Route>
                  <Route path="/file-management"><LazyPage Component={FileManagement} /></Route>
                  
                  {/* Social & Integration */}
                  <Route path="/social-integration"><LazyPage Component={SocialIntegration} /></Route>
                  <Route path="/referral-dashboard"><LazyPage Component={ReferralDashboard} /></Route>
                  <Route path="/event-management"><LazyPage Component={EventManagement} /></Route>
                  <Route path="/api-integrations"><LazyPage Component={APIIntegrations} /></Route>
                  
                  {/* Interactive Pages */}
                  <Route path="/schedule-consultation"><LazyPage Component={ScheduleConsultation} /></Route>
                  <Route path="/apply-accelerator"><LazyPage Component={ApplyAccelerator} /></Route>
                  <Route path="/request-quote"><LazyPage Component={RequestQuote} /></Route>
                  <Route path="/tasks"><LazyPage Component={TasksHub} /></Route>
                  
                  {/* Notes */}
                  <Route path="/notes"><LazyPage Component={NotesPage} /></Route>
                  
                  {/* Legal pages */}
                  <Route path="/pricing"><LazyPage Component={Pricing} /></Route>
                  <Route path="/terms"><LazyPage Component={Terms} /></Route>
                  <Route path="/privacy"><LazyPage Component={Privacy} /></Route>
                  <Route path="/privacy-request"><LazyPage Component={PrivacyRequest} /></Route>
                  <Route path="/about"><LazyPage Component={About} /></Route>
                  <Route path="/contact"><LazyPage Component={Contact} /></Route>
                  
                  {/* Story Generator */}
                  <Route path="/story-generator"><LazyPage Component={StoryGeneratorPage} /></Route>
                  
                  {/* 404 - this should be last */}
                  <Route path="/:rest*"><LazyPage Component={NotFound} /></Route>
                </Switch>
              </AppShell>
            )}
          </ErrorBoundary>
        </main>
      </div>

      {/* Global components - CONTENT ONLY, NO NAV (AppShell owns all navigation) */}

      {/* Subtle onboarding hints for new users (hide on Scout landing) */}
      {!isLlmRoute && <SimpleSubtleHints />}

      {/* Bug report tool - always available */}
      <SimpleBugReportTool />

    </SimpleMobileGestures>
  );
});
const App = memo(function App() {
  // VERIFICATION: Ensure this is the REAL TradeScout App being loaded
  console.log('✅ REAL TRADE SCOUT APP LOADED - client/src/App.tsx');

  return (
    <ErrorBoundary fallback={<PageLoader />}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <SessionProvider>
            <Router>
              <AppLayout />
            </Router>
            <SimpleFloatingHelp />
          </SessionProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
});

export default App;