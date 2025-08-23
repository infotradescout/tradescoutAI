import { memo } from 'react';

const SimpleNavigation = memo(function SimpleNavigation() {
  return (
    <nav className="bg-navy-900/95 backdrop-blur-lg border-b border-navy-700/50 sticky top-0 z-50 shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center">
            <a href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                TradeScout
              </span>
            </a>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="/find-contractors" className="text-gray-300 hover:text-orange-400 transition-all duration-300 relative group">
              <span className="relative z-10">Find Contractors</span>
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-orange-500 group-hover:w-full transition-all duration-300"></span>
            </a>
            <a href="/contractors" className="text-gray-300 hover:text-orange-400 transition-all duration-300 relative group">
              <span className="relative z-10">Dashboard</span>
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-orange-500 group-hover:w-full transition-all duration-300"></span>
            </a>
            <a href="/quote-calculator" className="text-gray-300 hover:text-orange-400 transition-all duration-300 relative group">
              <span className="relative z-10">Calculator</span>
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-orange-500 group-hover:w-full transition-all duration-300"></span>
            </a>
            <a href="/daily-deals" className="text-gray-300 hover:text-orange-400 transition-all duration-300 relative group">
              <span className="relative z-10">Deals</span>
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-orange-500 group-hover:w-full transition-all duration-300"></span>
            </a>
            <div className="flex items-center space-x-4 ml-6">
              <button className="text-gray-300 hover:text-orange-400 transition-colors px-4 py-2">
                Sign In
              </button>
              <button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-2 rounded-lg font-semibold transition-all duration-300 hover:scale-105 shadow-lg">
                Get Started
              </button>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button className="text-gray-300 hover:text-orange-400 p-2 rounded-lg hover:bg-navy-800 transition-all">
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