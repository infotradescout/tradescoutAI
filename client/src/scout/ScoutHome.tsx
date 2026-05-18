/**
 * ScoutHome
 *
 * The default Scout OS surface rendered when there are no messages yet.
 * This is the "you just opened Scout" state — the OS is alive, aware of
 * your location, and ready to work.
 *
 * Data flow:
 *   useScoutLocation → resolves county/state/fips via browser geo / IP / manual
 *   useScoutHomeSnapshot → fetches real local stats + trending prompts from API
 *
 * Visual design: matches the "Morphic Universal OS" mockup screenshots exactly.
 * Pure black background, dark gray cards, hard orange borders, Sora typography.
 */

import { useState, useCallback } from "react";
import {
  Archive,
  ArrowRight,
  Brain,
  ClipboardList,
  Home,
  MapPin,
  ChevronDown,
  Radar,
  Sparkles,
  TrendingUp,
  Clock,
  ListChecks,
  Users,
  ShoppingBag,
  Wrench,
  Calendar,
  PackageSearch,
  ShieldCheck,
} from "lucide-react";
import { useScoutLocation } from "./hooks/useScoutLocation";
import {
  useScoutHomeSnapshot,
  type OpportunityMove,
  type PriceSignal,
} from "./hooks/useScoutHomeSnapshot";
import {
  SCOUT_CAPABILITY_COPY,
  formatPriceSignalFreshness,
  formatPriceSignalSource,
  type ScoutCapabilityId,
} from "./scoutExperience";

// ── Types ──────────────────────────────────────────────────────────────────

