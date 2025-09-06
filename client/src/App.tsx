import React, { memo, useState, useEffect, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { ErrorBoundary } from './components/ui/error-boundary';

// Only load essential components eagerly
import SimpleLanding from './pages/SimpleLanding';
import SimpleHome from './pages/SimpleHome';
import SimpleNavigation from './components/layout/SimpleNavigation';
import SimpleMobileGestures from './components/SimpleMobileGestures';
import SimpleSubtleHints from './components/onboarding/SimpleSubtleHints';
import SimpleBugReportTool from './components/SimpleBugReportTool';
import SimpleFloatingHelp from './components/ui/simple-floating-help';
import SimpleRouter from './components/SimpleRouter';
import MobileAppBar from './components/navigation/MobileAppBar';

// Loading component for lazy-loaded pages
import { PageLoadingSpinner } from './components/LoadingSpinner';

const PageLoader = memo(function PageLoader() {
  return <PageLoadingSpinner message="Loading TradeScout..." />;
});

// Lazy load all pages by category for better code splitting
// Core Pages
const FindContractors = React.lazy(() => import('./pages/find-contractors'));
const ContractorBoard = React.lazy(() => import('./pages/contractor-board'));
const QuoteCalculator = React.lazy(() => import('./pages/quote-calculator'));
const DailyDeals = React.lazy(() => import('./pages/daily-deals'));
const HelpDemo = React.lazy(() => import('./pages/help-demo'));
const TestPage = React.lazy(() => import('./pages/test-page'));
const Profile = React.lazy(() => import('./pages/profile'));

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

// Marketplace & Social
const WorkerMarketplace = React.lazy(() => import('./pages/worker-marketplace'));
const Chat = React.lazy(() => import('./pages/chat'));
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
const Help = React.lazy(() => import('./pages/help'));
const Invite = React.lazy(() => import('./pages/invite'));
const Dashboard = React.lazy(() => import('./pages/dashboard'));

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
const LeadManagement = React.lazy(() => import('./pages/lead-management'));

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
            © 2025 TradeScout. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
});

