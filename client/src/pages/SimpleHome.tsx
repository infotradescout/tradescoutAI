import { memo } from 'react';
import { Button } from '@/components/ui/button';

const SimpleHome = memo(function SimpleHome() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Welcome Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Welcome to TradeScout
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Your dashboard for managing home improvement projects
          </p>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <div className="bg-navy-800 rounded-lg p-6 border border-navy-600">
            <h3 className="text-lg font-semibold text-white mb-3">Find Contractors</h3>
            <p className="text-gray-300 mb-4">Browse verified local contractors</p>
            <Button 
              className="w-full bg-orange-500 hover:bg-orange-600"
              onClick={() => window.location.href = '/contractors'}
            >
              Browse Contractors
            </Button>
          </div>

          <div className="bg-navy-800 rounded-lg p-6 border border-navy-600">
            <h3 className="text-lg font-semibold text-white mb-3">Get Quote</h3>
            <p className="text-gray-300 mb-4">Calculate project costs instantly</p>
            <Button 
              className="w-full bg-orange-500 hover:bg-orange-600"
              onClick={() => window.location.href = '/quote-calculator'}
            >
              Quote Calculator
            </Button>
          </div>

          <div className="bg-navy-800 rounded-lg p-6 border border-navy-600">
            <h3 className="text-lg font-semibold text-white mb-3">Daily Deals</h3>
            <p className="text-gray-300 mb-4">Special offers and discounts</p>
            <Button 
              className="w-full bg-orange-500 hover:bg-orange-600"
              onClick={() => window.location.href = '/daily-deals'}
            >
              View Deals
            </Button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-navy-800 rounded-lg p-6 border border-navy-600">
          <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-navy-600">
              <span className="text-gray-300">Welcome to TradeScout!</span>
              <span className="text-sm text-gray-400">Just now</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-navy-600">
              <span className="text-gray-300">Explore contractor directory</span>
              <span className="text-sm text-gray-400">Getting started</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-300">Try the quote calculator</span>
              <span className="text-sm text-gray-400">Recommended</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default SimpleHome;