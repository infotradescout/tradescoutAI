import {
  ArrowRight,
  Calendar,
  Car,
  ChevronDown,
  ChevronRight,
  Hammer,
  Loader2,
  Home,
  MapPin,
  Search,
  Sparkles,
  Tag,
  Users2,
  UsersRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
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

type ObjectiveUrgency = "low" | "medium" | "high";

type FastWinActionCard = {
  id: string;
  title: string;
  body: string;
  actionLabel: string;
  actionTarget: string;
  objectiveId: string;
  valueScore: number;
  urgency: ObjectiveUrgency;
};

type ObjectiveSuggestion = {
  id: string;
  title: string;
  description: string;
  recommendedRoute: string;
};

type ObjectiveOnboardingBundle = {
  role: string;
  suggestions: ObjectiveSuggestion[];
  fastWins: FastWinActionCard[];
  nextRecommendedObjectiveId?: string;
  completionSummary: {
    completedCount: number;
    inProgressCount: number;
    pendingCount: number;
    completionRate: number;
  };
};

type ScoutLocalWorkRequest = {
  id?: string | number | null;
  title?: string | null;
  status?: string | null;
  lifecycleStatus?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ScoutHomeRecordSummary = {
  id?: string | number | null;
  label?: string | null;
  nickname?: string | null;
  address?: string | null;
  city?: string | null;
  stateCode?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type LocalSnapshotAction = {
  id: string;
  label: string;
  detail: string;
  prompt: string;
  icon: LucideIcon;
};

type LocalCommandSnapshot = {
  openRequestCount: number;
  latestRequestTitle: string;
  homeRecordCount: number;
  homeReminderCount: number;
  recentActivityCount: number;
  localSignalCount: number;
  nextActions: LocalSnapshotAction[];
};

function inferObjectiveRole(lane?: OnboardingLane): string | undefined {
  switch (lane) {
    case "offer_services":
      return "contractor";
    case "real_estate":
      return "realtor";
    case "manage_projects":
    case "find_help":
    case "community":
    case "browse_only":
      return "homeowner";
    default:
      return undefined;
  }
}

function formatUrgencyTone(urgency: ObjectiveUrgency): string {
  switch (urgency) {
    case "high":
      return "Best first move";
    case "medium":
      return "Good next step";
    default:
      return "Worth setting up";
  }
}

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

async function fetchDirectConnectRequestsForScout(): Promise<ScoutLocalWorkRequest[]> {
  const res = await fetch("/api/direct-connect/requests", { credentials: "include" });
  if (!res.ok) return [];
  const json = await res.json();
  if (Array.isArray(json)) return json as ScoutLocalWorkRequest[];
  if (Array.isArray(json?.requests)) return json.requests as ScoutLocalWorkRequest[];
  return [];
}

async function fetchHomeRecordsForScout(): Promise<ScoutHomeRecordSummary[]> {
  const res = await fetch("/api/homes", { credentials: "include" });
  if (!res.ok) return [];
  const json = await res.json();
  if (Array.isArray(json)) return json as ScoutHomeRecordSummary[];
  if (Array.isArray(json?.homes)) return json.homes as ScoutHomeRecordSummary[];
  return [];
}

const CLOSED_DIRECT_CONNECT_STATES = new Set([
  "archived",
  "cancelled",
  "canceled",
  "closed",
  "complete",
  "completed",
  "deleted",
  "resolved",
]);

function isOpenDirectConnectRequest(request: ScoutLocalWorkRequest): boolean {
  const state = String(request.lifecycleStatus || request.status || "")
    .trim()
    .toLowerCase();
  if (!state) return true;
  return !CLOSED_DIRECT_CONNECT_STATES.has(state);
}

function displayRequestTitle(request?: ScoutLocalWorkRequest): string {
  const title = String(request?.title || "").trim();
  return title || "Direct Connect request";
}

function buildLocalCommandSnapshot({
  directConnectRequests,
  homeRecords,
  recentActivity,
  localSignalCount,
  hasRealContinuation,
}: {
  directConnectRequests: ScoutLocalWorkRequest[];
  homeRecords: ScoutHomeRecordSummary[];
  recentActivity: RecentActivity[];
  localSignalCount: number;
  hasRealContinuation: boolean;
}): LocalCommandSnapshot {
  const openRequests = directConnectRequests.filter(isOpenDirectConnectRequest);
  const latestRequestTitle = displayRequestTitle(openRequests[0]);
  const homeReminderCount = homeRecords.length > 0 ? 0 : 1;
  const nextActions: LocalSnapshotAction[] = [];

  if (openRequests.length > 0) {
    nextActions.push({
      id: "open-direct-connect",
      label: "Review open request",
      detail: latestRequestTitle,
      prompt: "Show my open Direct Connect requests and the next safe step.",
      icon: Hammer,
    });
  }

  if (homeRecords.length > 0) {
    nextActions.push({
      id: "homeid-check",
      label: "Review HomeID context",
      detail: `${formatCount(homeRecords.length)} saved home${homeRecords.length === 1 ? "" : "s"}`,
      prompt: "Review my HomeID reminders and home context.",
      icon: Home,
    });
  } else {
    nextActions.push({
      id: "homeid-reminder",
      label: "Add a HomeID when useful",
      detail: "Optional context for future requests",
      prompt: "Show me how HomeID can help after I start a request.",
      icon: Home,
    });
  }

  if (hasRealContinuation || recentActivity.length > 0) {
    nextActions.push({
      id: "continue-activity",
      label: "Continue recent activity",
      detail: `${formatCount(recentActivity.length)} recent item${recentActivity.length === 1 ? "" : "s"}`,
      prompt: "Continue my recent local activity and show what needs attention.",
      icon: Calendar,
    });
  }

  nextActions.push({
    id: "local-search",
    label: "Search local help",
    detail: "Requests, homes, providers, and activity",
    prompt: "Search local help, requests, homes, and activity.",
    icon: Search,
  });

  return {
    openRequestCount: openRequests.length,
    latestRequestTitle,
    homeRecordCount: homeRecords.length,
    homeReminderCount,
    recentActivityCount: recentActivity.length,
    localSignalCount,
    nextActions: nextActions.slice(0, 4),
  };
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
    <section className="px-4 pt-3 pb-1">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-4xl font-black tracking-tight text-white">{t("scout.title")}</h1>
        <LanguageSwitcher />
      </div>
      <button type="button" className="mt-1.5 inline-flex items-center gap-2 text-sm text-zinc-300">
        <MapPin className="h-4 w-4 text-ts-orange" />
        {locationLabel || t("scout.setLocation")}
        <ChevronDown className="h-4 w-4" />
      </button>
      <p className="mt-2 max-w-[460px] text-sm leading-relaxed text-zinc-400">
        Search, compare, or keep local work moving. You review before anything is shared.
      </p>
    </section>
  );
}

const SCOUT_START_ACTIONS: Array<{
  label: string;
  detail: string;
  prompt: string;
  icon: LucideIcon;
}> = [
  {
    label: "Find local help",
    detail: "People and businesses near you",
    prompt: "Find trusted local help for a project or problem near me.",
    icon: Users2,
  },
  {
    label: "Check a price",
    detail: "Quotes, costs, and local ranges",
    prompt: "Help me check whether a quote or local price is fair.",
    icon: Tag,
  },
  {
    label: "Start a request",
    detail: "Prepare it before anyone is contacted",
    prompt:
      "Help me prepare a Direct Connect request. Keep it in review until I choose to share it.",
    icon: Hammer,
  },
  {
    label: "See nearby activity",
    detail: "Useful updates from your area",
    prompt: "Show me useful local activity and updates near me.",
    icon: MapPin,
  },
];

function ScoutStartCard({
  contextualPrompt,
  onPromptSelect,
}: {
  contextualPrompt: ReturnType<typeof resolveScoutFirstUseTaskPrompt>;
  onPromptSelect: (prompt: string) => void;
}) {
  const hasContextualNextStep = contextualPrompt.ctaLabel !== "Pick a start";

  const openContextualNextStep = () => {
    if (contextualPrompt.ctaLabel === "Review HomeID") {
      onPromptSelect("Review my HomeID updates and what to check next.");
      return;
    }
    onPromptSelect("Review my saved context and show what I should continue.");
  };

  return (
    <section className="px-4 pt-3">
      <div className="overflow-hidden rounded-2xl border border-orange-500/25 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.16),rgba(9,9,11,0.98)_45%)] shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
        <div className="p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ts-orange">Start here</p>
          <h2 className="mt-1 text-2xl font-black leading-tight text-white">
            What should we solve?
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">
            Describe it below, or choose a common starting point.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SCOUT_START_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => onPromptSelect(action.prompt)}
                  className="group flex min-h-[70px] items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/85 p-3 text-left transition-colors hover:border-orange-500/40 hover:bg-zinc-900"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500/12 text-ts-orange">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-white">{action.label}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-zinc-500">
                      {action.detail}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5" />
                </button>
              );
            })}
          </div>

          {hasContextualNextStep ? (
            <button
              type="button"
              className="mt-3 flex w-full items-center justify-between rounded-xl border border-orange-500/25 bg-orange-500/10 px-3 py-3 text-left"
              onClick={openContextualNextStep}
            >
              <span>
                <span className="block text-xs font-bold uppercase tracking-[0.12em] text-ts-orange">
                  Continue where you left off
                </span>
                <span className="mt-1 block text-sm text-zinc-300">{contextualPrompt.message}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ts-orange" />
            </button>
          ) : null}

          <details className="group mt-3 border-t border-zinc-800/80 pt-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-zinc-300 [&::-webkit-details-marker]:hidden">
              How Scout works
              <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3">
              <FirstUseGuidanceCard
                title="Scout is your discovery page."
                description={SCOUT_GUIDANCE_TEXT}
              />
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}

