import React, { useEffect, useMemo, useState } from "react";
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

function TradeScoutLogo({ backToTop = false }: { backToTop?: boolean }) {
  return (
    <a
      className="ts-logo"
      href={backToTop ? "#top" : "/"}
      aria-label={backToTop ? "Back to top" : "TradeScout home"}
    >
      <span className="ts-logo-initials" aria-hidden="true">
        TS
      </span>
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
      <h3>{card.title}</h3>
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
                <h3>{moment.requester.title}</h3>
                <p>{moment.requester.body}</p>
              </article>
              <article role="cell">
                <span>For the business</span>
                <h3>{moment.business.title}</h3>
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
            <details className="ts-feature-card" key={feature.number}>
              <summary>
                <span className="ts-feature-number">{feature.number}</span>
                <span className="ts-feature-action">{feature.action}</span>
                <strong>{feature.name}</strong>
                <span className="ts-feature-toggle" aria-hidden="true">
                  +
                </span>
              </summary>
              <p>{feature.description}</p>
            </details>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChapterPanel({
  chapter,
  activeTopicId,
  onTopicChange,
}: {
  chapter: ExplainerChapter;
  activeTopicId: string;
  onTopicChange: (topicId: string) => void;
}) {
  const activeTopicIndex = Math.max(
    0,
    chapter.topics.findIndex((topic) => topic.id === activeTopicId)
  );
  const activeTopic = chapter.topics[activeTopicIndex] || chapter.topics[0];

  const moveTopic = (direction: -1 | 1) => {
    const nextIndex =
      (activeTopicIndex + direction + chapter.topics.length) % chapter.topics.length;
    onTopicChange(chapter.topics[nextIndex].id);
  };

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

      <div className="ts-topic-nav" aria-label={`${chapter.navLabel} topics`}>
        <div className="ts-topic-status" aria-live="polite">
          <div>
            <span>{chapter.navLabel} topics</span>
            <strong>{activeTopic.label}</strong>
          </div>
          <em>
            {String(activeTopicIndex + 1).padStart(2, "0")} /{" "}
            {String(chapter.topics.length).padStart(2, "0")}
          </em>
        </div>
        <div className="ts-topic-controls">
          <button type="button" onClick={() => moveTopic(-1)} aria-label="Previous topic">
            ←
          </button>
          <div className="ts-topic-track" role="tablist">
            {chapter.topics.map((topic, index) => (
              <button
                type="button"
                role="tab"
                aria-selected={topic.id === activeTopic.id}
                tabIndex={topic.id === activeTopic.id ? 0 : -1}
                onClick={() => onTopicChange(topic.id)}
                key={topic.id}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                {topic.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => moveTopic(1)} aria-label="Next topic">
            →
          </button>
        </div>
      </div>

      {chapter.topics.map((topic) => (
        <div
          key={topic.id}
          role="tabpanel"
          hidden={topic.id !== activeTopic.id}
          aria-hidden={topic.id !== activeTopic.id}
        >
          <TopicContent topic={topic} />
        </div>
      ))}

      {chapter.boundary ? <aside className="ts-chapter-boundary">{chapter.boundary}</aside> : null}
    </section>
  );
}

function getInitialChapterId() {
  if (typeof window === "undefined") return explainerChapters[0].id;
  const hash = String(window.location?.hash || "").replace(/^#/, "");
  return explainerChapters.some((chapter) => chapter.id === hash) ? hash : explainerChapters[0].id;
}

export default function TradeScoutLandingPage() {
  const [activeChapterId, setActiveChapterId] = useState(getInitialChapterId);
  const [topicByChapter, setTopicByChapter] = useState<Record<string, string>>(() =>
    Object.fromEntries(explainerChapters.map((chapter) => [chapter.id, chapter.topics[0].id]))
  );

  useEffect(() => {
    bootstrapDemandAttribution();
    void trackDemandEvent("landing_view", {
      variant: LANDING_CONVERSION_VARIANT,
      surface: "public_landing",
    });
  }, []);

  useEffect(() => {
    const syncHash = () => {
      const hash = String(window.location.hash || "").replace(/^#/, "");
      if (explainerChapters.some((chapter) => chapter.id === hash)) {
        setActiveChapterId(hash);
      }
    };
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const directConnectHref = withDemandQueryParams(
    `/direct-connect?source=${LANDING_PRIMARY_REQUEST_SOURCE}`
  );
  const scoutHref = withDemandQueryParams("/scout?source=landing_scout");
  const claimHref = withDemandQueryParams("/claim-my-business?source=landing_business");

  const activeChapterIndex = Math.max(
    0,
    explainerChapters.findIndex((chapter) => chapter.id === activeChapterId)
  );
  const activeChapter = explainerChapters[activeChapterIndex] || explainerChapters[0];

  const activeTopicId = useMemo(
    () => topicByChapter[activeChapter.id] || activeChapter.topics[0].id,
    [activeChapter, topicByChapter]
  );

  const trackClick = (cta: string, target: string) => {
    void trackDemandEvent("cta_click", {
      variant: LANDING_CONVERSION_VARIANT,
      surface: "public_landing",
      cta,
      source: LANDING_PRIMARY_REQUEST_SOURCE,
      target,
    });
  };

  const chooseChapter = (chapter: ExplainerChapter) => {
    setActiveChapterId(chapter.id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${chapter.id}`);
    }
  };

  return (
    <main className="ts-landing-shell" id="top">
      <header className="ts-header" aria-label="TradeScout primary header">
        <TradeScoutLogo />
        <span className="ts-header-context">Plain-language system explainer</span>
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
          <p className="ts-kicker">TradeScout for requesters and local businesses</p>
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
          <div className="ts-trust-row" aria-label="TradeScout product rules">
            <span>✓ Payment cannot buy recommendations</span>
            <span>✓ The requester chooses who receives a request</span>
            <span>✓ Both sides choose before contact opens</span>
          </div>
        </div>
      </section>

      <nav className="ts-chapter-nav" aria-label="TradeScout explainer sections">
        <div className="ts-chapter-status">
          <span>Main section</span>
          <strong>
            {activeChapter.number} / {String(explainerChapters.length).padStart(2, "0")} ·{" "}
            {activeChapter.navLabel}
          </strong>
          <small>Choose a section, then a topic.</small>
        </div>
        <div className="ts-chapter-track" role="tablist">
          {explainerChapters.map((chapter) => (
            <button
              type="button"
              role="tab"
              aria-selected={chapter.id === activeChapter.id}
              onClick={() => chooseChapter(chapter)}
              key={chapter.id}
            >
              <span>{chapter.number}</span>
              {chapter.navLabel}
            </button>
          ))}
        </div>
      </nav>

      <div className="ts-explainer-stage">
        {explainerChapters.map((chapter) => (
          <div
            className="ts-chapter-slot"
            hidden={chapter.id !== activeChapter.id}
            aria-hidden={chapter.id !== activeChapter.id}
            key={chapter.id}
          >
            <ChapterPanel
              chapter={chapter}
              activeTopicId={
                chapter.id === activeChapter.id
                  ? activeTopicId
                  : topicByChapter[chapter.id] || chapter.topics[0].id
              }
              onTopicChange={(topicId) =>
                setTopicByChapter((current) => ({ ...current, [chapter.id]: topicId }))
              }
            />
          </div>
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
          <a href="/pricing">Pricing</a>
        </nav>
      </footer>
    </main>
  );
}
