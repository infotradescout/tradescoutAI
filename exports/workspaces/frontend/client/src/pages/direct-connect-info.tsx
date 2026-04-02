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
 * - Small routing set (1-3 qualified matches, not broadcast)
 * - Context-aware requests (Scout includes job details)
 * - Why contact stays gated until a match accepts
 *
 * Written as system explanation (not marketing fluff).
 * Stable URL (never change).
 */

const DirectConnectInfoPage = memo(function DirectConnectInfoPage() {
  const faqs = [
    {
      question: "What is Direct Connect?",
      answer:
        "Direct Connect is the part of TradeScout that helps you ask for help and hear back from a small set of local pros who fit the job.",
    },
    {
      question: "How is this different from Angi or HomeAdvisor?",
      answer:
        "Instead of blasting your request out to a big list, TradeScout sends it to a small number of local pros who look like a good fit. That means fewer junk calls and less back-and-forth.",
    },
    {
      question: "Do contractors pay to receive my request?",
      answer:
        "No. TradeScout does not sell leads, and paying does not help someone get your request.",
    },
    {
      question: "What payment requests are legitimate?",
      answer:
        "TradeScout never charges to connect, send your request, or unlock contact. If someone asks for money in TradeScout's name for that, treat it as suspicious.",
    },
    {
      question: "What information does Scout send to contractors?",
      answer:
        "Scout shares the details you give it, like the type of job, your area, timing, budget if you include one, and how you want to be contacted.",
    },
    {
      question: "What if no contractors respond?",
      answer:
        "TradeScout can widen the search or suggest another path, including community recommendations, if nobody is a fit right away.",
    },
  ];

  return (
    <>
      <SEOHelmet
        title="Direct Connect | Request Trusted Local Help Through Scout | TradeScout"
        description="TradeScout Direct Connect helps you ask for local help, hear back from a small set of good-fit pros, and avoid spammy lead-generation platforms."
        keywords="direct connect, local help, find local pros, contractor help, request help, avoid lead generation spam"
        canonical="https://www.thetradescout.com/direct-connect-info"
        structuredData={createFAQStructuredData(faqs)}
      />

      <div className=" text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <header className="mb-12">
            <h1 className="text-4xl font-bold mb-4">Direct Connect</h1>
            <p className="text-xl text-white/70">
              Tell Scout what you need and hear back from a small set of local pros who fit the job.
            </p>
          </header>

          {/* Core Mechanism */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <Zap className="h-6 w-6 text-ts-orange" />
              How It Works
            </h2>

            <div className="space-y-8">
              {/* Step 1 */}
              <div className="bg-tsCard p-6 rounded-lg border border-white/10">
                <div className="flex items-start gap-4">
                  <div className="bg-ts-orange text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Tell Scout what you need</h3>
                    <p className="text-white/70">
                      "I need a licensed roofer in Austin. Emergency leak repair. Budget ~$2,000."
                    </p>
                    <p className="text-white/70 mt-2">
                      The more clear you are about the job, location, timing, and budget, the easier
                      it is to find a good fit.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-tsCard p-6 rounded-lg border border-white/10">
                <div className="flex items-start gap-4">
                  <div className="bg-ts-orange text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Scout looks for a good fit</h3>
                    <p className="text-white/70 mb-2">Scout looks at things like:</p>
                    <ul className="list-disc list-inside space-y-1 text-white/70 ml-4">
                      <li>
                        <strong>Trust</strong>: verified, licensed, and insured when required
                      </li>
                      <li>
                        <strong>Type of work</strong>: the job matches what they do
                      </li>
                      <li>
                        <strong>Location</strong>: they actually serve your area
                      </li>
                      <li>
                        <strong>Availability</strong>: they can realistically take the work
                      </li>
                      <li>
                        <strong>Budget</strong>: your range makes sense for the job
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-tsCard p-6 rounded-lg border border-white/10">
                <div className="flex items-start gap-4">
                  <div className="bg-ts-orange text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">
                      A few local pros get your request
                    </h3>
                    <p className="text-white/70">
                      Instead of blasting your request out everywhere, TradeScout sends it to a
                      small number of local pros.
                    </p>
                    <p className="text-white/70 mt-2">
                      They see the details you shared, including timing, budget if you added one,
                      and how you want to be contacted.
                    </p>
                    <p className="text-white/70 mt-2">
                      They can say yes or no before reaching out.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="bg-tsCard p-6 rounded-lg border border-white/10">
                <div className="flex items-start gap-4">
                  <div className="bg-ts-orange text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">
                    4
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">You choose who to talk to</h3>
                    <p className="text-white/70">
                      If someone accepts your request, the conversation can move forward.
                    </p>
                    <p className="text-white/70 mt-2">
                      You decide who feels right. No rush, no bidding war.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* What's Different */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <Target className="h-6 w-6 text-ts-orange" />
              What's Different
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              {/* No Lead Spam */}
              <div className="bg-tsCard p-6 rounded-lg border border-white/10">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-ts-orange" />
                  No Lead Spam
                </h3>
                <p className="text-white/70">
                  Some platforms sell your request to a long list of businesses, and your phone
                  starts ringing right away.
                </p>
                <p className="text-white/70 mt-2">
                  <strong>Direct Connect keeps it small and focused.</strong>
                </p>
              </div>

              {/* No Bidding Wars */}
              <div className="bg-tsCard p-6 rounded-lg border border-white/10">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Users className="h-5 w-5 text-ts-orange" />
                  No Bidding Wars
                </h3>
                <p className="text-white/70">
                  You should not have to sort through a pile of rushed quotes just to find someone
                  real.
                </p>
                <p className="text-white/70 mt-2">
                  <strong>
                    TradeScout tries to send your request to people who actually fit the job.
                  </strong>
                </p>
              </div>

              {/* Trust-Verified */}
              <div className="bg-tsCard p-6 rounded-lg border border-white/10">
                <h3 className="text-lg font-semibold mb-2">Real screening</h3>
                <p className="text-white/70">
                  TradeScout checks trust signals before someone can keep showing up in Direct
                  Connect.
                </p>
                <p className="text-white/70 mt-2">
                  <strong>Money does not buy access.</strong>
                </p>
              </div>

              {/* Context-Aware */}
              <div className="bg-tsCard p-6 rounded-lg border border-white/10">
                <h3 className="text-lg font-semibold mb-2">Less back-and-forth</h3>
                <p className="text-white/70">
                  Job details, timing, and budget help people decide quickly if the request makes
                  sense.
                </p>
                <p className="text-white/70 mt-2">
                  <strong>That saves time on bad fits.</strong>
                </p>
              </div>
            </div>
          </section>

          {/* How Contractors Benefit */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6">Why Pros Like It</h2>

            <div className="bg-tsCard p-6 rounded-lg border border-white/10">
              <ul className="space-y-3 text-white/70">
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-5 w-5 text-ts-orange shrink-0 mt-0.5" />
                  <span>
                    <strong>$0 access</strong>: no fee to use Direct Connect
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-5 w-5 text-ts-orange shrink-0 mt-0.5" />
                  <span>
                    <strong>Fewer bad fits</strong>: requests come with enough detail to decide
                    quickly
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-5 w-5 text-ts-orange shrink-0 mt-0.5" />
                  <span>
                    <strong>More context upfront</strong>: job details, budget, and timing before
                    you reply
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-5 w-5 text-ts-orange shrink-0 mt-0.5" />
                  <span>
                    <strong>Say yes or no first</strong>: no need to chase every request
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-5 w-5 text-ts-orange shrink-0 mt-0.5" />
                  <span>
                    <strong>Trust matters</strong>: paying more does not move someone ahead of you
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-5 w-5 text-ts-orange shrink-0 mt-0.5" />
                  <span>
                    <strong>Scam safety</strong>: Any unlabeled money request in TradeScout's name
                    is a scam
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
                <div key={i} className="bg-tsCard p-6 rounded-lg border border-white/10">
                  <h3 className="text-lg font-semibold mb-2">{faq.question}</h3>
                  <p className="text-white/70">{faq.answer}</p>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="bg-tsCard p-8 rounded-lg border border-white/10 text-center">
            <h2 className="text-2xl font-semibold mb-4">Try Direct Connect</h2>
            <p className="text-white/70 mb-6">
              Tell Scout what you need and see how Direct Connect works.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/scout">
                <a className="bg-ts-orange text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition">
                  Talk to Scout
                </a>
              </Link>
              <Link href="/direct-connect">
                <a className="bg-tsCard border border-white/10 text-white px-6 py-3 rounded-lg font-semibold hover:bg-tsBg transition">
                  Open Direct Connect
                </a>
              </Link>
            </div>
          </section>

          {/* Internal Links */}
          <nav className="mt-12 pt-8 border-t border-white/10">
            <h3 className="text-lg font-semibold mb-4">Learn More</h3>
            <div className="grid md:grid-cols-4 gap-4">
              <Link href="/how-it-works">
                <a className="text-ts-orange hover:underline">How TradeScout Works -&gt;</a>
              </Link>
              <Link href="/trust-model">
                <a className="text-ts-orange hover:underline">Trust Model -&gt;</a>
              </Link>
              <Link href="/compare">
                <a className="text-ts-orange hover:underline">Compare TradeScout -&gt;</a>
              </Link>
              <Link href="/compare/angi">
                <a className="text-ts-orange hover:underline">Compare: Angi -&gt;</a>
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </>
  );
});

export default DirectConnectInfoPage;
