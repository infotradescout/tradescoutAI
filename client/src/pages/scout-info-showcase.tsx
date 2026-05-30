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
    label: "Site",
    detail: "pages, tools, and help",
    rank: "01",
    confidence: "high",
    icon: Database,
    bar: "w-[94%]",
  },
  {
    label: "Near me",
    detail: "people, posts, and requests",
    rank: "02",
    confidence: "medium",
    icon: MapPinned,
    bar: "w-[78%]",
  },
  {
    label: "Latest",
    detail: "prices, events, and updates",
    rank: "03",
    confidence: "low",
    icon: Search,
    bar: "w-[56%]",
  },
];

const contactSteps = ["Open Scout", "Review the next step", "Choose what to do"];

const trendBars = ["h-[36%]", "h-[48%]", "h-[42%]", "h-[58%]", "h-[67%]", "h-[76%]", "h-[84%]"];

const missionSteps = [
  {
    title: "Tell Scout what you need",
    description:
      "Start with a local question: what is nearby, changing, useful, available, or worth checking.",
  },
  {
    title: "Scout checks the basics",
    description:
      "It looks at nearby posts, requests, pros, services, prices, rules, and events when available.",
  },
  {
    title: "You get a simple answer",
    description: "Scout explains what matters, why it matters, and what to do next.",
  },
  {
    title: "Missing info stays honest",
    description: "If TradeScout has not indexed something yet, Scout displays that clearly.",
  },
  {
    title: "Contact stays protected",
    description: "You review the next step before sharing contact info or making a request.",
  },
  {
    title: "You stay in control",
    description: "Save it, keep asking, or move forward when the next step makes sense.",
  },
];

const capabilityPanels = [
  {
    title: "Search everything",
    icon: MapPinned,
    kicker: "Site plus local",
    body: "Scout shows TradeScout pages, local activity, useful services, posts, requests, prices, and things worth checking.",
    evidence: "site pages\nnearby posts\nlocal services",
  },
  {
    title: "Price watch",
    icon: TrendingUp,
    kicker: "What costs may be doing",
    body: "Scout can help you understand whether a local material, service, or project cost looks steady, rising, or worth checking before you buy.",
    evidence: "recent prices\navailability\nlocal demand",
  },
  {
    title: "Plain answer",
    icon: Layers3,
    kicker: "What, why, what next",
    body: "Scout turns messy search questions into a short explanation and a practical next step.",
    evidence: "what matters\nwhy it matters\nwhat to do next",
  },
  {
    title: "Contact guard",
    icon: ShieldCheck,
    kicker: "No surprise contact sharing",
    body: "Scout shows the next step before contact info or a request path is opened.",
    evidence: "ask first\nreview next step\nchoose contact",
  },
  {
    title: "Saved context",
    icon: Database,
    kicker: "Come back later",
    body: "When you sign in, Scout can keep your question and answer available so you do not have to start over.",
    evidence: "saved question\nsaved answer\nnext step remembered",
  },
];

const audienceCards = [
  {
    icon: Users,
    title: "Homeowners",
    description: "See useful local activity before you decide where to spend time or money.",
  },
  {
    icon: MapPinned,
    title: "Contractors",
    description: "Spot local demand, pricing, timing, and requirements before quoting.",
  },
  {
    icon: ShieldCheck,
    title: "DIY planners",
    description: "Understand nearby materials, services, rules, and timing before starting.",
  },
  {
    icon: BarChart3,
    title: "Local buyers",
    description: "Know what changed nearby before buying materials or hiring help.",
  },
];

