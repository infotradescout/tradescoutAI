import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

// Simple community moderation components
import MasterAdminSetup from "@/components/auth/MasterAdminSetup";
import Login from "@/pages/login";
import Register from "@/pages/register";
import CommunityModerationDemo from "@/pages/CommunityModerationDemo";
import NotFound from "@/pages/not-found";

// Simple navigation component
function SimpleNav() {
  const { isAuthenticated, user } = useAuth();

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Community Moderation Demo
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Welcome, {user?.firstName || user?.email}
                </span>
                <a href="/api/auth/logout" className="text-sm text-blue-600 hover:text-blue-500">
                  Logout
                </a>
              </>
            ) : (
              <>
                <a href="/login" className="text-sm text-blue-600 hover:text-blue-500">
                  Login
                </a>
                <a href="/register" className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded">
                  Register
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const { needsSetup, isLoading: setupLoading } = useSetupStatus();

  if (isLoading || setupLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading Community Demo...</p>
        </div>
      </div>
    );
  }

  // Only redirect to setup if explicitly accessing setup route
  // For demo purposes, allow access to community even if setup is needed

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <SimpleNav />
      <Switch>
        {/* Setup route */}
        <Route path="/setup" component={MasterAdminSetup} />
        
        {/* Auth routes */}
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        
        {/* Main community demo */}
        <Route path="/" component={CommunityModerationDemo} />
        <Route path="/community" component={CommunityModerationDemo} />
        
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;