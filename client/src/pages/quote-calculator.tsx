import { memo } from 'react';

const QuoteCalculator = memo(function QuoteCalculator() {
  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-orange-400">
          Quote Calculator
        </h1>
        
        {/* Calculator Form */}
        <section className="mb-12">
          <div className="bg-navy-800 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-6">Get Your Project Estimate</h2>
            <form data-testid="quote-calculator-form">
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Project Type</label>
                <select data-testid="project-type-select" className="w-full bg-navy-700 text-white p-3 rounded border border-navy-600 focus:border-orange-500">
                  <option>Select project type</option>
                  <option>Kitchen Renovation</option>
                  <option>Bathroom Remodel</option>
                  <option>Roofing</option>
                  <option>Flooring</option>
                  <option>Plumbing</option>
                  <option>Electrical</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Square Footage</label>
                <input 
                  data-testid="square-footage-input"
                  type="number" 
                  placeholder="Enter square footage"
                  className="w-full bg-navy-700 text-white p-3 rounded border border-navy-600 focus:border-orange-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Location</label>
                <input 
                  type="text" 
                  placeholder="Enter your city and state"
                  className="w-full bg-navy-700 text-white p-3 rounded border border-navy-600 focus:border-orange-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Timeline</label>
                <select className="w-full bg-navy-700 text-white p-3 rounded border border-navy-600 focus:border-orange-500">
                  <option>Select timeline</option>
                  <option>ASAP (Rush job)</option>
                  <option>Within 1 month</option>
                  <option>Within 3 months</option>
                  <option>Within 6 months</option>
                  <option>Flexible</option>
                </select>
              </div>
            </div>
            
            <div className="mt-6">
              <button data-testid="calculate-estimate-btn" className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded font-semibold transition-colors">
                Calculate Estimate
              </button>
            </div>
            </form>
          </div>
        </section>

        {/* Estimate Results */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Your Estimate</h2>
          <div className="bg-navy-800 p-6 rounded-lg">
            <div className="text-center">
              <div className="text-4xl font-bold text-orange-400 mb-4">$8,500 - $15,200</div>
              <p className="text-gray-300 mb-6">Estimated cost range for your project</p>
              <button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded font-semibold transition-colors">
                Get Detailed Quotes from Contractors
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
});

export default QuoteCalculator;