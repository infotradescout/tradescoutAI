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
            Start a local work request in Direct Connect before anyone gets your phone number.
            TradeScout organizes the job, location, and context first — then contact happens only
            when you decide.
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
          <h2 id="ts-sequence-title">One request. Zero spam. Full control.</h2>
        </div>

        <div className="ts-step-grid">
          <article className="ts-step-card">
            <div className="ts-step-number" aria-hidden="true">
              1
            </div>
            <h3>Post what you need</h3>
            <p>Fix, install, quote, or inspect — describe the job in under a minute.</p>
          </article>

          <article className="ts-step-card">
            <div className="ts-step-number" aria-hidden="true">
              2
            </div>
            <h3>Matched to local pros</h3>
            <p>
              We route your request to relevant local providers — your info is never sold as a lead.
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
          <h2 id="ts-record-title">Every job remembers itself</h2>
        </div>

        <p>
          Requests, photos, quotes, and completed work all save to your HomeID — so the next pro
          starts with context, not a blank page.
        </p>
      </section>
    </main>
  );
}
