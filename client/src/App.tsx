
import React from 'react';
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Navigation from "./components/layout/navigation";

// Import all pages
import Landing from "./pages/landing";
import Home from "./pages/home";
import Contractors from "./pages/contractors";
import ContractorProfile from "./pages/contractor-profile";
import ContractorDashboard from "./pages/contractor-dashboard";
import HomeownerDashboard from "./pages/homeowner-dashboard";
import Dashboard from "./pages/dashboard";
import Login from "./pages/login";
import Register from "./pages/register";
import ProfileSetup from "./pages/profile-setup";
import Profile from "./pages/profile";
import Settings from "./pages/settings";
import Marketplace from "./pages/marketplace";
import MarketplaceListing from "./pages/marketplace-listing";
import Exchange from "./pages/exchange";
import HandmadeMarketplace from "./pages/handmade-marketplace";
import WorkerMarketplace from "./pages/worker-marketplace";
import BusinessListing from "./pages/business-listing";
import PropertyListing from "./pages/property-listing";
import Community from "./pages/community";
import CommunityFeed from "./pages/CommunityFeed";
import CommunityModerationDemo from "./pages/CommunityModerationDemo";
import CommunityDashboard from "./pages/community-dashboard";
import ModerationCenter from "./pages/moderation-center";
import Chat from "./pages/chat";
import Conversations from "./pages/conversations";
import Notifications from "./pages/notifications";
import Help from "./pages/help";
import HelpDemo from "./pages/help-demo";
import Foundation from "./pages/foundation";
import Affiliate from "./pages/affiliate";
import Accelerator from "./pages/accelerator";
import ContractorAccelerator from "./pages/contractor-accelerator";
import GrowthPack from "./pages/growth-pack";
import ContractorPromos from "./pages/contractor-promos";
import PromoPublic from "./pages/promo-public";
import ContractorBoard from "./pages/contractor-board";
import ContractorApply from "./pages/contractor-apply";
import Leaderboard from "./pages/leaderboard";
import QuoteCalculator from "./pages/quote-calculator";
import AdvancedSearch from "./pages/advanced-search";
import Helpers from "./pages/helpers";
import HelperDashboard from "./pages/helper-dashboard";
import Invite from "./pages/invite";
import AddressVerification from "./pages/address-verification";
import SavedAds from "./pages/saved-ads";
import PaymentHistory from "./pages/payment-history";
import PaymentSuccess from "./pages/payment-success";
import Checkout from "./pages/checkout";
import TestFunctionality from "./pages/test-functionality";
import TestPage from "./pages/test-page";
import SimpleLanding from "./pages/simple-landing";
import SafeLanding from "./pages/safe-landing";
import NotFound from "./pages/not-found";

// Admin pages
import AdminPanel from "./pages/admin-panel";
import AdminDashboard from "./pages/admin-dashboard";
import AdminUsers from "./pages/admin-users";
import AdminListings from "./pages/admin-listings";
import AdminWorkspace from "./pages/admin-workspace";
import AdminCreateAccount from "./pages/admin-create-account";
import AdminTestingControls from "./pages/admin-testing-controls";
import AdminErrorReports from "./pages/admin-error-reports";
import AdminAttachments from "./pages/admin-attachments";
import AdminAddressVerifications from "./pages/admin-address-verifications";
import AdminProfessionalVerification from "./pages/admin-professional-verification";
import AdminPricingAnalytics from "./pages/admin-pricing-analytics";

// Business role dashboards
import BusinessOwnerDashboard from "./pages/business-owner-dashboard";
import PropertyManagerDashboard from "./pages/property-manager-dashboard";
import InsuranceAgentDashboard from "./pages/insurance-agent-dashboard";
import MortgageBrokerDashboard from "./pages/mortgage-broker-dashboard";
import RealtorDashboard from "./pages/realtor-dashboard";
import RealtorApplication from "./pages/realtor-application";
import CarSalesmanDashboard from "./pages/car-salesman-dashboard";
import CarSalesmanApplication from "./pages/car-salesman-application";
import StaffDashboard from "./pages/staff-dashboard";
import CrmDashboard from "./pages/CrmDashboard";
import RoleDirectory from "./pages/RoleDirectory";

