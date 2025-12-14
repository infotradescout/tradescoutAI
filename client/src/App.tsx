import React, { memo, Suspense, useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Link, Router, Route, Switch, useLocation } from 'wouter';
import { X } from 'lucide-react';
import { queryClient } from './lib/queryClient';
import { ErrorBoundary } from './components/ui/error-boundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { SessionProvider } from './contexts/SessionContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth, useLogout } from './hooks/useAuth';
import { Button } from './components/ui/button';

// Only load essential components eagerly
import SmartHome from './SmartHome';
import ScoutLanding from './scout';
import SimpleMobileGestures from './components/SimpleMobileGestures';
import SimpleSubtleHints from './components/onboarding/SimpleSubtleHints';
import SimpleBugReportTool from './components/SimpleBugReportTool';
import SimpleFloatingHelp from './components/ui/simple-floating-help';
import MobileAppBar from './components/navigation/MobileAppBar';
import ComingSoon from './pages/coming-soon';

// Loading component for lazy-loaded pages
import { PageLoadingSpinner } from './components/LoadingSpinner';

const PageLoader = memo(function PageLoader() {
  return <PageLoadingSpinner message="Loading TradeScout..." />;
});

// Toggle to gate unfinished full-site features behind a Coming Soon screen
const FULL_SITE_PAUSED = false;

// Lazy load all pages by category for better code splitting
// Core Pages
// Contractors: canonical path now points to worker marketplace
const ContractorsPage = React.lazy(() => import('./pages/worker-marketplace'));
const DailyDeals = React.lazy(() => import('./pages/daily-deals'));
const HelpDemo = React.lazy(() => import('./pages/help-demo'));
const TestPage = React.lazy(() => import('./pages/test-page'));
const Profile = React.lazy(() => import('./pages/ProfilePage'));

// Authentication & User Management
const Login = React.lazy(() => import('./pages/login'));
const ProfileSetup = React.lazy(() => import('./pages/profile-setup'));
const AddressVerification = React.lazy(() => import('./pages/address-verification'));
const Register = React.lazy(() => import('./pages/register'));
const Signup = React.lazy(() => import('./pages/signup'));

// Contractor Features
const ContractorApply = React.lazy(() => import('./pages/contractor-apply'));
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
const CommunityBuilderProfileSetup = React.lazy(() => import('./pages/community-builder/profile-setup'));
const CommunityBuilderContributionSuccess = React.lazy(() => import('./pages/community-builder/contribution-success'));
const ProfileCommunity = React.lazy(() => import('./pages/community-builder/profile-community'));
const CountyTransparency = React.lazy(() => import('./pages/county/transparency'));
const AdminCommunityBuilderReconciliation = React.lazy(() => import('./pages/admin/community-builder-reconciliation'));
const AdminCommunityBuilderBuilders = React.lazy(() => import('./pages/admin/community-builder-builders'));

// Additional Features
const Marketplace = React.lazy(() => import('./pages/marketplace-shell'));
const Exchange = React.lazy(() => import('./pages/exchange'));
const HandmadeMarketplace = React.lazy(() => import('./pages/handmade-marketplace'));
const Leaderboard = React.lazy(() => import('./pages/leaderboard'));
const Foundation = React.lazy(() => import('./pages/foundation'));
// NOTE: CommunityFeedOld mock has been quarantined to client/src/playgrounds/CommunityFeedMock.tsx
// and should not be routed. This lazy import is intentionally removed.
const CommunityModerationDemo = React.lazy(() => import('./pages/CommunityModerationDemo'));
const Checkout = React.lazy(() => import('./pages/checkout'));
const PaymentSuccess = React.lazy(() => import('./pages/payment-success'));
const PaymentHistory = React.lazy(() => import('./pages/payment-history'));
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

// Debug / experimental views
const ScoutLandingLite = React.lazy(() => import('./experiments/scout-landing-lite'));

// Advanced Social & Integration Features
const SocialIntegration = React.lazy(() => import('./pages/social-integration'));
const CommunityFeed = React.lazy(() => import('./pages/community-feed'));
const AdvancedSearchNew = React.lazy(() => import('./pages/advanced-search'));
const ReferralDashboard = React.lazy(() => import('./pages/referral-dashboard'));
const EventManagement = React.lazy(() => import('./pages/event-management'));
const APIIntegrations = React.lazy(() => import('./pages/api-integrations'));

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

