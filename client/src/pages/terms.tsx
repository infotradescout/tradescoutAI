import { GuestGate } from "@/components/guest-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Terms() {
  return (
    <GuestGate action="view-terms">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-navy-800 border-navy-600 text-white">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Terms of Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h2 className="text-lg font-semibold mb-3">Acceptance of Terms</h2>
              <p className="text-gray-300">
                By accessing and using TradeScout, you accept and agree to be bound by the 
                terms and provision of this agreement.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3">User Accounts</h2>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li>You must provide accurate and complete information when creating an account</li>
                <li>You are responsible for maintaining the security of your account</li>
                <li>One account per person or business entity</li>
                <li>You must be at least 18 years old to use our service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3">Contractor Responsibilities</h2>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li>Provide accurate information about your services and qualifications</li>
                <li>Maintain proper licensing and insurance as required by law</li>
                <li>Respond to customer inquiries in a timely manner</li>
                <li>Complete work professionally and according to agreed specifications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3">Prohibited Activities</h2>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li>Posting false or misleading information</li>
                <li>Attempting to manipulate the recommendation system</li>
                <li>Harassing or threatening other users</li>
                <li>Using the platform for illegal activities</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3">Contact</h2>
              <p className="text-gray-300">
                Questions about these Terms of Service? Contact us at legal@tradescout.com
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </GuestGate>
  );
}