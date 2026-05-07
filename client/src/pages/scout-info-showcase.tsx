import { memo, useState, type ComponentType } from "react";
import { Link } from "wouter";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertCircle,
  ArrowRight,
  BadgeInfo,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Database,
  Gauge,
  Layers3,
  MapPinned,
  Route,
  TrendingUp,
  Users,
} from "lucide-react";

type IconType = ComponentType<{ className?: string }>;

type FeatureCard = {
  id: string;
  icon: IconType;
  title: string;
  subtitle: string;
  summary: string;
  details: string[];
  example: string;
  techNote: string;
  tone: string;
};

type MissionStep = {
  num: string;
  title: string;
  description: string;
};

type AudienceCard = {
  icon: IconType;
  title: string;
  description: string;
  tone: string;
};

const featureCards: FeatureCard[] = [
  {
    id: "trend-engine",
    icon: TrendingUp,
    title: "Trend Engine",
    subtitle: "Scout 2.0 - Predictive market intelligence",
    summary:
      "Scout tracks how prices, codes, and market conditions move over time so you can see direction, not just a snapshot.",
    details: [
      "Scout stores each finding with a timestamp and compares it to earlier findings on the same topic.",
      "Direction is surfaced as rising, falling, or stable so the pattern is obvious at a glance.",
      "Trend signals are attached to relevant answers for materials, permits, labor, and market activity.",
      "The point is motion that helps you act sooner, not a wall of raw history.",
    ],
    example:
      "You ask Scout about lumber pricing. It returns today's number and shows it is up 11% over the last 30 days, so you lock in a supplier quote before the next bump.",
    techNote:
      "trend: rising\nwindow: 30 days\nevidence: 3 matching sources\noutput: price direction + next step",
    tone: "bg-ts-orange/10 text-ts-orange",
  },
  {
    id: "synthesis-2",
    icon: Layers3,
    title: "Synthesis 2.0",
    subtitle: "Scout 2.0 - Multi-source conflict reconciliation",
    summary:
      "Scout checks multiple sources at once, then resolves disagreements by trust order instead of blending conflicting data together.",
    details: [
      "Scout queries the knowledge base first, then county data, then live web context.",
      "When sources agree, the confidence score rises; when they conflict, Scout shows the discrepancy.",
      "The evidence trail stays visible so operators can verify the source path later.",
      "Synthesis is about one clear answer with context, not a pile of contradictory snippets.",
    ],
    example:
      "Scout checks permit fees from three sources. Two agree on $450 and one outlier says $620, so Scout returns $450 and notes which source disagreed.",
    techNote:
      "source order:\n1. knowledge base\n2. county data\n3. live web\nconflicts: surfaced, not blended",
    tone: "bg-emerald-500/10 text-emerald-200",
  },
  {
    id: "lisa-routing",
    icon: Route,
    title: "LISA Routing",
    subtitle: "Scout 2.0 - Context-aware delivery",
    summary:
      "LISA tags each finding with the right metadata and routes it to the right surface without breaking the gated contact path.",
    details: [
      "Scout turns findings into LisaFeedItem objects with scope references, confidence, and audience tags.",
      "Routing stays context-aware, so the same finding can land differently for an admin, estimator, or county team.",
      "Visibility never equals access; action still flows through Intent -> Decision Card -> Contact.",
      "The route is explicit so teams can see why an item was sent where it was sent.",
    ],
    example:
      "A pricing finding on an active bid is routed to the estimator's workflow, while the same intelligence in a county ops context stays in the county surface.",
    techNote:
      "kind: scout_intelligence\nscope: county + trade\npriority: mapped from confidence\nroute: LISA-ready",
    tone: "bg-sky-500/10 text-sky-200",
  },
  {
    id: "scout-vault",
    icon: Database,
    title: "Scout Vault",
    subtitle: "Scout 2.0 - Immutable intelligence history",
    summary:
      "Scout Vault keeps a permanent record of what Scout knew, when it knew it, and how the answer was assembled.",
    details: [
      "Every question, answer, source, and confidence score is timestamped for later reference.",
      "Historical records are searchable for bids, disputes, audits, and follow-up missions.",
      "Vault entries preserve the state of intelligence at the moment the mission ran.",
      "That makes trend comparison and evidence review cheap instead of tedious.",
    ],
    example:
      "A contractor pulls a Vault record from the day a bid was submitted and uses the timestamped price trail to settle a cost dispute.",
    techNote:
      "evidence hash: stored\nttl: cleanup job removes stale items\npurpose: audit trail + replay",
    tone: "bg-blue-500/10 text-blue-200",
  },
  {
    id: "county-intelligence",
    icon: MapPinned,
    title: "County Intelligence",
    subtitle: "Facts stay inside county containers",
    summary:
      "Scout writes operational facts into the county containers so the system stays consistent and precomputed for the UI.",
    details: [
      "Facts go to county_metrics, assignments go to county_entities, and human context goes to county_notes.",
      "Counties remain the operational container instead of becoming ad hoc fields scattered across the app.",
      "Admin and UI surfaces read precomputed intelligence by default.",
      "That keeps routing stable and county-level views predictable.",
    ],
    example:
      "A county permit update is stored once in the right county containers, then reused by admin views, heatmap views, and downstream routing.",
    techNote:
      "county_metrics = facts\ncounty_entities = assignments\ncounty_notes = context\nread path: precomputed first",
    tone: "bg-blue-500/10 text-blue-200",
  },
  {
    id: "visual-command-center",
    icon: BarChart3,
    title: "Visual Scouting Command Center",
    subtitle: "County heatmap, browser, and file tray",
    summary:
      "Scout turns geography into a working surface so ops can sort county intelligence, files, and contractors without leaving the map view.",
    details: [
      "The regional browser surfaces county-specific findings and related files in one place.",
      "The heatmap layer makes clustering and county coverage easier to read.",
      "A draggable data tray helps organize files and assign them to counties quickly.",
      "The goal is faster spatial sorting, not another dashboard to babysit.",
    ],
    example:
      "An admin drags a file into the Travis County tray, sees related findings light up on the heatmap, and keeps moving without a manual filing detour.",
    techNote: "browser + heatmap + tray\ncounty-specific sort\nspatial intelligence first",
    tone: "bg-amber-500/10 text-amber-200",
  },
  {
    id: "cost-optimization",
    icon: Gauge,
    title: "Cost Optimization",
    subtitle: "Lean enough to repeat the same mission",
    summary:
      "Scout reduces repeated spend with caching, dedupe, routing shortcuts, and token trimming before the model runs.",
    details: [
      "Response caching serves repeated questions from memory when the answer has not changed.",
      "Query routing skips LLM work for obvious FAQ-style requests.",
      "Request deduplication prevents in-flight duplicates from getting charged twice.",
      "Prompt compression trims the payload so the model gets only the useful context.",
    ],
    example:
      "A team asks the same county-fee question three times in a day and Scout serves the cached answer instead of paying for the same work three times.",
    techNote: "cache -> route -> dedupe -> compress\nrepeat missions stay lean",
    tone: "bg-lime-500/10 text-lime-200",
  },
  {
    id: "no-fake-data",
    icon: AlertCircle,
    title: "No Fake Data",
    subtitle: "Missing information stays missing",
    summary:
      "If the knowledge base has not indexed something yet, Scout says not yet indexed instead of inventing a placeholder.",
    details: [
      "Scout does not make up prices, rules, or citations to fill a gap.",
      "Missing knowledge stays explicit so operators know when to verify manually.",
      "The no-fake-data rule keeps the trail honest for county, code, and pricing work.",
      "The system prefers a clear gap over a confident hallucination.",
    ],
    example:
      "A user asks for a fee schedule the knowledge base has not indexed yet. Scout says not yet indexed and points to the missing source rather than guessing.",
    techNote: "status: not yet indexed\nrule: don't invent placeholders\nwatchdog: surface the gap",
    tone: "bg-rose-500/10 text-rose-200",
  },
];

