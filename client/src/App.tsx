import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

import Navigation from "@/components/layout/navigation";
import MobileCTA from "@/components/mobile-cta";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
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
import Marketplace from "@/pages/marketplace";
import SavedAds from "@/pages/saved-ads";
import ProfileSetup from "@/pages/profile-setup";
import AdminUsers from "@/pages/admin-users";
import AdminErrorReports from "@/pages/admin-error-reports";
import AdminTestingControls from "@/pages/admin-testing-controls";
import AddressVerification from "@/pages/address-verification";
import Community from "@/pages/community";
import HandmadeMarketplace from "@/pages/handmade-marketplace";
import ModerationCenter from "@/pages/moderation-center";
import { ProfileSetupRedirect } from "@/components/profile-setup-redirect";
import { FloatingBugReport } from "@/components/FloatingBugReport";
import { BetaNotificationPopup } from "@/components/BetaNotificationPopup";
import { AddressVerificationBanner } from "@/components/AddressVerificationBanner";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="text-orange-500 mx-auto mb-4" />
          <p className="text-gray-300">Loading TradeScout...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg text-gray-100">
      <Navigation />
      {isAuthenticated && <AddressVerificationBanner />}
      <Switch>
        {/* Public routes available to all users */}
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
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
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/handmade" component={HandmadeMarketplace} />
        <Route path="/promo/:slug" component={PromoPublic} />
        
        {!isAuthenticated ? (
          <>
            <Route path="/" component={Landing} />
            <Route path="/register" component={RegisterPage} />
            <Route path="/login" component={LoginPage} />
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
            <Route path="/chat/:conversationId?" component={Chat} />
            <Route path="/community" component={Community} />
            <Route path="/moderation" component={ModerationCenter} />
            <Route path="/saved-ads" component={SavedAds} />
          </>
        )}
        <Route component={NotFound} />
      </Switch>
      <MobileCTA />
      <FloatingBugReport />
      <BetaNotificationPopup />
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
