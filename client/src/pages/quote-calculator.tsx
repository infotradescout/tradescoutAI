import { memo } from "react";
import { Page, Section } from "@/components/layout/PagePrimitives";

const QuoteCalculator = memo(function QuoteCalculator() {
  return (
    <Page>
      <Section title="Quote Calculator" subtitle="Get an instant estimate for your project">
        {/* Calculator Form */}
        <div className="rounded-2xl border border-white/10 bg-tsCard p-5 md:p-6">
          <h2 className="text-lg font-semibold text-white mb-5">Get Your Project Estimate</h2>
          <form data-testid="quote-calculator-form">
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium mb-2 text-white/80">Project Type</label>
                <select
                  data-testid="project-type-select"
                  className="w-full bg-tsCard text-white p-3 rounded-xl border border-white/10 focus:border-ts-orange/30 focus:outline-none"
                >
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
                <label className="block text-sm font-medium mb-2 text-white/80">Square Footage</label>
                <input
                  data-testid="square-footage-input"
                  type="number"
                  placeholder="Enter square footage"
                  className="w-full bg-tsCard text-white p-3 rounded-xl border border-white/10 focus:border-ts-orange/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-white/80">Location</label>
                <input
                  type="text"
                  placeholder="Enter your city and state"
                  className="w-full bg-tsCard text-white p-3 rounded-xl border border-white/10 focus:border-ts-orange/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-white/80">Timeline</label>
                <select className="w-full bg-tsCard text-white p-3 rounded-xl border border-white/10 focus:border-ts-orange/30 focus:outline-none">
                  <option>Select timeline</option>
                  <option>ASAP (Rush job)</option>
                  <option>Within 1 month</option>
                  <option>Within 3 months</option>
                  <option>Within 6 months</option>
                  <option>Flexible</option>
                </select>
              </div>
            </div>

            <div className="mt-5">
              <button
                data-testid="calculate-estimate-btn"
                className="bg-ts-orange hover:bg-ts-orange-dark text-white px-8 py-3 rounded-xl font-semibold transition-colors"
              >
                Calculate Estimate
              </button>
            </div>
          </form>
        </div>

        {/* Estimate Results */}
        <div className="rounded-2xl border border-white/10 bg-tsCard p-5 md:p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Your Estimate</h2>
          <div className="text-center py-4">
            <div className="text-4xl font-bold text-ts-orange mb-3">$8,500 - $15,200</div>
            <p className="text-white/70 mb-6">Estimated cost range for your project</p>
            <button className="bg-ts-orange hover:bg-ts-orange-dark text-white px-6 py-3 rounded-xl font-semibold transition-colors">
              Get Detailed Quotes from Contractors
            </button>
          </div>
        </div>
      </Section>
    </Page>
  );
});

export default QuoteCalculator;
