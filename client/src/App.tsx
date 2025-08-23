import { memo } from 'react';
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
import ContractorDashboard from './pages/contractor-dashboard';
import HomeownerDashboard from './pages/homeowner-dashboard';
import RealtorDashboard from './pages/realtor-dashboard';
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

// Main router component - completely simplified without hooks
const Router = memo(function Router() {
  // Get current path from window location
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  
  // Simple component selection based on path  
  let ComponentToRender = SimpleLanding;
  
  // Complete TradeScout routing - Full functionality restored
  if (currentPath === '/home' || currentPath === '/dashboard') {
    ComponentToRender = SimpleHome;
  } 
  // Authentication & Setup
  else if (currentPath === '/login') {
    ComponentToRender = Login;
  } else if (currentPath === '/profile-setup') {
    ComponentToRender = ProfileSetup;
  } else if (currentPath === '/address-verification') {
    ComponentToRender = AddressVerification;
  }
  // Core Features
  else if (currentPath.startsWith('/find-contractors')) {
    ComponentToRender = FindContractors;
  } else if (currentPath.startsWith('/contractors')) {
    ComponentToRender = ContractorBoard;
  } else if (currentPath.startsWith('/quote-calculator')) {
    ComponentToRender = QuoteCalculator;
  } else if (currentPath.startsWith('/daily-deals')) {
    ComponentToRender = DailyDeals;
  } else if (currentPath.startsWith('/help-demo')) {
    ComponentToRender = HelpDemo;
  } else if (currentPath.startsWith('/test-page')) {
    ComponentToRender = TestPage;
  } else if (currentPath.startsWith('/profile')) {
    ComponentToRender = Profile;
  }
  // Contractor Features
  else if (currentPath === '/contractor-apply') {
    ComponentToRender = ContractorApply;
  } else if (currentPath === '/business-listing') {
    ComponentToRender = BusinessListing;
  } else if (currentPath === '/business-owner-dashboard') {
    ComponentToRender = BusinessOwnerDashboard;
  } else if (currentPath === '/accelerator') {
    ComponentToRender = Accelerator;
  }
  // Admin Features
  else if (currentPath === '/admin-panel') {
    ComponentToRender = AdminPanel;
  } else if (currentPath === '/admin/users') {
    ComponentToRender = AdminUsers;
  } else if (currentPath === '/admin/user-management') {
    ComponentToRender = AdminUserManagement;
  } else if (currentPath === '/admin/workspace') {
    ComponentToRender = AdminWorkspace;
  } else if (currentPath === '/admin/error-reports') {
    ComponentToRender = AdminErrorReports;
  } else if (currentPath === '/admin/testing') {
    ComponentToRender = AdminTestingControls;
  } else if (currentPath === '/admin/address-verifications') {
    ComponentToRender = AdminAddressVerifications;
  } else if (currentPath === '/admin/professional-verification') {
    ComponentToRender = AdminProfessionalVerification;
  } else if (currentPath === '/admin/listings') {
    ComponentToRender = AdminListings;
  } else if (currentPath === '/admin/attachments') {
    ComponentToRender = AdminAttachments;
  } else if (currentPath === '/admin/pricing-analytics') {
    ComponentToRender = AdminPricingAnalytics;
  } else if (currentPath === '/admin/create-account') {
    ComponentToRender = AdminCreateAccount;
  } else if (currentPath.startsWith('/admin')) {
    ComponentToRender = AdminDashboard;
  }
  // Marketplace & Social
  else if (currentPath === '/worker-marketplace') {
    ComponentToRender = WorkerMarketplace;
  } else if (currentPath === '/chat') {
    ComponentToRender = Chat;
  } else if (currentPath === '/saved-ads') {
    ComponentToRender = SavedAds;
  } else if (currentPath === '/affiliate') {
    ComponentToRender = Affiliate;
  } else if (currentPath === '/growth-pack') {
    ComponentToRender = GrowthPack;
  } else if (currentPath === '/boosts') {
    ComponentToRender = Boosts;
  } else if (currentPath === '/advanced-search') {
    ComponentToRender = AdvancedSearch;
  }
  // HOA & Groups
  else if (currentPath === '/groups') {
    ComponentToRender = Groups;
  } else if (currentPath.startsWith('/group/')) {
    ComponentToRender = GroupDetail;
  } else if (currentPath === '/hoa-management') {
    ComponentToRender = HoaManagement;
  } else if (currentPath === '/community') {
    ComponentToRender = Community;
  } else if (currentPath === '/community-feed') {
    ComponentToRender = CommunityFeed;
  } else if (currentPath === '/community-moderation') {
    ComponentToRender = CommunityModerationDemo;
  }
  // Marketplace & Features
  else if (currentPath === '/marketplace') {
    ComponentToRender = Marketplace;
  } else if (currentPath === '/exchange') {
    ComponentToRender = Exchange;
  } else if (currentPath === '/handmade-marketplace') {
    ComponentToRender = HandmadeMarketplace;
  } else if (currentPath === '/leaderboard') {
    ComponentToRender = Leaderboard;
  } else if (currentPath === '/foundation') {
    ComponentToRender = Foundation;
  }
  // Role-specific Dashboards
  else if (currentPath === '/contractor-dashboard') {
    ComponentToRender = ContractorDashboard;
  } else if (currentPath === '/homeowner-dashboard') {
    ComponentToRender = HomeownerDashboard;
  } else if (currentPath === '/realtor-dashboard') {
    ComponentToRender = RealtorDashboard;
  } else if (currentPath === '/car-salesman-dashboard') {
    ComponentToRender = CarSalesmanDashboard;
  } else if (currentPath === '/helper-dashboard') {
    ComponentToRender = HelperDashboard;
  } else if (currentPath === '/insurance-agent-dashboard') {
    ComponentToRender = InsuranceAgentDashboard;
  } else if (currentPath === '/property-manager-dashboard') {
    ComponentToRender = PropertyManagerDashboard;
  } else if (currentPath === '/mortgage-broker-dashboard') {
    ComponentToRender = MortgageBrokerDashboard;
  } else if (currentPath === '/staff-dashboard') {
    ComponentToRender = StaffDashboard;
  }
  // Applications
  else if (currentPath === '/realtor-application') {
    ComponentToRender = RealtorApplication;
  } else if (currentPath === '/car-salesman-application') {
    ComponentToRender = CarSalesmanApplication;
  }
  // Payment & Commerce
  else if (currentPath === '/checkout') {
    ComponentToRender = Checkout;
  } else if (currentPath === '/payment-success') {
    ComponentToRender = PaymentSuccess;
  } else if (currentPath === '/payment-history') {
    ComponentToRender = PaymentHistory;
  }
  // User Features
  else if (currentPath === '/register') {
    ComponentToRender = Register;
  } else if (currentPath === '/signup') {
    ComponentToRender = Signup;
  } else if (currentPath === '/invite') {
    ComponentToRender = Invite;
  } else if (currentPath === '/notifications') {
    ComponentToRender = Notifications;
  } else if (currentPath === '/settings') {
    ComponentToRender = Settings;
  } else if (currentPath === '/help') {
    ComponentToRender = Help;
  }
  // HOA & Groups Additional
  else if (currentPath === '/county-hub') {
    ComponentToRender = CountyHub;
  }
  // Verification & Compliance
  else if (currentPath === '/verification') {
    ComponentToRender = Verification;
  } else if (currentPath === '/insurance-verification') {
    ComponentToRender = InsuranceVerification;
  } else if (currentPath === '/license-verification') {
    ComponentToRender = LicenseVerification;
  } else if (currentPath === '/background-check') {
    ComponentToRender = BackgroundCheck;
  } else if (currentPath === '/compliance') {
    ComponentToRender = Compliance;
  }
  // Marketing & Promotions
  else if (currentPath === '/promotions') {
    ComponentToRender = Promotions;
  } else if (currentPath === '/ad-creator') {
    ComponentToRender = AdCreator;
  } else if (currentPath === '/analytics') {
    ComponentToRender = Analytics;
  } else if (currentPath === '/lead-management') {
    ComponentToRender = LeadManagement;
  }
  // Tools & Utilities
  else if (currentPath === '/documentation') {
    ComponentToRender = Documentation;
  }
  // New Complete Features
  else if (currentPath === '/crm' || currentPath === '/crm-dashboard') {
    ComponentToRender = CRM;
  } else if (currentPath === '/vehicle-marketplace') {
    ComponentToRender = VehicleMarketplace;
  } else if (currentPath === '/hoa-dashboard') {
    ComponentToRender = HOADashboard;
  } else if (currentPath === '/real-estate-marketplace') {
    ComponentToRender = RealEstateMarketplace;
  } else if (currentPath === '/coffee-company' || currentPath === '/coffee') {
    ComponentToRender = CoffeeCompany;
  } else if (currentPath === '/administrative-dashboard') {
    ComponentToRender = AdministrativeDashboard;
  } else if (currentPath === '/county-directory') {
    ComponentToRender = CountyDirectory;
  } else if (currentPath === '/application-tracker') {
    ComponentToRender = ApplicationTracker;
  } else if (currentPath === '/resource-center') {
    ComponentToRender = ResourceCenter;
  } else if (currentPath === '/membership-portal' || currentPath === '/membership') {
    ComponentToRender = MembershipPortal;
  } else if (currentPath === '/training-center' || currentPath === '/training') {
    ComponentToRender = TrainingCenter;
  }
  // Advanced Social & Integration Features
  else if (currentPath === '/social-integration' || currentPath === '/social') {
    ComponentToRender = SocialIntegration;
  } else if (currentPath === '/community-feed' || currentPath === '/community') {
    ComponentToRender = CommunityFeed;
  } else if (currentPath === '/advanced-search') {
    ComponentToRender = AdvancedSearchNew;
  } else if (currentPath === '/referral-dashboard' || currentPath === '/referrals') {
    ComponentToRender = ReferralDashboard;
  } else if (currentPath === '/event-management' || currentPath === '/events') {
    ComponentToRender = EventManagement;
  } else if (currentPath === '/api-integrations' || currentPath === '/api' || currentPath === '/integrations') {
    ComponentToRender = APIIntegrations;
  }
  // Admin Interactive Features
  else if (currentPath === '/contractor-verification' || currentPath === '/verification') {
    ComponentToRender = ContractorVerification;
  } else if (currentPath === '/content-moderation' || currentPath === '/moderation') {
    ComponentToRender = ContentModeration;
  } else if (currentPath === '/system-settings' || currentPath === '/settings') {
    ComponentToRender = SystemSettings;
  } else if (currentPath === '/support-tickets' || currentPath === '/support') {
    ComponentToRender = SupportTickets;
  }
  // Interactive Action Pages
  else if (currentPath === '/schedule-consultation' || currentPath === '/consultation') {
    ComponentToRender = ScheduleConsultation;
  } else if (currentPath === '/apply-accelerator' || currentPath === '/apply') {
    ComponentToRender = ApplyAccelerator;
  } else if (currentPath === '/platform-analytics' || currentPath === '/analytics') {
    ComponentToRender = PlatformAnalytics;
  } else if (currentPath === '/manage-users' || currentPath === '/users') {
    ComponentToRender = ManageUsers;
  } else if (currentPath === '/payment-processing' || currentPath === '/billing' || currentPath === '/payments') {
    ComponentToRender = PaymentProcessing;
  } else if (currentPath === '/file-management' || currentPath === '/files') {
    ComponentToRender = FileManagement;
  }
  // Legal & Info
  else if (currentPath === '/terms') {
    ComponentToRender = Terms;
  } else if (currentPath === '/privacy') {
    ComponentToRender = Privacy;
  } else if (currentPath === '/about') {
    ComponentToRender = About;
  } else if (currentPath === '/contact') {
    ComponentToRender = Contact;
  }
  // 404 Handling
  else if (currentPath !== '/') {
    ComponentToRender = NotFound;
  } else {
    // Default landing page
    ComponentToRender = SimpleLanding;
  }

  return (
    <SimpleMobileGestures>
      <div className="min-h-screen gradient-bg flex flex-col">
        <SimpleNavigation />
        
        <main className="flex-1 relative">
          <ComponentToRender />
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