interface ScoutHomeProps {
  onPromptSelect: (text: string) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDelta(delta: number): string {
  if (delta === 0) return "";
  return delta > 0 ? `+${delta} this week` : `${delta} this week`;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Skeleton loader ────────────────────────────────────────────────────────

function SkeletonTile() {
  return (
    <div
      className="rounded-xl p-3 animate-pulse"
      style={{
        backgroundColor: "var(--surface-intermediate)",
        border: "1px solid var(--border-primary)",
      }}
    >
      <div
        className="h-3 w-16 rounded mb-2"
        style={{ backgroundColor: "var(--border-primary, #2a2a2a)" }}
      />
      <div
        className="h-7 w-12 rounded mb-1"
        style={{ backgroundColor: "var(--border-primary, #2a2a2a)" }}
      />
      <div
        className="h-2 w-20 rounded"
        style={{ backgroundColor: "var(--border-primary, #2a2a2a)" }}
      />
    </div>
  );
}

function SkeletonPrompt() {
  return (
    <div
      className="rounded-xl px-3 py-2.5 animate-pulse flex items-center gap-3"
      style={{
        backgroundColor: "var(--surface-intermediate)",
        border: "1px solid var(--border-primary)",
      }}
    >
      <div
        className="h-8 w-8 rounded-lg flex-shrink-0"
        style={{ backgroundColor: "var(--border-primary, #2a2a2a)" }}
      />
      <div className="flex-1">
        <div
          className="h-3 w-full rounded mb-1.5"
          style={{ backgroundColor: "var(--border-primary, #2a2a2a)" }}
        />
        <div
          className="h-2 w-24 rounded"
          style={{ backgroundColor: "var(--border-primary, #2a2a2a)" }}
        />
      </div>
    </div>
  );
}

// ── Location pill ──────────────────────────────────────────────────────────

function LocationPill({
  county,
  state,
  status,
  onChangeClick,
}: {
  county: string;
  state: string;
  status: string;
  onChangeClick: () => void;
}) {
  const isResolving = status === "resolving";
  const label =
    county && state
      ? `${county} County, ${state}`
      : county
        ? county
        : isResolving
          ? "Detecting location..."
          : "Set your location";

  return (
    <button
      type="button"
      onClick={onChangeClick}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-all"
      style={{
        backgroundColor: "var(--surface-intermediate)",
        border: "1px solid var(--border-primary)",
        color: "var(--text-primary, #e5e5e5)",
      }}
      aria-label="Change location"
    >
      <span
        className="h-2 w-2 rounded-full flex-shrink-0"
        style={{
          backgroundColor: isResolving ? "#f97316" : "#22c55e",
          boxShadow: isResolving ? "0 0 6px #f97316" : "0 0 6px #22c55e",
        }}
      />
      <MapPin className="h-3 w-3 flex-shrink-0" style={{ color: "#f97316" }} />
      <span className="truncate max-w-[160px]">{label}</span>
      <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-50" />
    </button>
  );
}

// ── Manual location input ──────────────────────────────────────────────────

function LocationInput({
  onSubmit,
  onCancel,
}: {
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");

  return (
    <div
      className="rounded-xl p-4 mb-4"
      style={{
        backgroundColor: "var(--surface-intermediate)",
        border: "1px solid var(--border-primary)",
      }}
    >
      <p className="text-[12px] font-semibold text-white mb-3">Enter your city or zip code</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
            if (e.key === "Escape") onCancel();
          }}
          placeholder="e.g. Austin, TX or 78701"
          className="flex-1 rounded-lg px-3 py-2 text-[13px] text-white placeholder-[#555] outline-none"
          style={{
            backgroundColor: "var(--surface-card)",
            border: "1px solid #333",
          }}
          autoFocus
        />
        <button
          type="button"
          onClick={() => value.trim() && onSubmit(value.trim())}
          className="rounded-lg px-4 py-2 text-[12px] font-semibold transition-opacity"
          style={{ backgroundColor: "#f97316", color: "#000" }}
        >
          Go
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-2 text-[12px] font-medium"
          style={{
            backgroundColor: "var(--surface-intermediate, #222)",
            color: "var(--text-secondary, #aaa)",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Data tile ──────────────────────────────────────────────────────────────

function DataTile({
  label,
  value,
  delta,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string | number;
  delta?: string;
  icon: React.ElementType;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-1"
      style={{
        backgroundColor: "var(--surface-card)",
        border: `1px solid ${highlight ? "#f97316" : "var(--surface-intermediate, #1e1e1e)"}`,
        boxShadow: highlight ? "0 0 12px rgba(249,115,22,0.12)" : undefined,
      }}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="h-3 w-3" style={{ color: "#f97316" }} />
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--text-muted, #666)" }}
        >
          {label}
        </span>
      </div>
      <span
        className="text-[22px] font-bold leading-none"
        style={{ color: "var(--text-primary, #fff)", fontFamily: "'Sora', sans-serif" }}
      >
        {value}
      </span>
      {delta && (
        <span className="text-[10px] font-medium" style={{ color: "#f97316" }}>
          {delta}
        </span>
      )}
    </div>
  );
}

// ── County price signal item ───────────────────────────────────────────────

function PriceSignalItem({ signal, onClick }: { signal: PriceSignal; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-all"
      style={{
        backgroundColor: "var(--surface-card)",
        border: "1px solid #1e1e1e",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "#f97316";
        (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-intermediate)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--surface-intermediate, #1e1e1e)";
        (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-card)";
      }}
    >
      <span
        className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: "var(--surface-intermediate, #1e1e1e)", color: "#f97316" }}
      >
        <TrendingUp className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold leading-snug" style={{ color: "#f5f5f5" }}>
          {signal.label}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug" style={{ color: "var(--text-muted, #666)" }}>
          {signal.description}
        </p>
        <p className="mt-1 text-[10px] font-medium" style={{ color: "#f97316" }}>
          {formatPriceSignalFreshness(signal.updatedAt)}
        </p>
        <p className="mt-1 text-[10px] font-medium" style={{ color: "var(--text-muted, #777)" }}>
          {formatPriceSignalSource(signal)}
        </p>
      </div>
    </button>
  );
}

// ── Opportunity Radar move item ───────────────────────────────────────────

function moveTypeLabel(type: OpportunityMove["type"]): string {
  const labels: Record<OpportunityMove["type"], string> = {
    service_gap: "Service gap",
    underserved_area: "Underserved area",
    fast_win: "Fast win",
    partnership_target: "Partnership",
    audit_target: "Audit target",
  };
  return labels[type];
}

function OpportunityMoveItem({ move, onClick }: { move: OpportunityMove; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl px-3 py-3 text-left transition-all"
      style={{
        backgroundColor: "var(--surface-card)",
        border: "1px solid #1e1e1e",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "#f97316";
        (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-intermediate)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--surface-intermediate, #1e1e1e)";
        (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-card)";
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: "var(--surface-intermediate, #1e1e1e)", color: "#f97316" }}
        >
          <Radar className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase" style={{ color: "#f97316" }}>
              {moveTypeLabel(move.type)}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-muted, #555)" }}>
              {move.confidence} confidence
            </span>
          </div>
          <p className="mt-1 text-[13px] font-semibold leading-snug" style={{ color: "#f5f5f5" }}>
            {move.title}
          </p>
          <p className="mt-1 text-[11px] leading-snug" style={{ color: "var(--text-muted, #666)" }}>
            {move.whyItMatters}
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[10px] font-medium" style={{ color: "var(--text-muted, #777)" }}>
              {move.sourceLabel}
            </span>
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold"
              style={{ color: "#f97316" }}
            >
              {move.actionLabel}
              <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Trending prompt chip ───────────────────────────────────────────────────

function PromptChip({
  icon,
  text,
  category,
  onClick,
}: {
  icon: string;
  text: string;
  category: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all group"
      style={{
        backgroundColor: "var(--surface-card)",
        border: "1px solid #1e1e1e",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "#f97316";
        (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-intermediate)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--surface-intermediate, #1e1e1e)";
        (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-card)";
      }}
    >
      <span
        className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-base"
        style={{ backgroundColor: "var(--surface-intermediate, #1e1e1e)" }}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] font-medium leading-snug truncate"
          style={{ color: "var(--text-primary, #e5e5e5)" }}
        >
          {text}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted, #555)" }}>
          {category}
        </p>
      </div>
      <span className="flex-shrink-0 text-[#333] group-hover:text-[#f97316] transition-colors">
        →
      </span>
    </button>
  );
}

// ── Recent activity item ───────────────────────────────────────────────────

function ActivityItem({
  icon,
  query,
  timestamp,
  onClick,
}: {
  icon: string;
  query: string;
  timestamp: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all"
      style={{
        backgroundColor: "var(--surface-card)",
        border: "1px solid #1a1a1a",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border-primary, #2a2a2a)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border-primary)";
      }}
    >
      <span className="text-base flex-shrink-0">{icon}</span>
      <p
        className="flex-1 text-[12px] leading-snug truncate"
        style={{ color: "var(--text-secondary, #aaa)" }}
      >
        {query}
      </p>
      <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-muted, #444)" }}>
        {timeAgo(timestamp)}
      </span>
    </button>
  );
}

// ── Scout 2 capability card ───────────────────────────────────────────────

function CapabilityCard({
  icon: Icon,
  title,
  detail,
  prompt,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  detail: string;
  prompt: string;
  onClick: (prompt: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(prompt)}
      className="group flex min-h-[92px] flex-col items-start rounded-xl px-3 py-3 text-left transition-all"
      style={{
        backgroundColor: "var(--surface-card)",
        border: "1px solid var(--surface-intermediate, #1e1e1e)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "#f97316";
        (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-intermediate)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--surface-intermediate, #1e1e1e)";
        (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-card)";
      }}
    >
      <span
        className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ backgroundColor: "var(--surface-intermediate, #1e1e1e)", color: "#f97316" }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span
        className="text-[13px] font-semibold leading-tight"
        style={{ color: "var(--text-primary, #e5e5e5)" }}
      >
        {title}
      </span>
      <span className="mt-1 text-[11px] leading-snug" style={{ color: "var(--text-muted, #666)" }}>
        {detail}
      </span>
    </button>
  );
}

// ── Section label ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span
        className="text-[10px] font-bold uppercase tracking-[0.16em]"
        style={{ color: "var(--text-muted, #555)" }}
      >
        {children}
      </span>
      <div
        className="flex-1 h-px"
        style={{ backgroundColor: "var(--surface-intermediate, #1e1e1e)" }}
      />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ScoutHome({ onPromptSelect }: ScoutHomeProps) {
  const { location, setManualLocation, clearLocation } = useScoutLocation();
  const { status: fetchStatus, data } = useScoutHomeSnapshot(location);
  const [showLocationInput, setShowLocationInput] = useState(false);

  const handleLocationChange = useCallback(() => {
    setShowLocationInput(true);
  }, []);

  const handleLocationSubmit = useCallback(
    (value: string) => {
      setShowLocationInput(false);
      setManualLocation(value);
    },
    [setManualLocation]
  );

  const isLoading = fetchStatus === "loading" || location.status === "resolving";
  const snapshot = data?.snapshot;
  const prompts = data?.trendingPrompts ?? [];
  const recentActivity = data?.recentActivity ?? [];
  const priceSignals = data?.priceSignals ?? [];
  const opportunityMoves = data?.opportunityMoves ?? [];
  const capabilityIcons: Record<ScoutCapabilityId, React.ElementType> = {
    plan: ClipboardList,
    intake: ListChecks,
    local_help: Wrench,
    materials: PackageSearch,
    prices: TrendingUp,
    compare: Brain,
    trust: ShieldCheck,
    saved: Archive,
    community: Users,
    exchange: ShoppingBag,
    homescout: Home,
    community_vault: ShieldCheck,
    finance: ClipboardList,
  };

  const countyDisplay = snapshot?.countyName
    ? `${snapshot.countyName}${snapshot.stateName ? `, ${snapshot.stateName}` : ""}`
    : location.county
      ? `${location.county}${location.state ? `, ${location.state}` : ""}`
      : "";

  return (
    <div className="flex flex-col gap-4 w-full pb-2">
      {/* ── Location pill ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <LocationPill
          county={snapshot?.countyName ?? location.county}
          state={snapshot?.stateName ?? location.state}
          status={location.status}
          onChangeClick={handleLocationChange}
        />
        {location.source !== "default" && location.status === "resolved" && (
          <button
            type="button"
            onClick={clearLocation}
            className="text-[10px] font-medium"
            style={{ color: "var(--text-muted, #444)" }}
          >
            Reset
          </button>
        )}
      </div>

      {/* ── Manual location input ───────────────────────────────────────── */}
      {showLocationInput && (
        <LocationInput
          onSubmit={handleLocationSubmit}
          onCancel={() => setShowLocationInput(false)}
        />
      )}

      {/* ── Location error prompt ───────────────────────────────────────── */}
      {location.status === "error" && !showLocationInput && (
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{
            backgroundColor: "var(--surface-intermediate)",
            border: "1px solid var(--border-primary)",
          }}
        >
          <MapPin className="h-4 w-4 flex-shrink-0" style={{ color: "#f97316" }} />
          <div className="flex-1">
            <p className="text-[12px] font-medium text-white">
              We couldn't detect your location automatically.
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted, #666)" }}>
              Enter your city or zip to get local results.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowLocationInput(true)}
            className="rounded-lg px-3 py-1.5 text-[11px] font-semibold flex-shrink-0"
            style={{ backgroundColor: "#f97316", color: "#000" }}
          >
            Set Location
          </button>
        </div>
      )}

      {/* ── Ready card ─────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl px-4 py-4 relative overflow-hidden"
        style={{
          backgroundColor: "var(--surface-card)",
          border: "1px solid #1e1e1e",
        }}
      >
        {/* Subtle orange glow top-right */}
        <div
          className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)",
            transform: "translate(30%, -30%)",
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-3.5 w-3.5" style={{ color: "#f97316" }} />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "#f97316" }}
            >
              Scout is ready
            </span>
          </div>
          <h2
            className="text-[20px] font-bold leading-tight text-white mb-1"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            What do you need help with today?
          </h2>
          <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-muted, #666)" }}>
            Scout helps you find local help, compare options, and know what to check before
            contacting anyone.
            {countyDisplay ? ` Scout knows ${countyDisplay}.` : ""}
          </p>
        </div>
      </div>

      {/* ── Scout 2 capability map ─────────────────────────────────────── */}
      <SectionLabel>What Scout can help with</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        {SCOUT_CAPABILITY_COPY.map((capability) => (
          <CapabilityCard
            key={capability.title}
            icon={capabilityIcons[capability.id]}
            title={capability.title}
            detail={capability.detail}
            prompt={capability.prompt}
            onClick={onPromptSelect}
          />
        ))}
      </div>

      {/* ── Local Snapshot ─────────────────────────────────────────────── */}
      {countyDisplay && (
        <>
          <SectionLabel>What Scout can check nearby · {countyDisplay}</SectionLabel>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-2">
              <SkeletonTile />
              <SkeletonTile />
              <SkeletonTile />
              <SkeletonTile />
            </div>
          ) : snapshot ? (
            <div className="grid grid-cols-2 gap-2">
              <DataTile
                label="Local listings"
                value={formatCount(snapshot.activeListings)}
                delta={formatDelta(snapshot.activeListingsDelta)}
                icon={ShoppingBag}
                highlight={snapshot.activeListings > 0}
              />
              <DataTile
                label="Local help"
                value={formatCount(snapshot.verifiedPros)}
                icon={Wrench}
              />
              <DataTile
                label="This week"
                value={snapshot.eventsThisWeek}
                delta={snapshot.eventsToday > 0 ? `${snapshot.eventsToday} today` : undefined}
                icon={Calendar}
              />
              <DataTile
                label="Community"
                value={formatCount(snapshot.communityMembers)}
                icon={Users}
              />
            </div>
          ) : null}
        </>
      )}

      {/* ── Opportunity Radar ─────────────────────────────────────────── */}
      {countyDisplay && opportunityMoves.length > 0 && (
        <>
          <SectionLabel>
            <Radar className="h-3 w-3 inline mr-1" style={{ color: "#f97316" }} />
            Opportunity Radar
          </SectionLabel>
          <div className="flex flex-col gap-2">
            {opportunityMoves.map((move) => (
              <OpportunityMoveItem
                key={move.id}
                move={move}
                onClick={() => onPromptSelect(move.prompt)}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Price Signal Freshness ─────────────────────────────────────── */}
      {countyDisplay && priceSignals.length > 0 && (
        <>
          <SectionLabel>
            <Clock className="h-3 w-3 inline mr-1" style={{ color: "#f97316" }} />
            Price signal freshness
          </SectionLabel>
          <div className="flex flex-col gap-2">
            {priceSignals.slice(0, 3).map((signal) => (
              <PriceSignalItem
                key={signal.id}
                signal={signal}
                onClick={() =>
                  onPromptSelect(
                    `Check prices and local trends using the latest ${signal.label} snapshot.`
                  )
                }
              />
            ))}
          </div>
        </>
      )}

      {/* ── Trending Prompts ────────────────────────────────────────────── */}
      <SectionLabel>
        <TrendingUp className="h-3 w-3 inline mr-1" style={{ color: "#f97316" }} />
        {countyDisplay
          ? `Trending in ${snapshot?.countyName ?? location.county}`
          : "Try Asking Scout"}
      </SectionLabel>

      <div className="flex flex-col gap-2">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonPrompt key={i} />)
          : prompts.map((prompt) => (
              <PromptChip
                key={prompt.id}
                icon={prompt.icon}
                text={prompt.text}
                category={prompt.category}
                onClick={() => onPromptSelect(prompt.text)}
              />
            ))}
      </div>

      {/* ── Recent Activity ─────────────────────────────────────────────── */}
      {recentActivity.length > 0 && (
        <>
          <SectionLabel>
            <Clock className="h-3 w-3 inline mr-1" />
            Recent Activity
          </SectionLabel>
          <div className="flex flex-col gap-1.5">
            {recentActivity.map((item) => (
              <ActivityItem
                key={item.id}
                icon={item.icon}
                query={item.query}
                timestamp={item.timestamp}
                onClick={() => onPromptSelect(item.query)}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Trust footer ────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2.5"
        style={{ backgroundColor: "var(--surface-card, #0d0d0d)", border: "1px solid #1a1a1a" }}
      >
        <span className="text-[11px]" style={{ color: "var(--text-muted, #444)" }}>
          🛡
        </span>
        <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted, #444)" }}>
          Results sourced from verified providers and the{" "}
          <span style={{ color: "#f97316" }}>Trade Scout Community</span>. Scout never charges for
          placement or ranking.
        </p>
      </div>
    </div>
  );
}
