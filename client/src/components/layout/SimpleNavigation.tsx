import { memo } from 'react';

const SimpleNavigation = memo(function SimpleNavigation() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Premium Logo */}
          <div className="flex items-center">
            <button onClick={() => window.location.pathname = '/'} className="flex items-center gap-3 group">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
              <div>
                <span className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  TradeScout
                </span>
                <div className="text-xs text-orange-400 font-medium -mt-1">PREMIUM</div>
              </div>
            </button>
          </div>

          {/* Premium Navigation - Full TradeScout Features */}
          <div className="hidden lg:flex items-center space-x-6">
            <button onClick={() => window.location.pathname = '/find-contractors'} className="group relative px-3 py-2 text-gray-300 hover:text-white transition-all duration-300">
              <span className="relative z-10 font-medium">Find Contractors</span>
              <div className="absolute inset-0 bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
              <div className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-gradient-to-r from-orange-500 to-orange-600 group-hover:w-full group-hover:left-0 transition-all duration-300"></div>
            </button>
            <div className="relative group">
              <button className="group relative px-3 py-2 text-gray-300 hover:text-white transition-all duration-300 flex items-center gap-2">
                <span className="relative z-10 font-medium">Marketplace</span>
                <svg className="w-4 h-4 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                <div className="absolute inset-0 bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
                <div className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-gradient-to-r from-orange-500 to-orange-600 group-hover:w-full group-hover:left-0 transition-all duration-300"></div>
              </button>
              
              {/* Dropdown Menu */}
              <div className="absolute top-full left-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
                <div className="py-2">
                  <a href="/worker-marketplace" className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-slate-700/50 transition-colors">
                    <div className="font-medium">Helpers & Workers</div>
                    <div className="text-sm text-gray-400">Find skilled helpers for projects</div>
                  </a>
                  <a href="/vehicle-marketplace" className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-slate-700/50 transition-colors">
                    <div className="font-medium">Vehicle Sales</div>
                    <div className="text-sm text-gray-400">Buy & sell cars, trucks, equipment</div>
                  </a>
                  <a href="/real-estate-marketplace" className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-slate-700/50 transition-colors">
                    <div className="font-medium">Real Estate</div>
                    <div className="text-sm text-gray-400">Properties, homes, land listings</div>
                  </a>
                  <a href="/handmade-marketplace" className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-slate-700/50 transition-colors">
                    <div className="font-medium">Handmade Goods</div>
                    <div className="text-sm text-gray-400">Custom crafts & artisan items</div>
                  </a>
                </div>
              </div>
            </div>
            <a href="/daily-deals" className="group relative px-3 py-2 text-gray-300 hover:text-white transition-all duration-300">
              <span className="relative z-10 font-medium">Deals</span>
              <div className="absolute inset-0 bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
              <div className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-gradient-to-r from-orange-500 to-orange-600 group-hover:w-full group-hover:left-0 transition-all duration-300"></div>
            </a>
            <a href="/groups" className="group relative px-3 py-2 text-gray-300 hover:text-white transition-all duration-300">
              <span className="relative z-10 font-medium">Groups</span>
              <div className="absolute inset-0 bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
              <div className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-gradient-to-r from-orange-500 to-orange-600 group-hover:w-full group-hover:left-0 transition-all duration-300"></div>
            </a>
            <a href="/county-hub" className="group relative px-3 py-2 text-gray-300 hover:text-white transition-all duration-300">
              <span className="relative z-10 font-medium">Community</span>
              <div className="absolute inset-0 bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
              <div className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-gradient-to-r from-orange-500 to-orange-600 group-hover:w-full group-hover:left-0 transition-all duration-300"></div>
            </a>
            
            {/* Premium CTAs */}
            <div className="flex items-center space-x-4 ml-8 pl-8 border-l border-white/10">
              <button 
                onClick={() => window.location.href = '/login'}
                className="text-gray-300 hover:text-white transition-colors font-medium px-4 py-2"
                data-testid="button-sign-in"
              >
                Sign In
              </button>
              <button 
                onClick={() => window.location.href = '/login'}
                className="relative group px-6 py-3 bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-orange-500/25"
                data-testid="button-get-started"
              >
                <span className="relative z-10">Get Started</span>
                <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-orange-800 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          <div className="lg:hidden">
            <button className="p-2 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all">
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