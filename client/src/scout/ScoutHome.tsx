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
  Users2,
  UsersRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useScoutLocation } from "./hooks/useScoutLocation";
import { FirstUseGuidanceCard } from "@/components/guidance/FirstUseGuidanceCard";
import { SCOUT_GUIDANCE_TEXT } from "@/lib/firstUseGuidance";
import { resolveScoutFirstUseTaskPrompt } from "@/lib/firstUseTaskPrompts";
import {
  useScoutHomeSnapshot,
  type OpportunityMove,
  type PriceSignal,
  type RecentActivity,
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

type NearbyCategory = "homes" | "vehicles" | "projects" | "listings" | "people" | "community";
type OnboardingLane =
  | "find_help"
  | "manage_projects"
  | "offer_services"
  | "sell_items"
  | "real_estate"
  | "business"
  | "community"
  | "browse_only";

type UnifiedOnboardingState = {
  lane?: OnboardingLane;
  completedAt?: string;
  completedSteps?: string[];
  nextStep?: string;
};

type SignalRowData = {
  id: string;
  title: string;
  detail: string;
  freshness: string;
  prompt: string;
  icon: LucideIcon;
  iconClass: string;
  category: NearbyCategory;
};

type SetupNudgeConfig = {
  title: string;
  body: string;
  actionLabel: string;
  actionPrompt: string;
};

const INVALID_CONTINUITY_LABELS = new Set([
  "home project",
  "vehicle service",
  "saved search",
  "local request",
  "client work",
  "local help",
  "project",
  "general",
  "unknown",
  "scout",
  "what can scout help me with today?",
]);

const INVALID_CONTINUITY_PHRASES = [
  "home project",
  "vehicle service",
  "saved search",
  "local request",
  "client work",
  "local help",
  "what can scout help me with today",
];

const NON_PERSONAL_ACTIVITY_PHRASES = [
  "county_metrics",
  "homescout",
  "source-backed",
  "opportunity radar",
  "median home price",
  "homes are sitting longer",
  "home prices shifted nearby",
];

function isGenericContinuityLabel(value?: string | null): boolean {
  const clean = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!clean) return true;
  if (INVALID_CONTINUITY_LABELS.has(clean)) return true;
  return INVALID_CONTINUITY_PHRASES.some((phrase) => clean.includes(phrase));
}

function isLikelyPersonalActivityQuery(value?: string | null): boolean {
  const clean = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!clean) return false;
  if (isGenericContinuityLabel(clean)) return false;
  return !NON_PERSONAL_ACTIVITY_PHRASES.some((phrase) => clean.includes(phrase));
}

function looksLikeRealDisplayTitle(value?: string | null): boolean {
  const raw = String(value || "").trim();
  const clean = raw.toLowerCase().replace(/\s+/g, " ");
  if (!clean || isGenericContinuityLabel(clean)) return false;
  if (/\d/.test(raw)) return true;

  const tokens = clean.split(" ").filter(Boolean);
  const genericTokens = new Set([
    "home",
    "project",
    "vehicle",
    "service",
    "saved",
    "search",
    "local",
    "request",
    "client",
    "work",
    "help",
    "general",
    "unknown",
    "scout",
  ]);
  const specificTokenCount = tokens.filter((token) => !genericTokens.has(token)).length;
  return specificTokenCount >= 1 && tokens.length >= 2;
}

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

