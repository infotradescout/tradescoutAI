import React from 'react';
import { Switch, Route, useLocation } from "wouter";
// Simple button component inline to avoid import issues
function Button({ children, onClick, className = "", size = "md", variant = "default", type = "button", disabled = false }: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  size?: string;
  variant?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}) {
  const baseClasses = "px-6 py-3 rounded font-medium transition-colors";
  const sizeClasses = size === "lg" ? "px-8 py-4 text-lg" : "px-6 py-3";
  const variantClasses = variant === "outline" 
    ? "border-2 bg-transparent" 
    : "text-white";
  
  return (
    <button 
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
    >
      {children}
    </button>
  );
}

function SimpleLanding() {
  const [, setLocation] = useLocation();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-slate-900 text-white">
      {/* Navigation Header */}
      <nav className="backdrop-blur-md bg-navy-800/90 border-b border-navy-600/50 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">TS</span>
            </div>
            <h1 className="text-2xl font-bold text-white">TradeScout</h1>
          </div>
          <div className="flex space-x-4">
            <Button 
              variant="outline" 
              className="border-white text-white hover:bg-white hover:text-navy-900"
              onClick={() => setLocation('/login')}
            >
              Login
            </Button>
            <Button 
              className="bg-orange-600 hover:bg-orange-700"
              onClick={() => setLocation('/register')}
            >
              Sign Up
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex items-center justify-center px-8 py-16">
        <div className="text-center max-w-4xl">
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
            TradeScout
          </h1>
          <p className="text-2xl mb-4 text-gray-300">Connect with verified local contractors</p>
          <p className="text-lg mb-12 text-gray-400 max-w-2xl mx-auto">
            Find trusted contractors, helpers, and marketplace sellers in your area. 
            Join thousands of homeowners and professionals building better communities.
          </p>
          <div className="space-x-4 mb-16">
            <Button 
              size="lg" 
              className="bg-orange-600 hover:bg-orange-700 px-8 py-4 text-lg"
              onClick={() => setLocation('/register')}
            >
              Get Started
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="border-white text-white hover:bg-white hover:text-navy-900 px-8 py-4 text-lg"
              onClick={() => setLocation('/contractors')}
            >
              Browse Contractors
            </Button>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="bg-navy-800/50 backdrop-blur-sm border border-navy-600/50 rounded-xl p-6">
              <div className="w-12 h-12 bg-orange-600 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <span className="text-white text-xl">🔨</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Verified Contractors</h3>
              <p className="text-gray-400">Connect with background-checked, licensed contractors in your area</p>
            </div>
            <div className="bg-navy-800/50 backdrop-blur-sm border border-navy-600/50 rounded-xl p-6">
              <div className="w-12 h-12 bg-orange-600 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <span className="text-white text-xl">💼</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Helper Marketplace</h3>
              <p className="text-gray-400">Find skilled helpers for both home projects and contractor jobs</p>
            </div>
            <div className="bg-navy-800/50 backdrop-blur-sm border border-navy-600/50 rounded-xl p-6">
              <div className="w-12 h-12 bg-orange-600 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <span className="text-white text-xl">🏘️</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Local Focus</h3>
              <p className="text-gray-400">County-based matching ensures you find professionals in your community</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-navy-600/50 bg-navy-800/30 py-8 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-400">© 2025 TradeScout. Connecting communities with trusted professionals.</p>
        </div>
      </footer>
    </div>
  );
}



function SimpleLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Login failed');
      }

      // Login successful, redirect to home
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg text-white flex items-center justify-center p-8">
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6">Login to TradeScout</h2>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-3 rounded bg-white/20 border border-white/30 text-white placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full p-3 rounded bg-white/20 border border-white/30 text-white placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          
          {error && (
            <div className="text-red-400 text-sm text-center bg-red-900/20 p-2 rounded">
              {error}
            </div>
          )}
          
          <Button 
            type="submit" 
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3"
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
        
        <div className="mt-6 text-center">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/')}
            className="text-gray-300 hover:text-white hover:bg-white/10"
          >
            ← Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}



export default function MinimalRouter() {
  return (
    <Switch>
      <Route path="/login" component={SimpleLogin} />
      <Route path="/" component={SimpleLanding} />
      <Route>
        <div className="min-h-screen gradient-bg text-white flex items-center justify-center">
          <p>Page not found</p>
        </div>
      </Route>
    </Switch>
  );
}