const workspaceCopy: Record<WorkspaceTab, { title: string; body: string; status: string }> = {
  scout: {
    title: "Search TradeScout",
    body: "Start with a normal sentence. Scout searches the site and what is useful around you.",
    status: "ready",
  },
  community: {
    title: "Local awareness",
    body: "Learn from nearby questions and patterns without opening contact paths too early.",
    status: "local context",
  },
  learn: {
    title: "Learn before acting",
    body: "Check nearby activity, costs, timing, rules, and risk before you commit.",
    status: "simple guidance",
  },
  outcomes: {
    title: "Next steps",
    body: "Move forward only after you understand the safer path.",
    status: "your choice",
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
  const [openPanel, setOpenPanel] = useState("Search everything");
  const activeCopy = workspaceCopy[activeTab];

  return (
    <div className="font-body text-white">
      <SEOHelmet
        title="Scout Help | TradeScout"
        description="Scout shows TradeScout users search the site and find nearby help, posts, requests, prices, rules, events, and safe next steps."
        canonical="https://www.thetradescout.com/help/scout"
      />

      <section className="relative overflow-hidden border-b border-[color:var(--border-subtle)] bg-[#080d13]">
        <div className="ts-grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-ts-orange/25 bg-ts-orange/10 px-3 py-1.5 text-xs font-semibold text-ts-orange">
              <Sparkles className="h-3.5 w-3.5" />
              Scout Help
            </div>

            <div className="flex items-center gap-2 text-xs text-[color:var(--text-secondary)]">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Ask first, act smarter
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
                  Contact stays protected
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white/55">
                  Seeing someone does not mean sharing contact info. Scout shows the next step
                  first.
                </p>
              </div>
            </aside>

            <main className="min-w-0">
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="ts-command-panel">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="ts-section-label">Start Here</p>
                      <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-tight md:text-6xl">
                        Search TradeScout and your area.
                      </h1>
                      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[color:var(--text-secondary)] md:text-base">
                        Scout searches pages, people, services, requests, prices, rules, events, and
                        useful local updates in one place.
                      </p>
                    </div>
                    <span className="ts-live-pill">{activeCopy.status}</span>
                  </div>

                  <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                      <div className="flex min-h-12 flex-1 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4">
                        <Search className="h-4 w-4 shrink-0 text-ts-orange" />
                        <span className="text-sm text-white/80">
                          Who near me can help with a fence this week?
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
                        <p className="text-sm font-semibold text-white">
                          A Scout answer feels like this
                        </p>
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
                                "Scout found matching pages, nearby help, recent requests, and price notes worth checking."}
                              {index === 1 &&
                                "Seeing the best matches first helps you avoid contacting the wrong person or opening the wrong page."}
                              {index === 2 &&
                                "Open the best match, save it, ask a follow-up, or make a request when it makes sense."}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="ts-result-tile">
                      <p className="text-sm font-semibold text-white">Local Pulse</p>
                      <div className="mt-4 flex h-24 items-end gap-2">
                        {trendBars.map((heightClass, index) => (
                          <div
                            key={`${heightClass}-${index}`}
                            className={`flex-1 rounded-t bg-gradient-to-t from-ts-orange/45 to-emerald-300/80 ${heightClass}`}
                          />
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-white/55">Nearby activity can change fast</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="ts-command-panel">
                    <div className="flex items-center justify-between gap-3">
                      <p className="ts-section-label">Where Scout looks</p>
                      <span className="text-xs text-white/45">site plus local</span>
                    </div>
                    <div className="mt-4">
                      <SourceRail />
                    </div>
                  </div>

                  <div className="ts-command-panel">
                    <div className="flex items-center justify-between gap-3">
                      <p className="ts-section-label">Local matters</p>
                      <MapPinned className="h-4 w-4 text-ts-orange" />
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-[0.9fr_1.1fr]">
                      <MiniHeatmap />
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Where you are changes the answer
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                          People, projects, services, prices, rules, and events can be different by
                          city or county.
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
                  <p className="ts-section-label">Before contact</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {contactSteps.map((step) => (
                      <span key={step} className="ts-routing-tag">
                        {step}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-white/65">
                    <p>Scout keeps the first move low-pressure.</p>
                    <p className="mt-2 text-white/50">
                      Ask the question, understand the risk, then decide whether contact makes
                      sense.
                    </p>
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
                    {["People", "Prices", "Rules"].map((label) => (
                      <div
                        key={label}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <p className="text-xs text-white/45">{label}</p>
                        <p className="mt-1 text-sm font-semibold text-white">Checked first</p>
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
                Ask a normal question. Get a useful next step.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--text-secondary)] md:text-base">
                Scout is not a public directory and it is not a lead-selling shortcut. It helps you
                find the right page, person, post, price, rule, or next step before you move
                forward.
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
              <p className="ts-section-label">What it helps with</p>
              <h2 className="mt-4 font-display text-3xl font-bold md:text-4xl">
                Practical answers without the jargon.
              </h2>
            </div>
            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/60">
              TradeScout only
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
                        <p className="text-sm font-semibold text-white">Plain notes</p>
                        <pre className="mt-4 whitespace-pre-wrap font-mono text-xs leading-6 text-white/65">
                          {panel.evidence}
                        </pre>
                      </div>
                      <div className="rounded-2xl border border-ts-orange/20 bg-ts-orange/10 p-5">
                        <p className="text-sm font-semibold text-white">Contact rule</p>
                        <p className="mt-3 text-sm leading-relaxed text-white/70">
                          Scout shows the next step before sharing contact info or making a request.
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
                The interface can be simple, but the engine behind it is searching site and local
                context while protecting the contact path.
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
                  When Scout has not indexed something yet, it says not yet indexed instead of
                  inventing an answer.
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
