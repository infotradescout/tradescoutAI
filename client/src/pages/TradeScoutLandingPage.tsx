import React from "react";
import "./TradeScoutLandingPage.css";

export default function TradeScoutLandingPage() {
  return (
    <main className="ts-landing-shell">
      <header className="ts-header" aria-label="TradeScout primary header">
        <a className="ts-logo" href="/" aria-label="TradeScout home">
          <span className="ts-logo-mark" aria-hidden="true">
            TS
          </span>
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
            Start a local work request before anyone gets your phone number. TradeScout organizes
            the job, location, and context first — then contact happens only when you decide.
          </p>

          <div className="ts-hero-actions" aria-label="Primary actions">
            <a className="ts-button ts-button-primary" href="/direct-connect">
              Start a Request
            </a>

            <a className="ts-button ts-button-secondary" href="/scout?unlock=exchange">
              Browse Local Activity
            </a>
          </div>
        </div>
      </section>

      <section className="ts-sequence" aria-labelledby="ts-sequence-title">
        <div className="ts-section-heading">
          <p className="ts-section-kicker">How it works</p>
          <h2 id="ts-sequence-title">Simple sequence. Clear control.</h2>
        </div>

        <div className="ts-step-grid">
          <article className="ts-step-card">
            <div className="ts-step-number" aria-hidden="true">
              1
            </div>
            <h3>Describe the work</h3>
            <p>Tell TradeScout what needs fixed, improved, quoted, or checked.</p>
          </article>

          <article className="ts-step-card">
            <div className="ts-step-number" aria-hidden="true">
              2
            </div>
            <h3>Organize by local fit</h3>
            <p>
              Your request is matched to relevant local providers without selling your info as a
              lead.
            </p>
          </article>

          <article className="ts-step-card">
            <div className="ts-step-number" aria-hidden="true">
              3
            </div>
            <h3>Decide before contact</h3>
            <p>You review the path forward before contact details are shared.</p>
          </article>
        </div>
      </section>

      <section className="ts-record-layer" aria-labelledby="ts-record-title">
        <div>
          <p className="ts-section-kicker">Record layer</p>
          <h2 id="ts-record-title">Keep a record as you go</h2>
        </div>

        <p>
          Save requests, documents, updates, and completed work to your HomeID so the next job
          starts with better context.
        </p>
      </section>
    </main>
  );
}
