import { memo } from "react";
import { Shield, Lock } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";

export default memo(function Privacy() {
  const lastUpdated = "June 6, 2026";

  const sections = [
    {
      title: "1. Information We Collect",
      content: (
        <>
          <h3 className="text-sm font-semibold text-white mb-1.5">Personal Information</h3>
          <p className="text-sm text-white/70 mb-2">
            When you create an account with TradeScout, we collect:
          </p>
          <ul className="list-disc list-inside text-sm text-white/70 space-y-1 ml-2 mb-4">
            <li>Name and contact information (email, phone number)</li>
            <li>Profile information and photos</li>
            <li>Address and location data for contractor matching</li>
            <li>Business information for contractor accounts</li>
            <li>Payment information for premium services</li>
          </ul>
          <h3 className="text-sm font-semibold text-white mb-1.5">
            Direct Connect Giveaway Information
          </h3>
          <p className="text-sm text-white/70 mb-4">
            If you enter a TradeScout giveaway through a Direct Connect request or an alternative
            mail-in entry, we may collect and process the information needed to administer the
            promotion. This may include your name, email address, phone number, mailing address,
            date of birth, state of residence, entry method, entry date, request identifier,
            eligibility status, and fraud-prevention review notes.
          </p>
          <h3 className="text-sm font-semibold text-white mb-1.5">Social Media Login</h3>
          <p className="text-sm text-white/70 mb-4">
            If you sign up using Facebook or Google, we receive your public profile information
            including name, email address, and profile picture. We do not access your friends list
            or post on your behalf without explicit permission.
          </p>
          <h3 className="text-sm font-semibold text-white mb-1.5">Usage Data</h3>
          <p className="text-sm text-white/70">
            We automatically collect information about how you use our service, including pages
            visited, features used, search queries, and interaction patterns to improve our
            platform.
          </p>
        </>
      ),
    },
    {
      title: "2. How We Use Your Information",
      content: (
        <ul className="list-disc list-inside text-sm text-white/70 space-y-1.5 ml-2">
          <li>Provide and maintain our contractor marketplace service</li>
          <li>Match homeowners with qualified contractors in their area</li>
          <li>Process transaction payments and maintain billing records</li>
          <li>Verify identity and prevent fraud</li>
          <li>
            Administer TradeScout promotions, sweepstakes, and giveaways, including eligibility
            screening, duplicate-entry controls, winner selection, winner notification, prize
            fulfillment, tax or eligibility documentation, and recordkeeping
          </li>
          <li>Send important service updates and notifications</li>
          <li>Improve our platform through analytics and user feedback</li>
          <li>
            Contact you for user experience surveys and platform improvement discussions (TradeScout
            admin only)
          </li>
          <li>Provide customer support and respond to inquiries</li>
          <li>Comply with legal obligations</li>
        </ul>
      ),
    },
    {
      title: "3. Information Sharing",
      content: (
        <>
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mb-4">
            <p className="text-sm text-green-200 font-medium">
              TradeScout does NOT sell, distribute, or share your personal information with third
              parties for marketing or commercial purposes. Your data stays with us.
            </p>
          </div>
          <p className="text-sm text-white/70 mb-2">
            We may share your information only in these specific, limited circumstances:
          </p>
          <ul className="list-disc list-inside text-sm text-white/70 space-y-1.5 ml-2">
            <li>
              <strong className="text-white">Contractor Matching:</strong> When you request quotes
              or services, we share relevant contact information with contractors you choose to
              connect with
            </li>
            <li>
              <strong className="text-white">TradeScout Admin Contact:</strong> Our platform
              administrators may contact you directly for user experience surveys, feedback
              sessions, or platform improvement discussions
            </li>
            <li>
              <strong className="text-white">Essential Service Providers:</strong> With trusted
              partners who help operate our platform under strict data protection agreements
            </li>
            <li>
              <strong className="text-white">Legal Requirements:</strong> When required by law,
              court order, or to protect our rights and users' safety
            </li>
            <li>
              <strong className="text-white">Promotion Administration:</strong> When needed to
              administer a giveaway or prize, such as verifying eligibility, contacting a potential
              winner, fulfilling a prize, preparing required tax documentation, or responding to
              regulator, auditor, or legal requests
            </li>
            <li>
              <strong className="text-white">Business Transfer:</strong> In the event of a merger or
              acquisition, with the same privacy protections
            </li>
          </ul>
        </>
      ),
    },
    {
      title: "4. Data Security",
      content: (
        <ul className="list-disc list-inside text-sm text-white/70 space-y-1.5 ml-2">
          <li>Encryption of data in transit and at rest</li>
          <li>Secure authentication and password protection</li>
          <li>Regular security audits and monitoring</li>
          <li>Limited access to personal data on a need-to-know basis</li>
          <li>Secure data centers with physical access controls</li>
        </ul>
      ),
    },
    {
      title: "5. Your Rights and Choices",
      content: (
        <ul className="list-disc list-inside text-sm text-white/70 space-y-1.5 ml-2">
          <li>Access and update your personal information</li>
          <li>Delete your account and associated data</li>
          <li>Opt out of marketing communications and user experience surveys</li>
          <li>Decline contact from TradeScout administrators for feedback sessions</li>
          <li>Request a copy of your data</li>
          <li>Control cookie preferences</li>
          <li>Report privacy concerns or unauthorized contact</li>
          <li>
            Ask questions about giveaway entry records or promotion-related privacy processing
          </li>
        </ul>
      ),
    },
    {
      title: "6. Cookies and Tracking",
      content: (
        <p className="text-sm text-white/70 leading-relaxed">
          We use cookies and similar technologies to enhance your experience, analyze usage
          patterns, and provide personalized content. You can control cookie settings through your
          browser preferences.
        </p>
      ),
    },
    {
      title: "7. Third-Party Services",
      content: (
        <p className="text-sm text-white/70 leading-relaxed">
          Our platform integrates with third-party services like Google Maps, payment processors,
          and analytics providers. These services have their own privacy policies governing their
          use of your information.
        </p>
      ),
    },
    {
      title: "8. Data Retention",
      content: (
        <div className="space-y-3 text-sm text-white/70 leading-relaxed">
          <p>
            We retain your information as long as your account is active or as needed to provide
            services. After account deletion, we may retain certain information for legal compliance
            and fraud prevention.
          </p>
          <p>
            Giveaway and sweepstakes records may be retained after the promotion ends when needed to
            document eligibility, duplicate-entry review, winner selection, prize fulfillment,
            tax/legal compliance, fraud prevention, dispute resolution, and audit history.
          </p>
        </div>
      ),
    },
    {
      title: "9. Children's Privacy",
      content: (
        <p className="text-sm text-white/70 leading-relaxed">
          TradeScout is not intended for users under 18. We do not knowingly collect personal
          information from children. If we become aware of such collection, we will delete the
          information immediately.
        </p>
      ),
    },
    {
      title: "10. International Users",
      content: (
        <p className="text-sm text-white/70 leading-relaxed">
          If you are accessing TradeScout from outside the United States, please be aware that your
          information may be transferred to and stored in the US. By using our service, you consent
          to this transfer.
        </p>
      ),
    },
    {
      title: "11. Changes to This Policy",
      content: (
        <p className="text-sm text-white/70 leading-relaxed">
          We may update this Privacy Policy periodically. We will notify you of significant changes
          via email or platform notification. Continued use of our service constitutes acceptance of
          the updated policy.
        </p>
      ),
    },
    {
      title: "12. Contact Information",
      content: (
        <div className="text-sm text-white/70 space-y-1.5">
          <p>
            <strong className="text-white">Privacy Questions:</strong>{" "}
            <a href="mailto:contact@thetradescout.com" className="text-ts-orange hover:underline">
              contact@thetradescout.com
            </a>
          </p>
          <p>
            <strong className="text-white">General Support:</strong>{" "}
            <a href="mailto:contact@thetradescout.com" className="text-ts-orange hover:underline">
              contact@thetradescout.com
            </a>
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="text-white font-body">
      <SEOHelmet
        title="Privacy Policy | TradeScout"
        description="Review TradeScout privacy policy covering data collection, use, protection, and your privacy rights and controls."
        canonical="https://www.thetradescout.com/privacy"
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-4">
            <Shield className="w-4 h-4 text-ts-orange" />
            <span className="text-sm font-medium text-ts-orange">Legal</span>
          </div>
          <h1 className="font-display text-3xl font-extrabold text-white mb-2">Privacy Policy</h1>
          <p className="text-sm text-white/50">Last updated: {lastUpdated}</p>
        </div>

        {/* Data Protection Guarantee */}
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-semibold text-green-300">Data Protection Guarantee</h3>
          </div>
          <div className="space-y-2 text-xs text-green-100/80">
            <p>
              <strong className="text-green-200">Zero Third-Party Sales:</strong> We never sell,
              rent, or distribute your personal information to outside companies, marketers, or data
              brokers.
            </p>
            <p>
              <strong className="text-green-200">TradeScout Admin Contact Only:</strong> The only
              non-service communications you'll receive from us are direct outreach from our team
              for user experience feedback and platform improvements.
            </p>
            <p>
              <strong className="text-green-200">Your Control:</strong> You can opt out of all admin
              communications while still receiving essential service updates about your account.
            </p>
          </div>
        </div>

        {/* Sections */}
        <div className="bg-tsCard border border-white/10 rounded-xl shadow-[0_18px_52px_rgba(0,0,0,0.36)] divide-y divide-white/5">
          {sections.map((section, i) => (
            <div key={i} className="p-5">
              <h2 className="text-sm font-semibold text-ts-orange mb-3">{section.title}</h2>
              {section.content}
            </div>
          ))}
        </div>

        {/* California + GDPR */}
        <div className="mt-4 space-y-3">
          <div className="bg-tsCard border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-ts-orange mb-2">
              California Privacy Rights (CCPA)
            </h3>
            <p className="text-xs text-white/70 leading-relaxed">
              California residents have additional rights under the California Consumer Privacy Act.
              You may request to know what personal information we collect, delete your information,
              and opt out of the sale of personal information.{" "}
              <strong className="text-white">
                Note: TradeScout does not sell personal information.
              </strong>{" "}
              Contact us at{" "}
              <a href="mailto:contact@thetradescout.com" className="text-ts-orange hover:underline">
                contact@thetradescout.com
              </a>{" "}
              to exercise these rights.
            </p>
          </div>
          <div className="bg-tsCard border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-ts-orange mb-2">
              European Privacy Rights (GDPR)
            </h3>
            <p className="text-xs text-white/70 leading-relaxed">
              If you are in the European Union, you have rights under the General Data Protection
              Regulation including data portability, erasure, and the right to object to processing.
              Contact our privacy team to exercise these rights.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});
