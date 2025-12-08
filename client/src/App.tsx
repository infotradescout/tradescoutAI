import React, { memo, Suspense, useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Router, Route, Switch, useLocation } from 'wouter';
import { X } from 'lucide-react';
import { queryClient } from './lib/queryClient';
import { ErrorBoundary } from './components/ui/error-boundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './hooks/useAuth';

// Only load essential components eagerly
import AssistantLanding from './assistant-landing';
import SmartHome from './SmartHome';
import SimpleMobileGestures from './components/SimpleMobileGestures';
import SimpleSubtleHints from './components/onboarding/SimpleSubtleHints';
import SimpleBugReportTool from './components/SimpleBugReportTool';
import SimpleFloatingHelp from './components/ui/simple-floating-help';
import MobileAppBar from './components/navigation/MobileAppBar';
import { AssistantChat } from './components/AssistantChat';
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
const FindContractors = React.lazy(() => import('./pages/find-contractors'));
const ContractorBoard = React.lazy(() => import('./pages/contractor-board'));
const QuoteCalculator = React.lazy(() => import('./pages/quote-calculator'));
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
const CountyTransparency = React.lazy(() => import('./pages/county/transparency'));
const AdminCommunityBuilderReconciliation = React.lazy(() => import('./pages/admin/community-builder-reconciliation'));
const AdminCommunityBuilderBuilders = React.lazy(() => import('./pages/admin/community-builder-builders'));

// Additional Features
const Marketplace = React.lazy(() => import('./pages/marketplace'));
const Exchange = React.lazy(() => import('./pages/exchange'));
const HandmadeMarketplace = React.lazy(() => import('./pages/handmade-marketplace'));
const Leaderboard = React.lazy(() => import('./pages/leaderboard'));
const Foundation = React.lazy(() => import('./pages/foundation'));
const CommunityFeedOld = React.lazy(() => import('./pages/CommunityFeed'));
const CommunityModerationDemo = React.lazy(() => import('./pages/CommunityModerationDemo'));
const Checkout = React.lazy(() => import('./pages/checkout'));
const PaymentSuccess = React.lazy(() => import('./pages/payment-success'));
const PaymentHistory = React.lazy(() => import('./pages/payment-history'));
const Notifications = React.lazy(() => import('./pages/notifications'));
const Settings = React.lazy(() => import('./pages/settings'));
const ProfileSettings = React.lazy(() => import('./pages/ProfileSettings'));
const PublicProfileView = React.lazy(() => import('./pages/PublicProfileView'));
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
const StaffDashboard = React.lazy(() => import('./pages/staff-dashboard'));

// Applications
const RealtorApplication = React.lazy(() => import('./pages/realtor-application'));
const CarSalesmanApplication = React.lazy(() => import('./pages/car-salesman-application'));

