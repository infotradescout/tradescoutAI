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
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import HomeownerDashboard from "@/pages/homeowner-dashboard";
import ContractorBoard from "@/pages/contractor-board";
import ContractorProfile from "@/pages/contractor-profile";
import EstimateCalculator from "@/pages/quote-calculator";
import GrowthPack from "@/pages/growth-pack";
import ContractorApply from "@/pages/contractor-apply";
import ContractorAccelerator from "@/pages/contractor-accelerator";
import ContractorDashboard from "@/pages/contractor-dashboard";
import AdminWorkspace from "@/pages/admin-workspace";
import AdminPanel from "@/pages/admin-panel";
import Chat from "@/pages/chat";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="text-orange-500 mx-auto mb-4" />
          <p className="text-gray-300">Loading Trade Scout...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg text-gray-100">
      <Navigation />
      <Switch>
        {/* Public routes available to all users */}
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/contractors/board" component={ContractorBoard} />
        <Route path="/contractors/apply" component={ContractorApply} />
        <Route path="/contractors/accelerator" component={ContractorAccelerator} />
        <Route path="/contractors/:slug" component={ContractorProfile} />
        <Route path="/quote" component={EstimateCalculator} />
        <Route path="/calculator" component={EstimateCalculator} />
        <Route path="/growth-pack" component={GrowthPack} />
        
        {!isAuthenticated ? (
          <>
            <Route path="/" component={Landing} />
          </>
        ) : (
          <>
            <Route path="/" component={Dashboard} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/homeowner-dashboard" component={HomeownerDashboard} />
            <Route path="/contractor-dashboard" component={ContractorDashboard} />
            <Route path="/admin" component={AdminWorkspace} />
            <Route path="/admin/panel" component={AdminPanel} />
            <Route path="/chat/:conversationId?" component={Chat} />
          </>
        )}
        <Route component={NotFound} />
      </Switch>
      <MobileCTA />
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
