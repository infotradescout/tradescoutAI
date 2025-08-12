import React from 'react';
import { Switch, Route } from "wouter";
import { Button } from "@/components/ui/button";

function SimpleLanding() {
  return (
    <div className="min-h-screen gradient-bg text-white flex items-center justify-center p-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold mb-6">TradeScout</h1>
        <p className="text-xl mb-8">Connect with verified local contractors</p>
        <div className="space-x-4">
          <Button size="lg" className="bg-orange-600 hover:bg-orange-700">
            Get Started
          </Button>
          <Button variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-navy-900">
            Learn More
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