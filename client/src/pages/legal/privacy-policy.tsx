import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function PrivacyPolicy() {
  const lastUpdated = "August 11, 2025";
  
  return (
    <div className="min-h-screen bg-[#0f1419]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">Privacy Policy</CardTitle>
            <p className="text-gray-600 dark:text-gray-300">
              Last Updated: {lastUpdated}
            </p>
          </CardHeader>
          <CardContent className="prose max-w-none dark:prose-invert">
            
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
              
              <h3 className="text-xl font-medium mb-3">Personal Information</h3>
              <p className="mb-4">We collect information you provide directly to us, such as when you:</p>
              <ul className="list-disc pl-6 mb-4">
                <li>Create an account and complete your profile</li>
                <li>List items on our marketplace</li>
                <li>Make purchases or engage in transactions</li>
                <li>Contact us for support or other inquiries</li>
                <li>Participate in surveys, contests, or promotional activities</li>
              </ul>
              
              <p className="mb-4">This information may include:</p>
              <ul className="list-disc pl-6 mb-6">
                <li>Name, email address, phone number</li>
                <li>Physical address for shipping and verification</li>
                <li>Payment information (processed securely by third-party providers)</li>
                <li>Government-issued ID for verification (when required by law)</li>
                <li>Business information for contractor accounts</li>
                <li>Profile photos and other content you submit</li>
              </ul>
              
              <h3 className="text-xl font-medium mb-3">Automatically Collected Information</h3>
              <ul className="list-disc pl-6 mb-6">
                <li>Device information (IP address, browser type, operating system)</li>
                <li>Usage data (pages visited, time spent, click patterns)</li>
                <li>Location data (with your permission)</li>
                <li>Cookies and similar tracking technologies</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
              <p className="mb-4">We use your information to:</p>
              <ul className="list-disc pl-6 mb-6">
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and send related information</li>
                <li>Verify your identity and prevent fraud</li>
                <li>Comply with legal obligations (including INFORM Consumers Act requirements)</li>
                <li>Send you technical notices, updates, security alerts</li>
                <li>Respond to your comments, questions, and customer service requests</li>
                <li>Communicate about products, services, and promotional offers</li>
                <li>Monitor and analyze usage patterns to improve user experience</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">3. Information Sharing and Disclosure</h2>
              
              <h3 className="text-xl font-medium mb-3">We Share Information In These Situations:</h3>
              <ul className="list-disc pl-6 mb-6">
                <li><strong>With Other Users:</strong> Your public profile, listings, and reviews are visible to other platform users</li>
                <li><strong>Service Providers:</strong> Third-party vendors who perform services on our behalf (payment processing, shipping, analytics)</li>
                <li><strong>Legal Requirements:</strong> When required by law or to respond to legal process</li>
                <li><strong>Business Transfers:</strong> In connection with any merger, sale, or transfer of company assets</li>
                <li><strong>Consent:</strong> When you give us permission to share your information</li>
              </ul>
              
              <h3 className="text-xl font-medium mb-3">INFORM Consumers Act Compliance</h3>
              <p className="mb-4">For high-volume sellers (200+ transactions and $5,000+ annual revenue), we may disclose:</p>
              <ul className="list-disc pl-6 mb-6">
                <li>Business name and address</li>
                <li>Contact information (email and phone)</li>
                <li>This information is shared with buyers to comply with federal transparency requirements</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">4. Your Privacy Rights</h2>
              
              <h3 className="text-xl font-medium mb-3">California Residents (CCPA/CPRA Rights)</h3>
              <p className="mb-4">You have the right to:</p>
              <ul className="list-disc pl-6 mb-6">
                <li><strong>Know:</strong> Request information about personal data collected, used, or shared</li>
                <li><strong>Delete:</strong> Request deletion of your personal information</li>
                <li><strong>Correct:</strong> Request correction of inaccurate personal information</li>
                <li><strong>Opt-Out:</strong> Opt out of the sale or sharing of personal information</li>
                <li><strong>Non-Discrimination:</strong> Receive equal service regardless of exercising privacy rights</li>
              </ul>
              
              <h3 className="text-xl font-medium mb-3">All Users</h3>
              <ul className="list-disc pl-6 mb-6">
                <li>Access and update your account information</li>
                <li>Control email and notification preferences</li>
                <li>Delete your account (subject to legal retention requirements)</li>
                <li>Opt out of marketing communications</li>
              </ul>
              
              <p className="mb-6">
                <strong>To Exercise Your Rights:</strong> Contact us at privacy@tradescout.com or use our 
                <a href="/privacy-request" className="text-blue-600 underline ml-1">Privacy Request Form</a>
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
              <p className="mb-4">We implement appropriate technical and organizational measures to protect your information:</p>
              <ul className="list-disc pl-6 mb-6">
                <li>Encryption of data in transit and at rest</li>
                <li>Regular security assessments and updates</li>
                <li>Access controls and employee training</li>
                <li>Secure payment processing through PCI DSS compliant providers</li>
                <li>Incident response procedures for data breaches</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">6. Cookies and Tracking</h2>
              <p className="mb-4">We use cookies and similar technologies to:</p>
              <ul className="list-disc pl-6 mb-6">
                <li>Remember your preferences and settings</li>
                <li>Analyze site traffic and usage patterns</li>
                <li>Provide targeted advertising</li>
                <li>Prevent fraud and improve security</li>
              </ul>
              <p className="mb-6">
                You can control cookie preferences through your browser settings or our 
                <a href="/cookie-preferences" className="text-blue-600 underline ml-1">Cookie Preference Center</a>
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">7. Data Retention</h2>
              <p className="mb-6">
                We retain your information for as long as necessary to provide services, comply with legal obligations, 
                resolve disputes, and enforce agreements. Specific retention periods vary by data type and legal requirements.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">8. International Transfers</h2>
              <p className="mb-6">
                Your information may be transferred to and processed in countries other than your residence. 
                We implement appropriate safeguards to protect your information during such transfers.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">9. Changes to This Policy</h2>
              <p className="mb-6">
                We may update this Privacy Policy periodically. We will notify you of material changes by email 
                or through a prominent notice on our platform. Your continued use constitutes acceptance of the updated policy.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">10. Contact Information</h2>
              <div className="bg-[#0f1419] dark:bg-[#1a2332] p-6 rounded-lg">
                <p className="mb-2"><strong>Data Protection Officer:</strong></p>
                <p className="mb-2">Email: privacy@tradescout.com</p>
                <p className="mb-2">Address: [Your Business Address]</p>
                <p className="mb-4">Phone: [Your Phone Number]</p>
                
                <p className="mb-2"><strong>For Privacy Requests:</strong></p>
                <p className="mb-2">Use our <a href="/privacy-request" className="text-blue-600 underline">Privacy Request Form</a></p>
                <p>Or email: privacy-requests@tradescout.com</p>
              </div>
            </section>

            <div className="text-center mt-8 pt-6 border-t border-[#2d3748]">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This Privacy Policy is effective as of {lastUpdated}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}