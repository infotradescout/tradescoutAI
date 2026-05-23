import {
  ArrowRight,
  Bell,
  Calendar,
  Car,
  ChevronRight,
  CircleDollarSign,
  Home,
  MapPin,
  Search,
  ShieldCheck,
  Tag,
  UserCircle2,
  Users2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useScoutLocation } from "./hooks/useScoutLocation";
import {
  useScoutHomeSnapshot,
  type OpportunityMove,
  type PriceSignal,
} from "./hooks/useScoutHomeSnapshot";

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
  subtitle: string;
  status: string;
  statusClass: string;
  prompt: string;
  icon: LucideIcon;
  imageUrl: string;
}

interface SignalRowData {
  id: string;
  title: string;
  detail: string;
  freshness: string;
  prompt: string;
  icon: LucideIcon;
  iconClass: string;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function prettyTimeAgo(value: string): string {
  const lower = String(value || "")
    .toLowerCase()
    .trim();
  if (!lower) return "Now";
  if (lower.includes("today")) return "2h ago";
  if (lower.includes("week")) return "4h ago";
  if (lower.includes("live")) return "2h ago";
  if (lower.includes("now")) return "2h ago";
  return value;
}

function locationZipHint(locationLabel: string): string {
  const digits = locationLabel.match(/\b\d{5}\b/);
  return digits?.[0] ?? "70401";
}

function humanizeThreadIntent(intent?: string | null) {
  const i = String(intent || "").toLowerCase();
  if (i === "client_work" || i === "project" || i === "client" || i === "local_help") {
    return "Home project";
  }
  if (i === "vehicle" || i === "vehicles") return "Vehicle service";
  if (i === "local_request") return "Local request";
  return "Saved search";
}

function continuityIconForThread(thread: ContinuityThread) {
  if (thread.relatedTo?.kind === "vehicle") return Car;
  if (thread.relatedTo?.kind === "home" || thread.relatedTo?.kind === "project") return Home;
  if (
    thread.intent === "local_request" ||
    thread.intent === "client_work" ||
    thread.intent === "client"
  ) {
    return Calendar;
  }
  if (thread.intent === "prices" || thread.intent === "materials") return Search;
  return Wrench;
}

function continuityImageForTitle(title: string) {
  const key = title.toLowerCase();
  if (key.includes("home")) {
    return "https://images.unsplash.com/photo-1616593969747-4797dc75033e?auto=format&fit=crop&w=900&q=80";
  }
  if (key.includes("vehicle")) {
    return "https://images.unsplash.com/photo-1610647752706-3bb12232b3ab?auto=format&fit=crop&w=900&q=80";
  }
  if (key.includes("request")) {
    return "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80";
  }
  return "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=900&q=80";
}

function statusPillClass(status: string) {
  const s = status.toLowerCase();
  if (s.includes("review")) return "bg-amber-500/18 text-amber-300";
  if (s.includes("approval")) return "bg-emerald-500/18 text-emerald-300";
  if (s.includes("matches")) return "bg-blue-500/18 text-blue-300";
  return "bg-violet-500/18 text-violet-300";
}

function continuationStatusFromThread(intent?: string | null, msgCount?: number) {
  if (msgCount && msgCount > 4) return "Waiting on review";
  if (msgCount && msgCount > 1) return "Needs approval";
  if (msgCount === 1) return "Needs next step";
  if (intent === "local_request") return "2 quotes received";
  return "Waiting on review";
}

function ScoutHeader({
  locationLabel,
  onProfileClick,
  onNotificationsClick,
}: {
  locationLabel: string;
  onProfileClick: () => void;
  onNotificationsClick: () => void;
}) {
  return (
    <header className="space-y-2">
      <div className="flex items-center justify-between border-b border-[color:var(--border-subtle)] pb-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--surface-card)] border border-[color:var(--border-subtle)]">
            <ShieldCheck className="h-5 w-5 text-ts-orange" />
          </span>
          <p className="text-2xl font-semibold tracking-tight text-[color:var(--text-primary)]">
            TradeScout
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNotificationsClick}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onProfileClick}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ts-orange/40 bg-ts-orange/10 text-ts-orange transition hover:bg-ts-orange/20"
            aria-label="Profile"
          >
            <UserCircle2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      <h1 className="text-6xl font-bold leading-none tracking-tight text-[color:var(--text-primary)]">
        Scout
      </h1>

