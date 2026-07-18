import React, { useEffect } from "react";
import {
  bootstrapDemandAttribution,
  trackDemandEvent,
  withDemandQueryParams,
} from "@/lib/demandEngine";
import "./TradeScoutLandingPage.css";

const LANDING_CONVERSION_VARIANT = "hybrid_public_landing";
const LANDING_PRIMARY_REQUEST_SOURCE = "landing_primary_cta";

const peopleSteps = [
  {
    number: "01",
    title: "Start with what you need",
    copy: "Open Scout, search local businesses, check Community, or browse the Exchange. Use whichever path feels natural.",
  },
  {
    number: "02",
    title: "See the useful proof",
    copy: "Compare the offer, location, availability, real work, recommendations, and price context without paid ranking deciding for you.",
  },
  {
    number: "03",
    title: "Choose who gets the request",
    copy: "Direct Connect sends your request only to the businesses you choose. Your contact information stays private until acceptance.",
  },
  {
    number: "04",
    title: "Keep the outcome",
    copy: "Requests, photos, quotes, completed work, and follow-up stay together so the next decision does not start from zero.",
  },
];

const businessSteps = [
  {
    number: "01",
    title: "Claim or create your profile",
    copy: "Bring the business, its offer, and the strongest provable facts into one clear public presence.",
  },
  {
    number: "02",
    title: "Show what makes you worth choosing",
    copy: "Keep services, products, availability, finished work, recommendations, and relevant proof current in one place.",
  },
  {
    number: "03",
    title: "Respond to chosen requests",
    copy: "Review the work before contact opens. Accept what fits, decline what does not, and never buy a resold lead.",
  },
  {
    number: "04",
    title: "Let good work keep working",
    copy: "Completed jobs and customer outcomes strengthen the profile naturally instead of disappearing into another app or spreadsheet.",
  },
];

