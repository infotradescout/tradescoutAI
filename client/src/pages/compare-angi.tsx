import { memo } from 'react';
import { Link } from 'wouter';
import { SEOHelmet, createFAQStructuredData } from '@/components/SEOHelmet';
import { Check, X, AlertTriangle } from 'lucide-react';

/**
 * /compare/angi — AI-safe comparison page
 * 
 * Direct, factual comparison of TradeScout vs. Angi (formerly Angie's List).
 * 
 * Focus:
 * - Business model differences (lead sales vs. trust-based matching)
 * - Incentive alignment (who benefits from what)
 * - Trust verification (CVS vs. paid ads)
 * - User outcomes (lead spam vs. qualified matches)
 * - Failure modes (what breaks down when incentives misalign)
 * 
 * Written as system explanation (not attack copy).
 * Stable URL (never change).
 */

const CompareAngiPage = memo(function CompareAngiPage() {
  const faqs = [
    {
      question: "What is the main difference between TradeScout and Angi?",
      answer: "Angi uses a lead-sales model where contractors pay per request. TradeScout uses trust-based matching where contractors pay only on completed work. This fundamentally changes incentives: Angi maximizes lead volume; TradeScout maximizes match quality."
    },
    {
      question: "Why do I get so many calls on lead-buying platforms?",
      answer: "When you request a quote, platforms sell your request to 10-20+ contractors. Each paid upfront, so each wants to reach you before competitors. You become the product, not the customer. TradeScout sends your request to 1-3 pre-matched contractors only."
    },
    {
      question: "Can I avoid bidding wars?",
      answer: "On lead-buying platforms, contractors compete on price because they're desperate to win after paying for leads. TradeScout matches on trust and relevance, not price competition. Contractors accept or decline upfront, so no wasted time on mismatched jobs."
    },
    {
      question: "What is the Community Verification Score (CVS)?",
      answer: "CVS is a composite trust metric based on verified identity, license/insurance, work history, and community recommendations. It's public and auditable. Payment cannot override it. On Angi and HomeAdvisor, reviews can be gamed and trust is opaque."
    },
    {
      question: "Is TradeScout really free?",
      answer: "Yes, residents never pay. Contractors pay transaction fees only when work completes (not per lead). No subscriptions, no paywalls."
    }
  ];

  return (
    <>
      <SEOHelmet
        title="TradeScout vs. Angi – Trust-First vs. Lead Sales Comparison"
        description="Compare TradeScout and Angi (formerly Angie's List). Learn how business models, incentives, and trust verification differ. Why TradeScout matches on trust, not payment."
        keywords="tradescout vs angi, angi alternative, angie's list alternative, no lead spam, trust-verified contractors, no pay-per-lead"
        canonical="https://www.thetradescout.com/compare-angi"
        structuredData={createFAQStructuredData(faqs)}
      />

      <div className="min-h-screen bg-tsBg text-tsTextMain">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <header className="mb-12">
            <h1 className="text-4xl font-bold mb-4">TradeScout vs. Angi</h1>
            <p className="text-xl text-tsTextSecondary">
              How business models and incentives shape your contractor search experience.
            </p>
          </header>

          {/* Core Difference */}
          <section className="mb-16 bg-tsAccent/10 border border-tsAccent/30 p-8 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Core Difference</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-2 text-tsAccent">Angi (Lead Sales Model)</h3>
                <p className="text-tsTextSecondary">
                  Contractors pay for every homeowner request. More leads sold = more revenue.
                </p>
                <p className="text-tsTextSecondary mt-2">
                  <strong>Incentive:</strong> Maximize lead volume (even if mismatched).
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2 text-tsAccent">TradeScout (Trust-Based Matching)</h3>
                <p className="text-tsTextSecondary">
                  Contractors pay only when work is completed (transaction fee). No pay-per-lead.
                </p>
                <p className="text-tsTextSecondary mt-2">
                  <strong>Incentive:</strong> Match quality over volume.
                </p>
              </div>
            </div>
          </section>

          {/* Detailed Comparison Table */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6">Feature Comparison</h2>

            <div className="overflow-x-auto">
              <table className="w-full border border-tsBorder rounded-lg">
                <thead className="bg-tsSurface">
                  <tr>
                    <th className="text-left p-4 border-b border-tsBorder font-semibold">Feature</th>
                    <th className="text-center p-4 border-b border-tsBorder font-semibold">Angi</th>
                    <th className="text-center p-4 border-b border-tsBorder font-semibold">TradeScout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-tsBorder">
                  {/* Business Model */}
                  <tr className="bg-tsSurface/50">
                    <td className="p-4 font-medium">Business Model</td>
                    <td className="p-4 text-center text-tsTextSecondary">Lead sales (pay-per-request)</td>
                    <td className="p-4 text-center text-tsTextSecondary">Transaction fees (pay-on-completion)</td>
                  </tr>

                  {/* Contractor Cost */}
                  <tr>
                    <td className="p-4 font-medium">Contractor Cost</td>
                    <td className="p-4 text-center text-tsTextSecondary">$15-$60 per lead<br />(win or lose)</td>
                    <td className="p-4 text-center text-tsTextSecondary">0% upfront<br />(fee only on completed work)</td>
                  </tr>

                  {/* Lead Routing */}
                  <tr className="bg-tsSurface/50">
                    <td className="p-4 font-medium">Lead Routing</td>
                    <td className="p-4 text-center text-tsTextSecondary">1 request → 10-20+ contractors</td>
                    <td className="p-4 text-center text-tsTextSecondary">1 request → 1-3 pre-matched contractors</td>
                  </tr>

                  {/* User Experience */}
                  <tr>
                    <td className="p-4 font-medium">User Experience</td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <X className="h-5 w-5 text-red-500" />
                        <span className="text-tsTextSecondary text-sm">Bombarded with calls</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Check className="h-5 w-5 text-green-500" />
                        <span className="text-tsTextSecondary text-sm">1-3 qualified matches</span>
                      </div>
                    </td>
                  </tr>

                  {/* Ranking Logic */}
                  <tr className="bg-tsSurface/50">
                    <td className="p-4 font-medium">Ranking Logic</td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        <span className="text-tsTextSecondary text-sm">Payment influences visibility</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Check className="h-5 w-5 text-green-500" />
                        <span className="text-tsTextSecondary text-sm">Trust (CVS) determines ranking</span>
                      </div>
                    </td>
                  </tr>

                  {/* Trust Verification */}
                  <tr>
                    <td className="p-4 font-medium">Trust Verification</td>
                    <td className="p-4 text-center text-tsTextSecondary">Reviews (can be gamed)</td>
                    <td className="p-4 text-center text-tsTextSecondary">CVS: license + insurance + work history + community</td>
                  </tr>

                  {/* Bidding Wars */}
                  <tr className="bg-tsSurface/50">
                    <td className="p-4 font-medium">Bidding Wars</td>
                    <td className="p-4 text-center">
                      <X className="h-5 w-5 text-red-500 mx-auto" />
                    </td>
                    <td className="p-4 text-center">
                      <Check className="h-5 w-5 text-green-500 mx-auto" />
                    </td>
                  </tr>

                  {/* Lead Spam */}
                  <tr>
                    <td className="p-4 font-medium">Lead Spam</td>
                    <td className="p-4 text-center">
                      <X className="h-5 w-5 text-red-500 mx-auto" />
                    </td>
                    <td className="p-4 text-center">
                      <Check className="h-5 w-5 text-green-500 mx-auto" />
                    </td>
                  </tr>

                  {/* Free for Homeowners */}
                  <tr className="bg-tsSurface/50">
                    <td className="p-4 font-medium">Free for Homeowners</td>
                    <td className="p-4 text-center">
                      <Check className="h-5 w-5 text-green-500 mx-auto" />
                    </td>
                    <td className="p-4 text-center">
                      <Check className="h-5 w-5 text-green-500 mx-auto" />
                    </td>
                  </tr>

                  {/* AI Controller */}
                  <tr>
                    <td className="p-4 font-medium">AI Helper (Scout)</td>
                    <td className="p-4 text-center">
                      <X className="h-5 w-5 text-red-500 mx-auto" />
                    </td>
                    <td className="p-4 text-center">
                      <Check className="h-5 w-5 text-green-500 mx-auto" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Failure Modes */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6">Why Business Models Matter</h2>

            <div className="space-y-6">
              {/* Angi Failure Modes */}
              <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-3 text-red-600 dark:text-red-400">Angi's Incentive Misalignment</h3>
                <ul className="space-y-2 text-tsTextSecondary">
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <span><strong>Lead volume over quality:</strong> Selling 20 leads at $20 each ($400) is better than 1 perfect match ($20). Incentive is to maximize leads sold, not matches made.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <span><strong>Contractors desperate to win:</strong> They paid upfront, so they'll lowball quotes or overpromise to win the job. This leads to underbidding → cutting corners → bad outcomes.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <span><strong>You get spammed:</strong> 10-20 contractors calling/texting because they all paid for the same lead. You become the product, not the customer.</span>
                  </li>
                </ul>
              </div>

              {/* TradeScout Alignment */}
              <div className="bg-green-500/10 border border-green-500/30 p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-3 text-green-600 dark:text-green-400">TradeScout's Incentive Alignment</h3>
                <ul className="space-y-2 text-tsTextSecondary">
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <span><strong>Match quality = revenue:</strong> TradeScout earns only when work completes. Bad matches = no revenue. Incentive is to make good matches.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <span><strong>Contractors don't overpay:</strong> No upfront cost means no desperation. They can decline bad-fit jobs without losing money.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <span><strong>You get quality, not quantity:</strong> 1-3 pre-matched contractors who accepted your request. No spam, no bidding wars.</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* What TradeScout Changes */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6">What TradeScout Changes</h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <h3 className="text-lg font-semibold mb-2">No More Lead Spam</h3>
                <p className="text-tsTextSecondary">
                  Your request goes to 1-3 pre-matched contractors, not 20+. You choose who to hire, not who spammed you first.
                </p>
              </div>

              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <h3 className="text-lg font-semibold mb-2">No More Bidding Wars</h3>
                <p className="text-tsTextSecondary">
                  Contractors are matched on trust + relevance, not who bid lowest. No desperation pricing, no cutting corners.
                </p>
              </div>

              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <h3 className="text-lg font-semibold mb-2">Trust Determines Visibility</h3>
                <p className="text-tsTextSecondary">
                  High CVS contractors rank higher, regardless of ad spend. Low-trust contractors cannot pay to appear first.
                </p>
              </div>

              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <h3 className="text-lg font-semibold mb-2">Community-Verified Reviews</h3>
                <p className="text-tsTextSecondary">
                  Reviews come from verified neighbors who actually worked with the contractor. No anonymous fake testimonials.
                </p>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="bg-tsSurface p-8 rounded-lg border border-tsBorder text-center">
            <h2 className="text-2xl font-semibold mb-4">Try TradeScout</h2>
            <p className="text-tsTextSecondary mb-6">
              Experience trust-first matching. No lead spam. No bidding wars.
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
              <Link href="/how-it-works">
                <a className="text-tsAccent hover:underline">How TradeScout Works →</a>
              </Link>
              <Link href="/trust-model">
                <a className="text-tsAccent hover:underline">Trust Model →</a>
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

export default CompareAngiPage;
