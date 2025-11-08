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
          <a href="/community-feed" className="group bg-navy-800/50 backdrop-blur-sm p-6 rounded-2xl border border-navy-700 hover:border-orange-500/50 transition-all duration-300 hover:transform hover:scale-105 block">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-purple-400">Community Feed</h3>
            <p className="text-gray-300">See posts, projects, and connect with others</p>
          </a>

          <a href="/find-contractors" className="group bg-navy-800/50 backdrop-blur-sm p-6 rounded-2xl border border-navy-700 hover:border-orange-500/50 transition-all duration-300 hover:transform hover:scale-105 block">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-orange-400">Find Contractors</h3>
            <p className="text-gray-300">Search for verified contractors in your area</p>
          </a>

          <a href="/marketplace" className="group bg-navy-800/50 backdrop-blur-sm p-6 rounded-2xl border border-navy-700 hover:border-orange-500/50 transition-all duration-300 hover:transform hover:scale-105 block">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-green-400">Marketplace</h3>
            <p className="text-gray-300">Buy and sell tools, materials, and equipment</p>
          </a>

          <a href="/daily-deals" className="group bg-navy-800/50 backdrop-blur-sm p-6 rounded-2xl border border-navy-700 hover:border-orange-500/50 transition-all duration-300 hover:transform hover:scale-105 block">
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-yellow-400">Daily Deals</h3>
            <p className="text-gray-300">Discover contractor promotions and savings</p>
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