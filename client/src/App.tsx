import React, { memo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { ErrorBoundary } from './components/ui/error-boundary';

// Simple components - using correct paths
import SimpleLanding from './pages/SimpleLanding';
import SimpleHome from './pages/SimpleHome';
import SimpleNavigation from './components/layout/SimpleNavigation';
import SimpleMobileGestures from './components/SimpleMobileGestures';
import SimpleSubtleHints from './components/onboarding/SimpleSubtleHints';
import SimpleBugReportTool from './components/SimpleBugReportTool';
// import SimpleToaster from './components/ui/simple-toaster';
import SimpleFloatingHelp from './components/ui/simple-floating-help';
import SimpleRouter from './components/SimpleRouter';
import MobileAppBar from './components/navigation/MobileAppBar';

// Core TradeScout Pages - Import all functionality
import FindContractors from './pages/find-contractors';
import ContractorBoard from './pages/contractor-board';
import QuoteCalculator from './pages/quote-calculator';
import DailyDeals from './pages/daily-deals';
import HelpDemo from './pages/help-demo';
import TestPage from './pages/test-page';
import Profile from './pages/profile';
import AdminDashboard from './pages/admin-dashboard';

// Authentication & User Management (existing pages)
import Login from './pages/login';
import ProfileSetup from './pages/profile-setup';
import AddressVerification from './pages/address-verification';

// Contractor Features (existing pages)
import ContractorApply from './pages/contractor-apply';
import BusinessListing from './pages/business-listing';
import BusinessOwnerDashboard from './pages/business-owner-dashboard';
import Accelerator from './pages/accelerator';

// Admin Features (existing pages)
import AdminPanel from './pages/admin-panel';
import AdminUserManagement from './pages/AdminUserManagement';
import AdminUsers from './pages/admin-users';
import AdminWorkspace from './pages/admin-workspace';
import AdminErrorReports from './pages/admin-error-reports';
import AdminTestingControls from './pages/admin-testing-controls';
import AdminAddressVerifications from './pages/admin-address-verifications';
import AdminProfessionalVerification from './pages/admin-professional-verification';
import AdminListings from './pages/admin-listings';
import AdminAttachments from './pages/admin-attachments';
import AdminPricingAnalytics from './pages/admin-pricing-analytics';
import AdminCreateAccount from './pages/admin-create-account';

// Marketplace & Social (existing pages)
import WorkerMarketplace from './pages/worker-marketplace';
import Chat from './pages/chat';
import SavedAds from './pages/saved-ads';
import Affiliate from './pages/affiliate';
import GrowthPack from './pages/growth-pack';
import Boosts from './pages/boosts';
import AdvancedSearch from './pages/advanced-search';

// HOA & Groups (existing pages)
import Groups from './pages/groups';
import GroupDetail from './pages/group-detail';
import HoaManagement from './pages/hoa-management';
import Community from './pages/community';

// Additional Features (existing pages)
import Marketplace from './pages/marketplace';
import Exchange from './pages/exchange';
import HandmadeMarketplace from './pages/handmade-marketplace';
import Leaderboard from './pages/leaderboard';
import Foundation from './pages/foundation';
import CommunityFeedOld from './pages/CommunityFeed';
import CommunityModerationDemo from './pages/CommunityModerationDemo';
import Checkout from './pages/checkout';
import PaymentSuccess from './pages/payment-success';
import PaymentHistory from './pages/payment-history';
import Notifications from './pages/notifications';
import Settings from './pages/settings';
import Help from './pages/help';
import Invite from './pages/invite';
import Dashboard from './pages/dashboard';
import Register from './pages/register';
import Signup from './pages/signup';

// Role-specific Dashboards (existing pages)
import ContractorDashboard from './pages/contractor-dashboard-simple';
import HomeownerDashboard from './pages/homeowner-dashboard';
import RealtorDashboard from './pages/realtor-dashboard';
import DealerDashboard from './pages/dealer-dashboard';
import CarSalesmanDashboard from './pages/car-salesman-dashboard';
import HelperDashboard from './pages/helper-dashboard';
import InsuranceAgentDashboard from './pages/insurance-agent-dashboard';
import PropertyManagerDashboard from './pages/property-manager-dashboard';
import MortgageBrokerDashboard from './pages/mortgage-broker-dashboard';
import StaffDashboard from './pages/staff-dashboard';

// Applications (existing pages)
import RealtorApplication from './pages/realtor-application';
import CarSalesmanApplication from './pages/car-salesman-application';

// Legal & Info (existing pages)
import Terms from './pages/terms';
import Privacy from './pages/privacy';
import About from './pages/about';
import Contact from './pages/contact';
import NotFound from './pages/not-found';

// Marketing & Promotions (existing pages)
import Promotions from './pages/promotions';
import AdCreator from './pages/ad-creator';
import Analytics from './pages/analytics';
import LeadManagement from './pages/lead-management';

// Additional Missing Pages
import CountyHub from './pages/county-hub';
import Verification from './pages/verification';
import InsuranceVerification from './pages/insurance-verification';
import LicenseVerification from './pages/license-verification';
import BackgroundCheck from './pages/background-check';
import Compliance from './pages/compliance';
import Documentation from './pages/documentation';

// New Complete Pages
import CRM from './pages/crm';
import VehicleMarketplace from './pages/vehicle-marketplace';
import HOADashboard from './pages/hoa-dashboard';
import RealEstateMarketplace from './pages/real-estate-marketplace';
import CoffeeCompany from './pages/coffee-company';
import AdministrativeDashboard from './pages/administrative-dashboard';
import CountyDirectory from './pages/county-directory';
import ApplicationTracker from './pages/application-tracker';
import ResourceCenter from './pages/resource-center';
import MembershipPortal from './pages/membership-portal';
import TrainingCenter from './pages/training-center';

// Advanced Social & Integration Features
import SocialIntegration from './pages/social-integration';
import CommunityFeed from './pages/community-feed';
import AdvancedSearchNew from './pages/advanced-search';
import ReferralDashboard from './pages/referral-dashboard';
import EventManagement from './pages/event-management';
import APIIntegrations from './pages/api-integrations';

// Admin Interactive Features
import ContractorVerification from './pages/contractor-verification';
import ContentModeration from './pages/content-moderation';
import SystemSettings from './pages/system-settings';
import SupportTickets from './pages/support-tickets';

// Interactive Action Pages
import ScheduleConsultation from './pages/schedule-consultation';
import ApplyAccelerator from './pages/apply-accelerator';
import PlatformAnalytics from './pages/platform-analytics';
import ManageUsers from './pages/manage-users';
import PaymentProcessing from './pages/payment-processing';
import FileManagement from './pages/file-management';

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

// Main router component - using proper component rendering
const Router = memo(function Router() {
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  
  // Direct component rendering with proper JSX
  const renderPage = () => {
    if (currentPath === '/home' || currentPath === '/dashboard') {
      return <SimpleHome />;
    } else if (currentPath === '/login') {
      return <Login />;
    } else if (currentPath === '/profile-setup') {
      return <ProfileSetup />;
    } else if (currentPath === '/address-verification') {
      return <AddressVerification />;
    } else if (currentPath.startsWith('/find-contractors')) {
      return <FindContractors />;
    } else if (currentPath.startsWith('/contractors')) {
      return <ContractorBoard />;
    } else if (currentPath.startsWith('/quote-calculator')) {
      return <QuoteCalculator />;
    } else if (currentPath.startsWith('/daily-deals')) {
      return <DailyDeals />;
    } else if (currentPath.startsWith('/help-demo')) {
      return <HelpDemo />;
    } else if (currentPath.startsWith('/test-page')) {
      return <TestPage />;
    } else if (currentPath.startsWith('/profile')) {
      return <Profile />;
    } else if (currentPath === '/contractor-apply') {
      return <ContractorApply />;
    } else if (currentPath === '/business-listing') {
      return <BusinessListing />;
    } else if (currentPath === '/business-owner-dashboard') {
      return <BusinessOwnerDashboard />;
    } else if (currentPath === '/accelerator') {
      return <Accelerator />;
    } else if (currentPath === '/admin-panel') {
      return <AdminPanel />;
    } else if (currentPath === '/admin/users') {
      return <AdminUsers />;
    } else if (currentPath === '/admin/user-management') {
      return <AdminUserManagement />;
    } else if (currentPath === '/admin/workspace') {
      return <AdminWorkspace />;
    } else if (currentPath === '/admin/error-reports') {
      return <AdminErrorReports />;
    } else if (currentPath === '/admin/testing') {
      return <AdminTestingControls />;
    } else if (currentPath === '/admin/address-verifications') {
      return <AdminAddressVerifications />;
    } else if (currentPath === '/admin/professional-verification') {
      return <AdminProfessionalVerification />;
    } else if (currentPath === '/admin/listings') {
      return <AdminListings />;
    } else if (currentPath === '/admin/attachments') {
      return <AdminAttachments />;
    } else if (currentPath === '/admin/pricing-analytics') {
      return <AdminPricingAnalytics />;
    } else if (currentPath === '/admin/create-account') {
      return <AdminCreateAccount />;
    } else if (currentPath.startsWith('/admin')) {
      return <AdminDashboard />;
    } else if (currentPath === '/worker-marketplace') {
      return <WorkerMarketplace />;
    } else if (currentPath === '/chat') {
      return <Chat />;
    } else if (currentPath === '/saved-ads') {
      return <SavedAds />;
    } else if (currentPath === '/affiliate') {
      return <Affiliate />;
    } else if (currentPath === '/growth-pack') {
      return <GrowthPack />;
    } else if (currentPath === '/boosts') {
      return <Boosts />;
    } else if (currentPath === '/advanced-search') {
      return <AdvancedSearch />;
    } else if (currentPath === '/groups') {
      return <Groups />;
    } else if (currentPath.startsWith('/group/')) {
      return <GroupDetail />;
    } else if (currentPath === '/hoa-management') {
      return <HoaManagement />;
    } else if (currentPath === '/community') {
      return <Community />;
    } else if (currentPath === '/community-feed') {
      return <CommunityFeed />;
    } else if (currentPath === '/community-moderation') {
      return <CommunityModerationDemo />;
    } else if (currentPath === '/marketplace') {
      return <Marketplace />;
    } else if (currentPath === '/exchange') {
      return <Exchange />;
    } else if (currentPath === '/handmade-marketplace') {
      return <HandmadeMarketplace />;
    } else if (currentPath === '/leaderboard') {
      return <Leaderboard />;
    } else if (currentPath === '/foundation') {
      return <Foundation />;
    } else if (currentPath === '/contractor-dashboard') {
      return <ContractorDashboard />;
    } else if (currentPath === '/homeowner-dashboard') {
      return <HomeownerDashboard />;
    } else if (currentPath === '/realtor-dashboard') {
      return <RealtorDashboard />;
    } else if (currentPath === '/dealer-dashboard') {
      return <DealerDashboard />;
    } else if (currentPath === '/car-salesman-dashboard') {
      return <CarSalesmanDashboard />;
    } else if (currentPath === '/helper-dashboard') {
      return <HelperDashboard />;
    } else if (currentPath === '/insurance-agent-dashboard') {
      return <InsuranceAgentDashboard />;
    } else if (currentPath === '/property-manager-dashboard') {
      return <PropertyManagerDashboard />;
    } else if (currentPath === '/mortgage-broker-dashboard') {
      return <MortgageBrokerDashboard />;
    } else if (currentPath === '/staff-dashboard') {
      return <StaffDashboard />;
    } else if (currentPath === '/realtor-application') {
      return <RealtorApplication />;
    } else if (currentPath === '/car-salesman-application') {
      return <CarSalesmanApplication />;
    } else if (currentPath === '/checkout') {
      return <Checkout />;
    } else if (currentPath === '/payment-success') {
      return <PaymentSuccess />;
    } else if (currentPath === '/payment-history') {
      return <PaymentHistory />;
    } else if (currentPath === '/register') {
      return <Register />;
    } else if (currentPath === '/signup') {
      return <Signup />;
    } else if (currentPath === '/invite') {
      return <Invite />;
    } else if (currentPath === '/notifications') {
      return <Notifications />;
    } else if (currentPath === '/settings') {
      return <Settings />;
    } else if (currentPath === '/help') {
      return <Help />;
    } else if (currentPath === '/county-hub') {
      return <CountyHub />;
    } else if (currentPath === '/verification') {
      return <Verification />;
    } else if (currentPath === '/insurance-verification') {
      return <InsuranceVerification />;
    } else if (currentPath === '/license-verification') {
      return <LicenseVerification />;
    } else if (currentPath === '/background-check') {
      return <BackgroundCheck />;
    } else if (currentPath === '/compliance') {
      return <Compliance />;
    } else if (currentPath === '/promotions') {
      return <Promotions />;
    } else if (currentPath === '/ad-creator') {
      return <AdCreator />;
    } else if (currentPath === '/analytics') {
      return <Analytics />;
    } else if (currentPath === '/lead-management') {
      return <LeadManagement />;
    } else if (currentPath === '/documentation') {
      return <Documentation />;
    } else if (currentPath === '/crm' || currentPath === '/crm-dashboard') {
      return <CRM />;
    } else if (currentPath === '/vehicle-marketplace') {
      return <VehicleMarketplace />;
    } else if (currentPath === '/hoa-dashboard') {
      return <HOADashboard />;
    } else if (currentPath === '/real-estate-marketplace') {
      return <RealEstateMarketplace />;
    } else if (currentPath === '/coffee-company' || currentPath === '/coffee') {
      return <CoffeeCompany />;
    } else if (currentPath === '/administrative-dashboard') {
      return <AdministrativeDashboard />;
    } else if (currentPath === '/county-directory') {
      return <CountyDirectory />;
    } else if (currentPath === '/application-tracker') {
      return <ApplicationTracker />;
    } else if (currentPath === '/resource-center') {
      return <ResourceCenter />;
    } else if (currentPath === '/membership-portal' || currentPath === '/membership') {
      return <MembershipPortal />;
    } else if (currentPath === '/training-center' || currentPath === '/training') {
      return <TrainingCenter />;
    } else if (currentPath === '/social-integration' || currentPath === '/social') {
      return <SocialIntegration />;
    } else if (currentPath === '/referral-dashboard' || currentPath === '/referrals') {
      return <ReferralDashboard />;
    } else if (currentPath === '/event-management' || currentPath === '/events') {
      return <EventManagement />;
    } else if (currentPath === '/api-integrations' || currentPath === '/api' || currentPath === '/integrations') {
      return <APIIntegrations />;
    } else if (currentPath === '/contractor-verification') {
      return <ContractorVerification />;
    } else if (currentPath === '/content-moderation' || currentPath === '/moderation') {
      return <ContentModeration />;
    } else if (currentPath === '/system-settings') {
      return <SystemSettings />;
    } else if (currentPath === '/support-tickets' || currentPath === '/support') {
      return <SupportTickets />;
    } else if (currentPath === '/schedule-consultation' || currentPath === '/consultation') {
      return <ScheduleConsultation />;
    } else if (currentPath === '/apply-accelerator' || currentPath === '/apply') {
      return <ApplyAccelerator />;
    } else if (currentPath === '/platform-analytics') {
      return <PlatformAnalytics />;
    } else if (currentPath === '/manage-users' || currentPath === '/users') {
      return <ManageUsers />;
    } else if (currentPath === '/payment-processing' || currentPath === '/billing' || currentPath === '/payments') {
      return <PaymentProcessing />;
    } else if (currentPath === '/file-management' || currentPath === '/files') {
      return <FileManagement />;
    } else if (currentPath === '/terms') {
      return <Terms />;
    } else if (currentPath === '/privacy') {
      return <Privacy />;
    } else if (currentPath === '/about') {
      return <About />;
    } else if (currentPath === '/contact') {
      return <Contact />;
    } else if (currentPath !== '/') {
      return <NotFound />;
    } else {
      return <SimpleLanding />;
    }
  };

  return (
    <SimpleMobileGestures>
      <div className="min-h-screen gradient-bg flex flex-col">
        <SimpleNavigation />
        
        <main className="flex-1 relative">
          {renderPage()}
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
    <ErrorBoundary fallback={<div className="min-h-screen gradient-bg flex items-center justify-center text-white">Loading...</div>}>
      <QueryClientProvider client={queryClient}>
        {/* Toast notifications disabled for now */}
        <SimpleRouter>
          <Router />
        </SimpleRouter>
        <SimpleFloatingHelp />
      </QueryClientProvider>
    </ErrorBoundary>
  );
});

export default App;