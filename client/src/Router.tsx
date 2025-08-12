import React from "react";
import { Switch, Route } from "wouter";
import { useAuth } from "@/hooks/useAuth";

// Import pages
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import ContractorDashboard from "@/pages/contractor-dashboard";
import HomeownerDashboard from "@/pages/homeowner-dashboard";
import HelperDashboard from "@/pages/helper-dashboard";
import Contractors from "@/pages/contractors";
import Helpers from "@/pages/helpers";
import Marketplace from "@/pages/marketplace";
import Chat from "@/pages/chat";
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import AdminPanel from "@/pages/admin-panel";
import AdminDashboard from "@/pages/admin-dashboard";
import Help from "@/pages/help";
import NotFound from "@/pages/not-found";
import Accelerator from "@/pages/accelerator";
import QuoteCalculator from "@/pages/quote-calculator";
import Community from "@/pages/community";
import Foundation from "@/pages/foundation";
import Exchange from "@/pages/exchange";

// Import components
import Navigation from "@/components/ui/navigation";

export default function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-white text-xl">Loading TradeScout...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-slate-900">
      {/* Show navigation for authenticated users */}
      {isAuthenticated && <Navigation />}
      
      <Switch>
        {/* Public routes */}
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        
        {/* Protected routes */}
        {isAuthenticated ? (
          <>
            <Route path="/" component={Dashboard} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/contractors" component={Contractors} />
            <Route path="/quote-calculator" component={QuoteCalculator} />
            <Route path="/community" component={Community} />
            <Route path="/helpers" component={Helpers} />
            <Route path="/foundation" component={Foundation} />
            <Route path="/exchange" component={Exchange} />
            <Route path="/accelerator" component={Accelerator} />
            <Route path="/contractor-dashboard" component={ContractorDashboard} />
            <Route path="/homeowner-dashboard" component={HomeownerDashboard} />
            <Route path="/helper-dashboard" component={HelperDashboard} />
            <Route path="/marketplace" component={Marketplace} />
            <Route path="/chat" component={Chat} />
            <Route path="/profile" component={Profile} />
            <Route path="/settings" component={Settings} />
            <Route path="/help" component={Help} />
            
            {/* Admin routes */}
            {(user?.role === 'head_admin' || user?.role === 'ops_admin') && (
              <>
                <Route path="/admin/panel" component={AdminPanel} />
                <Route path="/admin/dashboard" component={AdminDashboard} />
              </>
            )}
          </>
        ) : (
          <Route path="/" component={Landing} />
        )}
        
        {/* Catch-all */}
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}