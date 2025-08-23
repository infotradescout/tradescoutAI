import { memo } from 'react';

const Profile = memo(function Profile() {
  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-orange-400">
          User Profile
        </h1>
        
        {/* Profile Header */}
        <section className="mb-12">
          <div className="bg-navy-800 p-6 rounded-lg">
            <div className="flex items-center space-x-6">
              <div className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center text-2xl font-bold">
                JD
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">John Doe</h2>
                <p className="text-gray-300">Homeowner • Member since 2024</p>
                <p className="text-gray-300">Los Angeles, CA</p>
              </div>
            </div>
          </div>
        </section>

        {/* Profile Information */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Profile Information</h2>
          <div className="bg-navy-800 p-6 rounded-lg">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">First Name</label>
                <input 
                  type="text" 
                  value="John"
                  className="w-full bg-navy-700 text-white p-3 rounded border border-navy-600 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Last Name</label>
                <input 
                  type="text" 
                  value="Doe"
                  className="w-full bg-navy-700 text-white p-3 rounded border border-navy-600 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input 
                  type="email" 
                  value="john.doe@example.com"
                  className="w-full bg-navy-700 text-white p-3 rounded border border-navy-600 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Phone</label>
                <input 
                  type="tel" 
                  value="(555) 123-4567"
                  className="w-full bg-navy-700 text-white p-3 rounded border border-navy-600 focus:border-orange-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Address</label>
                <input 
                  type="text" 
                  value="123 Main St, Los Angeles, CA 90210"
                  className="w-full bg-navy-700 text-white p-3 rounded border border-navy-600 focus:border-orange-500"
                />
              </div>
            </div>
            <div className="mt-6">
              <button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded font-semibold transition-colors">
                Update Profile
              </button>
            </div>
          </div>
        </section>

        {/* Account Preferences */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Preferences</h2>
          <div className="bg-navy-800 p-6 rounded-lg">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Email notifications for new deals</span>
                <input type="checkbox" className="rounded" checked />
              </div>
              <div className="flex items-center justify-between">
                <span>SMS notifications for project updates</span>
                <input type="checkbox" className="rounded" />
              </div>
              <div className="flex items-center justify-between">
                <span>Weekly contractor recommendations</span>
                <input type="checkbox" className="rounded" checked />
              </div>
            </div>
          </div>
        </section>

        {/* Recent Activity */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Recent Activity</h2>
          <div className="space-y-4">
            <div className="bg-navy-800 p-4 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-orange-400">Requested quote for kitchen renovation</h3>
                  <p className="text-gray-300 text-sm">2 days ago</p>
                </div>
                <span className="text-yellow-400 text-sm">Pending</span>
              </div>
            </div>
            <div className="bg-navy-800 p-4 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-orange-400">Contacted ABC Plumbing for bathroom repair</h3>
                  <p className="text-gray-300 text-sm">1 week ago</p>
                </div>
                <span className="text-green-400 text-sm">Completed</span>
              </div>
            </div>
            <div className="bg-navy-800 p-4 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-orange-400">Joined TradeScout platform</h3>
                  <p className="text-gray-300 text-sm">2 weeks ago</p>
                </div>
                <span className="text-blue-400 text-sm">Account Created</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
});

export default Profile;