function ProgressiveSection({
  title,
  description,
  children,
  defaultOpen = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) setIsOpen(true);
  }, [defaultOpen]);

  return (
    <section className="px-4 pt-3">
      <details
        className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/80"
        open={isOpen}
        onToggle={(event) => setIsOpen(event.currentTarget.open)}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-base font-bold text-white">{title}</span>
            <span className="mt-0.5 block text-sm leading-snug text-zinc-500">{description}</span>
          </span>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-zinc-400">
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="-mx-4 border-t border-zinc-800 pb-3">{children}</div>
      </details>
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
      <h2 className="text-2xl font-bold leading-tight text-white">Explore what to review next</h2>
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

function LocalCommandCenter({
  snapshot,
  onPromptSelect,
}: {
  snapshot: LocalCommandSnapshot;
  onPromptSelect: (prompt: string) => void;
}) {
  const stats = [
    {
      label: "Open Direct Connect requests",
      value: snapshot.openRequestCount,
      detail:
        snapshot.openRequestCount > 0
          ? snapshot.latestRequestTitle
          : "No open request waiting on you",
      icon: Hammer,
    },
    {
      label: "HomeID reminders",
      value: snapshot.homeReminderCount,
      detail:
        snapshot.homeRecordCount > 0
          ? `${formatCount(snapshot.homeRecordCount)} saved home${snapshot.homeRecordCount === 1 ? "" : "s"}`
          : "Optional, not required to start",
      icon: Home,
    },
    {
      label: "Recent activity",
      value: snapshot.recentActivityCount,
      detail: "Searches and local context",
      icon: Calendar,
    },
    {
      label: "Local signals",
      value: snapshot.localSignalCount,
      detail: "County activity and market context",
      icon: MapPin,
    },
  ];

  return (
    <section className="px-4 pt-2">
      <div className="overflow-hidden rounded-2xl border border-orange-500/20 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.18),rgba(9,9,11,0.96)_42%)] shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
        <div className="border-b border-zinc-800/80 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ts-orange">
            Local command center
          </p>
          <h2 className="mt-1 text-2xl font-black leading-tight text-white">Your local snapshot</h2>
          <p className="mt-1 text-sm leading-snug text-zinc-400">
            Open work, home context, recent activity, and suggested next actions in one place.
          </p>
          <button
            type="button"
            onClick={() => onPromptSelect("Search local help, requests, homes, and activity.")}
            className="mt-3 flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/90 px-3 py-3 text-left"
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <Search className="h-4 w-4 shrink-0 text-ts-orange" />
              <span className="truncate text-sm font-semibold text-white">
                Search local help, requests, homes, and activity.
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 p-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon className="h-4 w-4 text-ts-orange" />
                  <span className="text-2xl font-black text-white">{formatCount(stat.value)}</span>
                </div>
                <p className="mt-2 text-[13px] font-semibold leading-tight text-white">
                  {stat.label}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-snug text-zinc-500">
                  {stat.detail}
                </p>
              </div>
            );
          })}
        </div>

        <div className="border-t border-zinc-800/80 p-3">
          <p className="px-1 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
            Suggested next actions
          </p>
          <div className="mt-2 space-y-2">
            {snapshot.nextActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => onPromptSelect(action.prompt)}
                  className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 text-left"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-ts-orange">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-white">{action.label}</span>
                    <span className="block truncate text-xs text-zinc-500">{action.detail}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
                </button>
              );
            })}
          </div>
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

