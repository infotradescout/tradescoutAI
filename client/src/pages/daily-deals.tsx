import { memo } from "react";

const DailyDeals = memo(function DailyDeals() {
  return (
    <div className=" text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-ts-orange">
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
              className="text-ts-orange px-8 py-3 rounded font-semibold transition-colors"
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
              {
                title: "Plumbing Repair",
                discount: "20% Off",
                contractor: "Pro Plumbers LLC",
                evidence: "Verification pending",
              },
              {
                title: "Electrical Installation",
                discount: "15% Off",
                contractor: "Bright Electric Co",
                evidence: "Verification pending",
              },
              {
                title: "Roofing Inspection",
                discount: "Free",
                contractor: "Roof Masters Inc",
                evidence: "Verification pending",
              },
              {
                title: "HVAC Maintenance",
                discount: "$100 Off",
                contractor: "Climate Control Pro",
                evidence: "Verification pending",
              },
              {
                title: "Flooring Installation",
                discount: "25% Off",
                contractor: "Floor Experts",
                evidence: "Verification pending",
              },
              {
                title: "Painting Services",
                discount: "$200 Off",
                contractor: "Perfect Paint Co",
                evidence: "Verification pending",
              },
            ].map((deal, i) => (
              <div key={i} data-testid={`deal-card-${i}`} className="bg-tsCard p-6 rounded-lg">
                <div className="bg-ts-orange text-white px-3 py-1 rounded text-sm font-semibold mb-3 inline-block">
                  {deal.discount}
                </div>
                <h3 className="text-xl font-semibold mb-2 text-ts-orange">{deal.title}</h3>
                <p className="text-white/70 mb-2">by {deal.contractor}</p>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-white/70">{deal.evidence}</span>
                  <span className="text-sm text-white/60">Expires today</span>
                </div>
                <button
                  data-testid={`view-deal-btn-${i}`}
                  className="w-full bg-ts-orange hover:bg-ts-orange-dark text-white py-2 rounded transition-colors"
                >
                  View Deal
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">How TradeDeals work with LuckyBucks</h2>
          <div className="bg-tsCard p-6 rounded-lg">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl mb-4">🔍</div>
                <h3 className="text-lg font-semibold mb-2">Browse Deals</h3>
                <p className="text-white/70">Check daily for new contractor promotions</p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-4">📞</div>
                <h3 className="text-lg font-semibold mb-2">Request Quote</h3>
                <p className="text-white/70">
                  Submit a request and wait for acceptance before contact
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-4">✅</div>
                <h3 className="text-lg font-semibold mb-2">Save Money</h3>
                <p className="text-white/70">Enjoy premium services at reduced costs</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
});

export default DailyDeals;
