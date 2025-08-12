import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useAIMonitoring } from "@/hooks/useAIMonitoring";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import React, { lazy, useEffect, memo, Suspense } from "react";

import { NextGenNavigation } from "@/components/layout/NextGenNavigation";
import { useGlobalSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { SwipeIndicator } from "@/components/SwipeIndicator";
import { KeyboardNavigationHint } from "@/components/KeyboardNavigationHint";
import { PageTransitionIndicator } from "@/components/PageTransitionIndicator";
import MobileCTA from "@/components/mobile-cta";
import { MobileAppBar } from "@/components/MobileAppBar";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { MobileGestures } from "@/components/MobileGestures";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppLikeEffects } from "@/hooks/useAppLikeEffects";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Landing from "@/pages/landing";
import SafeLanding from "@/pages/safe-landing";
import Home from "@/pages/home";
import Foundation from "@/pages/foundation";
import Exchange from "@/pages/exchange";
import Helpers from "@/pages/helpers";
import Accelerator from "@/pages/accelerator";
import Help from "@/pages/help";
import Settings from "@/pages/settings";
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
import AdminAttachments from "@/pages/admin-attachments";
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
import CrmDashboard from "@/pages/CrmDashboard";
import TestFunctionality from "@/pages/test-functionality";

import ModerationCenter from "@/pages/moderation-center";
import Checkout from "@/pages/checkout";
import PaymentSuccess from "@/pages/payment-success";
import PaymentHistory from "@/pages/payment-history";
import AdvancedSearch from "@/pages/advanced-search";
import Notifications from "@/pages/notifications";
import Profile from "@/pages/profile";
import { ProfileSetupRedirect } from "@/components/profile-setup-redirect";

// Lazy load admin components
const AdminCreateAccount = lazy(() => import("@/pages/admin-create-account"));

// Lazy load legal pages
const PrivacyPolicy = lazy(() => import("./pages/legal/privacy-policy"));
const TermsOfService = lazy(() => import("./pages/legal/terms-of-service"));
const Compliance = lazy(() => import("./pages/legal/compliance"));
const CookiePolicy = lazy(() => import("./pages/legal/cookie-policy"));

// Dashboard redirect component for authenticated users
function DashboardRedirect() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Determine the appropriate dashboard based on user role
    let dashboardPath = '/dashboard';

    if (user?.role === 'contractor_user') {
      dashboardPath = '/contractor-dashboard';
    } else if (user?.role === 'homeowner') {
      dashboardPath = '/homeowner-dashboard';
    } else if (user?.role === 'ops_admin' || user?.role === 'head_admin') {
      dashboardPath = '/admin';
    }

    setLocation(dashboardPath);
  }, [user, setLocation]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="lg" className="text-orange-500 mx-auto mb-4" />
        <p className="text-gray-300">Taking you to your dashboard...</p>
      </div>
    </div>
  );
}
import { FloatingBugReport } from "@/components/FloatingBugReport";
import { BetaNotificationPopup } from "@/components/BetaNotificationPopup";
import { AddressVerificationBanner } from "@/components/AddressVerificationBanner";
import { LegalFooter } from "@/components/footer/legal-footer";
import { TutorialProvider } from "@/components/tutorial/TutorialProvider";