const missionSteps: MissionStep[] = [
  {
    num: "1",
    title: "Mission Trigger",
    description: "A user, admin, or scheduled job starts a scouting mission.",
  },
  {
    num: "2",
    title: "Multi-Source Gathering",
    description: "Scout checks the knowledge base first, then county data, then live web context.",
  },
  {
    num: "3",
    title: "Synthesis",
    description: "Conflicts are resolved by source priority and the evidence trail stays visible.",
  },
  {
    num: "4",
    title: "Optimization",
    description: "Caching, dedupe, and token compression keep repeated requests lean.",
  },
  {
    num: "5",
    title: "LISA Conversion",
    description: "Scout turns findings into the exact shape LISA expects to consume.",
  },
  {
    num: "6",
    title: "Persistence and Routing",
    description: "Scout stores the results and sends them to the right county and UI surfaces.",
  },
];

const audienceCards: AudienceCard[] = [
  {
    icon: Users,
    title: "Contractors",
    description:
      "Check codes, prices, and market shifts before you quote, schedule, or buy material.",
    tone: "text-ts-orange",
  },
  {
    icon: MapPinned,
    title: "County teams",
    description:
      "Work from precomputed county intelligence instead of rebuilding it every time someone asks.",
    tone: "text-blue-200",
  },
  {
    icon: Database,
    title: "Admin operators",
    description:
      "Run missions, review the source trail, and keep the intelligence pipeline healthy.",
    tone: "text-amber-200",
  },
  {
    icon: BarChart3,
    title: "Support leads",
    description:
      "Answer with confidence, route the right next step, and keep a clean record of what happened.",
    tone: "text-emerald-200",
  },
];

