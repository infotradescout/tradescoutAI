import { memo } from 'react';

const TestPage = memo(function TestPage() {
  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-orange-400">
          Test Page
        </h1>
        
        {/* Component Testing */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Component Testing</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-navy-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-4 text-orange-400">Button Tests</h3>
              <div className="space-y-4">
                <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded transition-colors">
                  Primary Button
                </button>
                <button className="border border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white px-4 py-2 rounded transition-colors">
                  Secondary Button
                </button>
                <button className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors">
                  Disabled Style
                </button>
              </div>
            </div>
            
            <div className="bg-navy-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-4 text-orange-400">Form Elements</h3>
              <div className="space-y-4">
                <input 
                  type="text" 
                  placeholder="Text input test"
                  className="w-full bg-navy-700 text-white p-3 rounded border border-navy-600 focus:border-orange-500"
                />
                <select className="w-full bg-navy-700 text-white p-3 rounded border border-navy-600 focus:border-orange-500">
                  <option>Select option</option>
                  <option>Option 1</option>
                  <option>Option 2</option>
                </select>
                <textarea 
                  placeholder="Textarea test"
                  className="w-full bg-navy-700 text-white p-3 rounded border border-navy-600 focus:border-orange-500"
                  rows={3}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Color Palette */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Color Palette</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-orange-500 p-4 rounded text-center">
              <div className="text-white font-semibold">Orange 500</div>
              <div className="text-orange-100 text-sm">#f97316</div>
            </div>
            <div className="bg-orange-400 p-4 rounded text-center">
              <div className="text-white font-semibold">Orange 400</div>
              <div className="text-orange-100 text-sm">#fb923c</div>
            </div>
            <div className="bg-navy-900 border border-navy-600 p-4 rounded text-center">
              <div className="text-white font-semibold">Navy 900</div>
              <div className="text-gray-300 text-sm">#0f172a</div>
            </div>
            <div className="bg-navy-800 p-4 rounded text-center">
              <div className="text-white font-semibold">Navy 800</div>
              <div className="text-gray-300 text-sm">#1e293b</div>
            </div>
          </div>
        </section>

        {/* API Testing */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">API Testing</h2>
          <div className="bg-navy-800 p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 text-orange-400">Available Endpoints</h3>
            <div className="space-y-2 text-sm font-mono">
              <div className="text-green-400">GET /api/health - Health check</div>
              <div className="text-blue-400">GET /api/auth/user - User authentication</div>
              <div className="text-blue-400">GET /api/contractors - Contractor listings</div>
              <div className="text-blue-400">GET /api/daily-deals - Daily contractor deals</div>
              <div className="text-blue-400">GET /api/stats - Platform statistics</div>
            </div>
            <button className="mt-4 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded transition-colors">
              Test API Connection
            </button>
          </div>
        </section>
      </div>
    </div>
  );
});

export default TestPage;