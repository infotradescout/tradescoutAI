import { Calendar, Hammer, Home, MapPin, MessageCircle, UsersRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { useScoutLocation } from "./hooks/useScoutLocation";
import { useScoutHomeSnapshot, type RecentActivity } from "./hooks/useScoutHomeSnapshot";

interface ContinuityThread {
  id: string;
  title: string;
  summary?: string | null;
  preview?: string | null;
  relatedLabel?: string | null;
}

interface ScoutHomeProps {
  primaryOutcomeInput: ReactNode;
  onPromptSelect: (text: string) => void;
  onContinuationSelect: (threadId: string) => void;
  continuationThreads?: ContinuityThread[];
}

type ScoutCommunityPost = {
  id: string;
};

type ScoutLocalWorkRequest = {
  status?: string | null;
  lifecycleStatus?: string | null;
};

type ScoutHomeRecordSummary = {
  id?: string | number | null;
};

type LocalCommandSnapshot = {
  openRequestCount: number;
  conversationCount: number;
  homeRecordCount: number;
  recentActivityCount: number;
  communityPostCount: number;
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

function isGenericContinuityLabel(value?: string | null): boolean {
  const clean = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!clean) return true;
  if (INVALID_CONTINUITY_LABELS.has(clean)) return true;
  return INVALID_CONTINUITY_PHRASES.some((phrase) => clean.includes(phrase));
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

export function getMeaningfulContinuations(threads: ContinuityThread[]): ContinuityThread[] {
  return threads
    .filter((thread) => {
      if (!thread.id) return false;
      const identityCandidates = [
        thread.relatedLabel,
        thread.title,
        thread.preview,
        thread.summary,
      ];
      if (!identityCandidates.some((candidate) => looksLikeRealDisplayTitle(candidate))) {
        return false;
      }
      const detail = thread.preview || thread.summary;
      return detail ? !isGenericContinuityLabel(detail) : true;
    })
    .slice(0, 6);
}

function formatCount(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}

async function fetchDirectConnectRequestsForScout(): Promise<ScoutLocalWorkRequest[]> {
  const response = await fetch("/api/direct-connect/requests", { credentials: "include" });
  if (!response.ok) return [];
  const body = await response.json();
  if (Array.isArray(body)) return body;
  return Array.isArray(body?.requests) ? body.requests : [];
}

async function fetchHomeRecordsForScout(): Promise<ScoutHomeRecordSummary[]> {
  const response = await fetch("/api/homes", { credentials: "include" });
  if (!response.ok) return [];
  const body = await response.json();
  if (Array.isArray(body)) return body;
  return Array.isArray(body?.homes) ? body.homes : [];
}

async function fetchCommunityPostsForScout(args: {
  countyFips?: string | null;
  stateCode?: string | null;
}): Promise<ScoutCommunityPost[]> {
  if (!args.countyFips) return [];
  const params = new URLSearchParams({ scope: "county", limit: "4", offset: "0" });
  params.set("countyFips", args.countyFips);
  if (args.stateCode) params.set("stateCode", args.stateCode);

  const response = await fetch(`/api/community/posts?${params.toString()}`, {
    credentials: "include",
  });
  if (!response.ok) return [];
  const body = await response.json();
  return Array.isArray(body) ? body : [];
}

function isOpenDirectConnectRequest(request: ScoutLocalWorkRequest): boolean {
  const state = String(request.lifecycleStatus || request.status || "")
    .trim()
    .toLowerCase();
  return !state || !CLOSED_DIRECT_CONNECT_STATES.has(state);
}

function buildLocalCommandSnapshot(args: {
  directConnectRequests: ScoutLocalWorkRequest[];
  homeRecords: ScoutHomeRecordSummary[];
  recentActivity: RecentActivity[];
  communityPostCount: number;
  continuationCount: number;
}): LocalCommandSnapshot {
  return {
    openRequestCount: args.directConnectRequests.filter(isOpenDirectConnectRequest).length,
    conversationCount: args.continuationCount,
    homeRecordCount: args.homeRecords.length,
    recentActivityCount: args.recentActivity.length + args.continuationCount,
    communityPostCount: args.communityPostCount,
  };
}

function ScoutHero({ locationLabel }: { locationLabel?: string }) {
  const { t } = useI18n();
  return (
    <section className="px-4 pt-3 pb-1">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-4xl font-black tracking-tight text-[var(--text-primary)]">
          {t("scout.title")}
        </h1>
        <LanguageSwitcher />
      </div>
      {locationLabel ? (
        <div className="mt-1.5 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <MapPin className="h-4 w-4 text-ts-orange" />
          {locationLabel}
        </div>
      ) : null}
      <p className="mt-2 max-w-[620px] text-sm leading-relaxed text-[var(--text-secondary)]">
        Plan the job, understand codes and permits, price the work, compare options, and keep the
        project moving. You review every next step.
      </p>
    </section>
  );
}

function ScoutControlSnapshot({
  snapshot,
  onNavigate,
  onPromptSelect,
  onContinueConversation,
}: {
  snapshot: LocalCommandSnapshot;
  onNavigate: (route: string) => void;
  onPromptSelect: (prompt: string) => void;
  onContinueConversation: () => void;
}) {
  const items = [
    snapshot.openRequestCount > 0
      ? {
          id: "work",
          label: "Open work",
          detail: `${snapshot.openRequestCount} active`,
          icon: Hammer,
          onClick: () => onNavigate("/direct-connect"),
        }
      : null,
    snapshot.conversationCount > 0
      ? {
          id: "conversations",
          label: "Conversations",
          detail: `${snapshot.conversationCount} to continue`,
          icon: MessageCircle,
          onClick: onContinueConversation,
        }
      : null,
    snapshot.homeRecordCount > 0
      ? {
          id: "homes",
          label: "HomeID",
          detail: `${snapshot.homeRecordCount} saved`,
          icon: Home,
          onClick: () => onNavigate("/homes"),
        }
      : null,
    snapshot.recentActivityCount > snapshot.conversationCount
      ? {
          id: "activity",
          label: "Recent activity",
          detail: `${snapshot.recentActivityCount - snapshot.conversationCount} items`,
          icon: Calendar,
          onClick: () =>
            onPromptSelect("Continue what I was doing and show me what needs attention."),
        }
      : null,
    snapshot.communityPostCount > 0
      ? {
          id: "community",
          label: "Community",
          detail: `${snapshot.communityPostCount} nearby`,
          icon: UsersRound,
          onClick: () => onNavigate("/community-feed"),
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (items.length === 0) return null;

  return (
    <section className="px-4 pt-2" data-testid="scout-control-snapshot">
      <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--surface-card)] px-3 py-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ts-orange">
              Continue
            </p>
            <h2 className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">
              Pick up where you left off
            </h2>
          </div>
          <span className="text-xs text-[var(--text-muted)]">{items.length}</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className="flex items-center gap-3 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-intermediate)] px-3 py-2.5 text-left transition hover:border-ts-orange/40"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ts-orange/10 text-ts-orange">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--text-primary)]">
                    {item.label}
                  </span>
                  <span className="block text-xs text-[var(--text-muted)]">{item.detail}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function ScoutHome({
  primaryOutcomeInput,
  onPromptSelect,
  onContinuationSelect,
  continuationThreads = [],
}: ScoutHomeProps) {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { location } = useScoutLocation();
  const { data } = useScoutHomeSnapshot(location);
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
  const { data: communityPosts = [] } = useQuery<ScoutCommunityPost[]>({
    queryKey: ["/api/community/posts", "scout-snapshot", location.fips || "", location.state || ""],
    queryFn: () =>
      fetchCommunityPostsForScout({ countyFips: location.fips, stateCode: location.state }),
    enabled: location.status === "resolved" && Boolean(location.fips),
    staleTime: 60_000,
  });
  const meaningfulContinuations = getMeaningfulContinuations(continuationThreads);
  const continuationCount = meaningfulContinuations.length;
  const localCommandSnapshot = useMemo(
    () =>
      buildLocalCommandSnapshot({
        directConnectRequests,
        homeRecords,
        recentActivity: data?.recentActivity ?? [],
        communityPostCount: communityPosts.length,
        continuationCount,
      }),
    [
      data?.recentActivity,
      directConnectRequests,
      homeRecords,
      communityPosts.length,
      continuationCount,
    ]
  );

  return (
    <div className="scout-home-surface pb-8 md:pb-10">
      <ScoutHero locationLabel={location.label} />
      {primaryOutcomeInput}
      <ScoutControlSnapshot
        snapshot={localCommandSnapshot}
        onPromptSelect={onPromptSelect}
        onContinueConversation={() => onContinuationSelect(meaningfulContinuations[0].id)}
        onNavigate={navigate}
      />
    </div>
  );
}
