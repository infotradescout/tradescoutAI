import React from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthButtons } from "@/components/auth-buttons";
import { AuthModal } from "@/components/auth-modal";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const queryClient = new QueryClient();

export default function SimpleApp() {
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 text-white">
        {/* Header */}
        <header className="bg-navy-800/80 backdrop-blur-md border-b border-navy-700/50 p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">T</span>
              </div>
              <span className="text-xl font-bold text-white">TradeScout</span>
            </div>
            <Button 
              onClick={() => setShowAuthModal(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Get Started
            </Button>
          </div>
        </header>

        {/* Hero Section */}
        <main className="max-w-7xl mx-auto px-4 py-16">
          <div className="text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Find Trusted Local Contractors
              </h1>
              <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                Connect with verified contractors in your area. Get up to 3 free quotes for your home improvement projects.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="grid md:grid-cols-3 gap-6 mt-12">
              <div className="bg-navy-800/50 p-6 rounded-lg border border-navy-700/50">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-2xl">🔍</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">Find Contractors</h3>
                <p className="text-gray-400">Browse verified contractors in your area</p>
              </div>
              
              <div className="bg-navy-800/50 p-6 rounded-lg border border-navy-700/50">
                <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-2xl">💬</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">Get Quotes</h3>
                <p className="text-gray-400">Receive up to 3 free project quotes</p>
              </div>
              
              <div className="bg-navy-800/50 p-6 rounded-lg border border-navy-700/50">
                <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-2xl">⭐</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">Choose & Review</h3>
                <p className="text-gray-400">Select the best contractor and leave reviews</p>
              </div>
            </div>

            {/* Call to Action */}
            <div className="pt-8">
              <Button 
                onClick={() => setShowAuthModal(true)}
                size="lg"
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 text-lg"
              >
                Start Your Project Today
              </Button>
            </div>
          </div>
        </main>

        {/* Authentication Modal */}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          title="Join TradeScout Today"
          description="Connect with verified contractors or grow your business"
          onGuestContinue={() => {
            setShowAuthModal(false);
            // Handle guest continue
          }}
        />

        {/* Footer */}
        <footer className="bg-navy-800/50 border-t border-navy-700/50 py-8 mt-16">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-gray-400">
              © 2025 TradeScout. Connecting homeowners with trusted contractors nationwide.
            </p>
          </div>
        </footer>
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}