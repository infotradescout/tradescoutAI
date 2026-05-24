import {
  Calendar,
  Car,
  ChevronDown,
  ChevronRight,
  Hammer,
  Home,
  MapPin,
  Search,
  Tag,
  UserCircle2,
  Users2,
  UsersRound,
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

type ContinueItem = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  tone: "orange" | "green" | "blue" | "purple";
  icon: LucideIcon;
  prompt: string;
};

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function continuityIconForThread(thread: ContinuityThread): LucideIcon {
  if (thread.relatedTo?.kind === "vehicle") return Car;
  if (thread.relatedTo?.kind === "home") return Home;
  if (thread.relatedTo?.kind === "project") return Hammer;
  if (thread.intent === "prices" || thread.intent === "materials") return Search;
  if (thread.intent === "local_request") return Calendar;
  return Wrench;
}

function statusFromThread(thread: ContinuityThread): string {
  const count = thread.messageCount ?? 0;
  const intent = String(thread.intent || "").toLowerCase();
  if (intent === "local_request") return "Waiting on response";
  if (count > 4) return "Waiting on review";
  if (count > 1) return "Needs approval";
  if (count === 1) return "Needs next step";
  return "In progress";
}

function toneFromIntent(intent?: string | null): ContinueItem["tone"] {
  const i = String(intent || "").toLowerCase();
  if (i === "vehicle") return "green";
  if (i === "prices" || i === "materials") return "blue";
  if (i === "local_request") return "purple";
  return "orange";
}

function normalizeThreadTitle(thread: ContinuityThread): string {
  const i = String(thread.intent || "").toLowerCase();
  if (i === "vehicle") return "Vehicle service";
  if (i === "prices" || i === "materials") return "Saved search";
  if (i === "local_request") return "Local request";
  return "Home project";
}

function buildContinueItems(threads: Array<ContinuityThread> = []): ContinueItem[] {
  const realItems = threads
    .filter((thread) => Boolean(thread.id))
    .slice(0, 6)
    .map((thread) => ({
      id: thread.id,
      title: normalizeThreadTitle(thread),
      subtitle: thread.relatedLabel || thread.preview || thread.title || "Local item",
      status: statusFromThread(thread),
      tone: toneFromIntent(thread.intent),
      icon: continuityIconForThread(thread),
      prompt: thread.summary || thread.preview || thread.title || "Continue this local item.",
    }));

  if (realItems.length > 0) return realItems;

  return [
    {
      id: "fallback-home",
      title: "Home project",
      subtitle: "Fence quote",
      status: "Waiting on review",
      tone: "orange",
      icon: Wrench,
      prompt: "Continue my home project.",
    },
    {
      id: "fallback-vehicle",
      title: "Vehicle service",
      subtitle: "2018 F-150 service",
      status: "Needs approval",
      tone: "green",
      icon: Car,
      prompt: "Continue my vehicle service request.",
    },
    {
      id: "fallback-search",
      title: "Saved search",
      subtitle: "Homes in 70401",
      status: "4 new matches",
      tone: "blue",
      icon: Search,
      prompt: "Continue my saved local search.",
    },
    {
      id: "fallback-request",
      title: "Local request",
      subtitle: "Pressure washing",
      status: "2 quotes received",
      tone: "purple",
      icon: Calendar,
      prompt: "Continue my local request.",
    },
  ];
}

function toneClasses(tone: ContinueItem["tone"]): {
  visual: string;
  badge: string;
} {
  if (tone === "green") {
    return {
      visual: "from-emerald-900/70 to-emerald-600/30",
      badge: "bg-emerald-500/15 text-emerald-400",
    };
  }
  if (tone === "blue") {
    return {
      visual: "from-blue-900/70 to-blue-600/30",
      badge: "bg-blue-500/15 text-blue-400",
    };
  }
  if (tone === "purple") {
    return {
      visual: "from-violet-900/70 to-violet-600/30",
      badge: "bg-violet-500/15 text-violet-400",
    };
  }
  return {
    visual: "from-amber-900/70 to-amber-600/30",
    badge: "bg-orange-500/15 text-orange-400",
  };
}

function ScoutHero({ locationLabel }: { locationLabel?: string }) {
  return (
    <section className="px-4 pt-5 pb-2">
      <h1 className="text-5xl font-black tracking-tight text-white">Scout</h1>
      <button type="button" className="mt-3 inline-flex items-center gap-2 text-lg text-zinc-300">
        <MapPin className="h-5 w-5 text-ts-orange" />
        {locationLabel || "Set location"}
        <ChevronDown className="h-4 w-4" />
      </button>
      <p className="mt-3 max-w-[340px] text-[15px] leading-snug text-zinc-400">
        Find, fix, sell, check, or continue anything local.
      </p>
    </section>
  );
}