const missionSnapshot = [
  {
    label: "Cache hits",
    value: "Fast repeats",
  },
  {
    label: "Deduped requests",
    value: "No double charge",
  },
  {
    label: "Prompt compression",
    value: "Less token waste",
  },
  {
    label: "County writeback",
    value: "Facts land in containers",
  },
];

type HeroTruthLayer = {
  label: string;
  description: string;
  rank: string;
  width: string;
  tone: string;
  icon: IconType;
};

type HeroOutputBlock = {
  label: string;
  description: string;
};

const heroTruthLayers: HeroTruthLayer[] = [
  {
    label: "TradeScout Knowledge Base",
    description: "Highest-trust indexed facts. Scout starts here and keeps the trail visible.",
    rank: "01",
    width: "96%",
    tone: "bg-ts-orange/10 text-ts-orange",
    icon: Database,
  },
  {
    label: "Local County Data",
    description: "Overrides general web data inside county containers and local write paths.",
    rank: "02",
    width: "84%",
    tone: "bg-emerald-500/10 text-emerald-200",
    icon: MapPinned,
  },
  {
    label: "Live Web Context",
    description:
      "Used for current market context and the gaps the knowledge base has not indexed yet.",
    rank: "03",
    width: "68%",
    tone: "bg-sky-500/10 text-sky-200",
    icon: Route,
  },
];

const heroOutputBlocks: HeroOutputBlock[] = [
  {
    label: "What",
    description: "One clear answer with the county scope attached.",
  },
  {
    label: "Why",
    description: "Evidence path, source order, and confidence stay visible.",
  },
  {
    label: "What to do",
    description: "Open the right next step instead of guessing.",
  },
];

const heroSignals = [
  {
    label: "Cache + dedupe",
    value: "Lean repeat runs",
  },
  {
    label: "County writeback",
    value: "Precomputed facts",
  },
  {
    label: "Confidence",
    value: "Honest only",
  },
  {
    label: "Contact gate",
    value: "Intent first",
  },
];

