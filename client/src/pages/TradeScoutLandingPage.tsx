import React, { useEffect } from "react";
import {
  bootstrapDemandAttribution,
  trackDemandEvent,
  withDemandQueryParams,
} from "@/lib/demandEngine";
import {
  explainerChapters,
  type ExplainerCard,
  type ExplainerChapter,
  type ExplainerTopic,
} from "./tradescoutExplainerData";
import "./TradeScoutLandingPage.css";

const LANDING_CONVERSION_VARIANT = "hybrid_public_landing";
const LANDING_PRIMARY_REQUEST_SOURCE = "landing_primary_cta";
const EXPLAINER_TOPIC_COUNT = explainerChapters.reduce(
  (total, chapter) => total + chapter.topics.length,
  0
);
const EXPLAINER_FEATURE_COUNT = explainerChapters.reduce(
  (total, chapter) =>
    total +
    chapter.topics.reduce((chapterTotal, topic) => chapterTotal + (topic.features?.length || 0), 0),
  0
);

function scrollToExplainerAnchor(targetId: string) {
  const target = document.getElementById(targetId);
  if (!target) return;

  const scrollRoot = [document.scrollingElement, document.body].find(
    (surface): surface is HTMLElement =>
      surface instanceof HTMLElement && surface.scrollHeight > surface.clientHeight + 1
  );
  if (!scrollRoot) {
    target.scrollIntoView({ block: "start", behavior: "auto" });
    return;
  }

  const scrollMarginTop = Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
  const nextScrollTop = scrollRoot.scrollTop + target.getBoundingClientRect().top - scrollMarginTop;
  scrollRoot.scrollTop = Math.max(0, nextScrollTop);
}

function navigateToExplainerAnchor(event: React.MouseEvent<HTMLAnchorElement>, targetId: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return;

  event.preventDefault();
  const nextHash = `#${encodeURIComponent(targetId)}`;
  if (window.location.hash !== nextHash) {
    window.history.pushState(null, "", nextHash);
  }
  scrollToExplainerAnchor(targetId);
}

function TradeScoutLogo({ backToTop = false }: { backToTop?: boolean }) {
  return (
    <a
      className="ts-logo"
      href={backToTop ? "#top" : "/"}
      aria-label={backToTop ? "Back to top" : "TradeScout home"}
      onClick={backToTop ? (event) => navigateToExplainerAnchor(event, "top") : undefined}
    >
      <img
        className="ts-logo-mark"
        src="/tradescout-logo-circle.png?v=13"
        alt="TradeScout"
        width={40}
        height={40}
        decoding="async"
        fetchPriority="high"
      />
      <span className="ts-logo-word">
        Trade<strong>Scout</strong>
      </span>
    </a>
  );
}

