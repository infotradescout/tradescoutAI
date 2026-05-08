import { memo, useState, type ComponentType } from "react";
import { Link } from "wouter";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Database,
  FileSearch,
  Gauge,
  Layers3,
  LockKeyhole,
  MapPinned,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Button } from "@/components/ui/button";

type IconType = ComponentType<{ className?: string }>;

type WorkspaceTab = "scout" | "community" | "learn" | "outcomes";

const navItems: Array<{ id: WorkspaceTab; label: string; icon: IconType }> = [
  { id: "scout", label: "Scout", icon: FileSearch },
  { id: "community", label: "Community", icon: Users },
  { id: "learn", label: "Learn", icon: TrendingUp },
  { id: "outcomes", label: "Outcomes", icon: ClipboardList },
];

const commandSources = [
  {
    label: "Knowledge Base",
    detail: "TradeScout Brain match",
    rank: "01",
    confidence: "high",
    icon: Database,
    bar: "w-[94%]",
  },
  {
    label: "County Data",
    detail: "48453 local container",
    rank: "02",
    confidence: "medium",
    icon: MapPinned,
    bar: "w-[78%]",
  },
  {
    label: "Live Web",
    detail: "market context only",
    rank: "03",
    confidence: "low",
    icon: Search,
    bar: "w-[56%]",
  },
];

const routingTags = [
  "kind: scout_intelligence",
  "scope: 48453",
  "trade: electrical",
  "priority: high",
];

const trendBars = ["h-[36%]", "h-[48%]", "h-[42%]", "h-[58%]", "h-[67%]", "h-[76%]", "h-[84%]"];

const missionSteps = [
  {
    title: "Mission Trigger",
    description: "A user, admin, or scheduled job starts a scouting mission.",
  },
  {
    title: "Multi-Source Gathering",
    description: "Scout checks the knowledge base first, county data second, and live web third.",
  },
  {
    title: "Synthesis",
    description: "Conflicts are resolved by truth order and the evidence path stays visible.",
  },
  {
    title: "Optimization",
    description: "Caching, request dedupe, and prompt compression reduce repeated spend.",
  },
  {
    title: "Decision Routing",
    description:
      "Findings become decision-ready findings with priority, scope, and next-step context.",
  },
  {
    title: "Persistence and Routing",
    description: "Scout stores the finding and routes it through the correct UI surfaces.",
  },
];

const capabilityPanels = [
  {
    title: "Trend Engine",
    icon: TrendingUp,
    kicker: "Predictive market intelligence",
    body: "Scout compares timestamped findings so pricing, permit timelines, and market signals show direction instead of just a static answer.",
    evidence: "window: 30 days\ntrend: rising\nevidence: 3 matching sources",
  },
  {
    title: "Synthesis 2.0",
    icon: Layers3,
    kicker: "Multi-source conflict reconciliation",
    body: "Scout resolves disagreements by source priority: TradeScout Knowledge Base, then local county data, then live web context.",
    evidence: "Truth stack\n1. knowledge base\n2. local data\n3. live web",
  },
  {
    title: "Decision routing",
    icon: Route,
    kicker: "Exact routing shape",
    body: "Scout converts findings into decision-ready intelligence while preserving the Intent -> Decision Card -> Contact path.",
    evidence: "kind: scout_intelligence\nscope: county + trade\nnext: Decision Card",
  },
  {
    title: "Scout Vault",
    icon: Database,
    kicker: "Evidence history",
    body: "Scout stores what it knew, when it knew it, and how the answer was assembled so teams can replay the decision trail.",
    evidence: "evidence_hash: stored\nttl: cleanup job\naudit: replayable",
  },
];

const audienceCards = [
  {
    icon: Users,
    title: "Contractors",
    description: "Check codes, prices, and market shifts before quoting or buying material.",
  },
  {
    icon: MapPinned,
    title: "County teams",
    description: "Work from precomputed county intelligence instead of rebuilding the same answer.",
  },
  {
    icon: ShieldCheck,
    title: "Admin operators",
    description: "Run missions, inspect evidence, and keep the Scout pipeline healthy.",
  },
  {
    icon: BarChart3,
    title: "Support leads",
    description: "Route one clear next step with confidence and a clean record.",
  },
];

const workspaceCopy: Record<WorkspaceTab, { title: string; body: string; status: string }> = {
  scout: {
    title: "Active Scouting Workspace",
    body: "Mission input, live synthesis, source ranking, routing tags, and county writeback in one working surface.",
    status: "mission ready",
  },
  community: {
    title: "Live Scout Feed",
    body: "Shared local questions, emerging county signals, and reusable findings without exposing gated contact paths.",
    status: "read-only global",
  },
  learn: {
    title: "Trend Analysis",
    body: "Historical patterns, market signals, and scouting guidance built from verified TradeScout intelligence.",
    status: "learning layer",
  },
  outcomes: {
    title: "Mission Outcomes",
    body: "Vault history, decisions made, and the downstream impact of Scout intelligence.",
    status: "audit trail",
  },
};