// Legal & Info
const Terms = React.lazy(() => import('./pages/terms'));
const Privacy = React.lazy(() => import('./pages/privacy'));
const About = React.lazy(() => import('./pages/about'));
const Contact = React.lazy(() => import('./pages/contact'));
const NotFound = React.lazy(() => import('./pages/not-found'));

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
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();
  const isLlmRoute = location === '/' || location.startsWith('/?');

  const [showBetaNotice, setShowBetaNotice] = useState(false);

  useEffect(() => {
    const dismissed = typeof window !== 'undefined' ? localStorage.getItem('ts_beta_notice_dismissed') : null;
    if (!dismissed) {
      setShowBetaNotice(true);
    }
  }, []);

  const dismissBetaNotice = () => {
    localStorage.setItem('ts_beta_notice_dismissed', 'true');
    setShowBetaNotice(false);
  };

  return (
    <SimpleMobileGestures>
      <div className="min-h-screen bg-tsBg text-tsTextMain font-sans flex flex-col">
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

        <main className="flex-1 relative w-full max-w-none lg:max-w-6xl mx-auto px-3 sm:px-4 py-6">
          <ErrorBoundary fallback={<PageLoader />}>
            <Switch>
              {/* Home routes - Smart routing based on user preferences */}
              <Route path="/" component={SmartHome} />
              {FULL_SITE_PAUSED ? (
                <Route path="/:rest*">
                  <ComingSoon />
                </Route>
              ) : (
                <>
                  <Route path="/home">
                    <ProtectedRoute>
                      <LazyPage Component={RoleDashboardRouter} />
                    </ProtectedRoute>
                  </Route>
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
                  
                  {/* Core pages */}
                  <Route path="/find-contractors/:rest*"><LazyPage Component={FindContractors} /></Route>
                  <Route path="/find-contractors"><LazyPage Component={FindContractors} /></Route>
                  <Route path="/contractors/:rest*"><LazyPage Component={ContractorBoard} /></Route>
                  <Route path="/contractor-board/:rest*"><LazyPage Component={ContractorBoard} /></Route>
                  <Route path="/quote-calculator/:rest*"><LazyPage Component={QuoteCalculator} /></Route>
                  <Route path="/daily-deals/:rest*"><LazyPage Component={DailyDeals} /></Route>
                  <Route path="/help-demo/:rest*"><LazyPage Component={HelpDemo} /></Route>
                  <Route path="/test-page/:rest*"><LazyPage Component={TestPage} /></Route>
                  <Route path="/profile">
                    <ProtectedRoute>
                      <LazyPage Component={Profile} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/profile/:userId"><LazyPage Component={PublicProfileView} /></Route>
                  
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
                  <Route path="/community"><LazyPage Component={Community} /></Route>
                  <Route path="/community-feed"><LazyPage Component={CommunityFeed} /></Route>
                  <Route path="/community-moderation"><LazyPage Component={CommunityModerationDemo} /></Route>
                  
                  {/* Community Builder routes */}
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
                  
                  {/* Admin routes */}
                  <Route path="/admin-panel"><LazyPage Component={AdminPanel} /></Route>
                  <Route path="/admin/panel"><LazyPage Component={AdminPanel} /></Route>
                  <Route path="/admin/users"><LazyPage Component={AdminUsers} /></Route>
                  <Route path="/admin/user-management"><LazyPage Component={AdminUserManagement} /></Route>
                  <Route path="/admin/workspace"><LazyPage Component={AdminWorkspace} /></Route>
                  <Route path="/admin/error-reports"><LazyPage Component={AdminErrorReports} /></Route>
                  <Route path="/admin/testing"><LazyPage Component={AdminTestingControls} /></Route>
                  <Route path="/admin/address-verifications"><LazyPage Component={AdminAddressVerifications} /></Route>
                  <Route path="/admin/professional-verification"><LazyPage Component={AdminProfessionalVerification} /></Route>
                  <Route path="/admin/listings"><LazyPage Component={AdminListings} /></Route>
                  <Route path="/admin/attachments"><LazyPage Component={AdminAttachments} /></Route>
                  <Route path="/admin/pricing-analytics"><LazyPage Component={AdminPricingAnalytics} /></Route>
                  <Route path="/admin/create-account"><LazyPage Component={AdminCreateAccount} /></Route>
                  <Route path="/admin/affiliates">
                    <ProtectedRoute requiredRoles={['super_admin']}>
                      <LazyPage Component={AdminAffiliates} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/admin/system-prompt">
                    <ProtectedRoute requiredRoles={['super_admin', 'head_admin']}>
                      <LazyPage Component={PromptAdminPage} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/admin/community-builder/reconciliation">
                    <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                      <LazyPage Component={AdminCommunityBuilderReconciliation} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/admin/community-builder/builders">
                    <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                      <LazyPage Component={AdminCommunityBuilderBuilders} />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/admin/:rest*"><LazyPage Component={AdminDashboard} /></Route>
                  
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
                  <Route path="/staff-dashboard">
                    <ProtectedRoute>
                      <LazyPage Component={StaffDashboard} />
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
                  <Route path="/terms"><LazyPage Component={Terms} /></Route>
                  <Route path="/privacy"><LazyPage Component={Privacy} /></Route>
                  <Route path="/about"><LazyPage Component={About} /></Route>
                  <Route path="/contact"><LazyPage Component={Contact} /></Route>
                  
                  {/* Story Generator */}
                  <Route path="/story-generator"><LazyPage Component={StoryGeneratorPage} /></Route>
                  
                  {/* 404 - this should be last */}
                  <Route path="/:rest*"><LazyPage Component={NotFound} /></Route>
                </>
              )}
            </Switch>
          </ErrorBoundary>
        </main>
        
        <LegalFooter />
      </div>
      
        {/* Global components */}
        <MobileAppBar />
      
        {/* Subtle onboarding hints for new users */}
        <SimpleSubtleHints />
      
        {/* Bug report tool - always available */}
        <SimpleBugReportTool />

        {/* AI Assistant Chat - hidden on LLM page to avoid duplication */}
        {!isLlmRoute && <AssistantChat isAuthenticated={isAuthenticated} />}
    </SimpleMobileGestures>
  );
});

const App = memo(function App() {
  return (
    <ErrorBoundary fallback={<PageLoader />}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <Router>
            <AppLayout />
          </Router>
          <SimpleFloatingHelp />
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
});

export default App;