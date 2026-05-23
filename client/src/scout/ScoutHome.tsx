import {
  ArrowRight,
  Calendar,
  CircleDollarSign,
  Home,
  MapPin,
  ShieldCheck,
  type LucideIcon,
  Truck,
  Users2,
  Wrench,
} from "lucide-react";
import { useScoutLocation } from "./hooks/useScoutLocation";
import {
  useScoutHomeSnapshot,
  type OpportunityMove,
  type PriceSignal,
} from "./hooks/useScoutHomeSnapshot";
import { formatPriceSignalFreshness } from "./scoutExperience";

interface ContinuityThread {
  id: string;
  title: string;
  summary?: string | null;
  preview?: string | null;
  intent?: string | null;
  relatedLabel?: string | null;
  messageCount?: number | null;
  relatedTo?: {
    kind?: "project" | "home" | "vehicle" | "client" | "generic";
  } | null;
}

interface ScoutHomeProps {
  onPromptSelect: (text: string) => void;
  continuationThreads?: Array<ContinuityThread>;
}

interface ContinuityCard {
  id: string;
  title: string;
  detail: string;
  prompt: string;
  icon: LucideIcon;
  accent: string;
  thumbClass?: string;
}

interface SignalRowData {
  id: string;
  title: string;
  detail: string;
  freshness: string;
  prompt: string;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ts-orange">
        {title}
      </p>
      {subtitle ? <p className="text-xs text-[color:var(--text-secondary)]">{subtitle}</p> : null}
    </div>
  );
}

function heroGradientForTitle(title: string) {
  const key = title.toLowerCase();
  if (key.includes("home")) return "linear-gradient(135deg, #f97316 0%, #fb923c 42%, #f59e0b 100%)";
  if (key.includes("vehicle"))
    return "linear-gradient(135deg, #0ea5e9 0%, #0284c7 44%, #155e75 100%)";
  if (key.includes("search"))
    return "linear-gradient(135deg, #16a34a 0%, #22c55e 45%, #15803d 100%)";
  return "linear-gradient(135deg, #7c3aed 0%, #a78bfa 44%, #6d28d9 100%)";
}

function humanizeThreadIntent(intent?: string | null, relatedLabel?: string | null) {
  const i = String(intent || "").toLowerCase();
  if (i === "client_work" || i === "project" || i === "client" || i === "local_help") {
    return "Home project";
  }
  if (i === "vehicle" || i === "vehicles") {
    return "Vehicle service";
  }
  if (i === "local_request") {
    return "Local request";
  }
  if (i === "prices" || i === "materials") {
    return "Saved search";
  }
  return relatedLabel ? "Local request" : "Saved search";
}

function continuityIconForThread(thread: ContinuityThread) {
  if (thread.relatedTo?.kind === "vehicle") return Truck;
  if (thread.relatedTo?.kind === "home" || thread.relatedTo?.kind === "project") return Home;
  if (
    thread.intent === "local_request" ||
    thread.intent === "client_work" ||
    thread.intent === "client"
  )
    return Users2;
  if (thread.intent === "prices" || thread.intent === "materials") return CircleDollarSign;
  return Wrench;
}

function continuationStatusFromPrompt(intent: string, count: number) {
  if (count > 6) return "Needs approval";
  if (count > 0) return `${count} active updates`;
  return "Waiting on review";
}

function continuationStatusFromThread(intent?: string | null, msgCount?: number) {
  if (msgCount && msgCount > 4) return "Waiting on response";
  if (msgCount && msgCount > 1) return "Needs approval";
  if (msgCount === 1) return "Needs next step";
  if (intent === "local_request") return "Needs next step";
  return "Waiting on review";
}

