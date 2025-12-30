import { memo } from 'react';

const DailyDeals = memo(function DailyDeals() {
  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-orange-400">
          TradeDeals Directory (legacy view)
        </h1>
        
        {/* Featured Deal */}
        <section className="mb-12">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 p-8 rounded-lg text-center">
            <h2 className="text-3xl font-bold mb-4">Deal of the Day</h2>
            <p className="text-xl mb-6">Professional Kitchen Renovation - 25% Off</p>
            <div className="text-4xl font-bold mb-4">Save $3,000</div>
            <p className="mb-6">Limited time offer from certified kitchen specialists</p>
            <button
              data-testid="claim-featured-deal-btn"
              className="text-orange-600 px-8 py-3 rounded font-semibold transition-colors"
              style={{ backgroundColor: "var(--surface-frame)" }}
            >
              Claim Deal
            </button>
          </div>
        </section>

        {/* Today's Deals */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Today's Contractor Deals</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "Plumbing Repair", discount: "20% Off", contractor: "Pro Plumbers LLC", rating: "4.9" },
              { title: "Electrical Installation", discount: "15% Off", contractor: "Bright Electric Co", rating: "4.8" },
              { title: "Roofing Inspection", discount: "Free", contractor: "Roof Masters Inc", rating: "5.0" },
              { title: "HVAC Maintenance", discount: "$100 Off", contractor: "Climate Control Pro", rating: "4.7" },
              { title: "Flooring Installation", discount: "25% Off", contractor: "Floor Experts", rating: "4.9" },
              { title: "Painting Services", discount: "$200 Off", contractor: "Perfect Paint Co", rating: "4.6" }
            ].map((deal, i) => (
              <div key={i} data-testid={`deal-card-${i}`} className="bg-navy-800 p-6 rounded-lg">
                <div className="bg-orange-500 text-white px-3 py-1 rounded text-sm font-semibold mb-3 inline-block">
                  {deal.discount}
                </div>
                <h3 className="text-xl font-semibold mb-2 text-orange-400">{deal.title}</h3>
                <p className="text-gray-300 mb-2">by {deal.contractor}</p>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-yellow-400">★★★★★ {deal.rating}</span>
                  <span className="text-sm text-gray-400">Expires today</span>
                </div>
                <button data-testid={`view-deal-btn-${i}`} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded transition-colors">
                  View Deal
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">How TradeDeals work with LuckyBucks</h2>
          <div className="bg-navy-800 p-6 rounded-lg">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl mb-4">🔍</div>
                <h3 className="text-lg font-semibold mb-2">Browse Deals</h3>
                <p className="text-gray-300">Check daily for new contractor promotions</p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-4">📞</div>
                <h3 className="text-lg font-semibold mb-2">Contact Contractor</h3>
                <p className="text-gray-300">Reach out directly to claim your discount</p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-4">✅</div>
                <h3 className="text-lg font-semibold mb-2">Save Money</h3>
                <p className="text-gray-300">Enjoy premium services at reduced costs</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
});

export default DailyDeals;