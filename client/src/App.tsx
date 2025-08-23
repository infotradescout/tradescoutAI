import { memo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ErrorBoundary } from '@/components/ui/error-boundary';

// Simple components - using correct paths
import SimpleLanding from './pages/SimpleLanding';
import SimpleHome from './pages/SimpleHome';
import SimpleNavigation from './components/layout/SimpleNavigation';
import SimpleMobileGestures from './components/SimpleMobileGestures';
import SimpleSubtleHints from './components/onboarding/SimpleSubtleHints';
import SimpleBugReportTool from './components/SimpleBugReportTool';
import SimpleToaster from './components/ui/simple-toaster';
import SimpleFloatingHelp from './components/ui/simple-floating-help';
import SimpleRouter from './components/SimpleRouter';
import MobileAppBar from './components/navigation/MobileAppBar';

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
  
  // Basic routing logic
  if (currentPath === '/home' || currentPath === '/dashboard') {
    ComponentToRender = SimpleHome;
  }
  
  // Simple routing - only using components we have
  if (currentPath === '/home' || currentPath === '/dashboard') {
    ComponentToRender = SimpleHome;
  } else {
    // Default to landing page for all other routes
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
        <SimpleToaster />
        <SimpleRouter>
          <Router />
        </SimpleRouter>
        <SimpleFloatingHelp />
      </QueryClientProvider>
    </ErrorBoundary>
  );
});

export default App;