function SourceRail() {
  return (
    <div className="space-y-3">
      {commandSources.map((source) => {
        const Icon = source.icon;

        return (
          <div key={source.label} className="ts-command-source">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ts-orange/10 text-ts-orange">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{source.label}</p>
                    <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]">
                      {source.detail}
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-white/45">{source.rank}</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/35">
                  <div className={`h-full rounded-full bg-ts-orange ${source.bar}`} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniHeatmap() {
  const cells = [
    "bg-ts-orange/70",
    "bg-emerald-400/55",
    "bg-sky-400/35",
    "bg-white/10",
    "bg-emerald-400/40",
    "bg-ts-orange/45",
    "bg-white/10",
    "bg-sky-400/50",
    "bg-ts-orange/30",
    "bg-white/10",
    "bg-emerald-400/65",
    "bg-sky-400/25",
  ];

  return (
    <div className="ts-mini-map" aria-hidden="true">
      {cells.map((tone, index) => (
        <div key={`${tone}-${index}`} className={`ts-mini-map-cell ${tone}`} />
      ))}
    </div>
  );
}

const ScoutInfoShowcase = memo(function ScoutInfoShowcase() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("scout");
  const [openPanel, setOpenPanel] = useState("Trend Engine");
  const activeCopy = workspaceCopy[activeTab];

  return (
    <div className="font-body text-white">
      <SEOHelmet
        title="Scout 2.0 Showcase | TradeScout"
        description="Scout 2.0 is TradeScout's active intelligence command center for knowledge base, county data, live context, and decision-ready findings."
        canonical="https://www.thetradescout.com/help/scout"
      />

      <section className="relative overflow-hidden border-b border-[color:var(--border-subtle)] bg-[#080d13]">
        <div className="ts-grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-ts-orange/25 bg-ts-orange/10 px-3 py-1.5 text-xs font-semibold text-ts-orange">
              <Sparkles className="h-3.5 w-3.5" />
              Scout 2.0 Showcase
            </div>

            <div className="flex items-center gap-2 text-xs text-[color:var(--text-secondary)]">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Data Factory online
            </div>
          </div>

          <div className="ts-command-shell">
            <aside className="ts-command-sidebar">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                  Workspace
                </p>
                <div className="mt-4 space-y-2">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const selected = activeTab === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveTab(item.id)}
                        className={`ts-command-nav ${selected ? "active" : ""}`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <LockKeyhole className="h-3.5 w-3.5 text-ts-orange" />
                  Contact invariant
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white/55">
                  Visibility does not grant access. Scout preserves Intent -&gt; Decision Card -&gt;
                  Contact.
                </p>
              </div>
            </aside>

            <main className="min-w-0">
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="ts-command-panel">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="ts-section-label">Active mission</p>
                      <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-tight md:text-6xl">
                        Scout is the Data Factory for TradeScout.
                      </h1>
                      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[color:var(--text-secondary)] md:text-base">
                        It scouts codes, prices, and market conditions, then converts the result
                        into decision-ready intelligence without pretending missing data exists.
                      </p>
                    </div>
                    <span className="ts-live-pill">{activeCopy.status}</span>
                  </div>

                  <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                      <div className="flex min-h-12 flex-1 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4">
                        <Search className="h-4 w-4 shrink-0 text-ts-orange" />
                        <span className="text-sm text-white/80">
                          What changed in Travis County electrical permit rules and copper pricing?
                        </span>
                      </div>
                      <Button asChild className="bg-ts-orange text-white hover:bg-ts-orange-dark">
                        <Link href="/scout">
                          Open Scout
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div className="ts-result-tile md:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">Synthesis result</p>
                        <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                          high confidence
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3">
                        {["What", "Why", "What to do"].map((label, index) => (
                          <div key={label} className="rounded-xl bg-white/[0.04] p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ts-orange">
                              {label}
                            </p>
                            <p className="mt-2 text-sm leading-relaxed text-white/75">
                              {index === 0 &&
                                "Copper pricing is rising and county electrical notes need review."}
                              {index === 1 &&
                                "Knowledge base and county data agree; web context is directional only."}
                              {index === 2 &&
                                "Open a Decision Card before any contact or assignment path."}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="ts-result-tile">
                      <p className="text-sm font-semibold text-white">Trend Engine</p>
                      <div className="mt-4 flex h-24 items-end gap-2">
                        {trendBars.map((heightClass, index) => (
                          <div
                            key={`${heightClass}-${index}`}
                            className={`flex-1 rounded-t bg-gradient-to-t from-ts-orange/45 to-emerald-300/80 ${heightClass}`}
                          />
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-white/55">Copper: rising over 30 days</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="ts-command-panel">
                    <div className="flex items-center justify-between gap-3">
                      <p className="ts-section-label">Truth stack</p>
                      <span className="text-xs text-white/45">highest trust first</span>
                    </div>
                    <div className="mt-4">
                      <SourceRail />
                    </div>
                  </div>

                  <div className="ts-command-panel">
                    <div className="flex items-center justify-between gap-3">
                      <p className="ts-section-label">County layer</p>
                      <MapPinned className="h-4 w-4 text-ts-orange" />
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-[0.9fr_1.1fr]">
                      <MiniHeatmap />
                      <div>
                        <p className="text-sm font-semibold text-white">Visual Command Center</p>
                        <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                          Regional browser, heatmap intelligence, and file tray stay county-aware.
                        </p>
                        <div className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 p-3">
                          <p className="text-xs font-semibold text-rose-100">No fake data rule</p>
                          <p className="mt-1 text-xs leading-relaxed text-rose-100/70">
                            Missing sources report not yet indexed.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="ts-command-panel">
                  <p className="ts-section-label">Decision routing</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {routingTags.map((tag) => (
                      <span key={tag} className="ts-routing-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-4 font-mono text-xs leading-6 text-white/65">
                    kind: scout_intelligence
                    <br />
                    narrative: What / Why / What to do
                    <br />
                    route: county surface + Decision Card
                  </div>
                </div>

                <div className="ts-command-panel">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="ts-section-label">{activeCopy.title}</p>
                      <p className="mt-3 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                        {activeCopy.body}
                      </p>
                    </div>
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {["Cache", "Dedupe", "Compress"].map((label) => (
                      <div
                        key={label}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <p className="text-xs text-white/45">{label}</p>
                        <p className="mt-1 text-sm font-semibold text-white">Cost controlled</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </section>

      <section className="border-b border-[color:var(--border-subtle)] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr]">
            <div>
              <p className="ts-section-label">How Scout Works</p>
              <h2 className="mt-4 font-display text-3xl font-bold md:text-4xl">
                One mission, one truth order, one output path.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--text-secondary)] md:text-base">
                Scout is not generic chat. It is active intelligence gathering with source priority,
                cost controls, persistence, and decision routing.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {missionSteps.map((step, index) => (
                <div key={step.title} className="ts-workflow-step">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ts-orange/10 font-mono text-xs font-semibold text-ts-orange">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <p className="ts-section-label">Core systems</p>
              <h2 className="mt-4 font-display text-3xl font-bold md:text-4xl">
                Scout 2.0 shows its work.
              </h2>
            </div>
            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/60">
              TradeScout only. No cross-brand data.
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-2">
              {capabilityPanels.map((panel) => {
                const Icon = panel.icon;
                const selected = openPanel === panel.title;

                return (
                  <button
                    key={panel.title}
                    type="button"
                    onClick={() => setOpenPanel(panel.title)}
                    className={`ts-capability-button ${selected ? "active" : ""}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{panel.title}</span>
                    <ChevronRight className="ml-auto h-4 w-4" />
                  </button>
                );
              })}
            </div>

            {capabilityPanels
              .filter((panel) => panel.title === openPanel)
              .map((panel) => {
                const Icon = panel.icon;

                return (
                  <div key={panel.title} className="ts-capability-detail">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-ts-orange/10 text-ts-orange">
                          <Icon className="h-5 w-5" />
                        </div>
                        <p className="mt-5 ts-section-label">{panel.kicker}</p>
                        <h3 className="mt-3 font-display text-3xl font-bold text-white">
                          {panel.title}
                        </h3>
                        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[color:var(--text-secondary)] md:text-base">
                          {panel.body}
                        </p>
                      </div>
                      <Gauge className="hidden h-6 w-6 text-white/25 sm:block" />
                    </div>

                    <div className="mt-8 grid gap-4 md:grid-cols-[1fr_0.85fr]">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                        <p className="text-sm font-semibold text-white">Evidence note</p>
                        <pre className="mt-4 whitespace-pre-wrap font-mono text-xs leading-6 text-white/65">
                          {panel.evidence}
                        </pre>
                      </div>
                      <div className="rounded-2xl border border-ts-orange/20 bg-ts-orange/10 p-5">
                        <p className="text-sm font-semibold text-white">Routing rule</p>
                        <p className="mt-3 text-sm leading-relaxed text-white/70">
                          Scout keeps findings inside county, trust, and contact boundaries before
                          routing them outward.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="ts-section-label">Scout is for everyone</p>
              <h2 className="mt-4 font-display text-3xl font-bold md:text-4xl">
                Built for people who need one clear next step.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--text-secondary)] md:text-base">
                The interface can be simple, but the engine behind it is scouting, scoring,
                preserving, and routing the decision trail.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {audienceCards.map((audience) => {
                const Icon = audience.icon;

                return (
                  <div key={audience.title} className="ts-audience-panel">
                    <Icon className="h-5 w-5 text-ts-orange" />
                    <h3 className="mt-4 text-base font-semibold text-white">{audience.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                      {audience.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-ts-orange/20 bg-ts-orange/10 p-6 md:p-8">
            <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-ts-orange">
                  <AlertCircle className="h-4 w-4" />
                  Missing information stays missing
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/70 md:text-base">
                  When Scout does not have indexed evidence, it reports not yet indexed instead of
                  inventing placeholders. That is the difference between a chat answer and an
                  intelligence engine.
                </p>
              </div>
              <Button asChild className="bg-ts-orange text-white hover:bg-ts-orange-dark">
                <Link href="/scout">
                  Open Scout
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
});

export default ScoutInfoShowcase;
