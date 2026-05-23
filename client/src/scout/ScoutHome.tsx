import { ArrowRight } from "lucide-react";
import { useScoutLocation } from "./hooks/useScoutLocation";
import {
  useScoutHomeSnapshot,
  type OpportunityMove,
  type PriceSignal,
} from "./hooks/useScoutHomeSnapshot";
import { formatPriceSignalFreshness } from "./scoutExperience";

interface ScoutHomeProps {
  onPromptSelect: (text: string) => void;
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

function ContinueCard({
  label,
  detail,
  cta,
  onClick,
}: {
  label: string;
  detail: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border p-3 text-left"
      style={{
        borderColor: "var(--border-subtle)",
        backgroundColor: "var(--surface-card)",
      }}
    >
      <p className="text-sm font-semibold text-[color:var(--text-primary)]">{label}</p>
      <p className="mt-1 text-xs text-[color:var(--text-secondary)]">{detail}</p>
      <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ts-orange">
        {cta}
        <ArrowRight className="h-3 w-3" />
      </p>
    </button>
  );
}

function ContinueRail({
  localLabel,
  prompts,
  onPromptSelect,
}: {
  localLabel: string;
  prompts: Array<{ id: string; text: string; category: string }>;
  onPromptSelect: (text: string) => void;
}) {
  const preferred = [
    { id: "home-project", text: "Home project", category: "Repairs, upgrades, and maintenance" },
    { id: "vehicle-service", text: "Vehicle service", category: "Service, repairs, and records" },
    { id: "saved-search", text: "Saved search", category: "Pick up a search you started earlier" },
    { id: "local-request", text: "Local request", category: "Post or continue a request nearby" },
  ];
  const top = prompts.length > 0 ? prompts.slice(0, 4) : preferred;
  const subtitle = localLabel
    ? `Continue where you left off in ${localLabel}.`
    : "Continue where you left off.";
  return (
    <section className="space-y-2">
      <SectionHeader title="Continue where you left off" subtitle={subtitle} />
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {top.map((item) => (
          <ContinueCard
            key={item.id}
            label={item.text}
            detail={item.category}
            cta="Continue"
            onClick={() => onPromptSelect(item.text)}
          />
        ))}
      </div>
    </section>
  );
}

function LaneCard({
  title,
  detail,
  onClick,
}: {
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border p-3 text-left"
      style={{
        borderColor: "var(--border-subtle)",
        backgroundColor: "var(--surface-card)",
      }}
    >
      <p className="text-sm font-semibold text-[color:var(--text-primary)]">{title}</p>
      <p className="mt-1 text-xs text-[color:var(--text-secondary)]">{detail}</p>
    </button>
  );
}

function PrimaryLaneGrid({ onPromptSelect }: { onPromptSelect: (text: string) => void }) {
  const lanes = [
    {
      title: "Homes",
      detail: "Repairs, records, inspections, projects",
      prompt: "Help me with a home project.",
    },
    {
      title: "Vehicles",
      detail: "Service, repairs, records, selling",
      prompt: "Help me with a vehicle service issue.",
    },
    {
      title: "Projects",
      detail: "Requests, quotes, jobs, updates",
      prompt: "Help me manage a local project request.",
    },
    {
      title: "Listings",
      detail: "Tools, materials, vehicles, property",
      prompt: "Help me with a listing or item search.",
    },
    {
      title: "People",
      detail: "Local help and saved providers",
      prompt: "Help me find local people for this work.",
    },
    {
      title: "Community",
      detail: "Posts, events, nearby activity",
      prompt: "Show me nearby community activity.",
    },
  ];
  return (
    <section className="space-y-2">
      <SectionHeader
        title="Where do you want to start?"
        subtitle="Pick the area you need right now."
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {lanes.map((lane) => (
          <LaneCard
            key={lane.title}
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
  onClick,
}: {
  title: string;
  detail: string;
  freshness: string;
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
      <span className="min-w-0">
        <p className="text-sm font-semibold text-[color:var(--text-primary)]">{title}</p>
        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">{detail}</p>
      </span>
      <span className="shrink-0 text-[10px] font-semibold text-ts-orange">{freshness}</span>
    </button>
  );
}

function moveToSignal(move: OpportunityMove) {
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

function priceToSignal(signal: PriceSignal) {
  return {
    id: signal.id,
    title: signal.label,
    detail: signal.description,
    freshness: formatPriceSignalFreshness(signal.updatedAt),
    prompt: `Check prices and local trends using the latest ${signal.label} snapshot.`,
  };
}

function LocalSignalList({
  priceSignals,
  opportunityMoves,
  onPromptSelect,
}: {
  priceSignals: PriceSignal[];
  opportunityMoves: OpportunityMove[];
  onPromptSelect: (text: string) => void;
}) {
  const merged = [
    ...opportunityMoves.slice(0, 2).map(moveToSignal),
    ...priceSignals.slice(0, 2).map(priceToSignal),
  ];
  if (merged.length === 0) return null;
  return (
    <section className="space-y-2">
      <SectionHeader title="Nearby right now" subtitle="What’s moving around you this week." />
      <div className="space-y-2">
        {merged.map((signal) => (
          <SignalRow
            key={signal.id}
            title={signal.title}
            detail={signal.detail}
            freshness={signal.freshness}
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
      className="rounded-xl border p-3"
      style={{
        borderColor: "var(--border-subtle)",
        backgroundColor: "var(--surface-card)",
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-secondary)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">{value}</p>
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

export function ScoutHome({ onPromptSelect }: ScoutHomeProps) {
  const { location } = useScoutLocation();
  const { data } = useScoutHomeSnapshot(location);
  const localLabel = location.label || "";

  return (
    <div className="flex w-full flex-col gap-4 pb-2">
      <ContinueRail
        localLabel={localLabel}
        prompts={data?.trendingPrompts || []}
        onPromptSelect={onPromptSelect}
      />
      <PrimaryLaneGrid onPromptSelect={onPromptSelect} />
      <LocalSignalList
        priceSignals={data?.priceSignals || []}
        opportunityMoves={data?.opportunityMoves || []}
        onPromptSelect={onPromptSelect}
      />
      <StatusMetricGrid snapshot={data?.snapshot} localLabel={localLabel} />
    </div>
  );
}
