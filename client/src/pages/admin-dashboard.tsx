import { memo } from 'react';

const AdminDashboard = memo(function AdminDashboard() {
  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-orange-400">
          Admin Dashboard
        </h1>
        
        {/* Key Metrics */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Platform Overview</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-navy-800 p-6 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Total Users</h3>
              <div className="text-3xl font-bold text-orange-400">125,000</div>
              <div className="text-green-400 text-sm">↑ 12% this month</div>
            </div>
            <div className="bg-navy-800 p-6 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Active Contractors</h3>
              <div className="text-3xl font-bold text-orange-400">28,500</div>
              <div className="text-green-400 text-sm">↑ 8% this month</div>
            </div>
            <div className="bg-navy-800 p-6 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Platform Revenue</h3>
              <div className="text-3xl font-bold text-orange-400">$2.45M</div>
              <div className="text-green-400 text-sm">↑ 15% this month</div>
            </div>
            <div className="bg-navy-800 p-6 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Retention Rate</h3>
              <div className="text-3xl font-bold text-orange-400">89%</div>
              <div className="text-green-400 text-sm">↑ 2% this month</div>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Quick Actions</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-navy-800 p-6 rounded-lg hover:bg-navy-700 transition-colors cursor-pointer">
              <h3 className="text-lg font-semibold mb-2 text-orange-400">Manage Users</h3>
              <p className="text-gray-300">View and manage user accounts, roles, and permissions</p>
            </div>
            <div className="bg-navy-800 p-6 rounded-lg hover:bg-navy-700 transition-colors cursor-pointer">
              <h3 className="text-lg font-semibold mb-2 text-orange-400">Contractor Verification</h3>
              <p className="text-gray-300">Review and approve contractor applications</p>
            </div>
            <div className="bg-navy-800 p-6 rounded-lg hover:bg-navy-700 transition-colors cursor-pointer">
              <h3 className="text-lg font-semibold mb-2 text-orange-400">Content Moderation</h3>
              <p className="text-gray-300">Monitor and moderate platform content</p>
            </div>
            <div className="bg-navy-800 p-6 rounded-lg hover:bg-navy-700 transition-colors cursor-pointer">
              <h3 className="text-lg font-semibold mb-2 text-orange-400">Analytics</h3>
              <p className="text-gray-300">View detailed platform analytics and reports</p>
            </div>
            <div className="bg-navy-800 p-6 rounded-lg hover:bg-navy-700 transition-colors cursor-pointer">
              <h3 className="text-lg font-semibold mb-2 text-orange-400">System Settings</h3>
              <p className="text-gray-300">Configure platform settings and preferences</p>
            </div>
            <div className="bg-navy-800 p-6 rounded-lg hover:bg-navy-700 transition-colors cursor-pointer">
              <h3 className="text-lg font-semibold mb-2 text-orange-400">Support Tickets</h3>
              <p className="text-gray-300">Manage customer support requests</p>
            </div>
          </div>
        </section>

        {/* Recent Activity */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Recent Platform Activity</h2>
          <div className="bg-navy-800 rounded-lg overflow-hidden">
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-navy-700">
                  <div>
                    <span className="text-orange-400">New contractor registration:</span> ABC Construction LLC
                  </div>
                  <span className="text-gray-400 text-sm">2 hours ago</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-navy-700">
                  <div>
                    <span className="text-blue-400">User verification completed:</span> john.doe@example.com
                  </div>
                  <span className="text-gray-400 text-sm">4 hours ago</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-navy-700">
                  <div>
                    <span className="text-green-400">Payment processed:</span> $1,250 contractor subscription
                  </div>
                  <span className="text-gray-400 text-sm">6 hours ago</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <div>
                    <span className="text-yellow-400">Support ticket resolved:</span> Quote calculator issue
                  </div>
                  <span className="text-gray-400 text-sm">8 hours ago</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* System Status */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">System Status</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-navy-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-4 text-orange-400">Services</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Web Application</span>
                  <span className="text-green-400">● Operational</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>API Services</span>
                  <span className="text-green-400">● Operational</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Database</span>
                  <span className="text-green-400">● Operational</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Payment Processing</span>
                  <span className="text-green-400">● Operational</span>
                </div>
              </div>
            </div>
            <div className="bg-navy-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-4 text-orange-400">Performance</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Response Time</span>
                  <span className="text-green-400">125ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Uptime</span>
                  <span className="text-green-400">99.9%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Server Load</span>
                  <span className="text-yellow-400">65%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Active Sessions</span>
                  <span className="text-blue-400">1,247</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
});

export default AdminDashboard;