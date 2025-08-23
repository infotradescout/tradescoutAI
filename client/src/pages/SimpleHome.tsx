import { memo } from 'react';

const SimpleHome = memo(function SimpleHome() {
  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-orange-400">
          Welcome to TradeScout
        </h1>
        
        {/* Quick Actions */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Quick Actions</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-navy-800 p-6 rounded-lg hover:bg-navy-700 transition-colors cursor-pointer">
              <h3 className="text-xl font-semibold mb-2 text-orange-400">Find Contractors</h3>
              <p className="text-gray-300">Search for verified contractors in your area</p>
            </div>
            <div className="bg-navy-800 p-6 rounded-lg hover:bg-navy-700 transition-colors cursor-pointer">
              <h3 className="text-xl font-semibold mb-2 text-orange-400">Get Quote</h3>
              <p className="text-gray-300">Calculate project costs with our pricing tool</p>
            </div>
            <div className="bg-navy-800 p-6 rounded-lg hover:bg-navy-700 transition-colors cursor-pointer">
              <h3 className="text-xl font-semibold mb-2 text-orange-400">Daily Deals</h3>
              <p className="text-gray-300">Check out today's special contractor offers</p>
            </div>
          </div>
        </section>

        {/* Recent Activity */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Recent Activity</h2>
          <div className="bg-navy-800 p-6 rounded-lg">
            <p className="text-gray-300">No recent activity. Start by finding contractors or getting a quote!</p>
          </div>
        </section>
      </div>
    </div>
  );
});

export default SimpleHome;