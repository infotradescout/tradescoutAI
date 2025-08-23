import { memo } from 'react';
import { Button } from '@/components/ui/button';

const SimpleLanding = memo(function SimpleLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 text-white">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
            TradeScout
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-gray-300 max-w-3xl mx-auto">
            Connect with trusted local contractors and manage your home improvement projects with confidence
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3"
              onClick={() => window.location.href = '/contractors'}
            >
              Find Contractors
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-white px-8 py-3"
              onClick={() => window.location.href = '/quote-calculator'}
            >
              Get Quote
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="text-center p-6 rounded-lg bg-navy-800/50 border border-navy-600">
            <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center mx-auto mb-4">
              🔨
            </div>
            <h3 className="text-xl font-semibold mb-3">Trusted Contractors</h3>
            <p className="text-gray-300">Verified local professionals with proven track records</p>
          </div>
          
          <div className="text-center p-6 rounded-lg bg-navy-800/50 border border-navy-600">
            <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center mx-auto mb-4">
              💰
            </div>
            <h3 className="text-xl font-semibold mb-3">Fair Pricing</h3>
            <p className="text-gray-300">Transparent quotes with regional pricing data</p>
          </div>
          
          <div className="text-center p-6 rounded-lg bg-navy-800/50 border border-navy-600">
            <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center mx-auto mb-4">
              📱
            </div>
            <h3 className="text-xl font-semibold mb-3">Easy Management</h3>
            <p className="text-gray-300">Track projects, communicate, and manage everything in one place</p>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center mb-16">
          <div>
            <div className="text-3xl font-bold text-orange-400 mb-2">125,000+</div>
            <div className="text-gray-300">Active Users</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-orange-400 mb-2">28,500+</div>
            <div className="text-gray-300">Contractors</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-orange-400 mb-2">$2.45M</div>
            <div className="text-gray-300">Platform Revenue</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-orange-400 mb-2">89%</div>
            <div className="text-gray-300">Retention Rate</div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">Ready to start your project?</h2>
          <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
            Join thousands of homeowners who trust TradeScout for their home improvement needs
          </p>
          <Button 
            size="lg" 
            className="bg-orange-500 hover:bg-orange-600 text-white px-12 py-4 text-lg"
            onClick={() => window.location.href = '/contractors'}
          >
            Get Started Today
          </Button>
        </div>
      </div>
    </div>
  );
});

export default SimpleLanding;