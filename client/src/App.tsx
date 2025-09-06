import React, { memo, useState, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { ErrorBoundary } from './components/ui/error-boundary';

// Only import essential components
import SimpleLanding from './pages/SimpleLanding';
import SimpleHome from './pages/SimpleHome';
import SimpleNavigation from './components/layout/SimpleNavigation';
import StoryGeneratorPage from './pages/StoryGeneratorPage';
import NotFound from './pages/not-found';

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

// Simplified router component
const Router = memo(function Router() {
  const [currentPath, setCurrentPath] = useState(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  
  // Listen for navigation changes
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    
    // Listen for back/forward button
    window.addEventListener('popstate', handleLocationChange);
    
    // Listen for anchor clicks
    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      
      if (anchor && anchor.href && anchor.href.startsWith(window.location.origin)) {
        e.preventDefault();
        const newPath = new URL(anchor.href).pathname;
        window.history.pushState({}, '', newPath);
        setCurrentPath(newPath);
      }
    };
    
    document.addEventListener('click', handleClick);
    
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      document.removeEventListener('click', handleClick);
    };
  }, []);
  
  // Simplified routing - only essential pages
  const renderPage = () => {
    if (currentPath === '/home' || currentPath === '/dashboard') {
      return <SimpleHome />;
    } else if (currentPath === '/story-generator') {
      return <StoryGeneratorPage />;
    } else if (currentPath !== '/') {
      return <NotFound />;
    } else {
      return <SimpleLanding />;
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      <SimpleNavigation />
      
      <main className="flex-1 relative">
        {renderPage()}
      </main>
      
      <LegalFooter />
    </div>
  );
});

const App = memo(function App() {
  return (
    <ErrorBoundary fallback={<div className="min-h-screen gradient-bg flex items-center justify-center text-white">Loading...</div>}>
      <QueryClientProvider client={queryClient}>
        <Router />
      </QueryClientProvider>
    </ErrorBoundary>
  );
});

export default App;