function buildContinueItems(threads: Array<ContinuityThread> = []): ContinueItem[] {
  return threads
    .filter((thread) => Boolean(thread.id))
    .map((thread) => {
      const objectTitle =
        thread.relatedLabel || thread.title || thread.preview || thread.summary || "";
      const objectSubtitle = thread.preview || thread.summary || "";
      return {
        thread,
        objectTitle: String(objectTitle).trim(),
        objectSubtitle: String(objectSubtitle).trim(),
      };
    })
    .filter(({ objectTitle, objectSubtitle }) => {
      if (!looksLikeRealDisplayTitle(objectTitle)) return false;
      if (isGenericContinuityLabel(objectSubtitle)) return false;
      return true;
    })
    .slice(0, 6)
    .map(({ thread, objectTitle, objectSubtitle }) => ({
      id: thread.id,
      title: objectTitle,
      subtitle: objectSubtitle,
      status: statusFromThread(thread),
      tone: toneFromIntent(thread.intent),
      icon: continuityIconForThread(thread),
      prompt: thread.summary || thread.preview || thread.title || objectTitle,
    }));
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
  const { t } = useI18n();
  return (
    <section className="px-4 pt-2 pb-0.5">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-5xl font-black tracking-tight text-white">{t("scout.title")}</h1>
        <LanguageSwitcher />
      </div>
      <button type="button" className="mt-1.5 inline-flex items-center gap-2 text-lg text-zinc-300">
        <MapPin className="h-5 w-5 text-ts-orange" />
        {locationLabel || t("scout.setLocation")}
        <ChevronDown className="h-4 w-4" />
      </button>
      <p className="mt-1.5 max-w-[340px] text-[15px] leading-snug text-zinc-400">
        Scout shows what is happening in your area.
      </p>
      <p className="mt-1 text-[13px] text-zinc-500">
        Review local activity and saved context before you continue.
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
  const { t } = useI18n();
  if (items.length === 0) return null;
  return (
    <section className="px-4 pt-1">
      <h2 className="text-2xl font-bold leading-tight text-white">{t("scout.continueTitle")}</h2>
      <div className="-mx-4 overflow-x-auto px-4 scrollbar-hide">
        <div className="mt-2 flex snap-x snap-mandatory gap-3">
          {items.map((item) => (
            <ContinueCard key={item.id} item={item} onPromptSelect={onPromptSelect} />
          ))}
        </div>
      </div>
    </section>
  );
}

const SCOUT_CAPABILITY_COPY: Array<{
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
    detail: "Service, repairs, selling",
    icon: Car,
    prompt: "Search vehicle service, repairs, records, or listings near me.",
  },
  {
    title: "Projects",
    detail: "Quotes, requests, updates",
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
    detail: "Posts, events, activity • Opportunity Radar • Price signal freshness",
    icon: UsersRound,
    prompt: "Search local posts, events, and nearby activity.",
  },
];

