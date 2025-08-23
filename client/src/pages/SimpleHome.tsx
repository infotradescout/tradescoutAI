import { memo } from 'react';

const SimpleHome = memo(function SimpleHome() {
  return (
    <div className="min-h-screen gradient-bg text-white">
      {/* Header */}
      <section className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Welcome to TradeScout
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Your professional dashboard for managing projects, finding contractors, and tracking progress
          </p>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8 text-center">Quick Actions</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <a href="/find-contractors" className="group bg-navy-800/50 backdrop-blur-sm p-6 rounded-2xl border border-navy-700 hover:border-orange-500/50 transition-all duration-300 hover:transform hover:scale-105 block">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-orange-400">Find Contractors</h3>
            <p className="text-gray-300">Search for verified contractors in your area</p>
          </a>

          <a href="/quote-calculator" className="group bg-navy-800/50 backdrop-blur-sm p-6 rounded-2xl border border-navy-700 hover:border-orange-500/50 transition-all duration-300 hover:transform hover:scale-105 block">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-orange-400">Quote Calculator</h3>
            <p className="text-gray-300">Get accurate project cost estimates</p>
          </a>

          <a href="/daily-deals" className="group bg-navy-800/50 backdrop-blur-sm p-6 rounded-2xl border border-navy-700 hover:border-orange-500/50 transition-all duration-300 hover:transform hover:scale-105 block">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-orange-400">Daily Deals</h3>
            <p className="text-gray-300">Discover contractor promotions and savings</p>
          </a>

          <a href="/contractors" className="group bg-navy-800/50 backdrop-blur-sm p-6 rounded-2xl border border-navy-700 hover:border-orange-500/50 transition-all duration-300 hover:transform hover:scale-105 block">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 00-2 2h2a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-orange-400">Dashboard</h3>
            <p className="text-gray-300">Manage your projects and profile</p>
          </a>
        </div>
      </section>

      {/* Platform Stats */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold mb-8 text-center">Platform Overview</h2>
        <div className="grid md:grid-cols-4 gap-6">
          <div className="text-center group">
            <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-3xl p-6 mb-4 group-hover:scale-105 transition-transform">
              <div className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent mb-2">28,500+</div>
              <div className="text-gray-300 font-medium">Verified Contractors</div>
            </div>
          </div>
          <div className="text-center group">
            <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-3xl p-6 mb-4 group-hover:scale-105 transition-transform">
              <div className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent mb-2">125,000+</div>
              <div className="text-gray-300 font-medium">Active Users</div>
            </div>
          </div>
          <div className="text-center group">
            <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-3xl p-6 mb-4 group-hover:scale-105 transition-transform">
              <div className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent mb-2">$2.45M</div>
              <div className="text-gray-300 font-medium">Platform Revenue</div>
            </div>
          </div>
          <div className="text-center group">
            <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-3xl p-6 mb-4 group-hover:scale-105 transition-transform">
              <div className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent mb-2">89%</div>
              <div className="text-gray-300 font-medium">Contractor Retention</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
});

export default SimpleHome;