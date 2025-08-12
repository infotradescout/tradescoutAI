import React from 'react';
import { Switch, Route, useLocation } from "wouter";

// Import pages that definitely exist
import Landing from "@/pages/landing";
import Accelerator from "@/pages/accelerator";

// Create mock navigation for demonstration
function MockNavigation() {
  const [location, setLocation] = useLocation();
  
  const navItems = [
    { href: "/", label: "Dashboard", icon: "🏠" },
    { href: "/contractors", label: "Contractors", icon: "🔨" },
    { href: "/quote-calculator", label: "Calculator", icon: "🧮" },
    { href: "/community", label: "Community", icon: "👥" },
    { href: "/helpers", label: "Helpers", icon: "🤝" },
    { href: "/foundation", label: "Foundation", icon: "🏛️" },
    { href: "/exchange", label: "Exchange", icon: "🔄" },
    { href: "/accelerator", label: "Accelerator", icon: "🚀" },
  ];

  return (
    <nav className="bg-navy-800 border-b border-navy-600 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">TS</span>
              </div>
              <span className="text-xl font-bold text-orange-500">TradeScout</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <button
                  key={item.href}
                  onClick={() => setLocation(item.href)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-orange-600 text-white' 
                      : 'text-gray-300 hover:text-white hover:bg-navy-700'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* User section */}
          <div className="flex items-center space-x-4">
            <button className="text-gray-300 hover:text-white">
              <span className="text-sm">🔔</span>
            </button>
            <button className="text-gray-300 hover:text-white">
              <span className="text-sm">👤 Help</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

// Simple page component for missing pages
function SimplePage({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-slate-900">
      <MockNavigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-6">{title}</h1>
          <p className="text-xl text-gray-300 mb-8">{description}</p>
          <div className="bg-navy-800/50 backdrop-blur-sm border border-navy-600/50 rounded-xl p-8">
            <p className="text-gray-400">This page is part of the TradeScout platform. Content coming soon!</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MinimalRouter() {
  return (
    <Switch>
      <Route path="/accelerator">
        <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-slate-900">
          <MockNavigation />
          <Accelerator />
        </div>
      </Route>
      
      <Route path="/contractors">
        <SimplePage 
          title="Find Contractors" 
          description="Connect with verified local contractors in your area" 
        />
      </Route>
      
      <Route path="/quote-calculator">
        <SimplePage 
          title="Quote Calculator" 
          description="Get instant estimates for your home improvement projects" 
        />
      </Route>
      
      <Route path="/community">
        <SimplePage 
          title="Community" 
          description="Connect with neighbors and local professionals" 
        />
      </Route>
      
      <Route path="/helpers">
        <SimplePage 
          title="Helpers Marketplace" 
          description="Find skilled helpers for your projects" 
        />
      </Route>
      
      <Route path="/foundation">
        <SimplePage 
          title="Foundation" 
          description="TradeScout Foundation - Building communities" 
        />
      </Route>
      
      <Route path="/exchange">
        <SimplePage 
          title="Exchange" 
          description="Equipment and material exchange marketplace" 
        />
      </Route>
      
      <Route path="/">
        <SimplePage 
          title="TradeScout Dashboard" 
          description="Your home for connecting with trusted professionals" 
        />
      </Route>
      
      {/* Catch-all */}
      <Route>
        <SimplePage 
          title="Page Not Found" 
          description="The page you're looking for doesn't exist" 
        />
      </Route>
    </Switch>
  );
}