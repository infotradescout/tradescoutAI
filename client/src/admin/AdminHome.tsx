import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Radio,
  RefreshCw,
  ShieldCheck,
  Search,
  type LucideIcon,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminWorkspace,
} from "./AdminWorkspace";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import {
  getAdminNavWorkspacesForRole,
  getAdminSearchWorkspacesForRole,
} from "./adminNavWorkspaces";
import {
  useAdminObservationClock,
  adminSourceState,
  knownQueueCount,
  queueDestination,
  refreshAdminSources,
  snapshotEvidenceKnown,
} from "./adminQueueState";
import {
  getAdminToolDescription,
  getAdminToolSearchText,
  type AdminRole,
  type AdminTool,
} from "./adminTools";

type AdminHomeProps = {
  role: AdminRole;
  isSuperAdmin: boolean;
};

type MissionControlSummary = {
  totalConnectionAttempts?: number;
  successfulConnections?: number;
  blockedConnections?: number;
  confusingExperiences?: number;
};

type ToolNotifications = {
  byTool?: Record<string, number | null>;
  updatedAt?: string;
  partiallyAvailable?: boolean;
  totalUnread?: number | null;
  degraded?: boolean;
  countsAvailable?: boolean;
};

type SnapshotStatusResponse = {
  statuses?: Array<{
    key: string;
    label: string;
    rowCount: number;
    latestComputedAt: string | null;
    isStale: boolean;
  }>;
};

type ToolEntry = {
  section: string;
  tool: AdminTool;
};

const QUICK_TOOL_IDS = [
  "direct-connect-requests",
  "tradepartner-ops",
  "users",
  "verification",
  "commercial-directory",
  "procurement",
  "errors",
  "live-stream",
];

