import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export default function TermsOfService() {
  const lastUpdated = "August 11, 2025";

  return (
    <div className="bg-[var(--surface-frame)] py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">Terms of Service</CardTitle>
            <p className="text-gray-600 dark:text-gray-300">Last Updated: {lastUpdated}</p>
          </CardHeader>
          <CardContent className="prose max-w-none dark:prose-invert">
            <Alert className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                By using TradeScout, you agree to be bound by these Terms of Service. Please read
                them carefully before using our platform.
              </AlertDescription>
            </Alert>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">1. Platform Overview</h2>

              <h3 className="text-xl font-medium mb-3">Service Description</h3>
              <p className="mb-4">
                TradeScout operates as a marketplace and coordination platform that connects
                residents, property stakeholders, community organizations, and verified service
                providers (including contractors and other professionals) and facilitates the
                exchange of valuable items, equipment, and services. We act as an intermediary and
                are not a party to the actual transactions between users.
              </p>

              <h3 className="text-xl font-medium mb-3">Platform Role</h3>
              <ul className="list-disc pl-6 mb-6">
                <li>We provide the technology platform for user interactions</li>
                <li>We facilitate communication between buyers and sellers</li>
                <li>We verify contractor credentials and user identities</li>
                <li>We do not own, sell, or warrant items listed by third-party sellers</li>
                <li>We are not responsible for the quality, safety, or legality of listed items</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">2. User Accounts and Verification</h2>

              <h3 className="text-xl font-medium mb-3">Account Requirements</h3>
              <ul className="list-disc pl-6 mb-6">
                <li>You must be at least 18 years old to create an account</li>
                <li>You must provide accurate, current, and complete information</li>
                <li>You are responsible for maintaining account security</li>
                <li>One person may not maintain multiple accounts</li>
                <li>Business accounts require additional verification</li>
              </ul>

              <h3 className="text-xl font-medium mb-3">Address Verification Requirement</h3>
              <p className="mb-4">
                All users must complete address verification within 14 days of account creation.
                Verification methods include:
              </p>
              <ul className="list-disc pl-6 mb-6">
                <li>Postcard verification to your physical address</li>
                <li>Document upload (utility bill, bank statement)</li>
                <li>Government-issued ID with current address</li>
              </ul>

              <h3 className="text-xl font-medium mb-3">
                High-Volume Seller Verification (INFORM Act)
              </h3>
              <p className="mb-4">
                Sellers meeting federal thresholds (200+ transactions and $5,000+ annual revenue)
                must provide:
              </p>
              <ul className="list-disc pl-6 mb-6">
                <li>Government-issued photo identification</li>
                <li>Tax identification number</li>
                <li>Bank account information</li>
                <li>Contact information verification</li>
                <li>Annual certification of accuracy</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">3. Marketplace Rules and Conduct</h2>

              <h3 className="text-xl font-medium mb-3">Prohibited Activities</h3>
              <ul className="list-disc pl-6 mb-6">
                <li>Listing illegal, stolen, or counterfeit items</li>
                <li>Misrepresenting item condition, authenticity, or ownership</li>
                <li>Circumventing platform fees or payment systems</li>
                <li>Creating false or misleading RECOMMENDATIONS</li>
                <li>Harassment, discrimination, or abusive behavior</li>
                <li>Spamming or unauthorized marketing</li>
                <li>Attempting to defraud other users</li>
                <li>Violating intellectual property rights</li>
              </ul>

              <h3 className="text-xl font-medium mb-3">Listing Requirements</h3>
              <ul className="list-disc pl-6 mb-6">
                <li>Accurate descriptions and photographs</li>
                <li>Clear pricing and terms</li>
                <li>Compliance with applicable laws and regulations</li>
                <li>Proper categorization of items</li>
                <li>Disclosure of material defects or issues</li>
              </ul>

              <h3 className="text-xl font-medium mb-3">Category-Specific Rules</h3>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg mb-6">
                <h4 className="font-medium mb-2">Local Food & Artisan Goods</h4>
                <ul className="list-disc pl-6">
                  <li>Valid food handler's permit required</li>
                  <li>Kitchen inspection certificate</li>
                  <li>Compliance with local health regulations</li>
                  <li>Proper labeling and allergen disclosure</li>
                </ul>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-6">
                <h4 className="font-medium mb-2">Business Sales</h4>
                <ul className="list-disc pl-6">
                  <li>Complete financial disclosure requirements</li>
                  <li>Legal representation recommended</li>
                  <li>Due diligence documentation</li>
                  <li>Compliance with securities regulations</li>
                </ul>
              </div>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">4. Payments and Fees</h2>

              <h3 className="text-xl font-medium mb-3">Access Pricing</h3>
              <ul className="list-disc pl-6 mb-6">
                <li>Access to TradeScout features, connections, and information is $0</li>
                <li>We do not charge access fees for core platform participation</li>
                <li>Trust ranking and visibility are never sold as paid access controls</li>
              </ul>

              <h3 className="text-xl font-medium mb-3">Payment Safety</h3>
              <ul className="list-disc pl-6 mb-6">
                <li>Access is $0; no one can pay to unlock access, ranking, or visibility</li>
                <li>Any payment request outside labeled checkout should be treated as fraud</li>
                <li>
                  If you use payment features (for example, paying a provider for an agreed booking),
                  the checkout will be clearly labeled in-app
                </li>
              </ul>

              <h3 className="text-xl font-medium mb-3">Payment Processing</h3>
              <ul className="list-disc pl-6 mb-6">
                <li>All payments processed through secure third-party providers</li>
                <li>We do not store credit card information</li>
                <li>Disputes handled according to payment processor policies</li>
                <li>Refunds subject to seller policies and applicable law</li>
              </ul>

              <h3 className="text-xl font-medium mb-3">Tax Compliance</h3>
              <ul className="list-disc pl-6 mb-6">
                <li>Sales tax collected as required by state law</li>
                <li>Tax reporting provided for high-volume sellers</li>
                <li>Users responsible for income tax obligations</li>
                <li>Business sales may trigger additional reporting requirements</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">5. Dispute Resolution</h2>

              <h3 className="text-xl font-medium mb-3">Internal Dispute Process</h3>
              <ol className="list-decimal pl-6 mb-6">
                <li>Contact the other party directly to resolve the issue</li>
                <li>Use our platform messaging system for documentation</li>
                <li>Submit a formal dispute through our resolution center</li>
                <li>Provide supporting documentation and evidence</li>
                <li>Accept binding decision from our dispute resolution team</li>
              </ol>

              <h3 className="text-xl font-medium mb-3">Legal Disputes</h3>
              <div className="bg-[var(--surface-frame)] dark:bg-[var(--surface-frame-alt)] p-6 rounded-lg mb-6">
                <p className="mb-4">
                  <strong>Governing Law:</strong> These terms are governed by the laws of [Your
                  State/Country]
                </p>
                <p className="mb-4">
                  <strong>Jurisdiction:</strong> Disputes resolved in courts of [Your Jurisdiction]
                </p>
                <p className="mb-4">
                  <strong>Arbitration:</strong> Most disputes subject to binding arbitration
                </p>
                <p>
                  <strong>Class Action Waiver:</strong> You agree not to participate in class action
                  lawsuits
                </p>
              </div>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">6. Intellectual Property</h2>

              <h3 className="text-xl font-medium mb-3">Platform Content</h3>
              <ul className="list-disc pl-6 mb-6">
                <li>TradeScout owns all platform technology and branding</li>
                <li>Users may not copy, modify, or distribute our content</li>
                <li>Our trademarks and logos are protected intellectual property</li>
              </ul>

              <h3 className="text-xl font-medium mb-3">User Content</h3>
              <ul className="list-disc pl-6 mb-6">
                <li>You retain ownership of content you upload</li>
                <li>You grant us license to use your content for platform operations</li>
                <li>You are responsible for ensuring you have rights to uploaded content</li>
                <li>We may remove infringing content without notice</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">7. Limitation of Liability</h2>

              <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg mb-6">
                <h3 className="text-xl font-medium mb-3">Platform Disclaimers</h3>
                <ul className="list-disc pl-6">
                  <li>Services provided "as is" without warranties</li>
                  <li>We do not guarantee continuous, uninterrupted service</li>
                  <li>We are not liable for user actions or third-party conduct</li>
                  <li>Maximum liability limited to fees paid in past 12 months</li>
                  <li>No liability for indirect, consequential, or punitive damages</li>
                </ul>
              </div>

              <h3 className="text-xl font-medium mb-3">User Responsibility</h3>
              <ul className="list-disc pl-6 mb-6">
                <li>You assume all risks of transactions with other users</li>
                <li>Verify items and services before completing transactions</li>
                <li>We recommend insurance for high-value transactions</li>
                <li>Report suspicious activity immediately</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">8. Account Termination</h2>

              <h3 className="text-xl font-medium mb-3">Termination by You</h3>
              <ul className="list-disc pl-6 mb-6">
                <li>You may close your account at any time</li>
                <li>Outstanding transactions must be completed</li>
                <li>Some information may be retained for legal compliance</li>
              </ul>

              <h3 className="text-xl font-medium mb-3">Termination by Us</h3>
              <ul className="list-disc pl-6 mb-6">
                <li>We may suspend or terminate accounts for violations</li>
                <li>Immediate termination for serious violations</li>
                <li>Notice provided when possible</li>
                <li>Appeal process available for account actions</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">9. Changes to Terms</h2>
              <p className="mb-6">
                We may modify these terms at any time. Material changes will be communicated via
                email or platform notice. Continued use constitutes acceptance of updated terms.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">10. Contact Information</h2>
              <div className="bg-[var(--surface-frame)] dark:bg-[var(--surface-frame-alt)] p-6 rounded-lg">
                <p className="mb-2">
                  <strong>Legal Department:</strong>
                </p>
                <p className="mb-2">Email: legal@tradescout.com</p>
                <p className="mb-2">Address: [Your Business Address]</p>
                <p className="mb-4">Phone: [Your Phone Number]</p>

                <p className="mb-2">
                  <strong>For Platform Issues:</strong>
                </p>
                <p className="mb-2">Support: support@tradescout.com</p>
                <p>Emergency: [Your Emergency Contact]</p>
              </div>
            </section>

            <div
              className="text-center mt-8 pt-6 border-t"
              style={{ borderColor: "var(--border-secondary)" }}
            >
              <p className="text-sm text-gray-600 dark:text-gray-400">
                These Terms of Service are effective as of {lastUpdated}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
