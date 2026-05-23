import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

type ModuleId =
  | "identity_profile"
  | "service_catalog"
  | "coverage_availability"
  | "trust_verification"
  | "operations_payout";

type ModuleStatus = "not_started" | "in_progress" | "complete";

type TransitionRow = {
  at: string;
  userId: string;
  moduleId: ModuleId | string;
  fromStatus: ModuleStatus | string;
  toStatus: ModuleStatus | string;
  source: string;
};

type TelemetryResponse = {
  lookbackDays: number;
  usersWithBusinessOnboarding: number;
  statusCounts: Record<ModuleId, Record<ModuleStatus, number>>;
  transitionCounts: Record<string, number>;
  recentTransitions: TransitionRow[];
};

const MODULE_LABELS: Record<ModuleId, string> = {
  identity_profile: "Identity & Profile",
  service_catalog: "Service Catalog",
  coverage_availability: "Coverage & Availability",
  trust_verification: "Trust Verification",
  operations_payout: "Operations & Payout",
};

function fmt(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function pct(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function statusTone(status: ModuleStatus | string) {
  if (status === "complete") return "success" as const;
  if (status === "in_progress") return "warning" as const;
  return "outline" as const;
}

export default function AdminBusinessOnboardingTelemetry() {
  const [days, setDays] = useState(14);

  const { data, isLoading, isFetching, refetch, error } = useQuery<TelemetryResponse>({
    queryKey: ["/api/admin/business-onboarding/telemetry", days],
    queryFn: () => apiRequest("GET", `/api/admin/business-onboarding/telemetry?days=${days}`),
    staleTime: 20000,
    retry: false,
  });

  const moduleRows = useMemo(() => {
    const counts = data?.statusCounts;
    if (!counts) return [];
    return (Object.keys(MODULE_LABELS) as ModuleId[]).map((moduleId) => {
      const row = counts[moduleId] || { not_started: 0, in_progress: 0, complete: 0 };
      const total = row.not_started + row.in_progress + row.complete;
      return {
        moduleId,
        label: MODULE_LABELS[moduleId],
        notStarted: row.not_started,
        inProgress: row.in_progress,
        complete: row.complete,
        total,
      };
    });
  }, [data?.statusCounts]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-zinc-100">Business Onboarding Telemetry</h1>
        <p className="text-sm text-zinc-400">Loading telemetry…</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-500/30 bg-zinc-950">
        <CardHeader>
          <CardTitle className="text-zinc-100">Business Onboarding Telemetry</CardTitle>
          <CardDescription className="text-zinc-400">
            Unable to load telemetry from `/api/admin/business-onboarding/telemetry`.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const transitions = data?.recentTransitions || [];
  const transitionCounts = data?.transitionCounts || {};
  const topTransitionModules = Object.entries(transitionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Business Onboarding Telemetry</h1>
          <p className="text-sm text-zinc-400">
            Completion coverage, module bottlenecks, and recent transition flow.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-400" htmlFor="telemetry-days">
            Lookback
          </label>
          <select
            id="telemetry-days"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="h-9 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-100"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
          </select>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-zinc-800 bg-zinc-950">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400">Users in flow</CardDescription>
            <CardTitle className="text-2xl text-zinc-100">
              {fmt(data?.usersWithBusinessOnboarding)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-zinc-800 bg-zinc-950">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400">Transitions (window)</CardDescription>
            <CardTitle className="text-2xl text-zinc-100">{fmt(transitions.length)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-zinc-800 bg-zinc-950">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400">Lookback days</CardDescription>
            <CardTitle className="text-2xl text-zinc-100">{fmt(data?.lookbackDays)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-zinc-950">
        <CardHeader>
          <CardTitle className="text-zinc-100">Module status distribution</CardTitle>
          <CardDescription className="text-zinc-400">
            Completion should trend toward full coverage before discoverability unlock.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {moduleRows.map((row) => (
            <div
              key={row.moduleId}
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-zinc-100">{row.label}</div>
                <div className="text-xs text-zinc-500">{fmt(row.total)} users</div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="success">
                  Complete {fmt(row.complete)} ({pct(row.complete, row.total)})
                </Badge>
                <Badge variant="warning">
                  In progress {fmt(row.inProgress)} ({pct(row.inProgress, row.total)})
                </Badge>
                <Badge variant="outline">
                  Not started {fmt(row.notStarted)} ({pct(row.notStarted, row.total)})
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-950">
          <CardHeader>
            <CardTitle className="text-zinc-100">Transition velocity by module</CardTitle>
            <CardDescription className="text-zinc-400">
              High transition volume can indicate active completion pushes or friction loops.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {topTransitionModules.length ? (
              topTransitionModules.map(([moduleId, count]) => (
                <div
                  key={moduleId}
                  className="flex items-center justify-between rounded-md border border-zinc-800 px-3 py-2 text-sm"
                >
                  <span className="text-zinc-200">
                    {MODULE_LABELS[moduleId as ModuleId] || moduleId}
                  </span>
                  <span className="text-zinc-400">{fmt(count)}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-zinc-500">No transitions captured in this window.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950">
          <CardHeader>
            <CardTitle className="text-zinc-100">Recent transitions</CardTitle>
            <CardDescription className="text-zinc-400">
              Last {fmt(transitions.length)} transition events in descending time order.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
              {transitions.length ? (
                transitions.map((row, idx) => (
                  <div
                    key={`${row.at}-${row.userId}-${idx}`}
                    className="rounded-md border border-zinc-800 p-2"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span>{new Date(row.at).toLocaleString()}</span>
                      <span>•</span>
                      <span>{row.source || "unknown_source"}</span>
                    </div>
                    <div className="mt-1 text-sm text-zinc-200">
                      {MODULE_LABELS[row.moduleId as ModuleId] || row.moduleId}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <Badge variant={statusTone(row.fromStatus)}>
                        {row.fromStatus || "unknown"}
                      </Badge>
                      <span className="text-zinc-500">→</span>
                      <Badge variant={statusTone(row.toStatus)}>{row.toStatus || "unknown"}</Badge>
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500">
                      User: {row.userId || "unknown"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-zinc-500">
                  No recent transition events in this window.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
