import { memo } from 'react';
import { CheckCircle, PartyPopper, Shield, Sparkles } from 'lucide-react';

const featureLines = [
  'Unlimited contractor search and messaging',
  'Community intel, playbooks, and local checklists',
  'Direct Connect board, quotes, and reminders',
  'Role-specific dashboards for homeowners, pros, and admins',
];

const sponsorLines = [
  'Occasional affiliate offers for tools and materials',
  'Paid advertisers who help keep TradeScout free',
  'Clear labels on any sponsored placements',
  'No paywalls and no upsells needed to use core features',
];

const communityLines = [
  'Community Builder badge holders help decide which local causes the community vault funds',
  'Community Builders run local drives and campaigns to raise funds for their counties',
  '10% of all platform profits are allocated to the TradeScout Community Builders fund',
  '100% of Community Builders contributions are returned directly to the communities where they originated',
  'Transparency-first reporting so neighbors can see exactly where support goes',
];

const Pricing = memo(function Pricing() {
  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-10">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/50 px-4 py-2 bg-orange-500/10 text-orange-200 text-sm">
            <PartyPopper className="h-4 w-4" />
            <span>Gotcha! TradeScout services are free forever.</span>
          </div>
          <h1 className="text-4xl font-bold">Simple pricing: $0</h1>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto">
            Use everything without a paywall. Search contractors, run community playbooks, manage your Direct Connect requests, and chat with Scout — all included. We stay free because partners and advertisers help fund the platform.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-navy-700 bg-navy-800/80 p-6 shadow-xl shadow-black/30">
            <div className="flex items-center gap-2 text-orange-400 mb-4">
              <Sparkles className="h-5 w-5" />
              <span className="font-semibold">What you get for free</span>
            </div>
            <ul className="space-y-3 text-gray-200">
              {featureLines.map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-orange-400 mt-0.5" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-navy-700 bg-navy-800/80 p-6 shadow-xl shadow-black/30">
            <div className="flex items-center gap-2 text-teal-200 mb-4">
              <Shield className="h-5 w-5" />
              <span className="font-semibold">How we keep it free</span>
            </div>
            <ul className="space-y-3 text-gray-200">
              {sponsorLines.map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-teal-300 mt-0.5" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-teal-500/40 bg-teal-600/10 p-6 shadow-xl shadow-black/30">
          <div className="flex items-center gap-2 text-teal-200 mb-4">
            <Shield className="h-5 w-5" />
            <span className="font-semibold">Community Builders & local reinvestment</span>
          </div>
          <p className="text-gray-100 mb-4">
            Community Builders aren't just organizing projects—they earn a badge that lets them send and vote on causes funded from the community vault. Our Community Builders model routes resources back to the neighborhoods that generated them.
          </p>
          <ul className="space-y-3 text-gray-100">
            {communityLines.map((line) => (
              <li key={line} className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-teal-300 mt-0.5" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-orange-500/40 bg-gradient-to-r from-orange-600/20 via-orange-500/10 to-orange-600/20 p-6 text-center space-y-3">
          <h2 className="text-2xl font-semibold text-orange-200">Start building without a credit card</h2>
          <p className="text-gray-100 max-w-2xl mx-auto">
            Jump in, invite your team, and explore every feature. If you see a sponsor tag, that partner is helping keep TradeScout open and sustainable for everyone.
          </p>
        </div>
      </div>
    </div>
  );
});

export default Pricing;
