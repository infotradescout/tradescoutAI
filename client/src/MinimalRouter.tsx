import React from 'react';
import { Switch, Route, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

function SimpleLanding() {
  const [, setLocation] = useLocation();
  
  return (
    <div className="min-h-screen gradient-bg text-white flex items-center justify-center p-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold mb-6">TradeScout</h1>
        <p className="text-xl mb-8">Connect with verified local contractors</p>
        <div className="space-x-4">
          <Button 
            size="lg" 
            className="bg-orange-600 hover:bg-orange-700"
            onClick={() => setLocation('/login')}
          >
            Get Started
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            className="border-white text-white hover:bg-white hover:text-navy-900"
            onClick={() => setLocation('/contractors')}
          >
            Browse Contractors
          </Button>
        </div>
      </div>
    </div>
  );
}

function SimpleLogin() {
  return (
    <div className="min-h-screen gradient-bg text-white flex items-center justify-center p-8">
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6">Login to TradeScout</h2>
        <p className="text-center text-gray-300">Authentication system is ready</p>
      </div>
    </div>
  );
}

function SimpleHome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  return (
    <div className="min-h-screen gradient-bg text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Welcome to TradeScout</h1>
          <Button 
            variant="outline" 
            onClick={() => setLocation('/auth/logout')}
            className="border-white text-white hover:bg-white hover:text-navy-900"
          >
            Logout
          </Button>
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Your Account</h2>
          <p className="text-lg">Role: {user?.role || 'Unknown'}</p>
          <p className="text-lg">Email: {user?.email || 'Not provided'}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-3">Find Contractors</h3>
            <p className="mb-4">Browse verified local contractors</p>
            <Button onClick={() => setLocation('/contractors')}>
              Browse Contractors
            </Button>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-3">Get Quotes</h3>
            <p className="mb-4">Calculate project estimates</p>
            <Button onClick={() => setLocation('/quote')}>
              Get Quote
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MinimalRouter() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center text-white">
          <LoadingSpinner size="lg" className="text-orange-500 mx-auto mb-4" />
          <p className="text-gray-300">Loading TradeScout...</p>
        </div>
      </div>
    );
  }
  
  return (
    <Switch>
      <Route path="/login" component={SimpleLogin} />
      {isAuthenticated ? (
        <Route path="/" component={SimpleHome} />
      ) : (
        <Route path="/" component={SimpleLanding} />
      )}
      <Route>
        <div className="min-h-screen gradient-bg text-white flex items-center justify-center">
          <p>Page not found</p>
        </div>
      </Route>
    </Switch>
  );
}