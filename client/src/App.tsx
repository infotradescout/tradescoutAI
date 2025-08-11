import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { lazy } from "react";

import { EnhancedNavigation } from "@/components/layout/EnhancedNavigation";
import MobileCTA from "@/components/mobile-cta";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Landing from "@/pages/landing";
import SafeLanding from "@/pages/safe-landing";
import Home from "@/pages/home";
import Foundation from "@/pages/foundation";
import MasterAdminSetup from "@/components/auth/MasterAdminSetup";

import Dashboard from "@/pages/dashboard";
import HomeownerDashboard from "@/pages/homeowner-dashboard";
import ContractorBoard from "@/pages/contractor-board";
import ContractorProfile from "@/pages/contractor-profile";
import EstimateCalculator from "@/pages/quote-calculator";
import WorkerMarketplace from "@/pages/worker-marketplace";
import GrowthPack from "@/pages/growth-pack";
import ForContractors from "@/pages/contractors";
import ContractorApply from "@/pages/contractor-apply";
import ContractorAccelerator from "@/pages/contractor-accelerator";
import ContractorDashboard from "@/pages/contractor-dashboard";
import AdminWorkspace from "@/pages/admin-workspace";
import AdminPanel from "@/pages/admin-panel";
import ContractorPromos from "@/pages/contractor-promos";
import PromoPublic from "@/pages/promo-public";
import Chat from "@/pages/chat";
import Conversations from "@/pages/conversations";
import Marketplace from "@/pages/marketplace";
import PropertyListing from "@/pages/property-listing";
import BusinessListing from "@/pages/business-listing";
import SavedAds from "@/pages/saved-ads";
import ProfileSetup from "@/pages/profile-setup";
import AdminUsers from "@/pages/admin-users";
import AdminErrorReports from "@/pages/admin-error-reports";
import AdminTestingControls from "@/pages/admin-testing-controls";
import AdminListings from "@/pages/admin-listings";
import AdminProfessionalVerification from "@/pages/admin-professional-verification";
import MarketplaceListing from "@/pages/marketplace-listing";
import RealtorApplication from "@/pages/realtor-application";
import CarSalesmanApplication from "@/pages/car-salesman-application";
import AddressVerification from "@/pages/address-verification";
import Community from "@/pages/community";
import CommunityFeed from "@/pages/CommunityFeed";
import CommunityModerationDemo from "@/pages/CommunityModerationDemo";
import Register from "@/pages/register";
import Leaderboard from "@/pages/leaderboard";
import InvitePage from "@/pages/invite";
import AffiliatePage from "@/pages/affiliate";

