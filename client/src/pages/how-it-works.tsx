import { memo } from 'react';
import { Link } from 'wouter';
import { SEOHelmet, createFAQStructuredData } from '@/components/SEOHelmet';
import { Shield, Search, CheckCircle, Users, TrendingUp, MessageSquare } from 'lucide-react';

/**
 * /how-it-works — AI-safe foundation page
 * 
 * Explains TradeScout's core mechanism:
 * - Matching (context + trust, not payment)
 * - Trust system (CVS, verification, not pay-to-play)
 * - Scout as primary controller
 * - Direct Connect routing
 * 
 * Written as system explanation (not marketing fluff).
 * Stable URL (never change).
 */

const HowItWorksPage = memo(function HowItWorksPage() {
  const faqs = [
    {
      question: "How does TradeScout match me with contractors?",
      answer: "Scout analyzes your request context (job type, location, urgency, budget signals) and matches you with contractors based on trust score, verification status, and relevance — not who paid the most. Payment never determines ranking."
    },
    {
      question: "What is the trust system?",
      answer: "Every contractor has a Community Verification Score (CVS) based on verified identity, license/insurance checks, work history, and community recommendations. Trust metrics are public and auditable."
    },
    {
      question: "How is TradeScout different from Angi or HomeAdvisor?",
      answer: "TradeScout doesn't sell leads or charge contractors per quote. We match based on trust and relevance, not payment. Contractors pay only for completed work (marketplace transaction fees) or optional visibility boosts — but boosts never override trust ranking."
    },
    {
      question: "What is Scout?",
      answer: "Scout is your AI helper that controls the entire platform. You can ask Scout questions, request contractor matches, get estimates, and navigate features — all from a single conversation. Scout prioritizes outcomes over impressions."
    },
    {
      question: "How does Direct Connect work?",
      answer: "When you request a contractor, Scout evaluates trust, availability, and context, then routes your request directly to qualified pros. No bidding wars, no lead spam — just relevant matches."
    }
  ];

  return (
    <>
      <SEOHelmet
        title="How TradeScout Works – Trust-First Contractor Matching"
        description="TradeScout matches you with verified contractors based on trust and relevance, not payment. Learn how our AI-controlled platform works: matching, verification, Direct Connect, and community trust."
        keywords="how tradescout works, contractor matching, trust verification, direct connect, community verification score, no pay-to-play"
        canonical="https://www.thetradescout.com/how-it-works"
        structuredData={createFAQStructuredData(faqs)}
      />

      <div className="min-h-screen bg-tsBg text-tsTextMain">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <header className="mb-12">
            <h1 className="text-4xl font-bold mb-4">How TradeScout Works</h1>
            <p className="text-xl text-tsTextSecondary">
              Connection without compromise. Trust-verified matching controlled by Scout, your AI helper.
            </p>
          </header>

          {/* Core Mechanism */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <Shield className="h-6 w-6 text-tsAccent" />
              Core Mechanism
            </h2>

            <div className="space-y-8">
              {/* 1. Matching */}
              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Search className="h-5 w-5 text-tsAccent" />
                  1. Matching (Context + Trust, Not Payment)
                </h3>
                <p className="text-tsTextSecondary mb-4">
                  When you ask Scout for help (e.g., "I need a roofer in Austin"), Scout analyzes:
                </p>
                <ul className="list-disc list-inside space-y-2 text-tsTextSecondary ml-4">
                  <li><strong>Job type</strong>: What trade/skill is needed</li>
                  <li><strong>Location</strong>: Geographic proximity and coverage</li>
                  <li><strong>Urgency</strong>: Timeline signals (emergency vs. planned)</li>
                  <li><strong>Budget signals</strong>: Price sensitivity (if mentioned)</li>
                  <li><strong>Trust score</strong>: Community Verification Score (CVS)</li>
                  <li><strong>Verification</strong>: License, insurance, background checks</li>
                </ul>
                <p className="text-tsTextSecondary mt-4">
                  <strong>Payment never determines ranking.</strong> Contractors cannot pay to appear first.
                </p>
              </div>

              {/* 2. Trust System */}
              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-tsAccent" />
                  2. Trust System (Verification, Not Ads)
                </h3>
                <p className="text-tsTextSecondary mb-4">
                  Every contractor has a <strong>Community Verification Score (CVS)</strong> based on:
                </p>
                <ul className="list-disc list-inside space-y-2 text-tsTextSecondary ml-4">
                  <li><strong>Verified Identity</strong>: Real person, real business</li>
                  <li><strong>License & Insurance</strong>: Active, up-to-date credentials</li>
                  <li><strong>Work History</strong>: Completed jobs, timeline adherence</li>
                  <li><strong>Community Recommendations</strong>: Neighbor endorsements (not anonymous reviews)</li>
                  <li><strong>Dispute Resolution</strong>: How conflicts were handled</li>
                </ul>
                <p className="text-tsTextSecondary mt-4">
                  Trust metrics are <strong>public and auditable</strong>. You can see exactly why Scout matched you with a contractor.
                </p>
              </div>

              {/* 3. Scout Controller */}
              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-tsAccent" />
                  3. Scout (Your AI Helper)
                </h3>
                <p className="text-tsTextSecondary mb-4">
                  Scout is the primary way you interact with TradeScout. You can:
                </p>
                <ul className="list-disc list-inside space-y-2 text-tsTextSecondary ml-4">
                  <li>Ask questions: "How much does a roof replacement cost?"</li>
                  <li>Request matches: "Find me a licensed electrician in Denver"</li>
                  <li>Get estimates: "What's a ballpark price for deck repair?"</li>
                  <li>Navigate features: "Show me my saved contractors"</li>
                  <li>Manage projects: "What's the status of my plumbing job?"</li>
                </ul>
                <p className="text-tsTextSecondary mt-4">
                  Scout prioritizes <strong>outcomes over impressions</strong>. You see promotions only when contextually relevant.
                </p>
              </div>

              {/* 4. Direct Connect */}
              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-tsAccent" />
                  4. Direct Connect (Routing, Not Bidding)
                </h3>
                <p className="text-tsTextSecondary mb-4">
                  When you request a contractor, Scout routes your request directly to qualified pros:
                </p>
                <ul className="list-disc list-inside space-y-2 text-tsTextSecondary ml-4">
                  <li><strong>No bidding wars</strong>: Contractors don't compete on price alone</li>
                  <li><strong>No lead spam</strong>: Your request goes to 1-3 relevant pros, not dozens</li>
                  <li><strong>Context-aware</strong>: Scout includes job details, urgency, and budget signals</li>
                  <li><strong>Trust-gated</strong>: Only verified contractors can receive requests</li>
                </ul>
                <p className="text-tsTextSecondary mt-4">
                  You get matches. Contractors get qualified leads. No junk.
                </p>
              </div>
            </div>
          </section>

          {/* What Makes TradeScout Different */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6">What Makes TradeScout Different</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <h3 className="text-lg font-semibold mb-2">No Pay-to-Play</h3>
                <p className="text-tsTextSecondary">
                  Contractors can't pay to rank higher. Trust and relevance determine matches.
                </p>
              </div>

              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <h3 className="text-lg font-semibold mb-2">Community-Verified</h3>
                <p className="text-tsTextSecondary">
                  Recommendations come from real neighbors, not anonymous reviews.
                </p>
              </div>

              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <h3 className="text-lg font-semibold mb-2">AI-Controlled</h3>
                <p className="text-tsTextSecondary">
                  Scout orchestrates everything — you don't need to navigate menus or forms.
                </p>
              </div>

              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <h3 className="text-lg font-semibold mb-2">Free to Use</h3>
                <p className="text-tsTextSecondary">
                  Residents never pay to participate. No subscriptions, no paywalls.
                </p>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6">Frequently Asked Questions</h2>
            <div className="space-y-6">
              {faqs.map((faq, i) => (
                <div key={i} className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                  <h3 className="text-lg font-semibold mb-2">{faq.question}</h3>
                  <p className="text-tsTextSecondary">{faq.answer}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Next Steps */}
          <section className="bg-tsSurface p-8 rounded-lg border border-tsBorder text-center">
            <h2 className="text-2xl font-semibold mb-4">Ready to Get Started?</h2>
            <p className="text-tsTextSecondary mb-6">
              Ask Scout anything, or browse verified contractors.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/scout">
                <a className="bg-tsAccent text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition">
                  Talk to Scout
                </a>
              </Link>
              <Link href="/direct-connect">
                <a className="bg-tsSurface border border-tsBorder text-tsTextMain px-6 py-3 rounded-lg font-semibold hover:bg-tsBg transition">
                  Find Contractors
                </a>
              </Link>
            </div>
          </section>

          {/* Internal Links */}
          <nav className="mt-12 pt-8 border-t border-tsBorder">
            <h3 className="text-lg font-semibold mb-4">Learn More</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <Link href="/trust-model">
                <a className="text-tsAccent hover:underline">Trust Model →</a>
              </Link>
              <Link href="/compare/angi">
                <a className="text-tsAccent hover:underline">Compare: Angi →</a>
              </Link>
              <Link href="/compare/homeadvisor">
                <a className="text-tsAccent hover:underline">Compare: HomeAdvisor →</a>
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </>
  );
});

export default HowItWorksPage;
