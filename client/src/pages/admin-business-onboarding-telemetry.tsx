import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminToolbar,
  AdminWorkspace,
} from "@/admin/AdminWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function percentage(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function readable(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusBadge(status: ModuleStatus | string) {
  if (status === "complete") {
    return (
      <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-200">
        Complete
      </Badge>
    );
  }
  if (status === "in_progress") {
    return (
      <Badge className="border-amber-400/25 bg-amber-400/10 text-amber-100">
        In progress
      </Badge>
    );
  }
  return (
    <Badge className="border-white/15 bg-white/5 text-white/50">{readable(status || "not_started")}</Badge>
  );
}

export default function AdminBusinessOnboardingTelemetry() {
  const [days, setDays] = useState("14");

  const telemetryQuery = useQuery<TelemetryResponse>({
    queryKey: ["/api/admin/business-onboarding/telemetry", days],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/admin/business-onboarding/telemetry?days=${encodeURIComponent(days)}`
      ) as Promise<TelemetryResponse>,
    staleTime: 20_000,
    retry: false,
  });

  const moduleRows = useMemo(() => {
    const counts = telemetryQuery.data?.statusCounts;
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
  }, [telemetryQuery.data?.statusCounts]);

  const transitions = telemetryQuery.data?.recentTransitions || [];
  const topTransitionModules = useMemo(
    () =>
      Object.entries(telemetryQuery.data?.transitionCounts || {})
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5),
    [telemetryQuery.data?.transitionCounts]
  );

  const statusTotals = useMemo(
    () =>
      moduleRows.reduce(
        (totals, row) => ({
          complete: totals.complete + row.complete,
          inProgress: totals.inProgress + row.inProgress,
          notStarted: totals.notStarted + row.notStarted,
          all: totals.all + row.total,
        }),
        { complete: 0, inProgress: 0, notStarted: 0, all: 0 }
      ),
    [moduleRows]
  );

  return (
    <AdminWorkspace data-testid="admin-business-onboarding-v2">
      <AdminSection
        title="Business onboarding health"
        description="Module completion, movement, and friction across business-account setup. The source reports actual stored states; unavailable telemetry is not replaced with zeroes."
        className="pt-0"
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => telemetryQuery.refetch()}
            disabled={telemetryQuery.isFetching}
            className="border-white/12 bg-transparent text-white/65"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${telemetryQuery.isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Businesses in setup",
              value: telemetryQuery.isError
                ? "—"
                : formatNumber(telemetryQuery.data?.usersWithBusinessOnboarding),
              detail: telemetryQuery.isError
                ? "Telemetry unavailable"
                : `${telemetryQuery.data?.lookbackDays || Number(days)}-day window`,
              tone: telemetryQuery.isError ? "warning" : "neutral",
            },
            {
              label: "Complete module states",
              value: telemetryQuery.isError ? "—" : formatNumber(statusTotals.complete),
              detail: telemetryQuery.isError
                ? "Module states unavailable"
                : `${percentage(statusTotals.complete, statusTotals.all)} of recorded module states`,
              tone: telemetryQuery.isError ? "warning" : "good",
            },
            {
              label: "In progress",
              value: telemetryQuery.isError ? "—" : formatNumber(statusTotals.inProgress),
              detail: "Recorded module states still moving",
              tone:
                telemetryQuery.isError || statusTotals.inProgress > 0 ? "warning" : "good",
            },
            {
              label: "Transitions",
              value: telemetryQuery.isError ? "—" : formatNumber(transitions.length),
              detail: "Recent stored status changes",
              tone: telemetryQuery.isError ? "warning" : "neutral",
            },
          ]}
        />
      </AdminSection>

      <AdminSection
        title="Module completion"
        description="Each row shows the current distribution for one required business setup module."
        className="pt-0"
      >
        <AdminToolbar>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/38">Lookback</span>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[10rem] border-white/10 bg-black/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-white/35">
            {moduleRows.length} required modules
          </span>
        </AdminToolbar>

        {telemetryQuery.isLoading ? (
          <div className="flex min-h-44 items-center justify-center border-y border-white/10 text-sm text-white/45">
            <RefreshCw className="mr-3 h-4 w-4 animate-spin" />
            Loading onboarding telemetry…
          </div>
        ) : telemetryQuery.isError ? (
          <div className="border-y border-amber-400/20 bg-amber-400/5 px-4 py-5 text-sm leading-6 text-amber-100">
            Business onboarding telemetry is unavailable. No setup state was changed.
          </div>
        ) : moduleRows.length ? (
          <AdminList className="mt-4">
            {moduleRows.map((row) => (
              <div
                key={row.moduleId}
                className="grid gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(14rem,1fr)_minmax(8rem,0.45fr)_minmax(8rem,0.45fr)_minmax(8rem,0.45fr)] lg:items-center"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-white">{row.label}</p>
                  <p className="mt-1 font-mono text-xs text-white/30">{row.moduleId}</p>
                  <p className="mt-2 text-xs text-white/42">{formatNumber(row.total)} accounts</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                    Complete
                  </p>
                  <p className="mt-2 text-lg font-semibold text-emerald-200">
                    {formatNumber(row.complete)}
                  </p>
                  <p className="text-xs text-white/32">{percentage(row.complete, row.total)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                    In progress
                  </p>
                  <p className="mt-2 text-lg font-semibold text-amber-100">
                    {formatNumber(row.inProgress)}
                  </p>
                  <p className="text-xs text-white/32">{percentage(row.inProgress, row.total)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                    Not started
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white/65">
                    {formatNumber(row.notStarted)}
                  </p>
                  <p className="text-xs text-white/32">{percentage(row.notStarted, row.total)}</p>
                </div>
              </div>
            ))}
          </AdminList>
        ) : (
          <AdminEmptyState
            title="No module-state telemetry"
            description="The onboarding source returned no module distributions for this window."
          />
        )}
      </AdminSection>

      <div className="grid gap-7 xl:grid-cols-[minmax(16rem,0.65fr)_minmax(0,1.35fr)]">
        <AdminSection
          title="Transition velocity"
          description="The modules receiving the most stored status changes in this window."
          className="pt-0"
        >
          {topTransitionModules.length ? (
            <AdminList>
              {topTransitionModules.map(([moduleId, count]) => (
                <div
                  key={moduleId}
                  className="flex items-center justify-between gap-4 px-3 py-3 text-sm sm:px-4"
                >
                  <span className="min-w-0 truncate text-white/58">
                    {MODULE_LABELS[moduleId as ModuleId] || readable(moduleId)}
                  </span>
                  <span className="font-mono text-white/75">{formatNumber(count)}</span>
                </div>
              ))}
            </AdminList>
          ) : (
            <AdminEmptyState
              title="No transition movement"
              description="No onboarding transitions were recorded in this window."
            />
          )}
        </AdminSection>

        <AdminSection
          title="Recent transitions"
          description="Newest stored module transitions, including source and account identifier."
          className="pt-0"
        >
          {transitions.length ? (
            <AdminList>
              {transitions.map((row, index) => (
                <details key={`${row.at}-${row.userId}-${index}`} className="group">
                  <summary className="grid cursor-pointer list-none gap-3 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(0,1fr)_minmax(11rem,0.45fr)_auto] lg:items-center [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <p className="font-semibold text-white">
                        {MODULE_LABELS[row.moduleId as ModuleId] || readable(row.moduleId)}
                      </p>
                      <p className="mt-1 truncate text-xs text-white/35">Account {row.userId}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {statusBadge(row.fromStatus)}
                      <span className="text-white/28">→</span>
                      {statusBadge(row.toStatus)}
                    </div>
                    <span className="text-xs text-white/38">{new Date(row.at).toLocaleString()}</span>
                  </summary>
                  <div className="border-t border-white/10 bg-white/[0.015] px-3 py-4 text-sm text-white/55 sm:px-4">
                    Source: {row.source || "Not recorded"}
                  </div>
                </details>
              ))}
            </AdminList>
          ) : (
            <AdminEmptyState
              title="No recent onboarding transitions"
              description="No transition records were returned for this lookback window."
            />
          )}
        </AdminSection>
      </div>
    </AdminWorkspace>
  );
}