function ContinueCard({
  item,
  onPromptSelect,
}: {
  item: ContinueItem;
  onPromptSelect: (prompt: string) => void;
}) {
  const { visual, badge } = toneClasses(item.tone);
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onPromptSelect(item.prompt)}
      className="w-[160px] flex-[0_0_160px] snap-start overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-left"
    >
      <div className={`relative h-[96px] bg-gradient-to-br ${visual}`}>
        <div className="absolute left-2 top-2 rounded-xl bg-orange-500 p-2">
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
      <div className="p-3">
        <p className="text-[15px] font-bold text-white">{item.title}</p>
        <p className="mt-1 text-[13px] text-zinc-400">{item.subtitle}</p>
        <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${badge}`}>
          {item.status}
        </span>
      </div>
    </button>
  );
}

function ContinueRail({
  items,
  onPromptSelect,
}: {
  items: ContinueItem[];
  onPromptSelect: (prompt: string) => void;
}) {
  return (
    <section className="px-4 pt-2">
      <h2 className="text-4xl font-semibold leading-none text-white">
        Continue where you left off
      </h2>
      <div className="-mx-4 overflow-x-auto px-4 scrollbar-hide">
        <div className="mt-3 flex snap-x snap-mandatory gap-3">
          {items.map((item) => (
            <ContinueCard key={item.id} item={item} onPromptSelect={onPromptSelect} />
          ))}
        </div>
      </div>
    </section>
  );
}

const EXPLORE_ITEMS: Array<{
  title: string;
  detail: string;
  icon: LucideIcon;
  prompt: string;
}> = [
  {
    title: "Homes",
    detail: "Repairs, records, inspections",
    icon: Home,
    prompt: "Search homes, repairs, records, inspections, or projects near me.",
  },
  {
    title: "Vehicles",
    detail: "Service, repairs, records",
    icon: Car,
    prompt: "Search vehicle service, repairs, records, or listings near me.",
  },
  {
    title: "Projects",
    detail: "Requests, quotes, jobs",
    icon: Hammer,
    prompt: "Search projects, quotes, jobs, and updates.",
  },
  {
    title: "Listings",
    detail: "Tools, materials, vehicles",
    icon: Tag,
    prompt: "Search local listings for tools, materials, vehicles, or property.",
  },
  {
    title: "People",
    detail: "Local help, saved providers",
    icon: Users2,
    prompt: "Search local help and saved providers near me.",
  },
  {
    title: "Community",
    detail: "Posts, events, activity",
    icon: UsersRound,
    prompt: "Search local posts, events, and nearby activity.",
  },
];

function ExploreGrid({ onPromptSelect }: { onPromptSelect: (prompt: string) => void }) {
  return (
    <section className="px-4 pt-4">
      <h2 className="text-4xl font-semibold leading-none text-white">Explore around you</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {EXPLORE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              type="button"
              onClick={() => onPromptSelect(item.prompt)}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-left"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-ts-orange" />
                <p className="text-[15px] font-semibold text-white">{item.title}</p>
              </div>
              <div className="mt-1 flex items-start justify-between gap-2">
                <p className="text-[12px] leading-tight text-zinc-400">{item.detail}</p>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const MOVE_COPY: Record<
  string,
  { title: string; detail: string; icon: LucideIcon; iconClass: string }
> = {
  "completed-job-demand": {
    title: "Repair activity is picking up",
    detail: "More home projects are moving nearby.",
    icon: Wrench,
    iconClass: "bg-amber-500/20 text-amber-300",
  },
  "homescout-seller-audit": {
    title: "Home prices shifted nearby",
    detail: "Similar homes changed price this week.",
    icon: Home,
    iconClass: "bg-emerald-500/20 text-emerald-300",
  },
  "tradedeals-fast-win": {
    title: "Local offers are moving",
    detail: "New deals on tools, trucks, or materials today.",
    icon: Tag,
    iconClass: "bg-orange-500/20 text-orange-300",
  },
  "community-partnership-window": {
    title: "Events are active this week",
    detail: "Community activity is picking up nearby.",
    icon: Calendar,
    iconClass: "bg-violet-500/20 text-violet-300",
  },
};

function buildNearbyRows(moves: OpportunityMove[], priceSignals: PriceSignal[]): SignalRowData[] {
  const moveRows = moves.slice(0, 4).map((move) => {
    const mapped = MOVE_COPY[move.id];
    if (mapped) {
      return {
        id: move.id,
        title: mapped.title,
        detail: mapped.detail,
        freshness: "Now",
        prompt: move.prompt,
        icon: mapped.icon,
        iconClass: mapped.iconClass,
      };
    }
    return {
      id: move.id,
      title: move.title,
      detail: move.whyItMatters,
      freshness: "Now",
      prompt: move.prompt,
      icon: Search,
      iconClass: "bg-blue-500/20 text-blue-300",
    };
  });

  if (moveRows.length > 0) return moveRows;

  return [
    {
      id: "fallback-1",
      title: "Repair activity is picking up",
      detail: "More home projects are moving nearby.",
      freshness: "Now",
      prompt: "Show local repair demand.",
      icon: Wrench,
      iconClass: "bg-amber-500/20 text-amber-300",
    },
    {
      id: "fallback-2",
      title: "Home prices shifted nearby",
      detail: "Similar homes changed price this week.",
      freshness: "Now",
      prompt: "Show local home price movement.",
      icon: Home,
      iconClass: "bg-emerald-500/20 text-emerald-300",
    },
    {
      id: "fallback-3",
      title: "Local offers are moving",
      detail: "New deals on tools, trucks, or materials today.",
      freshness: "Now",
      prompt: "Show local offers moving today.",
      icon: Tag,
      iconClass: "bg-orange-500/20 text-orange-300",
    },
    {
      id: "fallback-4",
      title: "Events are active this week",
      detail: "Community activity is picking up nearby.",
      freshness: "Now",
      prompt: "Show local events this week.",
      icon: Calendar,
      iconClass: "bg-violet-500/20 text-violet-300",
    },
    ...priceSignals.slice(0, 2).map((signal) => ({
      id: signal.id,
      title: signal.label,
      detail: signal.description,
      freshness: "Now",
      prompt: `Check ${signal.label}.`,
      icon: Search,
      iconClass: "bg-blue-500/20 text-blue-300",
    })),
  ].slice(0, 4);
}

function NearbyList({
  moves,
  priceSignals,
  onPromptSelect,
}: {
  moves: OpportunityMove[];
  priceSignals: PriceSignal[];
  onPromptSelect: (prompt: string) => void;
}) {
  const rows = buildNearbyRows(moves, priceSignals);
  return (
    <section className="px-4 pt-4">
      <h2 className="text-4xl font-semibold leading-none text-white">Nearby right now</h2>
      <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onPromptSelect(row.prompt)}
              className="flex w-full items-center gap-3 border-b border-zinc-800 px-3 py-3 text-left last:border-b-0"
            >
              <span
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${row.iconClass}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-white">{row.title}</p>
                <p className="text-[13px] text-zinc-400">{row.detail}</p>
              </span>
              <ChevronRight className="h-4 w-4 text-zinc-500" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function LocalSnapshot({
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
    <section className="px-4 pt-4 pb-2">
      <h2 className="text-2xl font-semibold text-white">Local snapshot</h2>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-2xl font-semibold text-white">
            {formatCount(snapshot.activeListings)}
          </p>
          <p className="text-xs text-zinc-400">Listings</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-2xl font-semibold text-white">{formatCount(snapshot.verifiedPros)}</p>
          <p className="text-xs text-zinc-400">Local help</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-2xl font-semibold text-white">{String(snapshot.eventsThisWeek)}</p>
          <p className="text-xs text-zinc-400">Events</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-2xl font-semibold text-white">
            {formatCount(snapshot.communityMembers)}
          </p>
          <p className="text-xs text-zinc-400">Members</p>
        </div>
      </div>
    </section>
  );
}

export function ScoutHome({ onPromptSelect, continuationThreads = [] }: ScoutHomeProps) {
  const { location } = useScoutLocation();
  const { data } = useScoutHomeSnapshot(location);

  return (
    <div className="scout-home-surface">
      <ScoutHero locationLabel={location.label} />
      <ContinueRail
        items={buildContinueItems(continuationThreads)}
        onPromptSelect={onPromptSelect}
      />
      <ExploreGrid onPromptSelect={onPromptSelect} />
      <NearbyList
        moves={data?.opportunityMoves ?? []}
        priceSignals={data?.priceSignals ?? []}
        onPromptSelect={onPromptSelect}
      />
      <LocalSnapshot snapshot={data?.snapshot} />
    </div>
  );
}