function ContentCard({ card }: { card: ExplainerCard }) {
  const tone = card.tone ? ` ts-explainer-card-${card.tone}` : "";
  return (
    <article className={`ts-explainer-card${tone}`}>
      {card.eyebrow ? <span className="ts-card-eyebrow">{card.eyebrow}</span> : null}
      <h4>{card.title}</h4>
      {card.body ? <p>{card.body}</p> : null}
      {card.bullets?.length ? (
        <ul>
          {card.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
      {card.chips?.length ? (
        <div className="ts-card-chips" aria-label="Key conditions">
          {card.chips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function TopicContent({ topic }: { topic: ExplainerTopic }) {
  return (
    <div className="ts-topic-content">
      {topic.intro ? (
        <div className="ts-topic-intro">
          <ContentCard card={{ ...topic.intro, tone: topic.intro.tone || "accent" }} />
        </div>
      ) : null}

      {topic.moments?.length ? (
        <div className="ts-moment-list" role="table" aria-label={`${topic.label} benefits`}>
          {topic.moments.map((moment) => (
            <div className="ts-moment-row" role="row" key={moment.number}>
              <div className="ts-moment-label" role="rowheader">
                <span>{moment.number}</span>
                <strong>{moment.title}</strong>
              </div>
              <article role="cell">
                <span>For the requester</span>
                <h4>{moment.requester.title}</h4>
                <p>{moment.requester.body}</p>
              </article>
              <article role="cell">
                <span>For the business</span>
                <h4>{moment.business.title}</h4>
                <p>{moment.business.body}</p>
              </article>
            </div>
          ))}
        </div>
      ) : null}

      {topic.cards?.length ? (
        <div className="ts-explainer-card-grid">
          {topic.cards.map((card, index) => (
            <ContentCard card={card} key={`${card.title}-${index}`} />
          ))}
        </div>
      ) : null}

      {topic.features?.length ? (
        <div className="ts-feature-grid">
          {topic.features.map((feature) => (
            <article className="ts-feature-card" key={feature.number}>
              <div className="ts-feature-card-heading">
                <span className="ts-feature-number">{feature.number}</span>
                <span className="ts-feature-action">{feature.action}</span>
                <h4>{feature.name}</h4>
              </div>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChapterPanel({ chapter }: { chapter: ExplainerChapter }) {
  return (
    <section
      className="ts-explainer-chapter"
      id={chapter.id}
      aria-labelledby={`${chapter.id}-title`}
    >
      <div className="ts-chapter-heading">
        <div>
          <span className="ts-section-kicker">{chapter.kicker}</span>
          <h2 id={`${chapter.id}-title`}>{chapter.title}</h2>
        </div>
        {chapter.description ? <p>{chapter.description}</p> : null}
      </div>

      <nav className="ts-topic-index" aria-label={`${chapter.navLabel} topics`}>
        <span>{String(chapter.topics.length).padStart(2, "0")} topics in this chapter</span>
        <div>
          {chapter.topics.map((topic, index) => (
            <a
              href={`#${chapter.id}-${topic.id}`}
              key={topic.id}
              onClick={(event) => navigateToExplainerAnchor(event, `${chapter.id}-${topic.id}`)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {topic.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="ts-topic-list">
        {chapter.topics.map((topic, topicIndex) => (
          <section
            className="ts-topic-section"
            id={`${chapter.id}-${topic.id}`}
            aria-labelledby={`${chapter.id}-${topic.id}-title`}
            key={topic.id}
          >
            <header className="ts-topic-heading">
              <span>
                Topic {String(topicIndex + 1).padStart(2, "0")} /{" "}
                {String(chapter.topics.length).padStart(2, "0")}
              </span>
              <h3 id={`${chapter.id}-${topic.id}-title`}>{topic.label}</h3>
            </header>
            <TopicContent topic={topic} />
          </section>
        ))}
      </div>

      {chapter.boundary ? <aside className="ts-chapter-boundary">{chapter.boundary}</aside> : null}
    </section>
  );
}

export default function TradeScoutLandingPage() {
  useEffect(() => {
    bootstrapDemandAttribution();
    void trackDemandEvent("landing_view", {
      variant: LANDING_CONVERSION_VARIANT,
      surface: "public_landing",
    });
  }, []);

  useEffect(() => {
    const scrollSurfaces = [
      document.documentElement,
      document.body,
      document.getElementById("root"),
      document.getElementById("top"),
    ].filter((surface): surface is HTMLElement => Boolean(surface));
    const previousScrollBehaviors = scrollSurfaces.map((surface) => surface.style.scrollBehavior);
    scrollSurfaces.forEach((surface) => {
      surface.style.scrollBehavior = "auto";
    });

    const scrollToCurrentAnchor = () => {
      const encodedId = String(window.location.hash || "").replace(/^#/, "");
      if (!encodedId) return;

      let targetId = encodedId;
      try {
        targetId = decodeURIComponent(encodedId);
      } catch {
        // Keep the literal hash when it is not valid URI encoding.
      }

      const scrollToTarget = () => scrollToExplainerAnchor(targetId);

      window.requestAnimationFrame(scrollToTarget);
      void document.fonts.ready.then(() => {
        window.requestAnimationFrame(scrollToTarget);
      });
    };

    scrollToCurrentAnchor();
    window.addEventListener("hashchange", scrollToCurrentAnchor);
    window.addEventListener("popstate", scrollToCurrentAnchor);
    return () => {
      window.removeEventListener("hashchange", scrollToCurrentAnchor);
      window.removeEventListener("popstate", scrollToCurrentAnchor);
      scrollSurfaces.forEach((surface, index) => {
        surface.style.scrollBehavior = previousScrollBehaviors[index];
      });
    };
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
        <TradeScoutLogo />
        <nav className="ts-primary-nav" aria-label="Landing page actions">
          <a href="/login">Log in</a>
          <a
            className="ts-nav-request"
            href={directConnectHref}
            onClick={() => trackClick("make_a_request", "/direct-connect")}
          >
            Make A Request
          </a>
        </nav>
      </header>

      <section className="ts-hero" aria-labelledby="ts-hero-title">
        <div className="ts-hero-copy">
          <h1 id="ts-hero-title">Connection Without Compromise.</h1>
          <p className="ts-hero-declaration">Local recommendations should lead somewhere.</p>
          <p className="ts-hero-subheadline">
            Recommendations drive TradeScout. Local experience helps a requester choose, send one
            protected request, connect only after both sides agree, and record the outcome for the
            next requester—without selling the lead, ranking, trust, or contact information.
          </p>
          <div className="ts-hero-actions" aria-label="Primary actions">
            <a
              className="ts-button ts-button-primary"
              href={directConnectHref}
              onClick={() => trackClick("make_a_request", "/direct-connect")}
            >
              Make A Request
            </a>
            <a
              className="ts-button ts-button-secondary"
              href={scoutHref}
              onClick={() => trackClick("open_scout", "/scout")}
            >
              Open Scout ↗
            </a>
          </div>
        </div>
      </section>

      <nav className="ts-chapter-nav" aria-label="TradeScout explainer sections">
        <div className="ts-chapter-status">
          <span>Full explainer</span>
          <strong>
            {String(explainerChapters.length).padStart(2, "0")} chapters · {EXPLAINER_TOPIC_COUNT}{" "}
            topics · {EXPLAINER_FEATURE_COUNT} features
          </strong>
          <small>Everything is on this page. Read through or jump to a chapter.</small>
        </div>
        <div className="ts-chapter-track">
          {explainerChapters.map((chapter) => (
            <a
              href={`#${chapter.id}`}
              key={chapter.id}
              onClick={(event) => navigateToExplainerAnchor(event, chapter.id)}
            >
              <span>{chapter.number}</span>
              {chapter.navLabel}
            </a>
          ))}
        </div>
      </nav>

      <div className="ts-explainer-stage">
        {explainerChapters.map((chapter) => (
          <ChapterPanel chapter={chapter} key={chapter.id} />
        ))}
      </div>

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
            <li>Sponsored offers stay separate from earned trust.</li>
          </ul>
          <a href="/pricing#how-tradescout-earns">See how we earn revenue here</a>
        </div>
      </section>

      <section className="ts-final-choice" aria-labelledby="ts-final-title">
        <p className="ts-section-kicker">Use TradeScout now</p>
        <h2 id="ts-final-title">Start with the real reason you came.</h2>
        <div className="ts-final-grid">
          <a
            className="ts-final-request"
            href={directConnectHref}
            onClick={() => trackClick("make_a_request", "/direct-connect")}
          >
            <span>I know what I need</span>
            <strong>Prepare one protected request and choose who sees it.</strong>
            <em>Make A Request ↗</em>
          </a>
          <a href={scoutHref} onClick={() => trackClick("open_scout_final", "/scout")}>
            <span>I need a clear next step</span>
            <strong>Use Scout to understand the need and compare the paths.</strong>
            <em>Open Scout ↗</em>
          </a>
          <a href={claimHref} onClick={() => trackClick("claim_business", "/claim-my-business")}>
            <span>I run a business</span>
            <strong>Claim the business home people can actually use.</strong>
            <em>Claim my business ↗</em>
          </a>
        </div>
      </section>

      <footer className="ts-footer">
        <TradeScoutLogo backToTop />
        <p>Connection Without Compromise</p>
        <nav aria-label="Footer navigation">
          <a href={directConnectHref}>Direct Connect</a>
          <a href="/community-feed">Open Community</a>
          <a href="/find-local-businesses">Businesses</a>
          <a href="/trade">Trades</a>
          <a href="/pricing">Pricing</a>
        </nav>
      </footer>
    </main>
  );
}
