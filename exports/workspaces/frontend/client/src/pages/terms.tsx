import { memo } from "react";
import { FileText } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";

export default memo(function Terms() {
  return (
    <div className="text-white font-body">
      <SEOHelmet
        title="Terms of Service | TradeScout"
        description="Read TradeScout terms of service, including account requirements, acceptable use, and platform participation rules."
        canonical="https://www.thetradescout.com/terms"
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-4">
            <FileText className="w-4 h-4 text-ts-orange" />
            <span className="text-sm font-medium text-ts-orange">Legal</span>
          </div>
          <h1 className="font-display text-3xl font-extrabold text-white mb-2">Terms of Service</h1>
          <p className="text-sm text-white/50">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        {/* Content */}
        <div className="bg-tsCard border border-white/10 rounded-xl p-6 shadow-[0_18px_52px_rgba(0,0,0,0.36)] space-y-6">
          <section>
            <h2 className="text-base font-semibold text-ts-orange mb-2">Acceptance of Terms</h2>
            <p className="text-sm text-white/70 leading-relaxed">
              By accessing and using TradeScout, you accept and agree to be bound by the terms and
              provisions of this agreement.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ts-orange mb-2">User Accounts</h2>
            <ul className="list-disc list-inside text-sm text-white/70 space-y-1.5 ml-2">
              <li>You must provide accurate and complete information when creating an account</li>
              <li>You are responsible for maintaining the security of your account</li>
              <li>One account per person or business entity</li>
              <li>You must be at least 18 years old to use our service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ts-orange mb-2">
              Contractor Responsibilities
            </h2>
            <ul className="list-disc list-inside text-sm text-white/70 space-y-1.5 ml-2">
              <li>Provide accurate information about your services and qualifications</li>
              <li>Maintain proper licensing and insurance as required by law</li>
              <li>Respond to customer inquiries in a timely manner</li>
              <li>Complete work professionally and according to agreed specifications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ts-orange mb-2">Prohibited Activities</h2>
            <ul className="list-disc list-inside text-sm text-white/70 space-y-1.5 ml-2">
              <li>Posting false or misleading information</li>
              <li>Attempting to manipulate the recommendation system</li>
              <li>Harassing or threatening other users</li>
              <li>Using the platform for illegal activities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ts-orange mb-2">Contact</h2>
            <p className="text-sm text-white/70">
              Questions about these Terms of Service? Contact us at{" "}
              <a href="mailto:legal@tradescout.com" className="text-ts-orange hover:underline">
                legal@tradescout.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
});
