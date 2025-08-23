import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelpSystemProvider } from "@/components/help-system-provider";
import { FloatingHelpButton } from "@/components/floating-help-button";
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
import ConnectMasterAdmin from "@/components/admin/ConnectMasterAdmin";
import { AuthFlow } from "@/components/auth/AuthFlow";

import Dashboard from "@/pages/dashboard";
import HomeownerDashboard from "@/pages/homeowner-dashboard";
import ContractorBoard from "@/pages/contractor-board";
import ContractorProfile from "@/pages/contractor-profile";
import ContractorSignup from "@/pages/contractor-signup";
import EstimateCalculator from "@/pages/quote-calculator";
import WorkerMarketplace from "@/pages/worker-marketplace";
import GrowthPack from "@/pages/growth-pack";
import ForContractors from "@/pages/contractors";
import FindContractors from "@/pages/find-contractors";
import ContractorApply from "@/pages/contractor-apply";
import ContractorAccelerator from "@/pages/contractor-accelerator";
import ContractorDashboard from "@/pages/contractor-dashboard";
import HelperDashboard from "@/pages/helper-dashboard";
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
import AdminUserManagement from "@/pages/AdminUserManagement";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminErrorReports from "@/pages/admin-error-reports";
import AdminAttachments from "@/pages/admin-attachments";
import AdminTestingControls from "@/pages/admin-testing-controls";
import AdminListings from "@/pages/admin-listings";
import AdminProfessionalVerification from "@/pages/admin-professional-verification";
import MarketplaceListing from "@/pages/marketplace-listing";
import RealtorApplication from "@/pages/realtor-application";
import CarSalesmanApplication from "@/pages/car-salesman-application";
import AddressVerification from "@/pages/address-verification";
import DailyDeals from "@/pages/daily-deals";
import Boosts from "@/pages/boosts";
import Groups from "@/pages/groups";
import HOAManagement from "@/pages/hoa-management";
import NationwideExpansion from "@/pages/nationwide-expansion";
import Community from "@/pages/community";
import CommunityFeed from "@/pages/CommunityFeed";
import CommunityModerationDemo from "@/pages/CommunityModerationDemo";
import RecommendationGeneratorPage from "@/pages/contractor/recommendation-generator";
import Register from "@/pages/register";
import Signup from "@/pages/signup";
import Leaderboard from "@/pages/leaderboard";
import InvitePage from "@/pages/invite";
import HandmadeMarketplace from "@/pages/handmade-marketplace";
import TestFunctionality from "@/pages/test-functionality";
import TestPage from "@/pages/test-page";
import SimpleLanding from "@/pages/simple-landing";
import HelpDemo from "@/pages/help-demo";
import Affiliate from "@/pages/affiliate";
import Checkout from "@/pages/checkout";
import PaymentSuccess from "@/pages/payment-success";
import PaymentHistory from "@/pages/payment-history";
import AdvancedSearch from "@/pages/advanced-search";
import Notifications from "@/pages/notifications";
import Profile from "@/pages/profile";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import { ProfileSetupRedirect } from "@/components/profile-setup-redirect";

import { SubtleHints } from "@/components/onboarding/SubtleHints";
import BugReportTool from "@/components/BugReportTool";

// Lazy load admin components
const AdminDashboard = lazy(() => import("@/pages/admin-dashboard"));
const AdminCreateAccount = lazy(() => import("@/pages/admin-create-account"));
const AdminAddressVerifications = lazy(() => import("@/pages/admin-address-verifications"));
const AdminPricingAnalytics = lazy(() => import("@/pages/admin-pricing-analytics"));
const BusinessOwnerDashboard = lazy(() => import("@/pages/business-owner-dashboard"));
const PropertyManagerDashboard = lazy(() => import("@/pages/property-manager-dashboard"));
const InsuranceAgentDashboard = lazy(() => import("@/pages/insurance-agent-dashboard"));
const MortgageBrokerDashboard = lazy(() => import("@/pages/mortgage-broker-dashboard"));
const RealtorDashboard = lazy(() => import("@/pages/realtor-dashboard"));
const CarSalesmanDashboard = lazy(() => import("@/pages/car-salesman-dashboard"));
const StaffDashboard = lazy(() => import("@/pages/staff-dashboard"));
const CrmDashboard = lazy(() => import("@/pages/CrmDashboard"));
const RoleDirectory = lazy(() => import("@/pages/RoleDirectory"));
const TermsOfService = lazy(() => import("@/pages/legal/terms-of-service"));
const PrivacyPolicy = lazy(() => import("@/pages/legal/privacy-policy"));
const CookiePolicy = lazy(() => import("@/pages/legal/cookie-policy"));
const Compliance = lazy(() => import("@/pages/legal/compliance"));

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

