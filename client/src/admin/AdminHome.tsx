import { useMemo } from "react";
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
import { getAdminNavWorkspacesForRole } from "./adminNavWorkspaces";
import { getAdminToolDescription, type AdminRole, type AdminTool } from "./adminTools";

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
  byTool?: Record<string, number>;
  totalUnread?: number;
  degraded?: boolean;
  countsAvailable?: boolean;
  presenceTaskHealth?: PresenceTaskHealth;
};

type PresenceTaskBreakdown = {
  select_site_path: number;
  confirm_facts: number;
  total: number;
};

type PresenceTaskHealth = {
  available: boolean;
  observedAt?: string;
  reminderAutomationStatus?: "healthy" | "degraded";
  activeTasks?: {
    waitingCustomer: PresenceTaskBreakdown;
    retrying: PresenceTaskBreakdown;
    terminalAttention: PresenceTaskBreakdown;
    totalActive: number;
  };
  terminalAttentionCount?: number;
  dueBacklogCount?: number;
  oldestDueAt?: string | null;
  lastAttemptAt?: string | null;
  lastSuccessfulTickAt?: string | null;
  lastFailureAt?: string | null;
  lastErrorCode?: string | null;
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

function taskBreakdown(value: PresenceTaskBreakdown | undefined): PresenceTaskBreakdown | null {
  if (
    !value ||
    !isValidTaskCount(value.select_site_path) ||
    !isValidTaskCount(value.confirm_facts) ||
    !isValidTaskCount(value.total) ||
    value.total !== value.select_site_path + value.confirm_facts
  ) {
    return null;
  }
  return value;
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

const PRESENCE_OBSERVATION_MAX_AGE_MS = 2 * 60 * 1000;

export function PresenceOperatorSummary({
  health,
  queryState,
}: {
  health?: PresenceTaskHealth;
  queryState: "loading" | "error" | "ready";
}) {
  const observationTime = health?.observedAt ? Date.parse(health.observedAt) : NaN;
  const lastSuccessTime = health?.lastSuccessfulTickAt
    ? Date.parse(health.lastSuccessfulTickAt)
    : NaN;
  const snapshotAvailable = queryState === "ready" && health?.available === true;
  const observationCurrent =
    snapshotAvailable &&
    Number.isFinite(observationTime) &&
    observationTime <= Date.now() + 60_000 &&
    Date.now() - observationTime <= PRESENCE_OBSERVATION_MAX_AGE_MS;
  const counts = observationCurrent ? health?.activeTasks : undefined;
  const waiting = taskBreakdown(counts?.waitingCustomer);
  const retrying = taskBreakdown(counts?.retrying);
  const terminal = taskBreakdown(counts?.terminalAttention);
  const totalActive = isValidTaskCount(counts?.totalActive) ? counts.totalActive : null;
  const consistentTotal =
    waiting &&
    retrying &&
    terminal &&
    totalActive !== null &&
    totalActive === waiting.total + retrying.total + terminal.total;
  const countsKnown = Boolean(consistentTotal);
  const dueBacklog =
    observationCurrent && isValidTaskCount(health?.dueBacklogCount) ? health.dueBacklogCount : null;
  const oldestDueTime = health?.oldestDueAt ? Date.parse(health.oldestDueAt) : NaN;
  const backlogDetail =
    dueBacklog === null
      ? "Due reminder attempts: unknown."
      : dueBacklog === 0 && !health?.oldestDueAt
        ? "Due reminder attempts: 0."
        : dueBacklog > 0 && Number.isFinite(oldestDueTime) && oldestDueTime <= observationTime
          ? `Due reminder attempts: ${formatCount(dueBacklog)}; oldest due ${formatObservation(health?.oldestDueAt)}.`
          : `Due reminder attempts: ${formatCount(dueBacklog)}; oldest due unknown.`;
  const automationState = !snapshotAvailable
    ? "Unknown"
    : !observationCurrent ||
        health?.reminderAutomationStatus === "degraded" ||
        !Number.isFinite(lastSuccessTime)
      ? "Degraded"
      : health?.reminderAutomationStatus === "healthy"
        ? "Healthy"
        : "Unknown";
  const unavailableDetail =
    queryState === "loading"
      ? "Loading the latest Presence status."
      : "Presence task counts are unavailable. Refresh to try again.";
  const breakdownDetail = (value: PresenceTaskBreakdown | null, description: string) =>
    countsKnown && value
      ? `${description} ${formatCount(value.select_site_path)} site path; ${formatCount(value.confirm_facts)} fact confirmation.`
      : unavailableDetail;

  return (
    <AdminSection
      title="Presence operations"
      description="Tracked customer tasks and reminder automation. Counts are tasks, not unique businesses or owner assignments."
    >
      <AdminList>
        <PresenceStateRow
          testId="presence-healthy"
          label="Healthy — reminder automation only"
          value={automationState}
          detail={`${automationState === "Healthy" ? "The customer reminder scheduler completed recently for both task types." : automationState === "Degraded" ? "Reminder scheduling needs attention or this observation is stale." : unavailableDetail} ${backlogDetail} Observed ${formatObservation(health?.observedAt)}; last successful run ${formatObservation(health?.lastSuccessfulTickAt)}. This does not measure onboarding completeness.`}
          attention={automationState === "Degraded"}
        />
        <PresenceStateRow
          testId="presence-waiting-customer"
          label="Waiting on Customer"
          value={countsKnown ? formatCount(waiting?.total) : "Unknown"}
          detail={breakdownDetail(waiting, "Customers need to respond:")}
        />
        <PresenceStateRow
          testId="presence-needs-authorization"
          label="Needs Authorization"
          value="Not instrumented"
          detail="Customer account permissions are not yet measured here. This is not a zero count."
        />
        <PresenceStateRow
          testId="presence-automation-retrying"
          label="Automation Retrying"
          value={countsKnown ? formatCount(retrying?.total) : "Unknown"}
          detail={breakdownDetail(retrying, "Automation will retry:")}
          attention={countsKnown && Boolean(retrying?.total)}
        />
        <PresenceStateRow
          testId="presence-human-exception"
          label="Human Exception"
          value={
            countsKnown
              ? `${formatCount(terminal?.total)} / ${formatCount(totalActive)}`
              : "Unknown"
          }
          detail={
            countsKnown && terminal
              ? `${formatCount(terminal.total)} of ${formatCount(totalActive)} active tracked tasks reached the reminder limit (${formatCount(terminal.select_site_path)} site path; ${formatCount(terminal.confirm_facts)} fact confirmation). Automatic reminders stopped after the retry limit. Informational; no operator case or action is available here.`
              : unavailableDetail
          }
        />
        <PresenceStateRow
          testId="presence-dangerous-action"
          label="Dangerous Action"
          value="Not instrumented"
          detail="Domain, account, and publication approvals are not yet measured here. This is not a zero count."
        />
      </AdminList>
    </AdminSection>
  );
}

function PresenceStateRow({
  testId,
  label,
  value,
  detail,
  attention = false,
}: {
  testId: string;
  label: string;
  value: string;
  detail: string;
  attention?: boolean;
}) {
  return (
    <div
      data-testid={testId}
      className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(12rem,0.35fr)_minmax(0,1fr)_auto] sm:items-start sm:gap-4"
    >
      <h3 className="text-sm font-semibold text-white">{label}</h3>
      <p className="text-xs leading-5 text-white/50">{detail}</p>
      <span className={`text-sm font-semibold ${attention ? "text-amber-200" : "text-white/75"}`}>
        {value}
      </span>
    </div>
  );
}

export function AdminHome({ role, isSuperAdmin }: AdminHomeProps) {
  const [, navigate] = useLocation();
  const canReadSignals =
    isSuperAdmin || role === "owner" || role === "super_admin" || role === "ops_admin";
  const sections = useMemo(
    () => getAdminNavWorkspacesForRole(role, isSuperAdmin),
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
  });
  const missionQuery = useQuery<MissionControlSummary>({
    queryKey: ["/api/admin/mission-control/summary"],
    queryFn: () => apiRequest("GET", "/api/admin/mission-control/summary"),
    enabled: canReadSignals,
    retry: false,
  });
  const snapshotQuery = useQuery<SnapshotStatusResponse>({
    queryKey: ["/api/admin/observability/snapshot-status"],
    queryFn: () => apiRequest("GET", "/api/admin/observability/snapshot-status"),
    enabled: canReadSignals,
    retry: false,
  });

  const unreadByTool = notificationsQuery.data?.byTool || {};
  const actionTools = useMemo(
    () =>
      tools
        .map((entry) => ({ ...entry, unread: Number(unreadByTool[entry.tool.id] || 0) }))
        .filter((entry) => entry.unread > 0)
        .sort((a, b) => b.unread - a.unread || a.tool.label.localeCompare(b.tool.label)),
    [tools, unreadByTool]
  );
  const quickTools = useMemo(() => {
    const byId = new Map(tools.map((entry) => [entry.tool.id, entry]));
    const ordered = QUICK_TOOL_IDS.map((id) => byId.get(id)).filter(Boolean) as ToolEntry[];
    for (const entry of tools) {
      if (ordered.length >= 8) break;
      if (!ordered.some((candidate) => candidate.tool.id === entry.tool.id)) ordered.push(entry);
    }
    return ordered.slice(0, 8);
  }, [tools]);

  const mission = missionQuery.data;
  const connectionAttempts = mission?.totalConnectionAttempts;
  const connectionRate =
    typeof connectionAttempts === "number" && connectionAttempts > 0
      ? Math.round(((mission?.successfulConnections || 0) / connectionAttempts) * 100)
      : null;
  const staleSnapshots = snapshotQuery.data?.statuses?.filter((status) => status.isStale) || [];
  const unreadSummary = unreadWorkSummary(
    notificationsQuery.data,
    notificationsQuery.isLoading ? "loading" : notificationsQuery.isError ? "error" : "ready"
  );
  const anySignalUnavailable = missionQuery.isError || snapshotQuery.isError;

  const refreshAll = () => {
    notificationsQuery.refetch();
    missionQuery.refetch();
    snapshotQuery.refetch();
  };

  return (
    <AdminWorkspace data-testid="admin-home-v2">
      <AdminSection
        title="Operator inbox"
        description="Start with work that needs a decision. Tool discovery belongs in the navigation search, not in another dashboard of cards."
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={refreshAll}
            disabled={
              notificationsQuery.isFetching || missionQuery.isFetching || snapshotQuery.isFetching
            }
            className="border-white/12 bg-white/[0.025] text-white/65 hover:bg-white/[0.06] hover:text-white"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                notificationsQuery.isFetching || missionQuery.isFetching || snapshotQuery.isFetching
                  ? "animate-spin"
                  : ""
              }`}
            />
            Refresh
          </Button>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Unread work",
              value: formatCount(unreadSummary.count),
              detail: unreadSummary.detail,
              tone: unreadSummary.tone,
            },
            {
              label: "Connection success",
              value: connectionRate === null ? "—" : `${connectionRate}%`,
              detail:
                typeof connectionAttempts === "number"
                  ? `${formatCount(connectionAttempts)} recorded attempts`
                  : "No current mission summary",
              tone: connectionRate === null ? "neutral" : connectionRate >= 80 ? "good" : "warning",
            },
            {
              label: "Blocked paths",
              value: formatCount(mission?.blockedConnections),
              detail: "Recorded hard stops",
              tone: (mission?.blockedConnections || 0) > 0 ? "warning" : "good",
            },
            {
              label: "Stale snapshots",
              value: snapshotQuery.isError ? "—" : formatCount(staleSnapshots.length),
              detail: anySignalUnavailable
                ? "One or more signal feeds unavailable"
                : "Current data containers",
              tone: anySignalUnavailable || staleSnapshots.length > 0 ? "warning" : "good",
            },
          ]}
        />
      </AdminSection>

      <PresenceOperatorSummary
        health={notificationsQuery.data?.presenceTaskHealth}
        queryState={
          notificationsQuery.isLoading ? "loading" : notificationsQuery.isError ? "error" : "ready"
        }
      />

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)]">
        <AdminSection
          title="Needs action"
          description="Unread counts come from the operating queues themselves. No synthetic urgency is added here."
          className="pt-0"
        >
          {notificationsQuery.isLoading ? (
            <div className="flex min-h-40 items-center justify-center border-y border-white/10 text-sm text-white/45">
              <RefreshCw className="mr-3 h-4 w-4 animate-spin" />
              Loading admin queues…
            </div>
          ) : notificationsQuery.isError || unreadSummary.count === null ? (
            <div className="flex items-start gap-3 border-y border-amber-400/20 bg-amber-400/5 px-4 py-5 text-sm leading-6 text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              The queue summary is unavailable. Open a workspace directly or retry the refresh.
            </div>
          ) : actionTools.length ? (
            <AdminList>
              {actionTools.map((entry) => {
                const Icon = entry.tool.icon;
                return (
                  <button
                    key={entry.tool.id}
                    type="button"
                    onClick={() => navigate(entry.tool.path)}
                    className="grid w-full gap-3 px-3 py-4 text-left transition-colors hover:bg-white/[0.025] sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center sm:px-4"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-200">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-white">
                        {entry.tool.label}
                      </span>
                      <span className="mt-1 block line-clamp-1 text-sm text-white/45">
                        {getAdminToolDescription(entry.tool)}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="rounded-full bg-orange-500 px-2 py-1 text-xs font-bold text-black">
                        {entry.unread}
                      </span>
                      <ArrowRight className="h-4 w-4 text-white/30" />
                    </span>
                  </button>
                );
              })}
            </AdminList>
          ) : (
            <AdminEmptyState
              title="No unread admin queues"
              description="This does not mean every system is healthy. It means no role-visible tool currently reports unread work."
            />
          )}
        </AdminSection>

        <AdminSection
          title="Platform state"
          description="Live operating signals, including unavailable states."
          className="pt-0"
        >
          <div className="divide-y divide-white/10 border-y border-white/10">
            <SignalRow
              icon={CheckCircle2}
              label="Successful connections"
              value={formatCount(mission?.successfulConnections)}
              available={!missionQuery.isError}
            />
            <SignalRow
              icon={CircleAlert}
              label="Confusing experiences"
              value={formatCount(mission?.confusingExperiences)}
              available={!missionQuery.isError}
              attention={(mission?.confusingExperiences || 0) > 0}
            />
            <SignalRow
              icon={Radio}
              label="Snapshot containers"
              value={
                snapshotQuery.isError
                  ? "Unavailable"
                  : staleSnapshots.length
                    ? `${staleSnapshots.length} stale`
                    : "Current"
              }
              available={!snapshotQuery.isError}
              attention={staleSnapshots.length > 0}
            />
            <SignalRow
              icon={ShieldCheck}
              label="Role-visible workspaces"
              value={String(tools.length)}
              available
            />
          </div>
        </AdminSection>
      </div>

      <AdminSection
        title="Common workspaces"
        description="Direct access to the operating surfaces used most often. Use Find tool in the top bar for everything else."
      >
        <div className="grid border-y border-white/10 sm:grid-cols-2 xl:grid-cols-4">
          {quickTools.map((entry) => {
            const Icon = entry.tool.icon;
            return (
              <button
                key={entry.tool.id}
                type="button"
                onClick={() => navigate(entry.tool.path)}
                className="group min-h-32 border-b border-white/10 px-4 py-4 text-left transition-colors hover:bg-white/[0.03] sm:border-r xl:border-b-0"
              >
                <Icon className="h-5 w-5 text-white/35 group-hover:text-orange-200" />
                <p className="mt-4 font-semibold text-white">{entry.tool.label}</p>
                <p className="mt-1 line-clamp-2 text-sm leading-5 text-white/42">
                  {getAdminToolDescription(entry.tool)}
                </p>
              </button>
            );
          })}
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