const Router = memo(function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const { needsSetup, isLoading: setupLoading } = useSetupStatus();
  const isMobile = useIsMobile();

  // Enable global swipe navigation on mobile with page cycling
  const swipeNav = useGlobalSwipeNavigation();

  // Enable AI monitoring for admin users
  useAIMonitoring();

  // Enable app-like mobile effects
  useAppLikeEffects();

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

  // If setup is needed and user is not on setup page, redirect to setup
  if (needsSetup) {
    return (
      <div className="min-h-screen gradient-bg text-gray-100">
        <MasterAdminSetup />
      </div>
    );
  }

  return (
    <MobileGestures>
      <div className="min-h-screen gradient-bg text-gray-100">
        {!isMobile && <NextGenNavigation />}
        {isAuthenticated && (
          <ErrorBoundary fallback={<div></div>}>
            <AddressVerificationBanner />
          </ErrorBoundary>
        )}
      <Switch>
        {/* Master Admin Setup - Only shows if no admin exists */}
        <Route path="/setup" component={MasterAdminSetup} />

        {/* Authentication routes */}
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />

        {/* Public routes available to all users */}
        <Route path="/contractors" component={ForContractors} />
        <Route path="/contractors/board" component={ContractorBoard} />
        <Route path="/contractors/apply" component={ContractorApply} />
        <Route path="/contractors/accelerator" component={ContractorAccelerator} />
        <Route path="/contractors/:slug" component={ContractorProfile} />
        <Route path="/quote" component={EstimateCalculator} />
        <Route path="/calculator" component={EstimateCalculator} />
        <Route path="/growth-pack" component={GrowthPack} />
        <Route path="/workers" component={WorkerMarketplace} />
        <Route path="/worker-marketplace" component={WorkerMarketplace} />
        <Route path="/helpers" component={Helpers} />
        <Route path="/accelerator" component={Accelerator} />
        <Route path="/exchange" component={Exchange} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/marketplace/list" component={MarketplaceListing} />
        <Route path="/exchange/list" component={MarketplaceListing} />
        <Route path="/property-listing" component={PropertyListing} />
        <Route path="/business-listing" component={BusinessListing} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/community" component={Community} />
        <Route path="/community/moderation" component={CommunityModerationDemo} />
        <Route path="/foundation" component={Foundation} />
        <Route path="/help" component={Help} />
        <Route path="/settings" component={Settings} />
        <Route path="/promo/:slug" component={PromoPublic} />
        <Route path="/test" component={TestFunctionality} />

        {/* Legal Pages */}
        <Route path="/legal/privacy-policy" component={PrivacyPolicy} />
        <Route path="/legal/terms-of-service" component={TermsOfService} />
        <Route path="/legal/compliance" component={Compliance} />
        <Route path="/legal/cookie-policy" component={CookiePolicy} />

        {!isAuthenticated ? (
          <>
            <Route path="/" component={Landing} />
          </>
        ) : (
          <>
            {/* Authenticated users redirect to dashboard as homepage */}
            <Route path="/" component={DashboardRedirect} />
            <Route path="/address-verification" component={AddressVerification} />
            <Route path="/profile-setup" component={ProfileSetup} />
            <Route path="/dashboard">
              <ProfileSetupRedirect>
                <Dashboard />
              </ProfileSetupRedirect>
            </Route>
            <Route path="/dashboard/account">
              <ProfileSetupRedirect>
                <Profile />
              </ProfileSetupRedirect>
            </Route>
            <Route path="/dashboard/messages" component={Conversations} />
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
            <Route path="/admin/create-account" component={AdminCreateAccount} />
            <Route path="/admin/error-reports" component={AdminErrorReports} />
            <Route path="/admin/attachments" component={AdminAttachments} />
            <Route path="/admin/testing-controls" component={AdminTestingControls} />
            <Route path="/admin/listings" component={AdminListings} />
            <Route path="/admin/professional-verification" component={AdminProfessionalVerification} />
            <Route path="/admin/crm" component={CrmDashboard} />
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
            <Route path="/profile">
              <ProfileSetupRedirect>
                <Profile />
              </ProfileSetupRedirect>
            </Route>
            <Route path="/community/feed" component={CommunityFeed} />
            <Route path="/foundation" component={Foundation} />
            <Route path="/affiliate" component={AffiliatePage} />
          </>
        )}
        <Route component={NotFound} />
      </Switch>
      <MobileCTA />
      <ErrorBoundary fallback={<div></div>}>
        <FloatingBugReport />
      </ErrorBoundary>
      {/* <ErrorBoundary fallback={<div></div>}>
        <BetaNotificationPopup />
      </ErrorBoundary> */}
      <SwipeIndicator
        currentPageIndex={swipeNav.currentPageIndex}
        totalPages={swipeNav.totalPages}
        onPrevious={swipeNav.navigateToPreviousPage}
        onNext={swipeNav.navigateToNextPage}
      />
      <KeyboardNavigationHint />
      <PageTransitionIndicator
        direction={swipeNav.transitionState.direction || undefined}
        isVisible={swipeNav.transitionState.isTransitioning}
        currentPage={swipeNav.transitionState.targetPage}
      />
      {isMobile && <MobileAppBar />}
      <PWAInstallPrompt />
      {!isMobile && <LegalFooter />}
    </div>
    </MobileGestures>
  );
});

const App = memo(function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TutorialProvider>
          <ErrorBoundary>
            <Toaster />
            <Router />
          </ErrorBoundary>
        </TutorialProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
});

export default App;