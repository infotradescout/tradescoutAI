import { memo } from 'react';

const SimpleNavigation = memo(function SimpleNavigation() {
  return (
    <nav className="bg-navy-900/90 backdrop-blur-sm border-b border-navy-700 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <a href="/" className="text-xl font-bold text-orange-400">
              TradeScout
            </a>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-6">
            <a href="/contractors" className="text-gray-300 hover:text-orange-400 transition-colors">
              Contractors
            </a>
            <a href="/quote-calculator" className="text-gray-300 hover:text-orange-400 transition-colors">
              Quote Calculator
            </a>
            <a href="/daily-deals" className="text-gray-300 hover:text-orange-400 transition-colors">
              Daily Deals
            </a>
            <a href="/help-demo" className="text-gray-300 hover:text-orange-400 transition-colors">
              Help
            </a>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button className="text-gray-300 hover:text-orange-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
});

export default SimpleNavigation;