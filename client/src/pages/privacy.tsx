import { GuestGate } from "@/components/guest-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Privacy() {
  return (
    <GuestGate action="view-privacy">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-navy-800 border-navy-600 text-white">
          <CardHeader>
            <CardTitle className="text-3xl text-center">Privacy Policy</CardTitle>
            <p className="text-center text-gray-300 mt-2">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </CardHeader>
          <CardContent className="space-y-8">
            <section>
              <h2 className="text-xl font-semibold mb-4 text-orange-400">1. Information We Collect</h2>
              
              <h3 className="text-lg font-medium mb-3">Personal Information</h3>
              <p className="text-gray-300 mb-4">
                When you create an account with TradeScout, we collect:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
                <li>Name and contact information (email, phone number)</li>
                <li>Profile information and photos</li>
                <li>Address and location data for contractor matching</li>
                <li>Business information for contractor accounts</li>
                <li>Payment information for premium services</li>
              </ul>

              <h3 className="text-lg font-medium mb-3 mt-6">Social Media Login</h3>
              <p className="text-gray-300 mb-4">
                If you sign up using Facebook or Google, we receive your public profile information 
                including name, email address, and profile picture. We do not access your friends 
                list or post on your behalf without explicit permission.
              </p>

              <h3 className="text-lg font-medium mb-3 mt-6">Usage Data</h3>
              <p className="text-gray-300">
                We automatically collect information about how you use our service, including 
                pages visited, features used, search queries, and interaction patterns to 
                improve our platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4 text-orange-400">2. How We Use Your Information</h2>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li>Provide and maintain our contractor marketplace service</li>
                <li>Match homeowners with qualified contractors in their area</li>
                <li>Process payments and manage premium subscriptions</li>
                <li>Verify identity and prevent fraud</li>
                <li>Send important service updates and notifications</li>
                <li>Improve our platform through analytics and user feedback</li>
                <li>Provide customer support and respond to inquiries</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4 text-orange-400">3. Information Sharing</h2>
              <p className="text-gray-300 mb-4">
                We do not sell, trade, or rent your personal information to third parties. 
                We may share your information only in these circumstances:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li><strong>With Contractors:</strong> When you request quotes or services, we share relevant contact information</li>
                <li><strong>Service Providers:</strong> With trusted partners who help operate our platform (payment processing, analytics)</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights and users</li>
                <li><strong>Business Transfer:</strong> In the event of a merger or acquisition</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4 text-orange-400">4. Data Security</h2>
              <p className="text-gray-300 mb-4">
                We implement industry-standard security measures to protect your information:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li>Encryption of data in transit and at rest</li>
                <li>Secure authentication and password protection</li>
                <li>Regular security audits and monitoring</li>
                <li>Limited access to personal data on a need-to-know basis</li>
                <li>Secure data centers with physical access controls</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4 text-orange-400">5. Your Rights and Choices</h2>
              <p className="text-gray-300 mb-4">You have the right to:</p>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li>Access and update your personal information</li>
                <li>Delete your account and associated data</li>
                <li>Opt out of marketing communications</li>
                <li>Request a copy of your data</li>
                <li>Control cookie preferences</li>
                <li>Report privacy concerns</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4 text-orange-400">6. Cookies and Tracking</h2>
              <p className="text-gray-300">
                We use cookies and similar technologies to enhance your experience, analyze 
                usage patterns, and provide personalized content. You can control cookie 
                settings through your browser preferences.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4 text-orange-400">7. Third-Party Services</h2>
              <p className="text-gray-300">
                Our platform integrates with third-party services like Google Maps, payment 
                processors, and analytics providers. These services have their own privacy 
                policies governing their use of your information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4 text-orange-400">8. Data Retention</h2>
              <p className="text-gray-300">
                We retain your information as long as your account is active or as needed 
                to provide services. After account deletion, we may retain certain 
                information for legal compliance and fraud prevention.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4 text-orange-400">9. Children's Privacy</h2>
              <p className="text-gray-300">
                TradeScout is not intended for users under 18. We do not knowingly collect 
                personal information from children. If we become aware of such collection, 
                we will delete the information immediately.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4 text-orange-400">10. International Users</h2>
              <p className="text-gray-300">
                If you are accessing TradeScout from outside the United States, please be 
                aware that your information may be transferred to and stored in the US. 
                By using our service, you consent to this transfer.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4 text-orange-400">11. Changes to This Policy</h2>
              <p className="text-gray-300">
                We may update this Privacy Policy periodically. We will notify you of 
                significant changes via email or platform notification. Continued use 
                of our service constitutes acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4 text-orange-400">12. Contact Information</h2>
              <div className="text-gray-300 space-y-2">
                <p><strong>Privacy Questions:</strong> privacy@tradescout.com</p>
                <p><strong>General Support:</strong> support@tradescout.com</p>
                <p><strong>Mailing Address:</strong></p>
                <p className="ml-4">
                  TradeScout Privacy Office<br/>
                  [Your Business Address]<br/>
                  [City, State ZIP]
                </p>
              </div>
            </section>

            <div className="bg-navy-700 rounded-lg p-6 mt-8">
              <h3 className="text-lg font-medium mb-3 text-orange-400">California Privacy Rights (CCPA)</h3>
              <p className="text-gray-300 text-sm">
                California residents have additional rights under the California Consumer Privacy Act. 
                You may request to know what personal information we collect, delete your information, 
                and opt out of the sale of personal information. Contact us at privacy@tradescout.com 
                to exercise these rights.
              </p>
            </div>

            <div className="bg-navy-700 rounded-lg p-6 mt-4">
              <h3 className="text-lg font-medium mb-3 text-orange-400">European Privacy Rights (GDPR)</h3>
              <p className="text-gray-300 text-sm">
                If you are in the European Union, you have rights under the General Data Protection 
                Regulation including data portability, erasure, and the right to object to processing. 
                Contact our privacy team to exercise these rights.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </GuestGate>
  );
}