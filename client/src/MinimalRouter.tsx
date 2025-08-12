import React from 'react';
import { Switch, Route, useLocation } from "wouter";
import { Button } from "@/components/ui/button";

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

import MinimalLoginPage from './MinimalLoginPage';



export default function MinimalRouter() {
  return (
    <Switch>
      <Route path="/login" component={MinimalLoginPage} />
      <Route path="/" component={SimpleLanding} />
      <Route>
        <div className="min-h-screen gradient-bg text-white flex items-center justify-center">
          <p>Page not found</p>
        </div>
      </Route>
    </Switch>
  );
}