const ScoutInfoShowcase = memo(function ScoutInfoShowcase() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (id: string) => {
    setExpanded((prev) => (prev === id ? null : id));
  };

  return (
    <div className="font-body text-white">
      <SEOHelmet
        title="Scout 2.0 Showcase | TradeScout"
        description="See how Scout gathers knowledge base, county data, and live web context, then turns the findings into LISA-ready intelligence."
        canonical="https://www.thetradescout.com/help/scout"
      />

      <section className="relative overflow-hidden py-16 md:py-20">
        <div className="ts-grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
        <div
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ts-orange/45 to-transparent"
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-ts-orange/30 bg-ts-orange/10 px-3 py-1.5 text-xs font-semibold text-ts-orange">
              <BadgeInfo className="h-3.5 w-3.5" />
              Scout 2.0 Showcase
            </div>

            <h1 className="mt-5 text-hero">Scout 2.0</h1>

            <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-[color:var(--text-secondary)] md:text-xl">
              TradeScout&apos;s guided intelligence engine. Scout actively gathers building codes,
              material prices, and market conditions, then turns the result into structured findings
              for LISA and the county containers. Discovery never bypasses the{" "}
              {"Intent -> Decision Card -> Contact"} path.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild className="bg-ts-orange text-white hover:bg-ts-orange-dark">
                <Link href="/scout">
                  Open Scout
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-[color:var(--border-primary)] bg-[color:var(--surface-intermediate)] text-white hover:bg-[color:var(--surface-card)]"
                onClick={() => {
                  document.getElementById("workflow")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
              >
                View workflow
                <BadgeInfo className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {[
                "Knowledge base first",
                "County data overrides web",
                "LISA-ready output",
                "No fake data",
              ].map((label) => (
                <span key={label} className="ts-badge-category">
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-12 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[20px] border border-[color:var(--border-primary)] bg-[color:var(--surface-card)] p-5 shadow-[var(--surface-card-shadow)] md:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="ts-section-label">Truth stack</p>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-[color:var(--text-secondary)]">
                    Scout resolves conflicts by source priority, so the answer stays honest even
                    when the web disagrees with county data.
                  </p>
                </div>
                <span className="ts-badge-new">Highest trust first</span>
              </div>

              <div className="mt-5 space-y-3">
                {heroTruthLayers.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.label}
                      className="rounded-xl border border-[color:var(--border-primary)] bg-[color:var(--surface-intermediate)] p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.tone}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="text-sm font-semibold text-white">{item.label}</h3>
                            <span className="font-mono text-[11px] text-[color:var(--text-secondary)]">
                              {item.rank}
                            </span>
                          </div>
                          <p className="mt-1 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                            {item.description}
                          </p>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/40">
                            <div
                              className={`h-full rounded-full ${item.tone}`}
                              style={{ width: item.width }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[20px] border border-[color:var(--border-primary)] bg-[color:var(--surface-card)] p-5 shadow-[var(--surface-card-shadow)] md:p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="ts-section-label">LISA handoff</p>
                  <span className="ts-badge-new">Exact shape</span>
                </div>

                <div className="mt-4 space-y-3">
                  {heroOutputBlocks.map((block) => (
                    <div
                      key={block.label}
                      className="rounded-xl border border-[color:var(--border-primary)] bg-[color:var(--surface-intermediate)] p-4"
                    >
                      <p className="text-sm font-semibold text-white">{block.label}</p>
                      <p className="mt-1 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                        {block.description}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 ts-tech-note">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-ts-orange">
                    Sample payload
                  </div>
                  <pre className="mt-2 whitespace-pre-wrap text-[12px] leading-6 text-[color:var(--text-secondary)]">
                    {`kind: scout_intelligence
scope: 48453 / trade:electrical
confidence: high
nextStep: Open Decision Card`}
                  </pre>
                </div>
              </div>

              <div className="rounded-[20px] border border-[color:var(--border-primary)] bg-[color:var(--surface-card)] p-5 shadow-[var(--surface-card-shadow)] md:p-6">
                <p className="ts-section-label">Operational signals</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {heroSignals.map((signal) => (
                    <div
                      key={signal.label}
                      className="rounded-xl border border-[color:var(--border-primary)] bg-[color:var(--surface-intermediate)] p-4"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                        {signal.label}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">{signal.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-[color:var(--border-primary)] bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">Not yet indexed stays honest</p>
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                    When Scout does not have the answer yet, it says so plainly and keeps the county
                    and contact rules intact.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Trust order", value: "Knowledge base first" },
              { label: "County writes", value: "Precomputed facts" },
              { label: "Cost control", value: "Cache + dedupe" },
              { label: "Contact gate", value: "Intent -> Decision Card -> Contact" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-[color:var(--border-primary)] bg-[color:var(--surface-intermediate)] p-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                  {item.label}
                </p>
                <p className="mt-2 text-sm font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[color:var(--border-subtle)] py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="ts-section-label">What Scout does</p>
            <h2 className="mt-4 font-display text-3xl font-bold md:text-4xl">
              One mission, one truth order, one output path.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[color:var(--text-secondary)] md:text-base">
              Scout is not a generic chat surface. It is an intelligence engine built to gather,
              reconcile, compress, and route the exact data TradeScout needs.
            </p>
          </div>

          <div className="mt-10 space-y-3">
            {featureCards.map((feature) => {
              const Icon = feature.icon;
              const isOpen = expanded === feature.id;

              return (
                <div key={feature.id} className={`ts-feature-card ${isOpen ? "active" : ""}`}>
                  <button
                    type="button"
                    onClick={() => toggle(feature.id)}
                    className="flex w-full items-center gap-4 px-6 py-5 text-left"
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ${
                        isOpen ? "bg-ts-orange text-white" : "bg-ts-orange/10 text-ts-orange"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-white">{feature.title}</p>
                      <p className="text-sm text-white/65">{feature.subtitle}</p>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="h-5 w-5 flex-shrink-0 text-ts-orange" />
                    ) : (
                      <ChevronDown className="h-5 w-5 flex-shrink-0 text-white/55" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="grid gap-5 border-t border-[color:var(--border-primary)] px-6 pb-6 pt-5 lg:grid-cols-[1.15fr_0.85fr]">
                      <div className="space-y-5">
                        <p className="leading-relaxed text-[color:var(--text-secondary)]">
                          {feature.summary}
                        </p>

                        <div>
                          <p className="mb-3 ts-section-label">How it works</p>
                          <ul className="space-y-2">
                            {feature.details.map((detail) => (
                              <li
                                key={detail}
                                className="flex items-start gap-3 text-sm leading-relaxed text-[color:var(--text-secondary)]"
                              >
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ts-orange" />
                                {detail}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="ts-example-block">
                          <p className="mb-2 ts-section-label">Real example</p>
                          <p className="text-sm leading-relaxed text-[color:var(--text-secondary)]">
                            {feature.example}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="ts-section-label">Evidence note</p>
                        <div className="ts-tech-note whitespace-pre-wrap">{feature.techNote}</div>
                        <div className="rounded-xl border border-[color:var(--border-primary)] bg-[color:var(--surface-intermediate)] p-4">
                          <p className="text-sm font-semibold text-white">Routing rule</p>
                          <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                            Scout keeps the answer inside the right county, trust, and contact
                            boundary before it routes anything outward.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="workflow"
        className="border-t border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] py-20"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <p className="ts-section-label">How a mission runs</p>
              <h2 className="mt-4 font-display text-3xl font-bold md:text-4xl">How Scout Works</h2>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[color:var(--text-secondary)] md:text-base">
                The sequence stays stable so the output is predictable, auditable, and cheap enough
                to repeat when the same question comes up again.
              </p>

              <div className="mt-10 space-y-5">
                {missionSteps.map((step) => (
                  <div key={step.title} className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[color:var(--border-primary)] bg-[color:var(--surface-card)] text-sm font-semibold text-ts-orange">
                      {step.num}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Card className="p-5 md:p-6">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-ts-orange" />
                <span className="text-sm font-semibold text-white">Mission snapshot</span>
              </div>

              <div className="mt-5 space-y-3">
                {missionSnapshot.map((row, index) => (
                  <div
                    key={row.label}
                    className={`rounded-lg border border-[color:var(--border-primary)] bg-[color:var(--surface-intermediate)] p-4 ${
                      index === 0 ? "border-ts-orange/25" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium text-[color:var(--text-secondary)]">
                        {row.label}
                      </span>
                      <span className="text-sm font-semibold text-white">{row.value}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-lg border border-[color:var(--border-primary)] bg-[color:var(--surface-card)] p-4">
                <p className="text-sm font-semibold text-white">Built to stay honest</p>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                  Scout keeps the source trail visible so teams can see where a finding came from
                  and why it won.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="border-t border-[color:var(--border-subtle)] py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="ts-section-label">Scout is for everyone</p>
            <h2 className="mt-4 font-display text-3xl font-bold md:text-4xl">
              Scout is for the people who need one clear next step.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {audienceCards.map((audience) => {
              const Icon = audience.icon;

              return (
                <Card
                  key={audience.title}
                  className="h-full p-5 transition-colors hover:border-ts-orange/30"
                >
                  <div
                    className={`inline-flex rounded-lg bg-[color:var(--surface-intermediate)] p-2 ${audience.tone}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-white">{audience.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                    {audience.description}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-[color:var(--border-subtle)] py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Card className="border-ts-orange/20 p-6 md:p-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <h2 className="font-display text-3xl font-bold md:text-4xl">
                  Ready to open Scout?
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[color:var(--text-secondary)] md:text-base">
                  Use the live engine when you want active intelligence. Use the help path when you
                  want a guided explanation of TradeScout&apos;s flow.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                <Button asChild className="bg-ts-orange text-white hover:bg-ts-orange-dark">
                  <Link href="/scout">
                    Open Scout
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-[color:var(--border-primary)] bg-[color:var(--surface-intermediate)] text-white hover:bg-[color:var(--surface-card)]"
                >
                  <Link href="/help/how-tradescout-works">
                    How TradeScout works
                    <BadgeInfo className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
});

export default ScoutInfoShowcase;