// Main router component with lazy loading
const Router = memo(function Router() {
  const [currentPath, setCurrentPath] = useState(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  
  // Listen for navigation changes
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    
    // Listen for back/forward button
    window.addEventListener('popstate', handleLocationChange);
    
    // Listen for anchor clicks with capture phase
    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      
      console.log('🔍 Click detected on:', target.tagName, target.className);
      
      if (anchor && anchor.href && anchor.href.startsWith(window.location.origin)) {
        console.log('🔥 Navigation intercepted:', anchor.href);
        e.preventDefault();
        e.stopPropagation();
        const newPath = new URL(anchor.href).pathname;
        console.log('🚀 Navigating to:', newPath);
        window.history.pushState({}, '', newPath);
        setCurrentPath(newPath);
      }
    };
    
    document.addEventListener('click', handleClick, true); // Use capture phase
    
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      document.removeEventListener('click', handleClick);
    };
  }, []);
  
  // Render page with lazy loading - all components now use LazyPage wrapper
  const renderPage = () => {
    console.log('🎯 Rendering page for path:', currentPath);
    if (currentPath === '/home' || currentPath === '/dashboard') {
      return <SimpleHome />;
    } else if (currentPath === '/login') {
      return <LazyPage Component={Login} />;
    } else if (currentPath === '/profile-setup') {
      return <LazyPage Component={ProfileSetup} />;
    } else if (currentPath === '/address-verification') {
      return <LazyPage Component={AddressVerification} />;
    } else if (currentPath.startsWith('/find-contractors')) {
      return <LazyPage Component={FindContractors} />;
    } else if (currentPath.startsWith('/contractors') || currentPath.startsWith('/contractor-board')) {
      return <LazyPage Component={ContractorBoard} />;
    } else if (currentPath.startsWith('/quote-calculator')) {
      return <LazyPage Component={QuoteCalculator} />;
    } else if (currentPath.startsWith('/daily-deals')) {
      return <LazyPage Component={DailyDeals} />;
    } else if (currentPath.startsWith('/help-demo')) {
      return <LazyPage Component={HelpDemo} />;
    } else if (currentPath.startsWith('/test-page')) {
      return <LazyPage Component={TestPage} />;
    } else if (currentPath.startsWith('/profile')) {
      return <LazyPage Component={Profile} />;
    } else if (currentPath === '/contractor-apply') {
      return <LazyPage Component={ContractorApply} />;
    } else if (currentPath === '/business-listing') {
      return <LazyPage Component={BusinessListing} />;
    } else if (currentPath === '/business-owner-dashboard') {
      return <LazyPage Component={BusinessOwnerDashboard} />;
    } else if (currentPath === '/accelerator') {
      return <LazyPage Component={Accelerator} />;
    } else if (currentPath === '/admin-panel' || currentPath === '/admin/panel') {
      return <LazyPage Component={AdminPanel} />;
    } else if (currentPath === '/admin/users') {
      return <LazyPage Component={AdminUsers} />;
    } else if (currentPath === '/admin/user-management') {
      return <LazyPage Component={AdminUserManagement} />;
    } else if (currentPath === '/admin/workspace') {
      return <LazyPage Component={AdminWorkspace} />;
    } else if (currentPath === '/admin/error-reports') {
      return <LazyPage Component={AdminErrorReports} />;
    } else if (currentPath === '/admin/testing') {
      return <LazyPage Component={AdminTestingControls} />;
    } else if (currentPath === '/admin/address-verifications') {
      return <LazyPage Component={AdminAddressVerifications} />;
    } else if (currentPath === '/admin/professional-verification') {
      return <LazyPage Component={AdminProfessionalVerification} />;
    } else if (currentPath === '/admin/listings') {
      return <LazyPage Component={AdminListings} />;
    } else if (currentPath === '/admin/attachments') {
      return <LazyPage Component={AdminAttachments} />;
    } else if (currentPath === '/admin/pricing-analytics') {
      return <LazyPage Component={AdminPricingAnalytics} />;
    } else if (currentPath === '/admin/create-account') {
      return <LazyPage Component={AdminCreateAccount} />;
    } else if (currentPath.startsWith('/admin')) {
      return <LazyPage Component={AdminDashboard} />;
    } else if (currentPath === '/worker-marketplace') {
      return <LazyPage Component={WorkerMarketplace} />;
    } else if (currentPath === '/chat') {
      return <LazyPage Component={Chat} />;
    } else if (currentPath === '/saved-ads') {
      return <LazyPage Component={SavedAds} />;
    } else if (currentPath === '/affiliate') {
      return <LazyPage Component={Affiliate} />;
    } else if (currentPath === '/growth-pack') {
      return <LazyPage Component={GrowthPack} />;
    } else if (currentPath === '/boosts') {
      return <LazyPage Component={Boosts} />;
    } else if (currentPath === '/advanced-search') {
      return <LazyPage Component={AdvancedSearch} />;
    } else if (currentPath === '/groups') {
      return <LazyPage Component={Groups} />;
    } else if (currentPath.startsWith('/group/')) {
      return <LazyPage Component={GroupDetail} />;
    } else if (currentPath === '/hoa-management') {
      return <LazyPage Component={HoaManagement} />;
    } else if (currentPath === '/community') {
      return <LazyPage Component={Community} />;
    } else if (currentPath === '/community-feed') {
      return <LazyPage Component={CommunityFeed} />;
    } else if (currentPath === '/community-moderation') {
      return <LazyPage Component={CommunityModerationDemo} />;
    } else if (currentPath === '/marketplace') {
      return <LazyPage Component={Marketplace} />;
    } else if (currentPath === '/exchange') {
      return <LazyPage Component={Exchange} />;
    } else if (currentPath === '/handmade-marketplace') {
      return <LazyPage Component={HandmadeMarketplace} />;
    } else if (currentPath === '/leaderboard') {
      return <LazyPage Component={Leaderboard} />;
    } else if (currentPath === '/foundation') {
      return <LazyPage Component={Foundation} />;
    } else if (currentPath === '/contractor-dashboard') {
      return <LazyPage Component={ContractorDashboard} />;
    } else if (currentPath === '/homeowner-dashboard') {
      return <LazyPage Component={HomeownerDashboard} />;
    } else if (currentPath === '/realtor-dashboard') {
      return <LazyPage Component={RealtorDashboard} />;
    } else if (currentPath === '/dealer-dashboard') {
      return <LazyPage Component={DealerDashboard} />;
    } else if (currentPath === '/car-salesman-dashboard') {
      return <LazyPage Component={CarSalesmanDashboard} />;
    } else if (currentPath === '/helper-dashboard') {
      return <LazyPage Component={HelperDashboard} />;
    } else if (currentPath === '/insurance-agent-dashboard') {
      return <LazyPage Component={InsuranceAgentDashboard} />;
    } else if (currentPath === '/property-manager-dashboard') {
      return <LazyPage Component={PropertyManagerDashboard} />;
    } else if (currentPath === '/mortgage-broker-dashboard') {
      return <LazyPage Component={MortgageBrokerDashboard} />;
    } else if (currentPath === '/staff-dashboard') {
      return <LazyPage Component={StaffDashboard} />;
    } else if (currentPath === '/realtor-application') {
      return <LazyPage Component={RealtorApplication} />;
    } else if (currentPath === '/car-salesman-application') {
      return <LazyPage Component={CarSalesmanApplication} />;
    } else if (currentPath === '/checkout') {
      return <LazyPage Component={Checkout} />;
    } else if (currentPath === '/payment-success') {
      return <LazyPage Component={PaymentSuccess} />;
    } else if (currentPath === '/payment-history') {
      return <LazyPage Component={PaymentHistory} />;
    } else if (currentPath === '/register') {
      return <LazyPage Component={Register} />;
    } else if (currentPath === '/signup') {
      return <LazyPage Component={Signup} />;
    } else if (currentPath === '/invite') {
      return <LazyPage Component={Invite} />;
    } else if (currentPath === '/notifications') {
      return <LazyPage Component={Notifications} />;
    } else if (currentPath === '/settings') {
      return <LazyPage Component={Settings} />;
    } else if (currentPath === '/help') {
      return <LazyPage Component={Help} />;
    } else if (currentPath === '/county-hub') {
      return <LazyPage Component={CountyHub} />;
    } else if (currentPath === '/verification') {
      return <LazyPage Component={Verification} />;
    } else if (currentPath === '/insurance-verification') {
      return <LazyPage Component={InsuranceVerification} />;
    } else if (currentPath === '/license-verification') {
      return <LazyPage Component={LicenseVerification} />;
    } else if (currentPath === '/background-check') {
      return <LazyPage Component={BackgroundCheck} />;
    } else if (currentPath === '/compliance') {
      return <LazyPage Component={Compliance} />;
    } else if (currentPath === '/promotions') {
      return <LazyPage Component={Promotions} />;
    } else if (currentPath === '/ad-creator') {
      return <LazyPage Component={AdCreator} />;
    } else if (currentPath === '/analytics') {
      return <LazyPage Component={Analytics} />;
    } else if (currentPath === '/lead-management') {
      return <LazyPage Component={LeadManagement} />;
    } else if (currentPath === '/documentation') {
      return <LazyPage Component={Documentation} />;
    } else if (currentPath === '/crm' || currentPath === '/crm-dashboard') {
      return <LazyPage Component={CRM} />;
    } else if (currentPath === '/vehicle-marketplace') {
      return <LazyPage Component={VehicleMarketplace} />;
    } else if (currentPath === '/hoa-dashboard') {
      return <LazyPage Component={HOADashboard} />;
    } else if (currentPath === '/real-estate-marketplace') {
      return <LazyPage Component={RealEstateMarketplace} />;
    } else if (currentPath === '/coffee-company' || currentPath === '/coffee') {
      return <LazyPage Component={CoffeeCompany} />;
    } else if (currentPath === '/administrative-dashboard') {
      return <LazyPage Component={AdministrativeDashboard} />;
    } else if (currentPath === '/county-directory') {
      return <LazyPage Component={CountyDirectory} />;
    } else if (currentPath === '/application-tracker') {
      return <LazyPage Component={ApplicationTracker} />;
    } else if (currentPath === '/resource-center') {
      return <LazyPage Component={ResourceCenter} />;
    } else if (currentPath === '/membership-portal' || currentPath === '/membership') {
      return <LazyPage Component={MembershipPortal} />;
    } else if (currentPath === '/training-center' || currentPath === '/training') {
      return <LazyPage Component={TrainingCenter} />;
    } else if (currentPath === '/social-integration' || currentPath === '/social') {
      return <LazyPage Component={SocialIntegration} />;
    } else if (currentPath === '/referral-dashboard' || currentPath === '/referrals') {
      return <LazyPage Component={ReferralDashboard} />;
    } else if (currentPath === '/event-management' || currentPath === '/events') {
      return <LazyPage Component={EventManagement} />;
    } else if (currentPath === '/api-integrations' || currentPath === '/api' || currentPath === '/integrations') {
      return <LazyPage Component={APIIntegrations} />;
    } else if (currentPath === '/contractor-verification') {
      return <LazyPage Component={ContractorVerification} />;
    } else if (currentPath === '/content-moderation' || currentPath === '/moderation') {
      return <LazyPage Component={ContentModeration} />;
    } else if (currentPath === '/car-sales/new-listing') {
      return <LazyPage Component={CarSalesNewListing} />;
    } else if (currentPath === '/car-sales/customers') {
      return <LazyPage Component={CarSalesCustomers} />;
    } else if (currentPath === '/car-sales/financing') {
      return <LazyPage Component={CarSalesFinancing} />;
    } else if (currentPath === '/car-sales/trade-in') {
      return <LazyPage Component={CarSalesTradeIn} />;
    } else if (currentPath === '/car-sales/payment-calculator') {
      return <LazyPage Component={CarSalesPaymentCalculator} />;
    } else if (currentPath === '/car-sales/vin-lookup') {
      return <LazyPage Component={CarSalesVinLookup} />;
    } else if (currentPath === '/car-sales/appointments') {
      return <LazyPage Component={CarSalesAppointments} />;
    } else if (currentPath === '/car-sales/follow-up') {
      return <LazyPage Component={CarSalesFollowUp} />;
    } else if (currentPath === '/realtor/clients') {
      return <LazyPage Component={RealtorClients} />;
    } else if (currentPath === '/realtor/market-analysis') {
      return <LazyPage Component={RealtorMarketAnalysis} />;
    } else if (currentPath === '/realtor/connections') {
      return <LazyPage Component={RealtorConnections} />;
    } else if (currentPath === '/realtor/calculator') {
      return <LazyPage Component={RealtorCalculator} />;
    } else if (currentPath === '/realtor/cma') {
      return <LazyPage Component={RealtorCMA} />;
    } else if (currentPath === '/realtor/appointments') {
      return <LazyPage Component={RealtorAppointments} />;
    } else if (currentPath === '/realtor/contacts') {
      return <LazyPage Component={RealtorContacts} />;
    } else if (currentPath === '/system-settings') {
      return <LazyPage Component={SystemSettings} />;
    } else if (currentPath === '/support-tickets' || currentPath === '/support') {
      return <LazyPage Component={SupportTickets} />;
    } else if (currentPath === '/schedule-consultation' || currentPath === '/consultation') {
      return <LazyPage Component={ScheduleConsultation} />;
    } else if (currentPath === '/apply-accelerator' || currentPath === '/apply') {
      return <LazyPage Component={ApplyAccelerator} />;
    } else if (currentPath === '/platform-analytics') {
      return <LazyPage Component={PlatformAnalytics} />;
    } else if (currentPath === '/manage-users' || currentPath === '/users') {
      return <LazyPage Component={ManageUsers} />;
    } else if (currentPath === '/payment-processing' || currentPath === '/billing' || currentPath === '/payments') {
      return <LazyPage Component={PaymentProcessing} />;
    } else if (currentPath === '/file-management' || currentPath === '/files') {
      return <LazyPage Component={FileManagement} />;
    } else if (currentPath === '/terms') {
      return <LazyPage Component={Terms} />;
    } else if (currentPath === '/privacy') {
      return <LazyPage Component={Privacy} />;
    } else if (currentPath === '/about') {
      return <LazyPage Component={About} />;
    } else if (currentPath === '/contact') {
      return <LazyPage Component={Contact} />;
    } else if (currentPath === '/story-generator') {
      return <LazyPage Component={StoryGeneratorPage} />;
    } else if (currentPath !== '/') {
      return <LazyPage Component={NotFound} />;
    } else {
      return <SimpleLanding />;
    }
  };

  return (
    <SimpleMobileGestures>
      <div className="min-h-screen gradient-bg flex flex-col">
        <SimpleNavigation />
        
        <main className="flex-1 relative">
          <ErrorBoundary fallback={<PageLoader />}>
            {renderPage()}
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
      
    </SimpleMobileGestures>
  );
});

const App = memo(function App() {
  return (
    <ErrorBoundary fallback={<PageLoader />}>
      <QueryClientProvider client={queryClient}>
        <SimpleRouter>
          <Router />
        </SimpleRouter>
        <SimpleFloatingHelp />
      </QueryClientProvider>
    </ErrorBoundary>
  );
});

export default App;