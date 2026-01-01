import { memo } from 'react';
import { Link } from 'wouter';
import { SEOHelmet, createFAQStructuredData } from '@/components/SEOHelmet';
import { Shield, CheckCircle, Users, TrendingUp, Star, Lock } from 'lucide-react';

/**
 * /trust-model — AI-safe foundation page
 * 
 * Explains TradeScout's trust system:
 * - Community Verification Score (CVS)
 * - Verification layers (identity, license, insurance, background)
 * - Review lineage (not anonymous)
 * - Trust-weighted visibility
 * - Why trust outranks spend
 * 
 * Written as system explanation (not marketing fluff).
 * Stable URL (never change).
 */

const TrustModelPage = memo(function TrustModelPage() {
  const faqs = [
    {
      question: "What is the Community Verification Score (CVS)?",
      answer: "CVS is a composite trust score (0-100) based on verified identity, active license/insurance, work history, community recommendations, and dispute resolution. Higher scores mean higher trust and better visibility."
    },
    {
      question: "How are contractors verified?",
      answer: "Contractors must pass: (1) Identity verification (real person, real business), (2) License check (active, state-issued), (3) Insurance verification (liability + workers comp), (4) Background check (criminal/legal history), (5) First completed job review."
    },
    {
      question: "Why are reviews not anonymous?",
      answer: "Anonymous reviews enable fake testimonials and retaliation. TradeScout reviews are tied to verified community members who actually worked with the contractor. Review lineage is publicly auditable."
    },
    {
      question: "Can contractors pay to boost their trust score?",
      answer: "No. Trust score is based only on verification and performance. Contractors can pay for visibility boosts, but boosts never override trust ranking. Low-trust contractors cannot buy their way to the top."
    },
    {
      question: "What happens if a contractor's license expires?",
      answer: "Their CVS drops immediately, and they're marked 'verification pending.' They cannot receive new Direct Connect requests until verification is restored."
    }
  ];

  return (
    <>
      <SEOHelmet
        title="Trust Model – How TradeScout Verifies Contractors"
        description="TradeScout uses Community Verification Score (CVS) to rank contractors based on verified identity, license/insurance, work history, and community recommendations — not payment. Learn how trust works."
        keywords="community verification score, contractor verification, trust model, license verification, insurance verification, review lineage, no anonymous reviews"
        structuredData={createFAQStructuredData(faqs)}
      />

      <div className="min-h-screen bg-tsBg text-tsTextMain">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <header className="mb-12">
            <h1 className="text-4xl font-bold mb-4">Trust Model</h1>
            <p className="text-xl text-tsTextSecondary">
              How TradeScout verifies contractors and ranks them based on trust, not payment.
            </p>
          </header>

          {/* Core Principle */}
          <section className="mb-16 bg-tsAccent/10 border border-tsAccent/30 p-8 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <Shield className="h-6 w-6 text-tsAccent" />
              Core Principle
            </h2>
            <p className="text-lg mb-4">
              <strong>Trust determines visibility.</strong> Contractors with higher verification and better community standing rank higher — regardless of how much they pay.
            </p>
            <p className="text-tsTextSecondary">
              Payment can buy optional visibility boosts, but it cannot override trust. A low-trust contractor with a paid boost will always rank below a high-trust contractor without one.
            </p>
          </section>

          {/* Community Verification Score */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <Star className="h-6 w-6 text-tsAccent" />
              Community Verification Score (CVS)
            </h2>

            <p className="text-tsTextSecondary mb-6">
              CVS is a composite trust score (0-100) calculated from:
            </p>

            <div className="space-y-6">
              {/* 1. Verified Identity */}
              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-tsAccent" />
                  1. Verified Identity (20 points)
                </h3>
                <ul className="list-disc list-inside space-y-2 text-tsTextSecondary ml-4">
                  <li>Real person with government-issued ID</li>
                  <li>Registered business (LLC, sole proprietor, etc.)</li>
                  <li>Verified business address (not P.O. box)</li>
                  <li>Active phone number and email</li>
                </ul>
              </div>

              {/* 2. License & Insurance */}
              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Lock className="h-5 w-5 text-tsAccent" />
                  2. License & Insurance (30 points)
                </h3>
                <ul className="list-disc list-inside space-y-2 text-tsTextSecondary ml-4">
                  <li><strong>Active state license</strong>: Verified against state registry</li>
                  <li><strong>General liability insurance</strong>: Minimum $1M coverage</li>
                  <li><strong>Workers comp insurance</strong>: If applicable (employees)</li>
                  <li><strong>Expiration monitoring</strong>: Auto-alerts 30 days before expiry</li>
                </ul>
                <p className="text-tsTextSecondary mt-4">
                  <strong>If license or insurance lapses, CVS drops to 0 until restored.</strong>
                </p>
              </div>

              {/* 3. Work History */}
              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-tsAccent" />
                  3. Work History (20 points)
                </h3>
                <ul className="list-disc list-inside space-y-2 text-tsTextSecondary ml-4">
                  <li>Number of completed jobs on TradeScout</li>
                  <li>Timeline adherence (on-time completion rate)</li>
                  <li>Budget adherence (stayed within estimate)</li>
                  <li>Repeat customers (% of clients who hired again)</li>
                </ul>
              </div>

              {/* 4. Community Recommendations */}
              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-5 w-5 text-tsAccent" />
                  4. Community Recommendations (20 points)
                </h3>
                <ul className="list-disc list-inside space-y-2 text-tsTextSecondary ml-4">
                  <li><strong>Neighbor endorsements</strong>: From verified community members</li>
                  <li><strong>Review lineage</strong>: Every review tied to a real person who worked with the contractor</li>
                  <li><strong>No anonymous reviews</strong>: Prevents fake testimonials and retaliation</li>
                  <li><strong>Quality over quantity</strong>: Weighted by reviewer trust score</li>
                </ul>
              </div>

              {/* 5. Dispute Resolution */}
              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-tsAccent" />
                  5. Dispute Resolution (10 points)
                </h3>
                <ul className="list-disc list-inside space-y-2 text-tsTextSecondary ml-4">
                  <li>How conflicts were resolved (mediation, refunds, repairs)</li>
                  <li>Response time to complaints</li>
                  <li>Willingness to fix issues vs. ghosting</li>
                  <li><strong>Unresolved disputes penalize CVS heavily</strong></li>
                </ul>
              </div>
            </div>
          </section>

          {/* Trust-Weighted Visibility */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6">Trust-Weighted Visibility</h2>

            <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder mb-6">
              <h3 className="text-xl font-semibold mb-3">How Matching Works</h3>
              <p className="text-tsTextSecondary mb-4">
                When Scout matches you with contractors, ranking is determined by:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-tsTextSecondary ml-4">
                <li><strong>CVS (primary)</strong>: Higher trust = higher rank</li>
                <li><strong>Relevance</strong>: Trade match, location proximity, availability</li>
                <li><strong>Context</strong>: Urgency signals, budget alignment, job complexity</li>
                <li><strong>Boosts (optional)</strong>: Paid visibility can move a contractor up <em>within the same trust tier</em></li>
              </ol>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2 text-yellow-600 dark:text-yellow-400">
                Payment Cannot Override Trust
              </h3>
              <p className="text-tsTextSecondary">
                A contractor with CVS 40 cannot pay to rank above a contractor with CVS 80. Boosts work <strong>within trust tiers</strong>, not across them.
              </p>
            </div>
          </section>

          {/* Public Audit Trail */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6">Public Audit Trail</h2>
            <p className="text-tsTextSecondary mb-4">
              Every contractor's trust metrics are publicly visible:
            </p>
            <ul className="list-disc list-inside space-y-2 text-tsTextSecondary ml-4">
              <li><strong>CVS breakdown</strong>: How the score was calculated</li>
              <li><strong>Verification status</strong>: License, insurance, background check dates</li>
              <li><strong>Review history</strong>: Who left reviews and when</li>
              <li><strong>Work timeline</strong>: Jobs completed, on-time rate, repeat clients</li>
              <li><strong>Dispute log</strong>: How conflicts were resolved (or not)</li>
            </ul>
            <p className="text-tsTextSecondary mt-4">
              You can see exactly <strong>why Scout matched you with a contractor</strong>.
            </p>
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
            <h2 className="text-2xl font-semibold mb-4">See Trust in Action</h2>
            <p className="text-tsTextSecondary mb-6">
              Browse verified contractors and see their CVS breakdown.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/direct-connect">
                <a className="bg-tsAccent text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition">
                  Find Contractors
                </a>
              </Link>
              <Link href="/scout">
                <a className="bg-tsSurface border border-tsBorder text-tsTextMain px-6 py-3 rounded-lg font-semibold hover:bg-tsBg transition">
                  Ask Scout
                </a>
              </Link>
            </div>
          </section>

          {/* Internal Links */}
          <nav className="mt-12 pt-8 border-t border-tsBorder">
            <h3 className="text-lg font-semibold mb-4">Learn More</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <Link href="/how-it-works">
                <a className="text-tsAccent hover:underline">How TradeScout Works →</a>
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

export default TrustModelPage;