function ContinueCard({
  label,
  detail,
  cta,
  onClick,
  Icon,
  accent,
  gradient,
  thumbClass,
}: {
  label: string;
  detail: string;
  cta: string;
  onClick: () => void;
  Icon: LucideIcon;
  accent: string;
  gradient: string;
  thumbClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative min-h-[158px] w-full overflow-hidden rounded-2xl border p-3 text-left transition hover:shadow-lg"
      style={{
        borderColor: "var(--border-subtle)",
        backgroundColor: "var(--surface-card)",
      }}
    >
      <div
        className="mb-3 flex h-24 w-full items-center justify-center rounded-xl border"
        style={{ background: gradient, borderColor: `${accent}55` }}
      >
        <span
          className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${thumbClass || ""}`}
          style={{
            background: "rgba(255,255,255,0.18)",
            border: `1px solid ${accent}66`,
            color: "var(--text-primary)",
          }}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="text-base font-semibold text-[color:var(--text-primary)]">{label}</p>
      <p className="mt-1 text-xs text-[color:var(--text-secondary)]">{detail}</p>
      <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ts-orange">
        {cta}
        <ArrowRight className="h-3 w-3" />
      </p>
    </button>
  );
}

function ScoutHeader({ locationLabel }: { locationLabel: string }) {
  return (
    <header className="space-y-2 pb-2">
      <p className="text-[11px] font-semibold tracking-[0.16em] uppercase text-ts-orange">
        TradeScout
      </p>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-ts-orange" />
        <h1 className="text-3xl font-bold leading-tight text-[color:var(--text-primary)]">Scout</h1>
      </div>
      <p className="text-sm text-[color:var(--text-secondary)]">
        <MapPin className="mr-1 inline h-3.5 w-3.5" />
        {locationLabel || "your area"}
      </p>
    </header>
  );
}

function ContinueRail({
  localLabel,
  prompts,
  continuationThreads,
  onPromptSelect,
}: {
  localLabel: string;
  prompts: Array<{ id: string; text: string; category: string; intent: string; count: number }>;
  continuationThreads?: Array<ContinuityThread>;
  onPromptSelect: (text: string) => void;
}) {
  const fallback: ContinuityCard[] = [
    {
      id: "home-project",
      title: "Home project",
      detail: "Waiting on review",
      prompt: "Continue the home project from before.",
      icon: Wrench,
      accent: "#f97316",
    },
    {
      id: "vehicle-service",
      title: "Vehicle service",
      detail: "Needs approval",
      prompt: "Continue vehicle service work in progress.",
      icon: Truck,
      accent: "#0ea5e9",
    },
    {
      id: "saved-search",
      title: "Saved search",
      detail: "4 new matches",
      prompt: "Continue my saved local search.",
      icon: CircleDollarSign,
      accent: "#16a34a",
    },
    {
      id: "local-request",
      title: "Local request",
      detail: "Offer expires soon",
      prompt: "Continue local request follow-up.",
      icon: Users2,
      accent: "#7c3aed",
    },
  ];

  const fromThreads: ContinuityCard[] = continuationThreads
    ? continuationThreads.map((thread, index) => ({
        id: thread.id,
        title: humanizeThreadIntent(thread.intent, thread.relatedLabel),
        detail: continuationStatusFromThread(
          thread.intent,
          thread.messageCount ?? thread.summary?.length
        ),
        prompt: thread.summary || thread.preview || thread.title || "Continue this thread.",
        icon: continuityIconForThread(thread),
        thumbClass: thread.relatedTo?.kind === "vehicle" ? "bg-white/20" : "",
        accent: index % 2 ? "#0ea5e9" : "#f97316",
      }))
    : [];

  const fromPrompts: ContinuityCard[] = prompts.slice(0, 4).map((prompt) => {
    const mappedLabel =
      prompt.intent === "contractor" || prompt.intent === "realtor"
        ? "Home project"
        : prompt.intent === "marketplace"
          ? "Saved search"
          : prompt.intent === "vehicle"
            ? "Vehicle service"
            : "Local request";

    return {
      id: prompt.id,
      title: mappedLabel,
      detail: continuationStatusFromPrompt(prompt.intent, prompt.count),
      prompt: `Continue ${mappedLabel.toLowerCase()} work.`,
      icon: mappedLabel === "Home project" ? Wrench : CircleDollarSign,
      thumbClass: "bg-white/20",
      accent: "#f97316",
    };
  });

  const cards =
    fromThreads.length > 0
      ? fromThreads.slice(0, 4)
      : fromPrompts.length > 0
        ? fromPrompts
        : fallback;

  const subtitle = localLabel
    ? `Continue where you left off in ${localLabel}.`
    : "Continue where you left off.";

  return (
    <section className="space-y-2">
      <SectionHeader title="Continue where you left off" subtitle={subtitle} />
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {cards.map((item) => (
          <ContinueCard
            key={item.id}
            label={item.title}
            detail={item.detail}
            cta="Continue"
            Icon={item.icon}
            accent={item.accent}
            gradient={heroGradientForTitle(item.title)}
            thumbClass={item.thumbClass}
            onClick={() => onPromptSelect(item.prompt)}
          />
        ))}
      </div>
    </section>
  );
}

function LaneCard({
  icon: Icon,
  title,
  detail,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative min-h-[132px] overflow-hidden rounded-2xl border p-4 text-left transition hover:shadow-md"
      style={{
        borderColor: "var(--border-subtle)",
        backgroundColor: "var(--surface-card)",
      }}
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ts-orange/35 bg-ts-orange/10 text-ts-orange">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-base font-semibold text-[color:var(--text-primary)]">{title}</p>
      <p className="mt-2 text-xs text-[color:var(--text-secondary)] leading-relaxed">{detail}</p>
    </button>
  );
}

function PrimaryLaneGrid({ onPromptSelect }: { onPromptSelect: (text: string) => void }) {
  const lanes = [
    {
      title: "Homes",
      detail: "Repairs, records, inspections, projects",
      prompt: "Help me with a home project.",
      icon: Home,
    },
    {
      title: "Vehicles",
      detail: "Service, repairs, records, selling",
      prompt: "Help me with a vehicle service issue or sale.",
      icon: Truck,
    },
    {
      title: "Projects",
      detail: "Requests, quotes, jobs, updates",
      prompt: "Help me manage a local project request.",
      icon: Wrench,
    },
    {
      title: "Listings",
      detail: "Tools, materials, vehicles, property",
      prompt: "Help me with a listing or item search.",
      icon: CircleDollarSign,
    },
    {
      title: "People",
      detail: "Local help and saved providers",
      prompt: "Help me find local people for this work.",
      icon: Users2,
    },
    {
      title: "Community",
      detail: "Posts, events, nearby activity",
      prompt: "Show me nearby community activity.",
      icon: Calendar,
    },
  ];
  return (
    <section className="space-y-2">
      <SectionHeader title="Your local world" />
      <div className="grid grid-cols-2 gap-2.5">
        {lanes.map((lane) => (
          <LaneCard
            key={lane.title}
            icon={lane.icon}
            title={lane.title}
            detail={lane.detail}
            onClick={() => onPromptSelect(lane.prompt)}
          />
        ))}
      </div>
    </section>
  );
}

function SignalRow({
  title,
  detail,
  freshness,
  laneTone,
  onClick,
}: {
  title: string;
  detail: string;
  freshness: string;
  laneTone?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left"
      style={{
        borderColor: "var(--border-subtle)",
        backgroundColor: "var(--surface-card)",
      }}
    >
      <span className="inline-flex h-8 w-8 shrink-0 rounded-lg border border-ts-orange/35 bg-ts-orange/10 text-ts-orange">
        <span className="m-auto text-[10px] font-bold leading-none">{laneTone || "▸"}</span>
      </span>
      <span className="min-w-0">
        <p className="text-sm font-semibold text-[color:var(--text-primary)]">{title}</p>
        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">{detail}</p>
      </span>
      <span className="shrink-0 text-[10px] font-semibold text-ts-orange">{freshness}</span>
    </button>
  );
}

function moveToSignal(move: OpportunityMove): SignalRowData {
  const textByLabel: Record<string, string> = {
    "completed-job-demand": "Repair activity is picking up",
    "homescout-seller-audit": "Home prices shifted nearby",
    "tradedeals-fast-win": "Local offers are moving",
    "community-partnership-window": "Events are active this week",
  };
  const humanTitle = textByLabel[move.id] || move.title;
  return {
    id: move.id,
    title: humanTitle,
    detail: move.whyItMatters,
    freshness: `${move.confidence} confidence`,
    prompt: move.prompt,
  };
}

function priceToSignal(signal: PriceSignal): SignalRowData {
  return {
    id: signal.id,
    title: signal.label,
    detail: signal.description,
    freshness: formatPriceSignalFreshness(signal.updatedAt),
    prompt: `Check prices and local trends using ${signal.label}.`,
  };
}

function LocalSignalList({
  priceSignals,
  opportunityMoves,
  onPromptSelect,
  localLabel,
}: {
  priceSignals: PriceSignal[];
  opportunityMoves: OpportunityMove[];
  localLabel: string;
  onPromptSelect: (text: string) => void;
}) {
  const mapped = [
    ...opportunityMoves.slice(0, 2).map(moveToSignal),
    ...priceSignals.slice(0, 2).map(priceToSignal),
  ];

  const fallback: SignalRowData[] = [
    {
      id: "fallback-1",
      title: "Fence projects increased nearby",
      detail: localLabel
        ? `${localLabel} demand moved up in service requests.`
        : "Service demand moved up in this area.",
      freshness: "Live",
      prompt: "Show me what is moving around me this week.",
    },
    {
      id: "fallback-2",
      title: "Used truck listings moved",
      detail: "Inventory changed quickly in nearby marketplace offers.",
      freshness: "Today",
      prompt: "What local jobs are getting more demand right now?",
    },
    {
      id: "fallback-3",
      title: "3 homes dropped price this week",
      detail: "Pricing adjustments are reshaping local buyer signals.",
      freshness: "This week",
      prompt: "Any local marketplace changes today?",
    },
    {
      id: "fallback-4",
      title: "2 providers joined locally",
      detail: "New local help options are active around you.",
      freshness: "Now",
      prompt: "Who can help me around me right now?",
    },
  ];

  const rows = mapped.length ? mapped : fallback;

  return (
    <section className="space-y-2">
      <SectionHeader title="Nearby right now" />
      <div className="space-y-2">
        {rows.map((signal) => (
          <SignalRow
            key={signal.id}
            title={signal.title}
            detail={signal.detail}
            freshness={signal.freshness}
            laneTone={signal.id.startsWith("fallback-") ? "↗" : "◈"}
            onClick={() => onPromptSelect(signal.prompt)}
          />
        ))}
      </div>
    </section>
  );
}

function StatusMetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: "var(--border-subtle)",
        backgroundColor: "var(--surface-card)",
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-secondary)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold leading-none text-[color:var(--text-primary)]">
        {value}
      </p>
    </div>
  );
}

function StatusMetricGrid({
  snapshot,
  localLabel,
}: {
  snapshot:
    | {
        activeListings: number;
        verifiedPros: number;
        eventsThisWeek: number;
        communityMembers: number;
      }
    | undefined;
  localLabel: string;
}) {
  if (!snapshot) return null;
  return (
    <section className="space-y-2">
      <SectionHeader
        title="Local snapshot"
        subtitle={localLabel ? `${localLabel} right now.` : "Right now."}
      />
      <div className="grid grid-cols-2 gap-2">
        <StatusMetricCard label="Listings" value={formatCount(snapshot.activeListings)} />
        <StatusMetricCard label="Local help" value={formatCount(snapshot.verifiedPros)} />
        <StatusMetricCard label="Events" value={String(snapshot.eventsThisWeek)} />
        <StatusMetricCard label="Members" value={formatCount(snapshot.communityMembers)} />
      </div>
    </section>
  );
}

export function ScoutHome({ onPromptSelect, continuationThreads = [] }: ScoutHomeProps) {
  const { location } = useScoutLocation();
  const { data } = useScoutHomeSnapshot(location);
  const localLabel = location.label || "";

  return (
    <div className="flex w-full flex-col gap-4 pb-2">
      <ScoutHeader locationLabel={localLabel} />
      <ContinueRail
        localLabel={localLabel}
        prompts={data?.trendingPrompts || []}
        continuationThreads={continuationThreads}
        onPromptSelect={onPromptSelect}
      />
      <PrimaryLaneGrid onPromptSelect={onPromptSelect} />
      <LocalSignalList
        priceSignals={data?.priceSignals || []}
        opportunityMoves={data?.opportunityMoves || []}
        localLabel={localLabel}
        onPromptSelect={onPromptSelect}
      />
      <StatusMetricGrid snapshot={data?.snapshot} localLabel={localLabel} />
    </div>
  );
}