export default function TradeScoutLandingPage() {
  useEffect(() => {
    bootstrapDemandAttribution();
    void trackDemandEvent("landing_view", {
      variant: LANDING_CONVERSION_VARIANT,
      surface: "public_landing",
    });
  }, []);

  const directConnectHref = withDemandQueryParams(
    `/direct-connect?source=${LANDING_PRIMARY_REQUEST_SOURCE}`
  );
  const scoutHref = withDemandQueryParams("/scout?source=landing_scout");
  const claimHref = withDemandQueryParams("/claim-my-business?source=landing_business");

  const trackClick = (cta: string, target: string) => {
    void trackDemandEvent("cta_click", {
      variant: LANDING_CONVERSION_VARIANT,
      surface: "public_landing",
      cta,
      source: LANDING_PRIMARY_REQUEST_SOURCE,
      target,
    });
  };

  return (
    <main className="ts-landing-shell" id="top">
      <header className="ts-header" aria-label="TradeScout primary header">
        <a className="ts-logo" href="/" aria-label="TradeScout home">
          <img
            className="ts-logo-mark"
            src="/tradescout-logo-circle.png?v=10"
            alt=""
            aria-hidden="true"
            decoding="async"
          />
          <span className="ts-logo-text">TradeScout</span>
        </a>

        <nav className="ts-primary-nav" aria-label="Landing page navigation">
          <a href="#people">For people</a>
          <a href="#businesses">For businesses</a>
          <a href="#two-paths">Use it your way</a>
          <a href="#pricing">Pricing</a>
          <a href="/login">Log in</a>
          <a
            className="ts-nav-scout"
            href={scoutHref}
            onClick={() => trackClick("open_scout_header", "/scout")}
          >
            Open Scout <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>

      <section className="ts-hero" aria-labelledby="ts-hero-title">
        <div className="ts-hero-copy">
          <p className="ts-kicker">For people and local businesses</p>
          <h1 id="ts-hero-title">Connection Without Compromise</h1>
          <p className="ts-hero-declaration">Find what you need. Show what you offer.</p>
          <p className="ts-hero-subheadline">
            TradeScout brings local discovery, requests, work, and follow-up together without
            selling your information or forcing either side into a lead auction.
          </p>

          <div className="ts-hero-actions" aria-label="Primary actions">
            <a
              className="ts-button ts-button-primary"
              href={scoutHref}
              onClick={() => trackClick("open_scout", "/scout")}
            >
              Open Scout <span aria-hidden="true">↗</span>
            </a>
            <a className="ts-button ts-button-secondary" href="#start">
              Explore TradeScout
            </a>
          </div>

          <div className="ts-trust-row" aria-label="TradeScout promises">
            <span>✓ No paid ranking</span>
            <span>✓ You choose who gets a request</span>
            <span>✓ Contact opens after acceptance</span>
          </div>
        </div>

        <div className="ts-start-panel" id="start" aria-label="Choose where to start">
          <p className="ts-panel-label">Pick where to start</p>
          <article className="ts-start-option">
            <span className="ts-option-number">01</span>
            <div>
              <p className="ts-option-kicker">For people</p>
              <h2>I need help, information, a product, or something local.</h2>
              <p>
                Use Scout or browse normally. When you want to reach someone, you stay in control.
              </p>
              <div className="ts-option-actions">
                <a href="/find-local-businesses">Find local businesses</a>
                <a
                  href={directConnectHref}
                  onClick={() => trackClick("make_a_request", "/direct-connect")}
                >
                  Make A Request <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          </article>
          <article className="ts-start-option ts-start-option-business">
            <span className="ts-option-number">02</span>
            <div>
              <p className="ts-option-kicker">For businesses</p>
              <h2>I want people to understand and choose what I offer.</h2>
              <p>
                Build on what already works, show real proof, and respond only to chosen requests.
              </p>
              <div className="ts-option-actions">
                <a href="/for-businesses">See how it works</a>
                <a
                  href={claimHref}
                  onClick={() => trackClick("claim_business", "/claim-my-business")}
                >
                  Claim my business <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section
        className="ts-audience-section ts-people-section"
        id="people"
        aria-labelledby="ts-people-title"
      >
        <div className="ts-section-intro">
          <p className="ts-section-kicker">For people</p>
          <h2 id="ts-people-title">You start with what you need.</h2>
          <p>
            A service, a local question, a purchase, a rental, a property decision, or something
            nearby—the first step should match the real intent.
          </p>
        </div>
        <div className="ts-flow-grid">
          {peopleSteps.map((step) => (
            <article className="ts-flow-card" key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
        <div className="ts-inline-actions">
          <a className="ts-text-action ts-text-action-strong" href={scoutHref}>
            Open Scout ↗
          </a>
          <a className="ts-text-action" href="/community-feed">
            Open Community ↗
          </a>
          <a className="ts-text-action" href="/exchange">
            Browse the Exchange ↗
          </a>
        </div>
      </section>

      <section
        className="ts-audience-section ts-business-section"
        id="businesses"
        aria-labelledby="ts-business-title"
      >
        <div className="ts-section-intro">
          <p className="ts-section-kicker">For businesses</p>
          <h2 id="ts-business-title">You start with what you offer.</h2>
          <p>
            TradeScout is for the full local economy. Your profile should help people understand the
            business, choose confidently, and keep the work moving—not give you another marketing
            job.
          </p>
        </div>
        <div className="ts-flow-grid">
          {businessSteps.map((step) => (
            <article className="ts-flow-card" key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
        <div className="ts-inline-actions">
          <a className="ts-text-action ts-text-action-strong" href={claimHref}>
            Claim my business ↗
          </a>
          <a className="ts-text-action" href="/for-businesses">
            For businesses ↗
          </a>
          <a className="ts-text-action" href="/trust-model">
            How trust works ↗
          </a>
        </div>
      </section>

      <section className="ts-pricing-reveal" id="pricing" aria-labelledby="ts-pricing-title">
        <div className="ts-pricing-punchline">
          <p className="ts-section-kicker">Pricing</p>
          <h2 className="ts-pricing-made" id="ts-pricing-title">
            Made you look.
          </h2>
        </div>
        <div className="ts-pricing-promise">
          <h3>TradeScout is free forever.</h3>
          <p>
            We may show valuable, relevant offers from verified TradePartners and local businesses.
            No company can advertise on TradeScout without bringing value and quality at the same
            time.
          </p>
          <ul>
            <li>No sold leads.</li>
            <li>No paid ranking.</li>
            <li>No payment required to connect.</li>
            <li>Sponsored offers stay clearly separate from earned trust.</li>
          </ul>
          <a href="/pricing#how-tradescout-earns">See how we earn revenue here</a>
        </div>
      </section>

      <section className="ts-two-paths" id="two-paths" aria-labelledby="ts-two-paths-title">
        <div className="ts-section-intro ts-section-intro-dark">
          <p className="ts-section-kicker">One TradeScout</p>
          <h2 id="ts-two-paths-title">Use it your way.</h2>
          <p>
            Everything stays connected whether you tap through TradeScout or use Scout to handle the
            next step.
          </p>
        </div>
        <div className="ts-path-grid">
          <article>
            <p className="ts-path-number">01</p>
            <h3>Classic TradeScout</h3>
            <p>
              Use normal navigation, profiles, directories, Community, Direct Connect, HomeID, and
              the Exchange.
            </p>
            <a href="/find-local-businesses">Explore normally ↗</a>
          </article>
          <article>
            <p className="ts-path-number">02</p>
            <h3>Scout</h3>
            <p>
              Describe what you are trying to do. Scout carries the context, compares useful
              options, and brings the right action forward.
            </p>
            <a href={scoutHref}>Open Scout ↗</a>
          </article>
          <article className="ts-path-shared">
            <p className="ts-path-number">Shared context</p>
            <h3>Switch without starting over.</h3>
            <p>
              Requests, businesses, properties, quotes, jobs, and outcomes remain the same record in
              both paths.
            </p>
          </article>
        </div>
      </section>

      <section className="ts-record-layer" aria-labelledby="ts-record-title">
        <div>
          <p className="ts-section-kicker">The useful outcome stays useful</p>
          <h2 id="ts-record-title">The next decision starts with the full story.</h2>
        </div>
        <p>
          Keep the request, selected business, photos, quote, job progress, completed work, and
          recommendation connected. TradeScout turns each real outcome into better context for the
          person, the business, and the next local decision.
        </p>
      </section>

      <section className="ts-final-choice" aria-labelledby="ts-final-title">
        <p className="ts-section-kicker">Start where you are</p>
        <h2 id="ts-final-title">What are you here to do?</h2>
        <div className="ts-final-grid">
          <a href={scoutHref}>
            <span>For people</span>
            <strong>Find an option and decide what happens next.</strong>
            <em>Open Scout ↗</em>
          </a>
          <a href={claimHref}>
            <span>For businesses</span>
            <strong>Show what you offer and receive chosen requests.</strong>
            <em>Claim my business ↗</em>
          </a>
        </div>
      </section>

      <footer className="ts-footer">
        <a className="ts-logo" href="#top" aria-label="Back to top">
          <img
            className="ts-logo-mark"
            src="/tradescout-logo-circle.png?v=10"
            alt=""
            aria-hidden="true"
          />
          <span className="ts-logo-text">TradeScout</span>
        </a>
        <p>Connection Without Compromise</p>
        <nav aria-label="Footer navigation">
          <a href="/how-it-works">How it works</a>
          <a href="/for-businesses">For businesses</a>
          <a href="/direct-connect">Direct Connect</a>
        </nav>
      </footer>
    </main>
  );
}
