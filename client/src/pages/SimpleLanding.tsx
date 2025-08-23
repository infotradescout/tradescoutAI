import { memo } from 'react';

const SimpleLanding = memo(function SimpleLanding() {
  return (
    <div className="min-h-screen bg-navy-900 text-white">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-5xl font-bold mb-6 text-orange-400">
          TradeScout
        </h1>
        <p className="text-xl mb-8 text-gray-300 max-w-3xl mx-auto">
          The premier platform connecting homeowners with verified contractors across 3,000+ counties nationwide
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors">
            Find Contractors
          </button>
          <button className="border border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white px-8 py-3 rounded-lg font-semibold transition-colors">
            Join as Contractor
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Why Choose TradeScout?</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-navy-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4 text-orange-400">Verified Contractors</h3>
            <p className="text-gray-300">All contractors undergo thorough verification including license checks and background reviews.</p>
          </div>
          <div className="bg-navy-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4 text-orange-400">County-Centric</h3>
            <p className="text-gray-300">Find contractors specific to your county with local knowledge and expertise.</p>
          </div>
          <div className="bg-navy-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4 text-orange-400">Transparent Pricing</h3>
            <p className="text-gray-300">Get accurate quotes with our regional pricing calculator and competitive marketplace.</p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-navy-800 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Platform Statistics</h2>
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-orange-400 mb-2">28,500+</div>
              <div className="text-gray-300">Verified Contractors</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-orange-400 mb-2">125,000+</div>
              <div className="text-gray-300">Active Users</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-orange-400 mb-2">$2.45M</div>
              <div className="text-gray-300">Platform Revenue</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-orange-400 mb-2">89%</div>
              <div className="text-gray-300">Contractor Retention</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
});

export default SimpleLanding;