import ModerationCenter from "@/pages/moderation-center";
import Checkout from "@/pages/checkout";
import PaymentSuccess from "@/pages/payment-success";
import PaymentHistory from "@/pages/payment-history";
import AdvancedSearch from "@/pages/advanced-search";
import Notifications from "@/pages/notifications";
import { ProfileSetupRedirect } from "@/components/profile-setup-redirect";
import { FloatingBugReport } from "@/components/FloatingBugReport";
import { BetaNotificationPopup } from "@/components/BetaNotificationPopup";
import { AddressVerificationBanner } from "@/components/AddressVerificationBanner";
import { LegalFooter } from "@/components/footer/legal-footer";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const { needsSetup, isLoading: setupLoading } = useSetupStatus();

  if (isLoading || setupLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="text-orange-500 mx-auto mb-4" />
          <p className="text-gray-300">Loading TradeScout...</p>
        </div>
      </div>
    );
  }

  // Only redirect to setup if explicitly accessing setup route
  // Allow access to public pages even if setup is needed

  return (
    <div className="min-h-screen gradient-bg text-gray-100">
      <EnhancedNavigation />
      {isAuthenticated && <AddressVerificationBanner />}
      <Switch>
        {/* Master Admin Setup - Only shows if no admin exists */}
        <Route path="/setup" component={MasterAdminSetup} />
        
        {/* Authentication routes */}
        <Route path="/login" component={Login} />
        
        {/* Public routes available to all users */}
        <Route path="/contractors" component={ContractorBoard} />
        <Route path="/contractors/board" component={ContractorBoard} />
        <Route path="/contractors/for-contractors" component={ForContractors} />
        <Route path="/contractors/apply" component={ContractorApply} />
        <Route path="/contractors/accelerator" component={ContractorAccelerator} />
        <Route path="/contractors/:slug" component={ContractorProfile} />
        <Route path="/quote" component={EstimateCalculator} />
        <Route path="/calculator" component={EstimateCalculator} />
        <Route path="/growth-pack" component={GrowthPack} />
        <Route path="/workers" component={WorkerMarketplace} />
        <Route path="/worker-marketplace" component={WorkerMarketplace} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/marketplace/list" component={MarketplaceListing} />
        <Route path="/property-listing" component={PropertyListing} />
        <Route path="/business-listing" component={BusinessListing} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/community" component={Community} />
        <Route path="/community/moderation" component={CommunityModerationDemo} />
        <Route path="/register" component={Register} />
        <Route path="/setup" component={MasterAdminSetup} />
        <Route path="/foundation" component={Foundation} />
        <Route path="/promo/:slug" component={PromoPublic} />
        
        {/* Legal Pages */}
        <Route path="/legal/privacy-policy" component={lazy(() => import("./pages/legal/privacy-policy"))} />
        <Route path="/legal/terms-of-service" component={lazy(() => import("./pages/legal/terms-of-service"))} />
        <Route path="/legal/compliance" component={lazy(() => import("./pages/legal/compliance"))} />
        <Route path="/legal/cookie-policy" component={lazy(() => import("./pages/legal/cookie-policy"))} />
        
        {!isAuthenticated ? (
          <>
            <Route path="/" component={Landing} />
          </>
        ) : (
          <>
            <Route path="/address-verification" component={AddressVerification} />
            <Route path="/profile-setup" component={ProfileSetup} />
            <Route path="/">
              <ProfileSetupRedirect>
                <Dashboard />
              </ProfileSetupRedirect>
            </Route>
            <Route path="/dashboard">
              <ProfileSetupRedirect>
                <Dashboard />
              </ProfileSetupRedirect>
            </Route>
            <Route path="/homeowner-dashboard">
              <ProfileSetupRedirect>
                <HomeownerDashboard />
              </ProfileSetupRedirect>
            </Route>
            <Route path="/contractor-dashboard">
              <ProfileSetupRedirect>
                <ContractorDashboard />
              </ProfileSetupRedirect>
            </Route>
            <Route path="/contractor-promos">
              <ProfileSetupRedirect>
                <ContractorPromos />
              </ProfileSetupRedirect>
            </Route>
            <Route path="/admin" component={AdminWorkspace} />
            <Route path="/admin/panel" component={AdminPanel} />
            <Route path="/admin/users" component={AdminUsers} />
            <Route path="/admin/workspace" component={AdminWorkspace} />
            <Route path="/admin/error-reports" component={AdminErrorReports} />
            <Route path="/admin/testing" component={AdminTestingControls} />
            <Route path="/admin/listings" component={AdminListings} />
            <Route path="/admin/professional-verification" component={AdminProfessionalVerification} />
            <Route path="/chat/:conversationId?" component={Chat} />
            <Route path="/conversations" component={Conversations} />
            <Route path="/invite" component={InvitePage} />
            <Route path="/moderation" component={ModerationCenter} />
            <Route path="/saved-ads" component={SavedAds} />
            <Route path="/realtor-application" component={RealtorApplication} />
            <Route path="/car-salesman-application" component={CarSalesmanApplication} />
            <Route path="/checkout" component={Checkout} />
            <Route path="/checkout/:type/:id" component={Checkout} />
            <Route path="/payment-success" component={PaymentSuccess} />
            <Route path="/payments/success" component={PaymentSuccess} />
            <Route path="/payments/history" component={PaymentHistory} />
            <Route path="/search" component={AdvancedSearch} />
            <Route path="/notifications" component={Notifications} />
            <Route path="/community/feed" component={CommunityFeed} />
            <Route path="/foundation" component={Foundation} />
            <Route path="/affiliate" component={AffiliatePage} />
          </>
        )}
        <Route component={NotFound} />
      </Switch>
      <MobileCTA />
      <FloatingBugReport />
      <BetaNotificationPopup />
      <LegalFooter />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <Toaster />
          <Router />
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