// Legal footer component
const LegalFooter = memo(function LegalFooter() {
  return (
    <footer className="bg-navy-900 border-t border-navy-700 mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
          <div className="flex flex-wrap gap-4 mb-4 md:mb-0">
            <a href="/terms" className="hover:text-orange-400 transition-colors">Terms</a>
            <a href="/privacy" className="hover:text-orange-400 transition-colors">Privacy</a>
            <a href="/cookies" className="hover:text-orange-400 transition-colors">Cookies</a>
            <a href="/compliance" className="hover:text-orange-400 transition-colors">Compliance</a>
          </div>
          <div>
            � 2025 TradeScout. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
});

// Main app layout component
const AppLayout = memo(function AppLayout() {
  const [location] = useLocation();
  const isLlmRoute = location === '/' || location === '/scout' || location.startsWith('/?');

  const { isAuthenticated } = useAuth();
  const logout = useLogout();

  const googleAuthEnabled = import.meta.env.VITE_DISABLE_GOOGLE_AUTH !== 'true';
  const facebookAuthEnabled = import.meta.env.VITE_DISABLE_FACEBOOK_AUTH !== 'true';

  const [showBetaNotice, setShowBetaNotice] = useState(false);

  useEffect(() => {
    const dismissed = typeof window !== 'undefined' ? sessionStorage.getItem('ts_beta_notice_dismissed_session') : null;
    if (!dismissed) {
      setShowBetaNotice(true);
    }
  }, []);

  const dismissBetaNotice = () => {
    sessionStorage.setItem('ts_beta_notice_dismissed_session', 'true');
    setShowBetaNotice(false);
  };

  const appBackgroundClass = 'bg-[#060b1c]';
  const mainClassName = isLlmRoute
    ? 'flex-1 relative w-full bg-[#060b1c]'
    : 'flex-1 relative w-full px-3 sm:px-4 md:px-6 py-6 bg-[#060b1c]';

  return (
    <SimpleMobileGestures>
      <div className={`min-h-screen ${appBackgroundClass} text-tsTextMain font-sans flex flex-col`}>
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <Link href="/profile">
                <Button size="sm" variant="secondary" className="bg-black/30 border border-tsBorder hover:bg-black/40">
                  Account
                </Button>
              </Link>
              <Button
                size="sm"
                variant="outline"
                className="border-tsBorder bg-transparent hover:bg-white/5"
                onClick={() => void logout()}
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button size="sm" variant="secondary" className="bg-black/30 border border-tsBorder hover:bg-black/40">
                  Sign in
                </Button>
              </Link>

              {googleAuthEnabled && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-tsBorder bg-transparent hover:bg-white/5"
                  onClick={() => {
                    window.location.href = '/api/auth/google';
                  }}
                >
                  Continue with Google
                </Button>
              )}

              {facebookAuthEnabled && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-tsBorder bg-transparent hover:bg-white/5"
                  onClick={() => {
                    window.location.href = '/api/auth/facebook';
                  }}
                >
                  Continue with Facebook
                </Button>
              )}
            </>
          )}
        </div>

        {!isLlmRoute && (
          <header className="hidden md:block sticky top-0 z-40 backdrop-blur-md bg-slate-950/85 border-b border-tsBorder shadow-lg">
            <div className="w-full px-6 py-4 flex flex-col items-center gap-3 text-center">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-tsAccent to-orange-700 p-2 rounded-xl shadow-lg shadow-orange-500/40" />
                <div className="text-left">
                  <div className="text-xs uppercase tracking-[0.22em] text-tsAccentSoft">TRADE SCOUT</div>
                  <div className="text-xl font-semibold text-tsTextMain leading-tight">Connection Without Compromise</div>
                </div>
              </div>
            </div>
          </header>
        )}

        {showBetaNotice && (
          <div className="fixed bottom-24 right-4 z-50 max-w-sm rounded-2xl border border-orange-400/50 bg-slate-950/95 shadow-2xl shadow-orange-500/20 p-4 text-sm text-gray-100">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-2 w-2 rounded-full bg-orange-400 shadow-[0_0_0_4px_rgba(249,115,22,0.25)]" />
              <div className="space-y-1">
                <p className="text-orange-200 font-semibold">TradeScout is in active beta</p>
                <p className="text-gray-300 leading-relaxed">
                  You may encounter rough edges, non-working features, or intermittent errors. Thanks for exploring—please share issues so we can polish fast.
                </p>
              </div>
              <button
                aria-label="Dismiss beta notice"
                onClick={dismissBetaNotice}
                className="ml-auto text-gray-400 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <main className={mainClassName}>
          <ErrorBoundary fallback={<PageLoader />}>
            <Switch>
              {/* Home routes - Scout landing is the primary front door */}
              <Route path="/" component={ScoutLanding} />
              <Route path="/scout" component={ScoutLanding} />
              <Route path="/_scout-lite">
                <LazyPage Component={ScoutLandingLite} />
              </Route>

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
              <Route path="/dashboard-settings">
                <ProtectedRoute>
                  <LazyPage Component={DashboardSettings} />
                </ProtectedRoute>
              </Route>

              {/* Auth routes */}
                  <Route path="/login"><LazyPage Component={Login} /></Route>
                  <Route path="/register"><LazyPage Component={Register} /></Route>
                  <Route path="/signup"><LazyPage Component={Signup} /></Route>
                  <Route path="/profile-setup"><LazyPage Component={ProfileSetup} /></Route>
                  <Route path="/address-verification"><LazyPage Component={AddressVerification} /></Route>
                  <Route path="/unauthorized"><LazyPage Component={Unauthorized} /></Route>
                  
                  {/* Core pages */}
                  <Route path="/contractors/:rest*"><LazyPage Component={ContractorsPage} /></Route>
                  <Route path="/contractors"><LazyPage Component={ContractorsPage} /></Route>
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
                  <Route path="/contractor-apply"><LazyPage Component={ContractorApply} /></Route>
                  <Route path="/business-listing"><LazyPage Component={BusinessListing} /></Route>
                  <Route path="/business-owner-dashboard"><LazyPage Component={BusinessOwnerDashboard} /></Route>
                  <Route path="/accelerator"><LazyPage Component={Accelerator} /></Route>
                  
                  {/* Marketplace routes */}
                  <Route path="/worker-marketplace"><LazyPage Component={WorkerMarketplace} /></Route>
                  <Route path="/marketplace"><LazyPage Component={Marketplace} /></Route>
                  <Route path="/vehicle-marketplace"><LazyPage Component={VehicleMarketplace} /></Route>
                  <Route path="/real-estate-marketplace"><LazyPage Component={RealEstateMarketplace} /></Route>
                  <Route path="/handmade-marketplace"><LazyPage Component={HandmadeMarketplace} /></Route>
                  <Route path="/exchange"><LazyPage Component={Exchange} /></Route>
                  
                  {/* Groups routes */}
                  <Route path="/groups"><LazyPage Component={Groups} /></Route>
                  <Route path="/group/:id"><LazyPage Component={GroupDetail} /></Route>
                  <Route path="/hoa-management"><LazyPage Component={HoaManagement} /></Route>
                  {/* Community tab should show the rich Nextdoor-style feed */}
                  <Route path="/community"><LazyPage Component={CommunityFeed} /></Route>
                  <Route path="/community-feed"><LazyPage Component={CommunityFeed} /></Route>
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
                  <Route path="/community-builder/profile-setup">
                    <ProtectedRoute>
                      <LazyPage Component={CommunityBuilderProfileSetup} />
                    </ProtectedRoute>
                  </Route>
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
                  
                  {/* Business Tools */}
                  <Route path="/boosts"><LazyPage Component={Boosts} /></Route>
                  <Route path="/analytics"><LazyPage Component={Analytics} /></Route>
                  <Route path="/crm"><LazyPage Component={CRM} /></Route>
                  <Route path="/project-tracker"><LazyPage Component={ProjectTracker} /></Route>
                  <Route path="/lead-management"><LazyPage Component={ProjectTracker} /></Route>
                  <Route path="/ad-creator"><LazyPage Component={AdCreator} /></Route>
                  <Route path="/promotions"><LazyPage Component={Promotions} /></Route>
                  <Route path="/growth-pack"><LazyPage Component={GrowthPack} /></Route>
                  
                  {/* Community & Geographic */}
                  <Route path="/county-directory"><LazyPage Component={CountyDirectory} /></Route>
                  <Route path="/county-hub"><LazyPage Component={CountyHub} /></Route>
                  <Route path="/leaderboard"><LazyPage Component={Leaderboard} /></Route>
                  <Route path="/foundation"><LazyPage Component={Foundation} /></Route>
                  <Route path="/coffee-company"><LazyPage Component={CoffeeCompany} /></Route>
                  <Route path="/resource-center"><LazyPage Component={ResourceCenter} /></Route>
                  
                  {/* Additional Features */}
                  <Route path="/hoa-dashboard"><LazyPage Component={HOADashboard} /></Route>
                  <Route path="/hoa-dashboard/:hoaId"><LazyPage Component={HOADashboard} /></Route>
                  <Route path="/membership-portal"><LazyPage Component={MembershipPortal} /></Route>
                  <Route path="/training-center"><LazyPage Component={TrainingCenter} /></Route>
                  <Route path="/application-tracker"><LazyPage Component={ApplicationTracker} /></Route>
                  <Route path="/administrative-dashboard"><LazyPage Component={AdministrativeDashboard} /></Route>
                  <Route path="/advanced-search"><LazyPage Component={AdvancedSearch} /></Route>
                  
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
          </ErrorBoundary>
        </main>

        {!isLlmRoute && <LegalFooter />}
      </div>

      {/* Global components */}
      <MobileAppBar />

      {/* Subtle onboarding hints for new users (hide on Scout landing) */}
      {!isLlmRoute && <SimpleSubtleHints />}

      {/* Bug report tool - always available */}
      <SimpleBugReportTool />
    </SimpleMobileGestures>
  );
});

const App = memo(function App() {
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