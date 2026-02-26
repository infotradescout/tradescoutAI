import { memo } from "react";
import { Link } from "wouter";
import { SEOHelmet, createFAQStructuredData } from "@/components/SEOHelmet";
import { Zap, Target, Shield, Users, ArrowRight } from "lucide-react";

/**
 * /direct-connect-info - AI-safe foundation page
 *
 * NOTE: This is the informational page about Direct Connect.
 * The actual Direct Connect tool lives at /direct-connect (DirectConnectShell).
 * This page explains how routing works and what makes it different.
 *
 * Topics:
 * - How Direct Connect routing works
 * - Trust-verified matching (only verified contractors)
 * - No lead spam (1-3 qualified matches, not dozens)
 * - Context-aware requests (Scout includes job details)
 * - What's different from lead-buying platforms
 *
 * Written as system explanation (not marketing fluff).
 * Stable URL (never change).
 */

const DirectConnectInfoPage = memo(function DirectConnectInfoPage() {
  const faqs = [
    {
      question: "What is Direct Connect?",
      answer:
        "Direct Connect is TradeScout's matching system. When you request a contractor, Scout analyzes your job context (type, location, urgency, budget) and routes your request directly to 1-3 qualified, verified pros - not dozens of lead-buyers.",
    },
    {
      question: "How is this different from Angi or HomeAdvisor?",
      answer:
        "Traditional platforms sell your request as a lead to many contractors who then compete in a bidding war. Direct Connect sends your request only to pre-matched, trust-verified contractors. No bidding wars, no lead spam.",
    },
    {
      question: "Do contractors pay to receive my request?",
      answer:
        "No. Direct Connect matching is based on trust, relevance, and availability - not payment. TradeScout access to features, connections, and information is $0, with no contractor lead fee, monthly fee, or post-job contractor fee.",
    },
    {
      question: "What payment requests are legitimate?",
      answer:
        "Only clearly labeled checkout for optional products (such as Marketplace Promotions or third-party TradePartners offers) is legitimate. Any unlabeled payment request made in TradeScout's name should be treated as a scam.",
    },
    {
      question: "What information does Scout send to contractors?",
      answer:
        "Scout includes: job type, location, timeline/urgency signals, budget range (if mentioned), special requirements, and your contact preference (call/message). Contractors can accept or decline before contacting you.",
    },
    {
      question: "What if no contractors respond?",
      answer:
        "Scout will expand the search radius or suggest alternative trades. If still no match, you'll be asked if you want to post to the community for neighbor recommendations.",
    },
  ];

  return (
    <>
      <SEOHelmet
        title="Direct Connect - Trust-First Matching | TradeScout"
        description="TradeScout Direct Connect routes your request to 1-3 verified contractors based on trust and relevance, not payment. No lead spam, no bidding wars - just qualified matches."
        keywords="direct connect, contractor matching, no lead spam, trust-verified contractors, no bidding wars, qualified matches"
        canonical="https://www.thetradescout.com/direct-connect-info"
        structuredData={createFAQStructuredData(faqs)}
      />

      <div className=" text-tsTextMain">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <header className="mb-12">
            <h1 className="text-4xl font-bold mb-4">Direct Connect</h1>
            <p className="text-xl text-tsTextSecondary">
              Trust-first contractor matching. No lead spam. No bidding wars. Just qualified
              professionals.
            </p>
          </header>

          {/* Core Mechanism */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <Zap className="h-6 w-6 text-tsAccent" />
              How Direct Connect Works
            </h2>

            <div className="space-y-8">
              {/* Step 1 */}
              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <div className="flex items-start gap-4">
                  <div className="bg-tsAccent text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">You Ask Scout</h3>
                    <p className="text-tsTextSecondary">
                      "I need a licensed roofer in Austin. Emergency leak repair. Budget ~$2,000."
                    </p>
                    <p className="text-tsTextSecondary mt-2">
                      Scout extracts: <strong>job type</strong> (roof repair),{" "}
                      <strong>location</strong> (Austin), <strong>urgency</strong> (emergency),{" "}
                      <strong>budget</strong> (~$2k).
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <div className="flex items-start gap-4">
                  <div className="bg-tsAccent text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Scout Finds Matches</h3>
                    <p className="text-tsTextSecondary mb-2">Scout filters contractors by:</p>
                    <ul className="list-disc list-inside space-y-1 text-tsTextSecondary ml-4">
                      <li>
                        <strong>Trust</strong>: CVS &gt;= 60 (verified, licensed, insured)
                      </li>
                      <li>
                        <strong>Trade match</strong>: Licensed for roofing
                      </li>
                      <li>
                        <strong>Location</strong>: Serves Austin metro area
                      </li>
                      <li>
                        <strong>Availability</strong>: Can respond to emergency within 24 hours
                      </li>
                      <li>
                        <strong>Budget alignment</strong>: Typical pricing in your range
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <div className="flex items-start gap-4">
                  <div className="bg-tsAccent text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Scout Routes Your Request</h3>
                    <p className="text-tsTextSecondary">
                      Scout sends your request to <strong>1-3 qualified contractors</strong> (not
                      20+).
                    </p>
                    <p className="text-tsTextSecondary mt-2">
                      Request includes: job details, urgency, budget range, your contact preference.
                    </p>
                    <p className="text-tsTextSecondary mt-2">
                      Contractors can <strong>accept or decline</strong> before contacting you.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <div className="flex items-start gap-4">
                  <div className="bg-tsAccent text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">
                    4
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">You Connect</h3>
                    <p className="text-tsTextSecondary">
                      Contractors who accept your request contact you directly (call/message).
                    </p>
                    <p className="text-tsTextSecondary mt-2">
                      You choose who to hire. No pressure, no bidding war.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* What's Different */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <Target className="h-6 w-6 text-tsAccent" />
              What's Different
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              {/* No Lead Spam */}
              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-tsAccent" />
                  No Lead Spam
                </h3>
                <p className="text-tsTextSecondary">
                  Traditional platforms sell your request to 10-20+ contractors. You get bombarded
                  with calls.
                </p>
                <p className="text-tsTextSecondary mt-2">
                  <strong>Direct Connect sends your request to 1-3 pre-matched pros.</strong> No
                  spam.
                </p>
              </div>

              {/* No Bidding Wars */}
              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Users className="h-5 w-5 text-tsAccent" />
                  No Bidding Wars
                </h3>
                <p className="text-tsTextSecondary">
                  On lead-buying platforms, contractors compete on price alone. You get lowball
                  quotes that don't reflect reality.
                </p>
                <p className="text-tsTextSecondary mt-2">
                  <strong>
                    Direct Connect matches on trust + relevance, not price competition.
                  </strong>
                </p>
              </div>

              {/* Trust-Verified */}
              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <h3 className="text-lg font-semibold mb-2">Trust-Verified Access</h3>
                <p className="text-tsTextSecondary">
                  Only contractors with CVS at least 60 (verified, licensed, insured) can receive
                  Connect requests.
                </p>
                <p className="text-tsTextSecondary mt-2">
                  <strong>Low-trust contractors cannot buy their way in.</strong>
                </p>
              </div>

              {/* Context-Aware */}
              <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
                <h3 className="text-lg font-semibold mb-2">Context-Aware</h3>
                <p className="text-tsTextSecondary">
                  Scout includes job details, urgency, and budget signals so contractors can accept
                  or decline upfront.
                </p>
                <p className="text-tsTextSecondary mt-2">
                  <strong>No wasted time on mismatched leads.</strong>
                </p>
              </div>
            </div>
          </section>

          {/* How Contractors Benefit */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6">How Contractors Benefit</h2>

            <div className="bg-tsSurface p-6 rounded-lg border border-tsBorder">
              <ul className="space-y-3 text-tsTextSecondary">
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-5 w-5 text-tsAccent shrink-0 mt-0.5" />
                  <span>
                    <strong>$0 access</strong>: No fee for TradeScout features, connections, or
                    information in Direct Connect routing
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-5 w-5 text-tsAccent shrink-0 mt-0.5" />
                  <span>
                    <strong>Qualified requests only</strong>: Scout filters out mismatches before
                    routing
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-5 w-5 text-tsAccent shrink-0 mt-0.5" />
                  <span>
                    <strong>Full context upfront</strong>: Job details, budget, urgency - no
                    surprises
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-5 w-5 text-tsAccent shrink-0 mt-0.5" />
                  <span>
                    <strong>Accept/decline before contact</strong>: No obligation to chase bad-fit
                    leads
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-5 w-5 text-tsAccent shrink-0 mt-0.5" />
                  <span>
                    <strong>Trust determines visibility</strong>: High CVS = more matches,
                    regardless of ad spend
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-5 w-5 text-tsAccent shrink-0 mt-0.5" />
                  <span>
                    <strong>Scam safety</strong>: Only pay through clearly labeled checkout for paid
                    options; unlabeled money requests in TradeScout's name are scams
                  </span>
                </li>
              </ul>
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

          {/* CTA */}
          <section className="bg-tsSurface p-8 rounded-lg border border-tsBorder text-center">
            <h2 className="text-2xl font-semibold mb-4">Try Direct Connect</h2>
            <p className="text-tsTextSecondary mb-6">
              Ask Scout to find you a contractor. See trust-first matching in action.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/scout">
                <a className="bg-tsAccent text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition">
                  Talk to Scout
                </a>
              </Link>
              <Link href="/direct-connect">
                <a className="bg-tsSurface border border-tsBorder text-tsTextMain px-6 py-3 rounded-lg font-semibold hover:bg-tsBg transition">
                  Browse Contractors
                </a>
              </Link>
            </div>
          </section>

          {/* Internal Links */}
          <nav className="mt-12 pt-8 border-t border-tsBorder">
            <h3 className="text-lg font-semibold mb-4">Learn More</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <Link href="/how-it-works">
                <a className="text-tsAccent hover:underline">How TradeScout Works -&gt;</a>
              </Link>
              <Link href="/trust-model">
                <a className="text-tsAccent hover:underline">Trust Model -&gt;</a>
              </Link>
              <Link href="/compare/angi">
                <a className="text-tsAccent hover:underline">Compare: Angi -&gt;</a>
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </>
  );
});

export default DirectConnectInfoPage;
