import { memo } from 'react';

const FindContractors = memo(function FindContractors() {
  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-orange-400">
          Find Contractors
        </h1>
        
        {/* Search Section */}
        <section className="mb-12">
          <div className="bg-navy-800 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Search for Contractors</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <input 
                type="text" 
                placeholder="Enter your location"
                className="bg-navy-700 text-white p-3 rounded border border-navy-600 focus:border-orange-500"
              />
              <select className="bg-navy-700 text-white p-3 rounded border border-navy-600 focus:border-orange-500">
                <option>Select trade type</option>
                <option>Plumbing</option>
                <option>Electrical</option>
                <option>HVAC</option>
                <option>Roofing</option>
                <option>Flooring</option>
              </select>
              <button className="bg-orange-500 hover:bg-orange-600 text-white p-3 rounded font-semibold transition-colors">
                Search
              </button>
            </div>
          </div>
        </section>

        {/* Featured Contractors */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Featured Contractors</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-navy-800 p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-2 text-orange-400">
                  Professional Contractor {i}
                </h3>
                <p className="text-gray-300 mb-4">Verified contractor with 10+ years experience</p>
                <div className="flex justify-between items-center">
                  <span className="text-yellow-400">★★★★★ 4.9</span>
                  <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded transition-colors">
                    View Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
});

export default FindContractors;