      <button
        type="button"
        className="inline-flex items-center gap-2 text-4xl text-[color:var(--text-secondary)]"
        aria-label="Location"
      >
        <MapPin className="h-5 w-5 text-ts-orange" />
        <span>{locationLabel || "Hammond, LA 70401"}</span>
        <ChevronRight className="h-4 w-4 rotate-90" />
      </button>

      <p className="text-3xl leading-relaxed text-[color:var(--text-secondary)]">
        Your local hub to find, fix, buy, sell, and stay in the know.
      </p>
    </header>
  );
}

function ContinueCard({
  label,
  subtitle,
  status,
  statusClass,
  onClick,
  Icon,
  imageUrl,
}: {
  label: string;
  subtitle: string;
  status: string;
  statusClass: string;
  onClick: () => void;
  Icon: LucideIcon;
  imageUrl: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-[230px] shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-[color:var(--surface-card)] text-left"
    >
      <div
        className="h-[132px] w-full bg-cover bg-center"
        style={{ backgroundImage: `url('${imageUrl}')` }}
      >
        <span className="ml-3 mt-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black/45 text-white backdrop-blur">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="space-y-1 p-3">
        <p className="text-2xl font-semibold text-[color:var(--text-primary)]">{label}</p>
        <p className="text-lg text-[color:var(--text-secondary)]">{subtitle}</p>
        <span
          className={`mt-1 inline-flex rounded-full px-3 py-1 text-base font-semibold ${statusClass}`}
        >
          {status}
        </span>
      </div>
    </button>
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
  const zip = locationZipHint(localLabel);

  const fallback: ContinuityCard[] = [
    {
      id: "home-project",
      title: "Home project",
      subtitle: "Fence quote",
      status: "Waiting on review",
      statusClass: statusPillClass("Waiting on review"),
      prompt: "Continue the home project from before.",
      icon: Wrench,
      imageUrl: continuityImageForTitle("home"),
    },
    {
      id: "vehicle-service",
      title: "Vehicle service",
      subtitle: "2018 F-150 service",
      status: "Needs approval",
      statusClass: statusPillClass("Needs approval"),
      prompt: "Continue vehicle service work in progress.",
      icon: Car,
      imageUrl: continuityImageForTitle("vehicle"),
    },
    {
      id: "saved-search",
      title: "Saved search",
      subtitle: `Homes in ${zip}`,
      status: "4 new matches",
      statusClass: statusPillClass("4 matches"),
      prompt: "Continue my saved local search.",
      icon: Search,
      imageUrl: continuityImageForTitle("search"),
    },
    {
      id: "local-request",
      title: "Local request",
      subtitle: "Pressure washing",
      status: "2 quotes received",
      statusClass: statusPillClass("quotes"),
      prompt: "Continue local request follow-up.",
      icon: Calendar,
      imageUrl: continuityImageForTitle("request"),
    },
  ];

  const fromThreads: ContinuityCard[] = (continuationThreads || []).map((thread) => {
    const title = humanizeThreadIntent(thread.intent);
    return {
      id: thread.id,
      title,
      subtitle: thread.relatedLabel || thread.preview || thread.title || "Local item",
      status: continuationStatusFromThread(thread.intent, thread.messageCount ?? undefined),
      statusClass: statusPillClass(
        continuationStatusFromThread(thread.intent, thread.messageCount ?? undefined)
      ),
      prompt: thread.summary || thread.preview || thread.title || "Continue this thread.",
      icon: continuityIconForThread(thread),
      imageUrl: continuityImageForTitle(title),
    };
  });

  const fromPrompts: ContinuityCard[] = prompts.slice(0, 4).map((prompt) => {
    const mappedLabel =
      prompt.intent === "contractor" || prompt.intent === "realtor"
        ? "Home project"
        : prompt.intent === "marketplace"
          ? "Saved search"
          : prompt.intent === "vehicle"
            ? "Vehicle service"
            : "Local request";
    const subtitle =
      mappedLabel === "Home project"
        ? "Fence quote"
        : mappedLabel === "Vehicle service"
          ? "2018 F-150 service"
          : mappedLabel === "Saved search"
            ? `Homes in ${zip}`
            : "Pressure washing";

    const status =
      mappedLabel === "Home project"
        ? "Waiting on review"
        : mappedLabel === "Vehicle service"
          ? "Needs approval"
          : mappedLabel === "Saved search"
            ? "4 new matches"
            : "2 quotes received";

    return {
      id: prompt.id,
      title: mappedLabel,
      subtitle,
      status,
      statusClass: statusPillClass(status),
      prompt: `Continue ${mappedLabel.toLowerCase()} work.`,
      icon:
        mappedLabel === "Home project"
          ? Wrench
          : mappedLabel === "Vehicle service"
            ? Car
            : mappedLabel === "Saved search"
              ? Search
              : Calendar,
      imageUrl: continuityImageForTitle(mappedLabel),
    };
  });

  const cards =
    fromThreads.length > 0
      ? fromThreads.slice(0, 4)
      : fromPrompts.length > 0
        ? fromPrompts
        : fallback;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-4xl font-semibold text-[color:var(--text-primary)]">
          Continue where you left off
        </h2>
        <button
          type="button"
          className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--text-secondary)]"
          aria-label="Next"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cards.map((item) => (
          <div key={item.id} className="snap-start">
            <ContinueCard
              label={item.title}
              subtitle={item.subtitle}
              status={item.status}
              statusClass={item.statusClass}
              Icon={item.icon}
              imageUrl={item.imageUrl}
              onClick={() => onPromptSelect(item.prompt)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function LaneCard({
  icon: Icon,
  title,
  detail,
  iconClass,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  iconClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-3xl border border-white/10 bg-[color:var(--surface-card)]/90 px-4 py-3 text-left"
    >
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${iconClass}`}
        >
          <Icon className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-4xl font-semibold text-[color:var(--text-primary)]">{title}</p>
          <p className="text-xl leading-tight text-[color:var(--text-secondary)]">{detail}</p>
        </div>
        <ChevronRight className="h-6 w-6 text-[color:var(--text-secondary)]" />
      </div>
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
      iconClass: "bg-amber-500/20 text-amber-300",
    },
    {
      title: "Vehicles",
      detail: "Service, repairs, records, selling",
      prompt: "Help me with a vehicle service issue or sale.",
      icon: Car,
      iconClass: "bg-emerald-500/20 text-emerald-300",
    },
    {
      title: "Projects",
      detail: "Requests, quotes, jobs, updates",
      prompt: "Help me manage a local project request.",
      icon: Wrench,
      iconClass: "bg-rose-500/20 text-rose-300",
    },
    {
      title: "Listings",
      detail: "Tools, materials, vehicles, property",
      prompt: "Help me with a listing or item search.",
      icon: Tag,
      iconClass: "bg-orange-500/20 text-orange-300",
    },
    {
      title: "People",
      detail: "Local help and saved providers",
      prompt: "Help me find local people for this work.",
      icon: UserCircle2,
      iconClass: "bg-violet-500/20 text-violet-300",
    },
    {
      title: "Community",
      detail: "Posts, events, nearby activity",
      prompt: "Show me nearby community activity.",
      icon: Users2,
      iconClass: "bg-cyan-500/20 text-cyan-300",
    },
  ];

  return (
    <section className="space-y-2">
      <h2 className="text-4xl font-semibold text-[color:var(--text-primary)]">
        Explore around you
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lanes.map((lane) => (
          <LaneCard
            key={lane.title}
            icon={lane.icon}
            iconClass={lane.iconClass}
            title={lane.title}
            detail={lane.detail}
            onClick={() => onPromptSelect(lane.prompt)}
          />
        ))}
      </div>
    </section>
  );
}

function moveToSignal(move: OpportunityMove): SignalRowData {
  const byId: Record<string, Omit<SignalRowData, "id" | "prompt">> = {
    "completed-job-demand": {
      title: "Repair activity is picking up",
      detail: "More fence and deck projects nearby",
      freshness: "2h ago",
      icon: ArrowRight,
      iconClass: "bg-amber-500/20 text-amber-300",
    },
    "homescout-seller-audit": {
      title: "Home prices shifted nearby",
      detail: "3 similar homes changed price this week",
      freshness: "4h ago",
      icon: Home,
      iconClass: "bg-emerald-500/20 text-emerald-300",
    },
    "tradedeals-fast-win": {
      title: "Local offers are moving",
      detail: "New deals on trucks and tools today",
      freshness: "6h ago",
      icon: Tag,
      iconClass: "bg-orange-500/20 text-orange-300",
    },
    "community-partnership-window": {
      title: "Events are active this week",
      detail: "2 community events happening nearby",
      freshness: "8h ago",
      icon: Calendar,
      iconClass: "bg-violet-500/20 text-violet-300",
    },
  };

  const mapped = byId[move.id];
  if (mapped) {
    return { id: move.id, prompt: move.prompt, ...mapped };
  }

  return {
    id: move.id,
    title: move.title,
    detail: move.whyItMatters,
    freshness: "Now",
    prompt: move.prompt,
    icon: CircleDollarSign,
    iconClass: "bg-blue-500/20 text-blue-300",
  };
}

function priceToSignal(signal: PriceSignal): SignalRowData {
  return {
    id: signal.id,
    title: signal.label,
    detail: signal.description,
    freshness: prettyTimeAgo(signal.updatedAt ? "Today" : "Now"),
    prompt: `Check prices and local trends using ${signal.label}.`,
    icon: CircleDollarSign,
    iconClass: "bg-blue-500/20 text-blue-300",
  };
}

function SignalRow({
  title,
  detail,
  freshness,
  Icon,
  iconClass,
  onClick,
}: {
  title: string;
  detail: string;
  freshness: string;
  Icon: LucideIcon;
  iconClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-white/10 px-3 py-3 text-left last:border-b-0"
    >
      <span
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconClass}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <p className="text-3xl font-semibold text-[color:var(--text-primary)]">{title}</p>
        <p className="text-xl text-[color:var(--text-secondary)]">{detail}</p>
      </span>
      <span className="shrink-0 text-xl text-[color:var(--text-secondary)]">
        {prettyTimeAgo(freshness)}
        <ChevronRight className="ml-1 inline h-4 w-4" />
      </span>
    </button>
  );
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
  const mapped = [
    ...opportunityMoves.slice(0, 4).map(moveToSignal),
    ...priceSignals.slice(0, 2).map(priceToSignal),
  ];

  const fallback: SignalRowData[] = [
    {
      id: "fallback-1",
      title: "Repair activity is picking up",
      detail: "More fence and deck projects nearby",
      freshness: "2h ago",
      prompt: "Show me what is moving around me this week.",
      icon: ArrowRight,
      iconClass: "bg-amber-500/20 text-amber-300",
    },
    {
      id: "fallback-2",
      title: "Home prices shifted nearby",
      detail: "3 similar homes changed price this week",
      freshness: "4h ago",
      prompt: "Any local home-market changes today?",
      icon: Home,
      iconClass: "bg-emerald-500/20 text-emerald-300",
    },
    {
      id: "fallback-3",
      title: "Local offers are moving",
      detail: "New deals on trucks and tools today",
      freshness: "6h ago",
      prompt: "Any local marketplace changes today?",
      icon: Tag,
      iconClass: "bg-orange-500/20 text-orange-300",
    },
    {
      id: "fallback-4",
      title: "Events are active this week",
      detail: "2 community events happening nearby",
      freshness: "8h ago",
      prompt: "Show nearby events and activity this week.",
      icon: Calendar,
      iconClass: "bg-violet-500/20 text-violet-300",
    },
  ];

  const rows = mapped.length ? mapped.slice(0, 4) : fallback;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-4xl font-semibold text-[color:var(--text-primary)]">
          Nearby right now
        </h2>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-2xl font-semibold text-ts-orange"
        >
          See all
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[color:var(--surface-card)]/85">
        {rows.map((signal) => (
          <SignalRow
            key={signal.id}
            title={signal.title}
            detail={signal.detail}
            freshness={signal.freshness}
            Icon={signal.icon}
            iconClass={signal.iconClass}
            onClick={() => onPromptSelect(signal.prompt)}
          />
        ))}
      </div>
    </section>
  );
}

function StatusMetricCard({
  label,
  value,
  delta,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string;
  delta: string;
  icon: LucideIcon;
  iconClass: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[color:var(--surface-card)]/90 p-3">
      <div className="flex items-start gap-2">
        <span
          className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${iconClass}`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-5xl font-semibold leading-none text-[color:var(--text-primary)]">
            {value}
          </p>
          <p className="mt-1 text-2xl text-[color:var(--text-secondary)]">{label}</p>
          <p className="text-2xl font-semibold text-ts-orange">{delta}</p>
        </div>
      </div>
    </div>
  );
}

function StatusMetricGrid({
  snapshot,
}: {
  snapshot:
    | {
        activeListings: number;
        verifiedPros: number;
        eventsThisWeek: number;
        communityMembers: number;
      }
    | undefined;
}) {
  if (!snapshot) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-4xl font-semibold text-[color:var(--text-primary)]">Local snapshot</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatusMetricCard
          label="Listings"
          value={formatCount(snapshot.activeListings)}
          delta="+12 today"
          icon={Tag}
          iconClass="bg-amber-500/20 text-amber-300"
        />
        <StatusMetricCard
          label="Local help"
          value={formatCount(snapshot.verifiedPros)}
          delta="+5 this week"
          icon={UserCircle2}
          iconClass="bg-emerald-500/20 text-emerald-300"
        />
        <StatusMetricCard
          label="Events"
          value={String(snapshot.eventsThisWeek)}
          delta="This week"
          icon={Calendar}
          iconClass="bg-violet-500/20 text-violet-300"
        />
        <StatusMetricCard
          label="Members"
          value={formatCount(snapshot.communityMembers)}
          delta="+34 this week"
          icon={Users2}
          iconClass="bg-cyan-500/20 text-cyan-300"
        />
      </div>
    </section>
  );
}

export function ScoutHome({ onPromptSelect, continuationThreads = [] }: ScoutHomeProps) {
  const { location } = useScoutLocation();
  const { data } = useScoutHomeSnapshot(location);
  const localLabel = location.label || "Hammond, LA 70401";

  return (
    <div className="flex w-full flex-col gap-5 pb-2">
      <ScoutHeader
        locationLabel={localLabel}
        onNotificationsClick={() => onPromptSelect("Show my latest local notifications.")}
        onProfileClick={() => onPromptSelect("Open my profile and settings.")}
      />
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
        onPromptSelect={onPromptSelect}
      />
      <StatusMetricGrid snapshot={data?.snapshot} />
    </div>
  );
}