function OnboardingPlanCard({
  bundle,
  isLoading,
  onPromptSelect,
  onOpenTarget,
}: {
  bundle: ObjectiveOnboardingBundle | null;
  isLoading: boolean;
  onPromptSelect: (prompt: string) => void;
  onOpenTarget: (target: string) => void;
}) {
  if (isLoading) {
    return (
      <section className="px-4 pt-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-ts-orange" />
            <span>Finishing your first-run plan from onboarding.</span>
          </div>
        </div>
      </section>
    );
  }

  const primaryFastWin = bundle?.fastWins?.[0];
  if (!primaryFastWin) return null;

  return (
    <section className="px-4 pt-2">
      <div className="rounded-2xl border border-ts-orange/35 bg-gradient-to-br from-ts-orange/12 via-zinc-950 to-zinc-950 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-ts-orange">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{formatUrgencyTone(primaryFastWin.urgency)}</span>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-white">
              Your setup already built a plan
            </h2>
            <p className="mt-1 text-sm text-zinc-300">
              TradeScout used your onboarding answers to line up a real first move before contact
              opens.
            </p>
          </div>
          <div className="rounded-full border border-ts-orange/35 px-2.5 py-1 text-[11px] font-semibold text-ts-orange">
            Score {primaryFastWin.valueScore}
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
          <p className="text-base font-semibold text-white">{primaryFastWin.title}</p>
          <p className="mt-1 text-sm text-zinc-300">{primaryFastWin.body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onOpenTarget(primaryFastWin.actionTarget)}
              className="inline-flex items-center gap-2 rounded-lg bg-ts-orange px-3 py-2 text-sm font-semibold text-black"
            >
              {primaryFastWin.actionLabel}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                onPromptSelect(`Help me complete this next step: ${primaryFastWin.title}`)
              }
              className="inline-flex rounded-lg border border-ts-orange/40 bg-ts-orange/10 px-3 py-2 text-sm font-semibold text-ts-orange"
            >
              Guide this step
            </button>
          </div>
        </div>
        {bundle?.fastWins && bundle.fastWins.length > 1 ? (
          <div className="mt-3 space-y-2">
            {bundle.fastWins.slice(1, 3).map((card) => (
              <div key={card.id} className="flex items-start gap-2 text-sm text-zinc-400">
                <ArrowRight className="mt-0.5 h-4 w-4 text-ts-orange" />
                <span>
                  <span className="font-medium text-white">{card.title}.</span> {card.body}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function ScoutHome({ onPromptSelect, continuationThreads = [] }: ScoutHomeProps) {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { location } = useScoutLocation();
  const { data } = useScoutHomeSnapshot(location);
  const [onboardingStatus, setOnboardingStatus] = useState<UnifiedOnboardingState | null>(null);
  const [objectiveBundle, setObjectiveBundle] = useState<ObjectiveOnboardingBundle | null>(null);
  const [objectiveBundlePending, setObjectiveBundlePending] = useState(false);
  const { data: directConnectRequests = [] } = useQuery<ScoutLocalWorkRequest[]>({
    queryKey: ["/api/direct-connect/requests", "scout-local-snapshot"],
    queryFn: fetchDirectConnectRequestsForScout,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const { data: homeRecords = [] } = useQuery<ScoutHomeRecordSummary[]>({
    queryKey: ["/api/homes", "scout-local-snapshot"],
    queryFn: fetchHomeRecordsForScout,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

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

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isAuthenticated || !onboardingStatus?.lane || onboardingStatus.lane === "browse_only") {
        setObjectiveBundle(null);
        setObjectiveBundlePending(false);
        return;
      }

      setObjectiveBundlePending(true);
      try {
        const response = await fetch("/api/scout/onboarding/objective-bundle", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: inferObjectiveRole(onboardingStatus.lane),
            countyFips: location.fips,
            stateCode: location.state,
          }),
        });

        if (!response.ok) {
          if (!cancelled) setObjectiveBundle(null);
          return;
        }

        const bundle = (await response.json()) as ObjectiveOnboardingBundle;
        if (!cancelled) setObjectiveBundle(bundle);
      } catch {
        if (!cancelled) setObjectiveBundle(null);
      } finally {
        if (!cancelled) setObjectiveBundlePending(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, location.fips, location.state, onboardingStatus?.lane]);

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
  const localCommandSnapshot = useMemo(
    () =>
      buildLocalCommandSnapshot({
        directConnectRequests,
        homeRecords,
        recentActivity: data?.recentActivity ?? [],
        localSignalCount: nearbyRows.length,
        hasRealContinuation,
      }),
    [
      data?.recentActivity,
      directConnectRequests,
      hasRealContinuation,
      homeRecords,
      nearbyRows.length,
    ]
  );
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
      <ScoutStartCard contextualPrompt={scoutFirstTaskPrompt} onPromptSelect={onPromptSelect} />
      <OnboardingPlanCard
        bundle={objectiveBundle}
        isLoading={objectiveBundlePending}
        onPromptSelect={onPromptSelect}
        onOpenTarget={(target) => {
          const nextTarget = String(target || "").trim();
          if (!nextTarget.startsWith("/")) {
            onPromptSelect("Help me choose the right next step from my onboarding plan.");
            return;
          }
          navigate(nextTarget);
        }}
      />
      {shouldShowSetupNudge && setupNudge ? (
        <SetupNudgeCard config={setupNudge} onPromptSelect={onPromptSelect} />
      ) : null}
      {hasRealContinuation ? (
        <ContinueRail items={continueItems} onPromptSelect={onPromptSelect} />
      ) : null}
      <ProgressiveSection
        title="Your activity"
        description="Requests, HomeID reminders, saved work, and nearby updates."
        defaultOpen={hasRealContinuation}
      >
        <LocalCommandCenter snapshot={localCommandSnapshot} onPromptSelect={onPromptSelect} />
        {hasPersonalizedFeed ? (
          <NearbyList rows={nearbyRows} onPromptSelect={onPromptSelect} />
        ) : null}
        {shouldShowSnapshot ? <LocalSnapshot snapshot={data?.snapshot} /> : null}
        {shouldShowEmptyContext ? <EmptyContextHint /> : null}
      </ProgressiveSection>
      <ProgressiveSection
        title="More ways to use Scout"
        description="Browse homes, vehicles, projects, listings, people, and community."
      >
        <ExploreGrid onPromptSelect={onPromptSelect} />
      </ProgressiveSection>
    </div>
  );
}