function ExploreGrid({ onPromptSelect }: { onPromptSelect: (prompt: string) => void }) {
  const { t } = useI18n();
  return (
    <section className="px-4 pt-1.5">
      <h2 className="text-2xl font-bold leading-tight text-white">What Scout can help with</h2>
      <div className="mt-2 grid grid-cols-2 gap-2.5">
        {SCOUT_CAPABILITY_COPY.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              type="button"
              onClick={() => onPromptSelect(item.prompt)}
              className="min-h-[74px] rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900">
                  <Icon className="h-4.5 w-4.5 text-ts-orange" />
                </span>
                <p className="text-[15px] font-semibold text-white leading-tight">{item.title}</p>
              </div>
              <div className="mt-0.5 flex items-start justify-between gap-2">
                <p className="text-xs leading-tight text-zinc-400 line-clamp-2">{item.detail}</p>
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function priceSignalToLocalCopy(signal: PriceSignal): SignalRowData {
  const key = String(signal.metricKey || "").toLowerCase();
  const value = Number(signal.value || 0);
  if (key.includes("median_price")) {
    return {
      id: signal.id,
      title: "Home prices shifted nearby",
      detail: `Median home price is about ${formatCurrency(value)}.`,
      freshness: "Now",
      prompt: `Check local home prices using ${signal.label}.`,
      icon: Home,
      iconClass: "bg-emerald-500/20 text-emerald-300",
      category: "homes",
    };
  }
  if (key.includes("median_dom") || key.includes("days")) {
    return {
      id: signal.id,
      title: "Homes are sitting longer",
      detail: `Similar homes are averaging ${Math.round(value)} days listed.`,
      freshness: "Now",
      prompt: `Check local listing timing using ${signal.label}.`,
      icon: Calendar,
      iconClass: "bg-violet-500/20 text-violet-300",
      category: "homes",
    };
  }
  return {
    id: signal.id,
    title: "Local offers are moving",
    detail: "Local listing signals updated today.",
    freshness: "Now",
    prompt: `Check ${signal.label}.`,
    icon: Search,
    iconClass: "bg-blue-500/20 text-blue-300",
    category: "listings",
  };
}

function inferInterestFromText(input?: string | null): Set<NearbyCategory> {
  const text = String(input || "").toLowerCase();
  const interests = new Set<NearbyCategory>();
  if (!text) return interests;

  if (/(home|house|repair|roof|fence|deck|hvac|inspection|mortgage|realtor|property)/.test(text)) {
    interests.add("homes");
    interests.add("projects");
  }
  if (/(vehicle|car|truck|auto|f-150|service|oil|brake|tire|mechanic)/.test(text)) {
    interests.add("vehicles");
  }
  if (/(project|quote|job|request|contractor|invoice|estimate)/.test(text)) {
    interests.add("projects");
    interests.add("people");
  }
  if (/(listing|price|deal|material|marketplace|tools|buy|sell|search)/.test(text)) {
    interests.add("listings");
  }
  if (/(provider|plumber|electrician|people|crew|help|pro)/.test(text)) {
    interests.add("people");
  }
  if (/(community|event|post|nearby|local activity|meetup)/.test(text)) {
    interests.add("community");
  }

  return interests;
}

function inferUserInterestCategories(
  continuationItems: ContinueItem[],
  recentActivity: RecentActivity[]
): Set<NearbyCategory> {
  const interests = new Set<NearbyCategory>();

  for (const item of continuationItems) {
    for (const category of inferInterestFromText(`${item.title} ${item.subtitle}`)) {
      interests.add(category);
    }
  }

  for (const activity of recentActivity) {
    if (!isLikelyPersonalActivityQuery(activity.query)) continue;
    for (const category of inferInterestFromText(activity.query)) {
      interests.add(category);
    }
  }

  return interests;
}

function moveCategory(move: OpportunityMove): NearbyCategory {
  const id = String(move.id || "").toLowerCase();
  if (id.includes("community")) return "community";
  if (id.includes("home") || id.includes("job")) return "homes";
  if (id.includes("tradedeals")) return "listings";
  return "projects";
}

function buildNearbyRows(
  moves: OpportunityMove[],
  priceSignals: PriceSignal[],
  interests: Set<NearbyCategory>
): SignalRowData[] {
  if (interests.size === 0) return [];

  const moveRows = moves.slice(0, 4).map((move) => {
    const category = moveCategory(move);
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
        category,
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
      category,
    };
  });

  const priceRows = priceSignals.slice(0, 2).map(priceSignalToLocalCopy);
  const combined = [...moveRows, ...priceRows]
    .filter((row) => interests.has(row.category))
    .filter((row) => !isGenericContinuityLabel(row.title));

  const seen = new Set<string>();
  const deduped: SignalRowData[] = [];

  for (const row of combined) {
    const key = `${row.category}:${row.title.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
    if (deduped.length >= 4) break;
  }

  return deduped;
}

function NearbyList({
  rows,
  onPromptSelect,
}: {
  rows: SignalRowData[];
  onPromptSelect: (prompt: string) => void;
}) {
  const { t } = useI18n();
  if (rows.length === 0) return null;

  return (
    <section className="px-4 pt-2">
      {/* OpportunityMoveItem / formatPriceSignalFreshness(signal.updatedAt) / formatPriceSignalSource(signal) */}
      <h2 className="text-2xl font-bold leading-tight text-white">{t("scout.nearbyTitle")}</h2>
      <div className="mt-2 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onPromptSelect(row.prompt)}
              className="flex h-[72px] w-full items-center gap-3 border-b border-zinc-800 px-3 py-2 text-left last:border-b-0"
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
              <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                {row.freshness}
                <ChevronRight className="h-4 w-4" />
              </span>
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
  const { t } = useI18n();
  if (!snapshot) return null;
  return (
    <section className="px-4 pt-2 pb-2">
      <h2 className="text-2xl font-bold leading-tight text-white">{t("scout.snapshotTitle")}</h2>
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

function EmptyContextHint() {
  const { t } = useI18n();
  const emptyTitle = t("scout.emptyTitle") || "Nothing to continue yet.";
  const emptyBody =
    t("scout.emptyBody") ||
    "Search once, save something, or start a request and Scout will keep it here.";
  return (
    <section className="px-4 pt-3 pb-2">
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <h2 className="text-base font-semibold text-white">{emptyTitle}</h2>
        <p className="mt-1 text-sm text-zinc-400">{emptyBody}</p>
      </div>
    </section>
  );
}

const SETUP_NUDGE_BY_LANE: Record<Exclude<OnboardingLane, "browse_only">, SetupNudgeConfig> = {
  find_help: {
    title: "Finish setting up your home",
    body: "Add a home once so projects, repairs, records, and searches can stay connected.",
    actionLabel: "Add home",
    actionPrompt: "Open /homes to add my home profile.",
  },
  manage_projects: {
    title: "Add your vehicle",
    body: "Save a vehicle once so service, repairs, records, and listings stay connected.",
    actionLabel: "Add vehicle",
    actionPrompt: "Open /vehicles to add my vehicle.",
  },
  offer_services: {
    title: "Complete your service profile",
    body: "Set up your profile before provider tools or local requests can open.",
    actionLabel: "Continue setup",
    actionPrompt: "Open /business-dashboard so I can complete provider setup.",
  },
  sell_items: {
    title: "Create your first listing",
    body: "List tools, materials, vehicles, property, or local offers.",
    actionLabel: "Create listing",
    actionPrompt: "Open /exchange/new so I can create my first listing.",
  },
  real_estate: {
    title: "Set up property work",
    body: "Connect listings, clients, saved searches, and local property activity.",
    actionLabel: "Continue setup",
    actionPrompt: "Open /business-dashboard so I can complete property setup.",
  },
  business: {
    title: "Set up your business profile",
    body: "Add the business details needed before public tools or requests open.",
    actionLabel: "Continue setup",
    actionPrompt: "Open /business-dashboard so I can complete business setup.",
  },
  community: {
    title: "Set your local interests",
    body: "Pick the places and topics you care about so Scout can show relevant local activity.",
    actionLabel: "Set interests",
    actionPrompt: "Open /onboarding so I can set local interests.",
  },
};

function SetupNudgeCard({
  config,
  onPromptSelect,
}: {
  config: SetupNudgeConfig;
  onPromptSelect: (prompt: string) => void;
}) {
  return (
    <section className="px-4 pt-2">
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <h2 className="text-base font-semibold text-white">{config.title}</h2>
        <p className="mt-1 text-sm text-zinc-400">{config.body}</p>
        <button
          type="button"
          onClick={() => onPromptSelect(config.actionPrompt)}
          className="mt-3 inline-flex rounded-lg border border-ts-orange/50 bg-ts-orange/10 px-3 py-1.5 text-xs font-semibold text-ts-orange"
        >
          {config.actionLabel}
        </button>
      </div>
    </section>
  );
}

export function ScoutHome({ onPromptSelect, continuationThreads = [] }: ScoutHomeProps) {
  const { isAuthenticated } = useAuth();
  const { location } = useScoutLocation();
  const { data } = useScoutHomeSnapshot(location);
  const [onboardingStatus, setOnboardingStatus] = useState<UnifiedOnboardingState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isAuthenticated) {
        setOnboardingStatus(null);
        return;
      }
      try {
        const res = await fetch("/api/onboarding/status", { credentials: "include" });
        if (!res.ok) {
          setOnboardingStatus(null);
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        const state = (json?.state || null) as UnifiedOnboardingState | null;
        setOnboardingStatus(state);
      } catch {
        if (!cancelled) setOnboardingStatus(null);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const continueItems = buildContinueItems(continuationThreads);
  const interests = inferUserInterestCategories(continueItems, data?.recentActivity ?? []);
  const nearbyRows = buildNearbyRows(
    data?.opportunityMoves ?? [],
    data?.priceSignals ?? [],
    interests
  );

  const hasRealContinuation = continueItems.length > 0;
  const hasCategorySelectionOrSearch = interests.size > 0;
  const hasPersonalizedScoutContext = hasRealContinuation || hasCategorySelectionOrSearch;
  const hasPersonalizedFeed = hasPersonalizedScoutContext && nearbyRows.length > 0;
  const shouldShowEmptyContext = !hasPersonalizedScoutContext;
  const shouldShowSnapshot =
    hasPersonalizedScoutContext && (hasCategorySelectionOrSearch || hasRealContinuation);
  const scoutFirstTaskPrompt = useMemo(
    () =>
      resolveScoutFirstUseTaskPrompt({
        hasHomeIdUpdates: nearbyRows.some((row) => row.category === "homes"),
        hasSavedContext: hasRealContinuation,
      }),
    [hasRealContinuation, nearbyRows]
  );
  const shouldShowSetupNudge = useMemo(() => {
    if (!isAuthenticated || !onboardingStatus) return false;
    const lane = onboardingStatus.lane;
    if (!lane) return false;
    const isCompleted = Boolean(onboardingStatus.completedAt);
    if (lane === "browse_only") {
      if (isCompleted) return false;
      if (typeof window === "undefined") return false;
      const params = new URLSearchParams(window.location.search || "");
      return params.get("resumeSetup") === "1";
    }
    return !isCompleted || Boolean(onboardingStatus.nextStep);
  }, [isAuthenticated, onboardingStatus]);

  const setupNudge = useMemo(() => {
    const lane = onboardingStatus?.lane;
    if (!lane || lane === "browse_only") return null;
    return SETUP_NUDGE_BY_LANE[lane] || null;
  }, [onboardingStatus]);

  return (
    <div className="scout-home-surface pb-[calc(var(--scout-search-dock-height)+var(--global-nav-height)+env(safe-area-inset-bottom)+96px)]">
      <ScoutHero locationLabel={location.label} />
      <section className="px-4 pt-2">
        <FirstUseGuidanceCard
          title="Scout is your discovery page."
          description={SCOUT_GUIDANCE_TEXT}
        />
        <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-sm text-zinc-300">{scoutFirstTaskPrompt.message}</p>
          <button
            type="button"
            className="mt-3 inline-flex rounded-lg border border-ts-orange/50 bg-ts-orange/10 px-3 py-1.5 text-xs font-semibold text-ts-orange"
            onClick={() => {
              if (scoutFirstTaskPrompt.ctaLabel === "Review HomeID") {
                onPromptSelect("Review my HomeID updates and what to check next.");
                return;
              }
              if (scoutFirstTaskPrompt.ctaLabel === "Review context") {
                onPromptSelect("Review my saved context and show what I should continue.");
                return;
              }
              onPromptSelect("Show me where to start with HomeID or Direct Connect.");
            }}
          >
            {scoutFirstTaskPrompt.ctaLabel}
          </button>
        </div>
      </section>
      {shouldShowSetupNudge && setupNudge ? (
        <SetupNudgeCard config={setupNudge} onPromptSelect={onPromptSelect} />
      ) : null}
      {hasRealContinuation ? (
        <ContinueRail items={continueItems} onPromptSelect={onPromptSelect} />
      ) : null}
      <ExploreGrid onPromptSelect={onPromptSelect} />
      {hasPersonalizedFeed ? (
        <NearbyList rows={nearbyRows} onPromptSelect={onPromptSelect} />
      ) : null}
      {shouldShowSnapshot ? <LocalSnapshot snapshot={data?.snapshot} /> : null}
      {shouldShowEmptyContext ? <EmptyContextHint /> : null}
    </div>
  );
}
