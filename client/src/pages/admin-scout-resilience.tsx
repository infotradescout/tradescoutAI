import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminWorkspace,
} from "@/admin/AdminWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { isSuperAdminLike } from "@/lib/roleChecks";

type ScoutSystemStatus = {
  success: boolean;
  data: {
    server: string;
    crawler: string;
    cache: string;
    database: string;
    gemini: string;
    geminiFallback?: {
      rateLimitCooldownRemainingMs?: number;
      temporarilyUnavailableModelCount?: number;
    };
    uptime: number;
    timestamp: string;
  };
};

type ScoutAdminAnalytics = {
  analytics: {
    queries: number;
    fallbacks: number;
    fallbackReasons?: Record<string, number>;
    lastQuery: string | null;
  };
};

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0 seconds";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${remainingSeconds}s`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}

function formatCooldown(milliseconds: number | undefined): string {
  const value = Number(milliseconds || 0);
  if (!Number.isFinite(value) || value <= 0) return "Inactive";
  return `${Math.ceil(value / 1000)} seconds`;
}

function readable(value: string | null | undefined): string {
  const text = String(value || "").trim();
  if (!text) return "Not reported";
  return text.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  return (await response.json()) as T;
}

export default function AdminScoutResilience() {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user && isSuperAdminLike(user.role || ""));

  const statusQuery = useQuery<ScoutSystemStatus>({
    queryKey: ["/api/scout/admin/system-status"],
    queryFn: () => fetchJson<ScoutSystemStatus>("/api/scout/admin/system-status"),
    enabled: isSuperAdmin,
    refetchInterval: 15_000,
    retry: false,
  });

  const analyticsQuery = useQuery<ScoutAdminAnalytics>({
    queryKey: ["/api/scout/admin/analytics"],
    queryFn: () => fetchJson<ScoutAdminAnalytics>("/api/scout/admin/analytics"),
    enabled: isSuperAdmin,
    refetchInterval: 15_000,
    retry: false,
  });

  const status = statusQuery.data?.data;
  const analytics = analyticsQuery.data?.analytics;
  const fallbackReasons = useMemo(
    () =>
      Object.entries(analytics?.fallbackReasons || {}).sort(
        (left, right) => right[1] - left[1]
      ),
    [analytics?.fallbackReasons]
  );

  const anyFetching = statusQuery.isFetching || analyticsQuery.isFetching;
  const anyError = statusQuery.isError || analyticsQuery.isError;
  const refresh = () => {
    statusQuery.refetch();
    analyticsQuery.refetch();
  };

  if (!isSuperAdmin) {
    return (
      <AdminWorkspace>
        <AdminEmptyState
          title="Super Admin access required"
          description="Scout resilience contains privileged service and fallback diagnostics."
        />
      </AdminWorkspace>
    );
  }

  return (
    <AdminWorkspace data-testid="admin-scout-resilience-v2">
      <AdminSection
        title="Scout resilience"
        description="Service health, provider fallback state, and degradation evidence for Scout action completion. Missing diagnostics remain unavailable instead of appearing healthy."
        className="pt-0"
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={refresh}
            disabled={anyFetching}
            className="border-white/12 bg-transparent text-white/65"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${anyFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Service",
              value: statusQuery.isError ? "—" : readable(status?.server),
              detail: statusQuery.isError
                ? "System status unavailable"
                : `Uptime ${formatDuration(Number(status?.uptime || 0))}`,
              tone: statusQuery.isError
                ? "warning"
                : status?.server === "healthy" || status?.server === "ok"
                  ? "good"
                  : "neutral",
            },
            {
              label: "Primary provider",
              value: statusQuery.isError ? "—" : readable(status?.gemini),
              detail: `Cooldown ${formatCooldown(
                status?.geminiFallback?.rateLimitCooldownRemainingMs
              )}`,
              tone:
                statusQuery.isError ||
                Number(status?.geminiFallback?.rateLimitCooldownRemainingMs || 0) > 0
                  ? "warning"
                  : "good",
            },
            {
              label: "Queries",
              value: analyticsQuery.isError ? "—" : analytics?.queries ?? 0,
              detail: analytics?.lastQuery
                ? `Last ${new Date(analytics.lastQuery).toLocaleString()}`
                : "No query time reported",
              tone: analyticsQuery.isError ? "warning" : "neutral",
            },
            {
              label: "Fallbacks",
              value: analyticsQuery.isError ? "—" : analytics?.fallbacks ?? 0,
              detail: `${fallbackReasons.length} recorded reason${fallbackReasons.length === 1 ? "" : "s"}`,
              tone:
                analyticsQuery.isError || Number(analytics?.fallbacks || 0) > 0
                  ? "warning"
                  : "good",
            },
          ]}
        />
      </AdminSection>

      {anyError ? (
        <div className="flex items-start gap-3 border-y border-amber-400/20 bg-amber-400/5 px-4 py-5 text-sm leading-6 text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          One or more Scout diagnostics are unavailable. Existing Scout behavior was not changed.
        </div>
      ) : null}

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
        <AdminSection
          title="Fallback reasons"
          description="Reason-level counts reported by the current Scout synthesis path."
          className="pt-0"
        >
          {analyticsQuery.isLoading ? (
            <div className="flex min-h-44 items-center justify-center border-y border-white/10 text-sm text-white/45">
              <RefreshCw className="mr-3 h-4 w-4 animate-spin" />
              Loading fallback analytics…
            </div>
          ) : analyticsQuery.isError ? (
            <div className="border-y border-amber-400/20 bg-amber-400/5 px-4 py-5 text-sm text-amber-100">
              Fallback analytics are unavailable.
            </div>
          ) : fallbackReasons.length ? (
            <AdminList>
              {fallbackReasons.map(([reason, count]) => (
                <div
                  key={reason}
                  className="flex items-center justify-between gap-4 px-3 py-3 text-sm sm:px-4"
                >
                  <span className="min-w-0 truncate text-white/58">{readable(reason)}</span>
                  <span className="font-mono text-white/75">{count}</span>
                </div>
              ))}
            </AdminList>
          ) : (
            <AdminEmptyState
              title="No fallback reasons recorded"
              description="The analytics source has not recorded a degradation reason."
            />
          )}
        </AdminSection>

        <AdminSection
          title="Service components"
          description="Current route, cache, database, crawler, and provider-cache state."
          className="pt-0"
        >
          {statusQuery.isLoading ? (
            <div className="flex min-h-44 items-center justify-center border-y border-white/10 text-sm text-white/45">
              <RefreshCw className="mr-3 h-4 w-4 animate-spin" />
              Loading service status…
            </div>
          ) : statusQuery.isError || !status ? (
            <div className="border-y border-amber-400/20 bg-amber-400/5 px-4 py-5 text-sm text-amber-100">
              Scout service status is unavailable.
            </div>
          ) : (
            <AdminList>
              {[
                ["Server", status.server],
                ["Crawler", status.crawler],
                ["Cache", status.cache],
                ["Database", status.database],
                ["Primary provider", status.gemini],
                [
                  "Unavailable provider cache",
                  String(status.geminiFallback?.temporarilyUnavailableModelCount || 0),
                ],
                ["Reported at", new Date(status.timestamp).toLocaleString()],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 px-3 py-3 text-sm sm:px-4"
                >
                  <span className="text-white/42">{label}</span>
                  <span className="text-right text-white/68">{readable(value)}</span>
                </div>
              ))}
            </AdminList>
          )}

          {!statusQuery.isError && status ? (
            <div className="mt-4 flex items-center gap-2 border-y border-white/10 px-3 py-3 text-xs text-white/42">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              Diagnostics refresh automatically every 15 seconds.
            </div>
          ) : null}
        </AdminSection>
      </div>
    </AdminWorkspace>
  );
}