// Legal pages
import TermsOfService from "./pages/legal/terms-of-service";
import PrivacyPolicy from "./pages/legal/privacy-policy";
import CookiePolicy from "./pages/legal/cookie-policy";
import Compliance from "./pages/legal/compliance";

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen">
          <Navigation />
          <Switch>
            {/* Main application routes */}
            <Route path="/" component={Landing} />
            <Route path="/home" component={Home} />
            <Route path="/contractors" component={Contractors} />
            <Route path="/contractors/:id" component={ContractorProfile} />
            <Route path="/contractor-dashboard" component={ContractorDashboard} />
            <Route path="/homeowner-dashboard" component={HomeownerDashboard} />
            <Route path="/dashboard" component={Dashboard} />
            
            {/* Route aliases for backward compatibility */}
            <Route path="/dashboard/messages" component={Conversations} />
            <Route path="/contractors/dashboard" component={ContractorDashboard} />
            <Route path="/exchange/list" component={Marketplace} />
            <Route path="/contractors/board" component={Contractors} />

            {/* Auth routes */}
            <Route path="/login" component={Login} />
            <Route path="/register" component={Register} />
            <Route path="/profile-setup" component={ProfileSetup} />
            <Route path="/profile" component={Profile} />
            <Route path="/settings" component={Settings} />

            {/* Marketplace routes */}
            <Route path="/marketplace" component={Marketplace} />
            <Route path="/marketplace/:id" component={MarketplaceListing} />
            <Route path="/exchange" component={Exchange} />
            <Route path="/handmade-marketplace" component={HandmadeMarketplace} />
            <Route path="/worker-marketplace" component={WorkerMarketplace} />
            <Route path="/business-listing" component={BusinessListing} />
            <Route path="/property-listing" component={PropertyListing} />

            {/* Community routes */}
            <Route path="/community" component={Community} />
            <Route path="/community/feed" component={CommunityFeed} />
            <Route path="/community/moderation" component={CommunityModerationDemo} />
            <Route path="/community-dashboard" component={CommunityDashboard} />
            <Route path="/moderation-center" component={ModerationCenter} />

            {/* Communication routes */}
            <Route path="/chat" component={Chat} />
            <Route path="/conversations" component={Conversations} />
            <Route path="/notifications" component={Notifications} />

            {/* Support routes */}
            <Route path="/help" component={Help} />
            <Route path="/help-demo" component={HelpDemo} />

            {/* Special features */}
            <Route path="/foundation" component={Foundation} />
            <Route path="/affiliate" component={Affiliate} />
            <Route path="/accelerator" component={Accelerator} />
            <Route path="/contractor-accelerator" component={ContractorAccelerator} />
            <Route path="/growth-pack" component={GrowthPack} />
            <Route path="/contractor-promos" component={ContractorPromos} />
            <Route path="/promo/:id" component={PromoPublic} />
            <Route path="/contractor-board" component={ContractorBoard} />
            <Route path="/contractor-apply" component={ContractorApply} />
            <Route path="/leaderboard" component={Leaderboard} />
            <Route path="/quote-calculator" component={QuoteCalculator} />
            <Route path="/advanced-search" component={AdvancedSearch} />
            <Route path="/helpers" component={Helpers} />
            <Route path="/helper-dashboard" component={HelperDashboard} />
            <Route path="/invite" component={Invite} />
            <Route path="/address-verification" component={AddressVerification} />
            <Route path="/saved-ads" component={SavedAds} />
            <Route path="/payment-history" component={PaymentHistory} />
            <Route path="/payment-success" component={PaymentSuccess} />
            <Route path="/checkout" component={Checkout} />

            {/* Admin routes */}
            <Route path="/admin" component={AdminPanel} />
            <Route path="/admin/dashboard" component={AdminDashboard} />
            <Route path="/admin/users" component={AdminUsers} />
            <Route path="/admin/listings" component={AdminListings} />
            <Route path="/admin/workspace" component={AdminWorkspace} />
            <Route path="/admin/create-account" component={AdminCreateAccount} />
            <Route path="/admin/testing-controls" component={AdminTestingControls} />
            <Route path="/admin/error-reports" component={AdminErrorReports} />
            <Route path="/admin/attachments" component={AdminAttachments} />
            <Route path="/admin/address-verifications" component={AdminAddressVerifications} />
            <Route path="/admin/professional-verification" component={AdminProfessionalVerification} />
            <Route path="/admin/pricing-analytics" component={AdminPricingAnalytics} />

            {/* Business role dashboards */}
            <Route path="/business-owner-dashboard" component={BusinessOwnerDashboard} />
            <Route path="/property-manager-dashboard" component={PropertyManagerDashboard} />
            <Route path="/insurance-agent-dashboard" component={InsuranceAgentDashboard} />
            <Route path="/mortgage-broker-dashboard" component={MortgageBrokerDashboard} />
            <Route path="/realtor-dashboard" component={RealtorDashboard} />
            <Route path="/realtor-application" component={RealtorApplication} />
            <Route path="/car-salesman-dashboard" component={CarSalesmanDashboard} />
            <Route path="/car-salesman-application" component={CarSalesmanApplication} />
            <Route path="/staff-dashboard" component={StaffDashboard} />
            <Route path="/crm-dashboard" component={CrmDashboard} />
            <Route path="/role-directory" component={RoleDirectory} />

            {/* Testing routes */}
            <Route path="/test" component={TestPage} />
            <Route path="/test-functionality" component={TestFunctionality} />
            <Route path="/simple-landing" component={SimpleLanding} />
            <Route path="/safe-landing" component={SafeLanding} />

            {/* Legal routes */}
            <Route path="/terms" component={TermsOfService} />
            <Route path="/privacy" component={PrivacyPolicy} />
            <Route path="/cookies" component={CookiePolicy} />
            <Route path="/compliance" component={Compliance} />

            {/* 404 route */}
            <Route component={NotFound} />
          </Switch>
        </div>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
