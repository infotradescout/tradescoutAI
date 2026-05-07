import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  CircleAlert,
  Command,
  Compass,
  Fingerprint,
  MapPinned,
  Radio,
  Search,
  ShieldCheck,
  TriangleAlert,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  getAdminNavSectionsForRole,
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
  byTool?: Record<string, number>;
  totalUnread?: number;
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

const LAW_GUARDS = [
  {
    label: "Contact gate",
    status: "enforced",
    detail: "Intent -> Decision Card -> Contact",
    icon: Workflow,
  },
  {
    label: "County containers",
    status: "enforced",
    detail: "county_metrics, county_entities, county_notes",
    icon: MapPinned,
  },
  {
    label: "Trust exposure",
    status: "enforced",
    detail: "Trust/CVS governs visibility and action",
    icon: Fingerprint,
  },
  {
    label: "Global view",
    status: "policy_target",
    detail: "Read-only global community, no global action",
    icon: Compass,
  },
] as const;

const FOCUS_TOOL_IDS = [
  "mission-control",
  "direct-connect-requests",
  "verification",
  "commercial-directory",
  "business-import",
  "live-stream",
  "controls",
  "users",
];

function formatCount(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function roleLabel(role: AdminRole) {
  if (role === "super_admin" || role === "owner") return "Super admin";
  if (role === "ops_admin") return "Ops admin";
  return "Moderator";
}

function compactPath(path: string) {
  if (path === "/admin") return "admin home";
  return path.replace("/admin/", "").replaceAll("-", " ");
}

function lawBadge(status: (typeof LAW_GUARDS)[number]["status"]) {
  return status === "enforced" ? "success" : "warning";
}

export function AdminHome({ role, isSuperAdmin }: AdminHomeProps) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const canReadOpsSignals =
    isSuperAdmin || role === "owner" || role === "super_admin" || role === "ops_admin";

  const sections = useMemo(
    () => getAdminNavSectionsForRole(role, isSuperAdmin),
    [isSuperAdmin, role]
  );

  const tools = useMemo<ToolEntry[]>(
    () =>
      sections.flatMap((section) =>
        section.items.map((tool) => ({ section: section.section, tool }))
      ),
    [sections]
  );

  const { data: notifications } = useQuery<ToolNotifications>({
    queryKey: ["/api/admin/tool-notifications"],
    queryFn: () => apiRequest("GET", "/api/admin/tool-notifications"),
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const { data: missionSummary } = useQuery<MissionControlSummary>({
    queryKey: ["/api/admin/mission-control/summary"],
    queryFn: () => apiRequest("GET", "/api/admin/mission-control/summary"),
    enabled: canReadOpsSignals,
    retry: false,
  });

  const { data: snapshotStatus } = useQuery<SnapshotStatusResponse>({
    queryKey: ["/api/admin/observability/snapshot-status"],
    queryFn: () => apiRequest("GET", "/api/admin/observability/snapshot-status"),
    enabled: canReadOpsSignals,
    retry: false,
  });

  const unreadByTool = notifications?.byTool || {};
  const getUnread = (toolId: string) => Number(unreadByTool[toolId] || 0);
  const totalUnread =
    typeof notifications?.totalUnread === "number"
      ? notifications.totalUnread
      : tools.reduce((sum, entry) => sum + getUnread(entry.tool.id), 0);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredTools = useMemo(() => {
    return tools.filter((entry) => {
      const sectionMatches = sectionFilter === "all" || entry.section === sectionFilter;
      if (!sectionMatches) return false;
      if (!normalizedQuery) return true;
      return getAdminToolSearchText(entry.tool, entry.section).includes(normalizedQuery);
    });
  }, [normalizedQuery, sectionFilter, tools]);

  const focusTools = useMemo(() => {
    const byId = new Map(tools.map((entry) => [entry.tool.id, entry]));
    const ordered = FOCUS_TOOL_IDS.map((id) => byId.get(id)).filter(Boolean) as ToolEntry[];
    for (const entry of tools) {
      if (ordered.length >= 8) break;
      if (!ordered.some((candidate) => candidate.tool.id === entry.tool.id)) ordered.push(entry);
    }
    return ordered.slice(0, 8);
  }, [tools]);

  const staleSnapshots = snapshotStatus?.statuses?.filter((status) => status.isStale) ?? [];
  const connectionAttempts = missionSummary?.totalConnectionAttempts ?? 0;
  const connectionRate =
    connectionAttempts > 0
      ? Math.round(((missionSummary?.successfulConnections ?? 0) / connectionAttempts) * 100)
      : 0;

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-5 px-3 py-3 sm:px-4 lg:px-5">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.26)] sm:px-5">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr] xl:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
              >
                Admin OS
              </Badge>
              <Badge variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-300">
                {roleLabel(role)}
              </Badge>
              {isSuperAdmin ? (
                <Badge
                  variant="outline"
                  className="border-orange-500/30 bg-orange-500/10 text-orange-100"
                >
                  Super controls
                </Badge>
              ) : null}
            </div>
            <div className="mt-3 flex items-start gap-3">
              <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-500/25 bg-orange-500/10 text-orange-100">
                <Command className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold text-zinc-50 sm:text-3xl">
                  Admin command center
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-400">
                  One role-aware index for platform operations, county intelligence, trust work,
                  automation, and finance.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
            <MetricTile
              label="Tools"
              value={formatCount(tools.length)}
              detail={`${sections.length} sections`}
            />
            <MetricTile
              label="Unread"
              value={formatCount(totalUnread)}
              detail="Tool notices"
              tone={totalUnread > 0 ? "orange" : "neutral"}
            />
            <MetricTile label="Connection" value={`${connectionRate}%`} detail="Mission rate" />
            <MetricTile
              label="Snapshots"
              value={formatCount(staleSnapshots.length)}
              detail="Stale"
              tone={staleSnapshots.length > 0 ? "red" : "green"}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-4">
        <SignalTile
          icon={ShieldCheck}
          label="Successful contact paths"
          value={formatCount(missionSummary?.successfulConnections)}
          detail={`${formatCount(connectionAttempts)} attempts`}
        />
        <SignalTile
          icon={CircleAlert}
          label="Blocked contact paths"
          value={formatCount(missionSummary?.blockedConnections)}
          detail="Contact gates preserved"
          tone={(missionSummary?.blockedConnections ?? 0) > 0 ? "orange" : "neutral"}
        />
        <SignalTile
          icon={TriangleAlert}
          label="Confusing experiences"
          value={formatCount(missionSummary?.confusingExperiences)}
          detail="UI or copy friction"
          tone={(missionSummary?.confusingExperiences ?? 0) > 0 ? "orange" : "neutral"}
        />
        <SignalTile
          icon={Radio}
          label="Snapshot drift"
          value={formatCount(staleSnapshots.length)}
          detail={
            staleSnapshots.length > 0
              ? staleSnapshots
                  .map((s) => s.label)
                  .slice(0, 2)
                  .join(", ")
              : "Current"
          }
          tone={staleSnapshots.length > 0 ? "red" : "green"}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)]">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950">
          <div className="border-b border-zinc-800 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">Tool index</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {filteredTools.length} of {tools.length} tools visible for this role.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative min-w-0 sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search admin tools"
                    className="border-zinc-800 bg-zinc-900 pl-9 text-zinc-100 placeholder:text-zinc-500"
                  />
                </div>
                <select
                  value={sectionFilter}
                  onChange={(event) => setSectionFilter(event.target.value)}
                  className="h-10 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-orange-500/40"
                >
                  <option value="all">All sections</option>
                  {sections.map((section) => (
                    <option key={section.section} value={section.section}>
                      {section.section}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredTools.length > 0 ? (
              filteredTools.map((entry) => (
                <ToolButton
                  key={entry.tool.id}
                  entry={entry}
                  unread={getUnread(entry.tool.id)}
                  onOpen={() => navigate(entry.tool.path)}
                />
              ))
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-400 md:col-span-2 xl:col-span-3">
                No tools match the current filter.
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-5">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-orange-200" />
              <h2 className="text-base font-semibold text-zinc-100">Today openers</h2>
            </div>
            <div className="mt-3 grid gap-2">
              {focusTools.map((entry) => {
                const Icon = entry.tool.icon;
                return (
                  <button
                    key={entry.tool.id}
                    type="button"
                    onClick={() => navigate(entry.tool.path)}
                    className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 text-left transition-colors hover:border-orange-500/35 hover:bg-zinc-900"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-zinc-400 group-hover:text-orange-100" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-100">
                        {entry.tool.label}
                      </span>
                      <span className="block truncate text-xs text-zinc-500">{entry.section}</span>
                    </span>
                    {getUnread(entry.tool.id) > 0 ? (
                      <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-100">
                        {getUnread(entry.tool.id)}
                      </span>
                    ) : null}
                    <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-orange-100" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-200" />
              <h2 className="text-base font-semibold text-zinc-100">Law guardrails</h2>
            </div>
            <div className="mt-3 grid gap-2">
              {LAW_GUARDS.map((guard) => {
                const Icon = guard.icon;
                return (
                  <div
                    key={guard.label}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-zinc-100">{guard.label}</span>
                          <Badge variant={lawBadge(guard.status)} className="px-2 py-0 text-[10px]">
                            {guard.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-zinc-500">{guard.detail}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <h2 className="text-base font-semibold text-zinc-100">Section loadout</h2>
            <div className="mt-3 grid gap-2">
              {sections.map((section) => {
                const sectionUnread = section.items.reduce(
                  (sum, item) => sum + getUnread(item.id),
                  0
                );
                return (
                  <button
                    key={section.section}
                    type="button"
                    onClick={() => setSectionFilter(section.section)}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors",
                      sectionFilter === section.section
                        ? "border-orange-500/35 bg-orange-500/10"
                        : "border-zinc-800 bg-zinc-900/70 hover:bg-zinc-900"
                    )}
                  >
                    <span>
                      <span className="block text-sm font-medium text-zinc-100">
                        {section.section}
                      </span>
                      <span className="block text-xs text-zinc-500">
                        {section.items.length} tools
                      </span>
                    </span>
                    <span className="text-xs text-zinc-500">{sectionUnread} unread</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricTile({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "orange" | "green" | "red";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        tone === "orange" && "border-orange-500/25 bg-orange-500/10",
        tone === "green" && "border-emerald-500/25 bg-emerald-500/10",
        tone === "red" && "border-red-500/25 bg-red-500/10",
        tone === "neutral" && "border-zinc-800 bg-zinc-900/70"
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-zinc-50">{value}</div>
      <div className="mt-1 truncate text-xs text-zinc-500">{detail}</div>
    </div>
  );
}

function SignalTile({
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "orange" | "green" | "red";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-zinc-950 p-4",
        tone === "orange" && "border-orange-500/25",
        tone === "green" && "border-emerald-500/25",
        tone === "red" && "border-red-500/25",
        tone === "neutral" && "border-zinc-800"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-zinc-400">{label}</span>
        <Icon className="h-4 w-4 text-zinc-500" />
      </div>
      <div className="mt-3 text-2xl font-semibold text-zinc-50">{value}</div>
      <div className="mt-1 truncate text-xs text-zinc-500" title={detail}>
        {detail}
      </div>
    </div>
  );
}

function ToolButton({
  entry,
  unread,
  onOpen,
}: {
  entry: ToolEntry;
  unread: number;
  onOpen: () => void;
}) {
  const Icon = entry.tool.icon;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-[132px] flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 text-left transition-colors hover:border-orange-500/35 hover:bg-zinc-900"
    >
      <span>
        <span className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 group-hover:border-orange-500/30 group-hover:text-orange-100">
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-zinc-100">
              {entry.tool.label}
            </span>
            <span className="mt-0.5 block truncate text-xs text-zinc-500">
              {compactPath(entry.tool.path)}
            </span>
          </span>
        </span>
        <span className="mt-3 line-clamp-2 block text-sm leading-5 text-zinc-400">
          {getAdminToolDescription(entry.tool)}
        </span>
      </span>
      <span className="mt-4 flex items-center justify-between gap-3">
        <span className="truncate text-xs text-zinc-500">{entry.section}</span>
        <span className="flex items-center gap-2">
          {unread > 0 ? (
            <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-100">
              {unread}
            </span>
          ) : null}
          <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-orange-100" />
        </span>
      </span>
    </button>
  );
}

export default AdminHome;