// Main router component
const Router = memo(function Router() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { needsSetup, isLoading: setupLoading } = useSetupStatus();
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const swipeNav = useGlobalSwipeNavigation();
  
  // Use app-like effects for PWA experience
  useAppLikeEffects();
  
  // AI monitoring for performance optimization
  useAIMonitoring();

  // Handle master admin setup requirement
  if (!setupLoading && needsSetup) {
    return <MasterAdminSetup />;
  }

  // Show loading state while checking authentication
  if (isLoading || setupLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Check if user needs to complete Facebook signup flow
  const needsOnboarding = isAuthenticated && user && (!user.role || user.role === 'pending' || !user.onboardingCompleted);
  
  if (needsOnboarding) {
    return <AuthFlow onComplete={() => window.location.reload()} />;
  }

  // Show different routes based on authentication status
  const isPublicRoute = ['/login', '/register', '/terms', '/privacy', '/cookies', '/compliance'].includes(location);

  return (
      <MobileGestures>
      <div className="min-h-screen gradient-bg flex flex-col">
        <NextGenNavigation />
        
        <main className="flex-1 relative">
        <Switch>
          {/* Public routes - always accessible */}
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/safe-landing" component={SafeLanding} />
          <Route path="/simple-landing" component={SimpleLanding} />
          <Route path="/test" component={TestPage} />
          <Route path="/test-functionality" component={TestFunctionality} />
          
          {/* Legal routes - canonical URLs */}
          <Route path="/privacy" component={Privacy} />
          <Route path="/terms" component={Terms} />
          
          {/* Redirect alternatives to canonical URLs */}
          <Route path="/privacy-policy">
            {() => {
              window.location.replace('/privacy');
              return null;
            }}
          </Route>
          <Route path="/terms-of-service">
            {() => {
              window.location.replace('/terms');
              return null;
            }}
          </Route>
          <Route path="/cookies">
            <Suspense fallback={<LoadingSpinner size="lg" />}>
              <CookiePolicy />
            </Suspense>
          </Route>
          <Route path="/compliance">
            <Suspense fallback={<LoadingSpinner size="lg" />}>
              <Compliance />
            </Suspense>
          </Route>

          {/* Protected routes */}
          {isAuthenticated ? (
            <>
              {/* Main application routes - Full access for authenticated users */}
              <Route path="/" component={Dashboard} />
              <Route path="/home" component={Home} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/foundation" component={Foundation} />
              <Route path="/exchange" component={Exchange} />
              <Route path="/helpers" component={Helpers} />
              <Route path="/accelerator" component={Accelerator} />
              <Route path="/help" component={Help} />
              <Route path="/help-demo" component={HelpDemo} />
              <Route path="/settings" component={Settings} />
              <Route path="/profile" component={Profile} />
              <Route path="/notifications" component={Notifications} />

              {/* Contractor routes */}
              <Route path="/contractors" component={ForContractors} />
              <Route path="/contractors/board" component={ContractorBoard} />
              <Route path="/contractors/find" component={FindContractors} />
              <Route path="/contractors/:slug" component={ContractorProfile} />
              <Route path="/contractors/apply" component={ContractorApply} />
              <Route path="/contractors/accelerator" component={ContractorAccelerator} />
              <Route path="/contractor-board" component={ContractorBoard} />
              <Route path="/contractor-profile/:id" component={ContractorProfile} />
              <Route path="/contractor-dashboard" component={ContractorDashboard} />
              <Route path="/contractor/recommendation-generator" component={RecommendationGeneratorPage} />
              <Route path="/contractor-promos" component={ContractorPromos} />
              <Route path="/promo/:id" component={PromoPublic} />
              <Route path="/growth-pack" component={GrowthPack} />

              {/* Dashboard routes */}
              <Route path="/homeowner-dashboard" component={HomeownerDashboard} />
              <Route path="/helper-dashboard" component={HelperDashboard} />

              {/* Marketplace routes */}
              <Route path="/marketplace" component={Marketplace} />
              <Route path="/marketplace/:id" component={MarketplaceListing} />
              <Route path="/worker-marketplace" component={WorkerMarketplace} />
              <Route path="/handmade-marketplace" component={HandmadeMarketplace} />
              <Route path="/property-listing" component={PropertyListing} />
              <Route path="/business-listing" component={BusinessListing} />
              <Route path="/saved-ads" component={SavedAds} />

              {/* Tools and utilities */}
              <Route path="/quote-calculator" component={EstimateCalculator} />
              <Route path="/calculator" component={EstimateCalculator} />
              <Route path="/quote" component={EstimateCalculator} />
              <Route path="/boosts" component={Boosts} />
              <Route path="/groups" component={Groups} />
              <Route path="/groups/:groupId">
                <Suspense fallback={<LoadingSpinner size="lg" />}>
                  <GroupDetail />
                </Suspense>
              </Route>
              <Route path="/hoa" component={HOAManagement} />
              <Route path="/nationwide" component={NationwideExpansion} />
              <Route path="/advanced-search" component={AdvancedSearch} />
              <Route path="/leaderboard" component={Leaderboard} />

              {/* Communication */}
              <Route path="/chat" component={Chat} />
              <Route path="/conversations" component={Conversations} />

              {/* User management */}
              <Route path="/profile-setup" component={ProfileSetup} />
              <Route path="/address-verification" component={AddressVerification} />
              <Route path="/invite" component={InvitePage} />

              {/* Applications */}
              <Route path="/realtor-application" component={RealtorApplication} />
              <Route path="/car-salesman-application" component={CarSalesmanApplication} />

              {/* Community */}
              <Route path="/community" component={Community} />
              <Route path="/community-feed" component={CommunityFeed} />
              <Route path="/community-moderation-demo" component={CommunityModerationDemo} />

              {/* Payment */}
              <Route path="/checkout" component={Checkout} />
              <Route path="/payment-success" component={PaymentSuccess} />
              <Route path="/payment-history" component={PaymentHistory} />
              <Route path="/affiliate" component={Affiliate} />
              <Route path="/daily-deals" component={DailyDeals} />
              <Route path="/deals" component={DailyDeals} />

              {/* Admin routes - Full access restored */}
              <Route path="/admin" component={AdminPanel} />
              <Route path="/admin/login" component={AdminLogin} />
              <Route path="/admin/workspace" component={AdminWorkspace} />
              <Route path="/admin/users" component={AdminUserManagement} />
              <Route path="/admin/listings" component={AdminListings} />
              <Route path="/admin/error-reports" component={AdminErrorReports} />
              <Route path="/admin/attachments" component={AdminAttachments} />
              <Route path="/admin/testing-controls" component={AdminTestingControls} />
              <Route path="/admin/professional-verification" component={AdminProfessionalVerification} />

              {/* Lazy-loaded admin routes */}
              <Route path="/admin/dashboard">
                <Suspense fallback={<LoadingSpinner size="lg" />}>
                  <AdminDashboard />
                </Suspense>
              </Route>
              <Route path="/admin/create-account">
                <Suspense fallback={<LoadingSpinner size="lg" />}>
                  <AdminCreateAccount />
                </Suspense>
              </Route>
              <Route path="/admin/address-verifications">
                <Suspense fallback={<LoadingSpinner size="lg" />}>
                  <AdminAddressVerifications />
                </Suspense>
              </Route>
              <Route path="/admin/pricing-analytics">
                <Suspense fallback={<LoadingSpinner size="lg" />}>
                  <AdminPricingAnalytics />
                </Suspense>
              </Route>

              {/* Business role dashboards */}
              <Route path="/business-owner-dashboard">
                <Suspense fallback={<LoadingSpinner size="lg" />}>
                  <BusinessOwnerDashboard />
                </Suspense>
              </Route>
              <Route path="/property-manager-dashboard">
                <Suspense fallback={<LoadingSpinner size="lg" />}>
                  <PropertyManagerDashboard />
                </Suspense>
              </Route>
              <Route path="/insurance-agent-dashboard">
                <Suspense fallback={<LoadingSpinner size="lg" />}>
                  <InsuranceAgentDashboard />
                </Suspense>
              </Route>
              <Route path="/mortgage-broker-dashboard">
                <Suspense fallback={<LoadingSpinner size="lg" />}>
                  <MortgageBrokerDashboard />
                </Suspense>
              </Route>
              <Route path="/realtor-dashboard">
                <Suspense fallback={<LoadingSpinner size="lg" />}>
                  <RealtorDashboard />
                </Suspense>
              </Route>
              <Route path="/car-salesman-dashboard">
                <Suspense fallback={<LoadingSpinner size="lg" />}>
                  <CarSalesmanDashboard />
                </Suspense>
              </Route>
              <Route path="/staff-dashboard">
                <Suspense fallback={<LoadingSpinner size="lg" />}>
                  <StaffDashboard />
                </Suspense>
              </Route>
              <Route path="/crm-dashboard">
                <Suspense fallback={<LoadingSpinner size="lg" />}>
                  <CrmDashboard />
                </Suspense>
              </Route>
              <Route path="/role-directory">
                <Suspense fallback={<LoadingSpinner size="lg" />}>
                  <RoleDirectory />
                </Suspense>
              </Route>
              
              {/* Admin connection for Facebook users */}
              <Route path="/connect-admin" component={ConnectMasterAdmin} />
              
              {/* Profile setup redirect */}
              <ProfileSetupRedirect>
                <div />
              </ProfileSetupRedirect>
            </>
          ) : (
            /* Public routes - only available pages */
            <>
              <Route path="/" component={Landing} />
              <Route path="/contractors/board" component={ContractorBoard} />
              <Route path="/quote-calculator" component={EstimateCalculator} />
              <Route path="/calculator" component={EstimateCalculator} />
              <Route path="/daily-deals" component={DailyDeals} />
              <Route path="/connect-admin" component={ConnectMasterAdmin} />
              <Route path="/signup" component={Signup} />
              
              {/* Redirect restricted routes to contractor board */}
              <Route path="/home" component={ContractorBoard} />
              <Route path="/landing" component={ContractorBoard} />
              <Route path="/foundation" component={ContractorBoard} />
              <Route path="/community" component={ContractorBoard} />
              <Route path="/helpers" component={ContractorBoard} />
              <Route path="/exchange" component={ContractorBoard} />
              <Route path="/accelerator" component={ContractorBoard} />
              <Route path="/marketplace" component={ContractorBoard} />
              
              {/* Default fallback */}
              <Route component={ContractorBoard} />
            </>
          )}

          {/* 404 fallback */}
          <Route component={NotFound} />
        </Switch>
      </main>

      {/* Mobile CTA for non-authenticated users */}
      {!isAuthenticated && isMobile && <MobileCTA />}

      {/* UI overlays and indicators */}
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
      
      {/* Subtle onboarding hints for new users */}
      <SubtleHints />
      
      {/* Bug report tool - always available */}
      <BugReportTool />
      
      {!isMobile && <LegalFooter />}
    </div>
    </MobileGestures>
  );
});

const App = memo(function App() {
  return (
    <ErrorBoundary fallback={<div className="min-h-screen gradient-bg flex items-center justify-center text-white">Loading...</div>}>
      <QueryClientProvider client={queryClient}>
        <HelpSystemProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <FloatingHelpButton />
          </TooltipProvider>
        </HelpSystemProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
});

export default App;