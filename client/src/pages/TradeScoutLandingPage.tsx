import React, { useEffect } from "react";
import {
  bootstrapDemandAttribution,
  trackDemandEvent,
  withDemandQueryParams,
} from "@/lib/demandEngine";
import "./TradeScoutLandingPage.css";

const LANDING_CONVERSION_VARIANT = "locked_public_landing";
const LANDING_PRIMARY_REQUEST_SOURCE = "landing_primary_cta";
const LANDING_PRIMARY_REQUEST_HREF = `/direct-connect?source=${LANDING_PRIMARY_REQUEST_SOURCE}`;

export default function TradeScoutLandingPage() {
  useEffect(() => {
    bootstrapDemandAttribution();
    void trackDemandEvent("landing_view", {
      variant: LANDING_CONVERSION_VARIANT,
      surface: "public_landing",
    });
  }, []);

  const primaryRequestHref = withDemandQueryParams(LANDING_PRIMARY_REQUEST_HREF);
  const trackPrimaryRequestClick = () => {
    void trackDemandEvent("cta_click", {
      variant: LANDING_CONVERSION_VARIANT,
      surface: "public_landing",
      cta: "start_request",
      source: LANDING_PRIMARY_REQUEST_SOURCE,
      target: "/direct-connect",
    });
  };

  return (
    <main className="ts-landing-shell">
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

        <nav className="ts-auth-nav" aria-label="Account navigation">
          <a href="/login">Log In</a>
          <span className="ts-nav-separator" aria-hidden="true">
            |
          </span>
          <a href="/register?role=provider">Claim Provider Profile</a>
        </nav>
      </header>

      <section className="ts-hero" aria-labelledby="ts-hero-title">
        <div className="ts-hero-copy">
          <p className="ts-kicker">Local work, organized before contact.</p>

          <h1 id="ts-hero-title">Connection Without Compromise</h1>

          <p className="ts-hero-subheadline">
            Tell us what you need done — no one gets your phone number until you say so. We organize
            the job and the details first, so you're in control from the first message.
          </p>

          <div className="ts-hero-actions" aria-label="Primary actions">
            <a
              className="ts-button ts-button-primary"
              href={primaryRequestHref}
              onClick={trackPrimaryRequestClick}
            >
              Start a Request
            </a>

            <a className="ts-button ts-button-secondary" href="/community">
              Browse Local Activity
            </a>
          </div>
        </div>
      </section>

      <section className="ts-sequence" aria-labelledby="ts-sequence-title">
        <div className="ts-section-heading">
          <p className="ts-section-kicker">How it works</p>
          <h2 id="ts-sequence-title">Here's exactly what happens when you post a request.</h2>
        </div>

        <div className="ts-step-grid">
          <article className="ts-step-card">
            <div className="ts-step-number" aria-hidden="true">
              1
            </div>
            <h3>Tell us what's going on</h3>
            <p>
              A repair, an install, or just a quote — describe it in your own words, no forms to
              decode.
            </p>
          </article>

          <article className="ts-step-card">
            <div className="ts-step-number" aria-hidden="true">
              2
            </div>
            <h3>Matched using real recommendations</h3>
            <p>
              We connect you with local pros your community already trusts — not the highest bidder
              in a lead auction.
            </p>
          </article>

          <article className="ts-step-card">
            <div className="ts-step-number" aria-hidden="true">
              3
            </div>
            <h3>You choose who reaches out</h3>
            <p>Review the responses and release contact details only when you're ready.</p>
          </article>
        </div>
      </section>

      <section className="ts-record-layer" aria-labelledby="ts-record-title">
        <div>
          <p className="ts-section-kicker">Record layer</p>
          <h2 id="ts-record-title">Everything's saved for next time</h2>
        </div>

        <p>
          Requests, photos, quotes, and finished work stay on your HomeID, so the next job starts
          with the full story already there.
        </p>
      </section>
    </main>
  );
}
