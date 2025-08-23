import { memo } from 'react';

const SimpleLanding = memo(function SimpleLanding() {
  return (
    <div className="min-h-screen gradient-bg text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-navy-900/50"></div>
        <div className="container mx-auto px-4 py-24 text-center relative z-10">
          <div className="inline-flex items-center px-4 py-2 bg-orange-500/20 rounded-full text-orange-300 text-sm font-medium mb-8">
            🚀 Now serving 3,000+ counties nationwide
          </div>
          <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
            TradeScout
          </h1>
          <p className="text-xl md:text-2xl mb-12 text-gray-300 max-w-4xl mx-auto leading-relaxed">
            The premier platform connecting homeowners with verified contractors. 
            <span className="text-orange-400 font-semibold"> Quality work, trusted professionals, transparent pricing.</span>
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <button className="group bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-10 py-4 rounded-xl font-semibold transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105">
              <span className="flex items-center gap-2">
                Find Contractors
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </span>
            </button>
            <button className="group border-2 border-orange-500 text-orange-400 hover:bg-orange-500 hover:text-white px-10 py-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105">
              Join as Contractor
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Why Choose TradeScout?</h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">Experience the difference with our comprehensive platform designed for both homeowners and contractors</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="group bg-navy-800/50 backdrop-blur-sm p-8 rounded-2xl border border-navy-700 hover:border-orange-500/50 transition-all duration-300 hover:transform hover:scale-105">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold mb-4 text-orange-400">Verified Contractors</h3>
            <p className="text-gray-300 leading-relaxed">All contractors undergo thorough verification including license checks, insurance validation, and comprehensive background reviews for your peace of mind.</p>
          </div>
          <div className="group bg-navy-800/50 backdrop-blur-sm p-8 rounded-2xl border border-navy-700 hover:border-orange-500/50 transition-all duration-300 hover:transform hover:scale-105">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold mb-4 text-orange-400">County-Centric</h3>
            <p className="text-gray-300 leading-relaxed">Find contractors specific to your county with deep local knowledge, proper licensing, and expertise in regional building codes and requirements.</p>
          </div>
          <div className="group bg-navy-800/50 backdrop-blur-sm p-8 rounded-2xl border border-navy-700 hover:border-orange-500/50 transition-all duration-300 hover:transform hover:scale-105">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold mb-4 text-orange-400">Transparent Pricing</h3>
            <p className="text-gray-300 leading-relaxed">Get accurate quotes with our regional pricing calculator, compare multiple bids, and enjoy our competitive marketplace with no hidden fees.</p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-navy-800/80 to-navy-900/80 backdrop-blur-sm"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Trusted by Thousands</h2>
            <p className="text-xl text-gray-400">Real numbers from our growing community</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center group">
              <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-3xl p-8 mb-4 group-hover:scale-105 transition-transform">
                <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent mb-2">28,500+</div>
                <div className="text-gray-300 text-lg font-medium">Verified Contractors</div>
                <div className="text-gray-500 text-sm mt-2">Thoroughly vetted professionals</div>
              </div>
            </div>
            <div className="text-center group">
              <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-3xl p-8 mb-4 group-hover:scale-105 transition-transform">
                <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent mb-2">125,000+</div>
                <div className="text-gray-300 text-lg font-medium">Active Users</div>
                <div className="text-gray-500 text-sm mt-2">Homeowners finding quality work</div>
              </div>
            </div>
            <div className="text-center group">
              <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-3xl p-8 mb-4 group-hover:scale-105 transition-transform">
                <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent mb-2">$2.45M</div>
                <div className="text-gray-300 text-lg font-medium">Platform Revenue</div>
                <div className="text-gray-500 text-sm mt-2">Facilitating quality projects</div>
              </div>
            </div>
            <div className="text-center group">
              <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-3xl p-8 mb-4 group-hover:scale-105 transition-transform">
                <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent mb-2">89%</div>
                <div className="text-gray-300 text-lg font-medium">Contractor Retention</div>
                <div className="text-gray-500 text-sm mt-2">Long-term partnerships</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Get Started?</h2>
          <p className="text-xl text-gray-400 mb-12">Join thousands of satisfied homeowners and contractors on TradeScout</p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-12 py-4 rounded-xl font-semibold transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105">
              Start Your Project Today
            </button>
            <button className="border-2 border-gray-600 text-gray-300 hover:border-orange-500 hover:text-orange-400 px-12 py-4 rounded-xl font-semibold transition-all duration-300">
              Learn More
            </button>
          </div>
        </div>
      </section>
    </div>
  );
});

export default SimpleLanding;