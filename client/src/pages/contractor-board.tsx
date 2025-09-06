import React, { memo } from 'react';

const ContractorBoard = memo(function ContractorBoard() {
  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-orange-400">
          Contractor Dashboard
        </h1>
        
        {/* Stats Overview */}
        <section className="mb-12">
          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-navy-800 p-6 rounded-lg text-center">
              <h3 className="text-2xl font-bold text-orange-400 mb-2">12</h3>
              <p className="text-gray-300">Active Projects</p>
            </div>
            <div className="bg-navy-800 p-6 rounded-lg text-center">
              <h3 className="text-2xl font-bold text-orange-400 mb-2">4.8</h3>
              <p className="text-gray-300">Average Rating</p>
            </div>
            <div className="bg-navy-800 p-6 rounded-lg text-center">
              <h3 className="text-2xl font-bold text-orange-400 mb-2">156</h3>
              <p className="text-gray-300">Completed Jobs</p>
            </div>
            <div className="bg-navy-800 p-6 rounded-lg text-center">
              <h3 className="text-2xl font-bold text-orange-400 mb-2">$45K</h3>
              <p className="text-gray-300">Monthly Revenue</p>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Quick Actions</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-navy-800 p-6 rounded-lg hover:bg-navy-700 transition-colors cursor-pointer">
              <h3 className="text-xl font-semibold mb-2 text-orange-400">View Connections</h3>
              <p className="text-gray-300">Check new project opportunities</p>
            </div>
            <div className="bg-navy-800 p-6 rounded-lg hover:bg-navy-700 transition-colors cursor-pointer">
              <h3 className="text-xl font-semibold mb-2 text-orange-400">Update Profile</h3>
              <p className="text-gray-300">Manage your contractor information</p>
            </div>
            <div className="bg-navy-800 p-6 rounded-lg hover:bg-navy-700 transition-colors cursor-pointer">
              <h3 className="text-xl font-semibold mb-2 text-orange-400">Submit Quote</h3>
              <p className="text-gray-300">Provide pricing for new projects</p>
            </div>
          </div>
        </section>

        {/* Recent Projects */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Recent Projects</h2>
          <div className="bg-navy-800 rounded-lg overflow-hidden">
            <div className="p-6">
              <p className="text-gray-300">No recent projects. Start by bidding on new opportunities!</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
});

export default ContractorBoard;