function formatCount(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

function isValidTaskCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function formatObservation(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "not recorded";
  return new Date(value).toLocaleString();
}

export function unreadWorkSummary(
  notifications: ToolNotifications | undefined,
  queryState: "loading" | "error" | "ready"
): { count: number | null; detail: string; tone: "good" | "warning" } {
  const countsAvailable =
    notifications?.countsAvailable === true ||
    (notifications?.countsAvailable !== false && notifications?.degraded !== true);
  if (
    queryState !== "ready" ||
    !notifications ||
    !countsAvailable ||
    !isValidTaskCount(notifications.totalUnread)
  ) {
    return { count: null, detail: "Admin queue counts unavailable", tone: "warning" };
  }
  return {
    count: notifications.totalUnread,
    detail: "Across role-visible admin queues",
    tone: notifications.totalUnread > 0 ? "warning" : "good",
  };
}

export function AdminHome({ role, isSuperAdmin }: AdminHomeProps) {
  const [, navigate] = useLocation();
  const observationNow = useAdminObservationClock();
  const [search, setSearch] = useState("");
  const [workspaceFilter, setWorkspaceFilter] = useState("all");
  const canReadSignals =
    isSuperAdmin || role === "owner" || role === "super_admin" || role === "ops_admin";
  const sections = useMemo(
    () => getAdminNavWorkspacesForRole(role, isSuperAdmin),
    [isSuperAdmin, role]
  );
  const searchSections = useMemo(
    () => getAdminSearchWorkspacesForRole(role, isSuperAdmin),
    [isSuperAdmin, role]
  );
  const tools = useMemo<ToolEntry[]>(
    () =>
      sections.flatMap((section) =>
        section.items.map((tool) => ({ section: section.section, tool }))
      ),
    [sections]
  );
  const notificationsQuery = useQuery<ToolNotifications>({
    queryKey: ["/api/admin/tool-notifications"],
    queryFn: () => apiRequest("GET", "/api/admin/tool-notifications"),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });
  const missionQuery = useQuery<MissionControlSummary>({
    queryKey: ["/api/admin/mission-control/summary"],
    queryFn: () => apiRequest("GET", "/api/admin/mission-control/summary"),
    enabled: canReadSignals,
    retry: false,
    refetchInterval: 30_000,
  });
  const snapshotQuery = useQuery<SnapshotStatusResponse>({
    queryKey: ["/api/admin/observability/snapshot-status"],
    queryFn: () => apiRequest("GET", "/api/admin/observability/snapshot-status"),
    enabled: canReadSignals,
    retry: false,
    refetchInterval: 30_000,
  });
  const queueState = adminSourceState({
    now: observationNow,
    loading: notificationsQuery.isLoading,
    error: notificationsQuery.isError,
    observedAt: notificationsQuery.data?.updatedAt,
  });
  const missionState = adminSourceState({
    now: observationNow,
    loading: missionQuery.isLoading,
    error: missionQuery.isError,
    enabled: canReadSignals,
    observedAt: missionQuery.dataUpdatedAt,
  });
  const snapshotState = adminSourceState({
    now: observationNow,
    loading: snapshotQuery.isLoading,
    error: snapshotQuery.isError,
    enabled: canReadSignals,
    observedAt: snapshotQuery.dataUpdatedAt,
  });
  const queuesCurrent = queueState === "Current";
  const missionCurrent = missionState === "Current";
  const snapshotsCurrent =
    snapshotState === "Current" && Array.isArray(snapshotQuery.data?.statuses);
  const unreadByTool = notificationsQuery.data?.byTool || {};
  const actionTools = tools
    .map((entry) => ({
      ...entry,
      unread: queuesCurrent ? knownQueueCount(unreadByTool[entry.tool.id]) : null,
    }))
    .filter((entry) => entry.unread !== null && entry.unread > 0)
    .sort((a, b) => (b.unread ?? 0) - (a.unread ?? 0) || a.tool.label.localeCompare(b.tool.label));
  const unavailableQueues = tools.filter(
    (entry) =>
      Object.prototype.hasOwnProperty.call(unreadByTool, entry.tool.id) &&
      (!queuesCurrent || knownQueueCount(unreadByTool[entry.tool.id]) === null)
  );
  const unreadSummary = unreadWorkSummary(
    notificationsQuery.data,
    queuesCurrent ? "ready" : "error"
  );
  const mission = missionCurrent ? missionQuery.data : undefined;
  const connectionAttempts = knownQueueCount(mission?.totalConnectionAttempts);
  const successfulConnections = knownQueueCount(mission?.successfulConnections);
  const connectionRate =
    connectionAttempts !== null &&
    connectionAttempts > 0 &&
    successfulConnections !== null &&
    successfulConnections <= connectionAttempts
      ? Math.round((successfulConnections / connectionAttempts) * 100)
      : null;
  const statuses = snapshotsCurrent ? snapshotQuery.data!.statuses! : [];
  const snapshotKnown = snapshotsCurrent && snapshotEvidenceKnown(statuses, observationNow);
  const staleSnapshots = snapshotKnown ? statuses.filter((status) => status.isStale) : [];
  const refreshing =
    notificationsQuery.isFetching ||
    (canReadSignals && (missionQuery.isFetching || snapshotQuery.isFetching));
  const refreshAll = () =>
    refreshAdminSources(
      () => notificationsQuery.refetch(),
      canReadSignals,
      () => missionQuery.refetch(),
      () => snapshotQuery.refetch()
    );
  const normalizedSearch = search.trim().toLowerCase();
  const catalogSections = (
    normalizedSearch || workspaceFilter !== "all" ? searchSections : sections
  )
    .filter((section) => workspaceFilter === "all" || section.section === workspaceFilter)
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (tool) =>
          tool.id !== "overview" &&
          (!normalizedSearch ||
            getAdminToolSearchText(tool, section.section).includes(normalizedSearch))
      ),
    }))
    .filter((section) => section.items.length > 0);
  const quickTools = QUICK_TOOL_IDS.flatMap((id) => {
    const entry = tools.find((candidate) => candidate.tool.id === id);
    return entry ? [entry] : [];
  });

  return (
    <AdminWorkspace data-testid="admin-home-v2">
      <AdminSection
        title="Operator inbox"
        description="Review pending work, check sources, and open the area you need to manage."
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={refreshAll}
            disabled={refreshing}
            className="border-white/12 bg-white/[0.025] text-white/75 hover:bg-white/[0.06] hover:text-white"
          >
            <RefreshCw className={refreshing ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            {refreshing ? "Refreshing" : "Refresh sources"}
          </Button>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Pending work",
              value: formatCount(unreadSummary.count),
              detail:
                unreadSummary.count === null
                  ? "One or more queue counts unavailable"
                  : "Across queues available to your role",
              tone: unreadSummary.tone,
            },
            {
              label: "Connection success",
              value: connectionRate === null ? "Unknown" : connectionRate + "%",
              detail:
                connectionAttempts === null
                  ? missionState
                  : formatCount(connectionAttempts) + " recorded attempts",
              tone: connectionRate === null ? "neutral" : connectionRate >= 80 ? "good" : "warning",
            },
            {
              label: "Blocked paths",
              value: formatCount(knownQueueCount(mission?.blockedConnections)),
              detail: missionCurrent ? "Recorded hard stops" : missionState,
              tone:
                knownQueueCount(mission?.blockedConnections) === null
                  ? "neutral"
                  : (mission?.blockedConnections || 0) > 0
                    ? "warning"
                    : "good",
            },
            {
              label: "Stale snapshots",
              value: snapshotKnown ? formatCount(staleSnapshots.length) : "Unknown",
              detail: !snapshotsCurrent
                ? snapshotState
                : statuses.length
                  ? "Precomputed data containers"
                  : "No snapshots reported",
              tone: !snapshotKnown || staleSnapshots.length > 0 ? "warning" : "good",
            },
          ]}
        />
        <p className="mt-3 text-xs leading-5 text-white/55" role="status">
          Queue source: {queueState.toLowerCase()}. Observed{" "}
          {formatObservation(notificationsQuery.data?.updatedAt)}. Sources refresh every 30 seconds;
          stored queue observations may be cached for 30 seconds.
        </p>
      </AdminSection>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)]">
        <AdminSection
          title="Needs action"
          description="Pending queue records link to their existing review workspace. Counts cover the connected queues, not every site workflow."
          className="pt-0"
        >
          {!queuesCurrent || notificationsQuery.data?.countsAvailable === false ? (
            <div
              className="mb-3 border-y border-amber-400/20 bg-amber-400/5 px-4 py-4 text-sm leading-6 text-amber-100"
              role="status"
            >
              <AlertTriangle className="mr-2 inline h-4 w-4" />
              {queueState === "Loading"
                ? "Loading admin queues."
                : queuesCurrent
                  ? notificationsQuery.data?.partiallyAvailable
                    ? "Some queues are unavailable. Available counts are shown below."
                    : "Queue counts are unavailable. Open a workspace directly or refresh sources."
                  : "Queue counts are " +
                    queueState.toLowerCase() +
                    ". Refresh sources or open a workspace directly."}
            </div>
          ) : null}
          {actionTools.length ? (
            <AdminList>
              {actionTools.map((entry) => {
                const Icon = entry.tool.icon;
                return (
                  <button
                    key={entry.tool.id}
                    type="button"
                    onClick={() => navigate(queueDestination(entry.tool))}
                    className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-white/[0.04]"
                  >
                    <Icon className="h-5 w-5 shrink-0 text-orange-200" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-white">
                        {entry.tool.id === "commercial-directory"
                          ? "Business provider documents"
                          : entry.tool.label}
                      </span>
                      <span className="mt-1 block text-xs text-white/55">
                        {entry.tool.id === "commercial-directory"
                          ? "Review pending license and insurance evidence in Commercial Work."
                          : getAdminToolDescription(entry.tool)}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-orange-500 px-2 py-1 text-xs font-bold text-black">
                      {entry.unread} pending
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-white/50" />
                  </button>
                );
              })}
            </AdminList>
          ) : queuesCurrent && unreadSummary.count === 0 ? (
            <AdminEmptyState
              title="No pending work in connected queues"
              description="Other workspaces may still need attention. Open site management below to inspect them."
            />
          ) : null}
          {unavailableQueues.length ? (
            <AdminList>
              {unavailableQueues.map(({ tool }) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => navigate(queueDestination(tool))}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-white/70"
                >
                  <span>{tool.label}</span>
                  <span className="text-xs text-amber-200">Count unavailable · Open queue</span>
                </button>
              ))}
            </AdminList>
          ) : null}
        </AdminSection>
        <AdminSection
          title="Platform state"
          description="These signals come from separate sources. Open System Status to inspect the supporting evidence."
          className="pt-0"
        >
          <AdminList>
            <SignalRow
              icon={CheckCircle2}
              label="Successful connections"
              value={missionCurrent ? formatCount(successfulConnections) : missionState}
              available={missionCurrent && successfulConnections !== null}
            />
            <SignalRow
              icon={CircleAlert}
              label="Confusing experiences"
              value={
                missionCurrent
                  ? formatCount(knownQueueCount(mission?.confusingExperiences))
                  : missionState
              }
              available={missionCurrent && knownQueueCount(mission?.confusingExperiences) !== null}
              attention={(mission?.confusingExperiences || 0) > 0}
            />
            <SignalRow
              icon={Radio}
              label="Snapshot containers"
              value={
                !snapshotsCurrent
                  ? snapshotState === "Current"
                    ? "Unknown · incomplete evidence"
                    : snapshotState
                  : !snapshotKnown
                    ? "Unknown · incomplete evidence"
                    : staleSnapshots.length
                      ? staleSnapshots.length + " stale"
                      : "Current"
              }
              available={snapshotKnown}
              attention={staleSnapshots.length > 0}
            />
            <SignalRow
              icon={ShieldCheck}
              label="Management destinations"
              value={String(tools.length)}
              available
            />
          </AdminList>
          {canReadSignals ? (
            <p className="mt-3 text-xs leading-5 text-white/50">
              Signals fetched{" "}
              {formatObservation(
                missionQuery.dataUpdatedAt
                  ? new Date(missionQuery.dataUpdatedAt).toISOString()
                  : null
              )}
              . Snapshots fetched{" "}
              {formatObservation(
                snapshotQuery.dataUpdatedAt
                  ? new Date(snapshotQuery.dataUpdatedAt).toISOString()
                  : null
              )}
              .
            </p>
          ) : null}
        </AdminSection>
      </div>

      <AdminSection
        title="Site management"
        description="Browse an area or search every registered tool available to your role, including older routes."
        actions={
          <span className="text-xs text-white/50">
            {catalogSections.reduce((sum, section) => sum + section.items.length, 0)} destinations
          </span>
        }
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-white/45" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search site management"
              placeholder="Search users, documents, settings, orders…"
              className="h-10 w-full rounded-lg border border-white/15 bg-white/[0.035] pl-9 pr-3 text-sm text-white placeholder:text-white/45"
            />
          </div>
          <select
            value={workspaceFilter}
            onChange={(event) => setWorkspaceFilter(event.target.value)}
            aria-label="Filter management area"
            className="h-10 rounded-lg border border-white/15 bg-tsBg px-3 text-sm text-white"
          >
            <option value="all">All areas</option>
            {searchSections.map((section) => (
              <option key={section.section} value={section.section}>
                {section.section}
              </option>
            ))}
          </select>
        </div>
        {catalogSections.length ? (
          <div className="grid items-start gap-3 lg:grid-cols-2">
            {catalogSections.map((section) => (
              <details
                key={section.section + Boolean(normalizedSearch || workspaceFilter !== "all")}
                open={normalizedSearch || workspaceFilter !== "all" ? true : undefined}
                className="min-w-0 rounded-lg border border-white/10 bg-white/[0.018]"
              >
                <summary className="cursor-pointer px-4 py-4 text-sm font-semibold text-white">
                  {section.section}
                  <span className="ml-3 text-xs font-normal text-white/50">
                    {section.items.length}
                  </span>
                </summary>
                <AdminList className="border-b-0">
                  {section.items.map((tool) => (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => navigate(tool.path)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.04]"
                    >
                      <tool.icon className="h-4 w-4 shrink-0 text-white/50" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-white">{tool.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-white/55">
                          {getAdminToolDescription(tool)}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-white/35" />
                    </button>
                  ))}
                </AdminList>
              </details>
            ))}
          </div>
        ) : (
          <AdminEmptyState
            title="No matching management tools"
            description="Try another search or select All areas."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setWorkspaceFilter("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        )}
      </AdminSection>


      <AdminSection title="Common workspaces" description="Shortcuts to frequent operating tasks.">
        <div className="grid border-y border-white/10 sm:grid-cols-2 xl:grid-cols-4">
          {quickTools.map((entry) => (
            <button
              key={entry.tool.id}
              type="button"
              onClick={() => navigate(entry.tool.path)}
              className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4 text-left text-sm text-white/80 hover:bg-white/[0.04]"
            >
              <span>{entry.tool.label}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-white/40" />
            </button>
          ))}
        </div>
      </AdminSection>
    </AdminWorkspace>
  );
}

function SignalRow({
  icon: Icon,
  label,
  value,
  available,
  attention = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  available: boolean;
  attention?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-4 sm:px-4">
      <span
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          !available
            ? "bg-red-400/10 text-red-200"
            : attention
              ? "bg-amber-400/10 text-amber-200"
              : "bg-emerald-400/10 text-emerald-200"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 text-sm text-white/55">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}
