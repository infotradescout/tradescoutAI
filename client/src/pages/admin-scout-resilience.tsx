import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { isSuperAdminLike } from "@/lib/roleChecks";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  if (!Number.isFinite(seconds) || seconds < 0) return "0s";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatCooldown(ms: number | undefined): string {
  const value = Number(ms || 0);
  if (!Number.isFinite(value) || value <= 0) return "inactive";
  return `${Math.ceil(value / 1000)}s`;
}

export default function AdminScoutResilience() {
  const { user } = useAuth();
  const [status, setStatus] = useState<ScoutSystemStatus | null>(null);
  const [analytics, setAnalytics] = useState<ScoutAdminAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isSuperAdmin = !!user && isSuperAdminLike(user.role || "");

  const load = useCallback(
    async (isManualRefresh = false) => {
      if (!isSuperAdmin) return;
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const [statusRes, analyticsRes] = await Promise.all([
          fetch("/api/scout/admin/system-status", { credentials: "include" }),
          fetch("/api/scout/admin/analytics", { credentials: "include" }),
        ]);

        if (!statusRes.ok) throw new Error("Failed to load Scout system status");
        if (!analyticsRes.ok) throw new Error("Failed to load Scout admin analytics");

        const [statusPayload, analyticsPayload] = await Promise.all([
          statusRes.json(),
          analyticsRes.json(),
        ]);

        setStatus(statusPayload);
        setAnalytics(analyticsPayload);
        setError(null);
      } catch (err) {
        setError(formatUserFacingErrorMessage(err, "Failed to load Scout resilience diagnostics."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isSuperAdmin]
  );

  useEffect(() => {
    if (!isSuperAdmin) return;
    void load(false);
    const timer = setInterval(() => {
      void load(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [isSuperAdmin, load]);

  const fallbackReasons = useMemo(() => {
    const reasons = analytics?.analytics?.fallbackReasons || {};
    return Object.entries(reasons).sort((a, b) => b[1] - a[1]);
  }, [analytics]);

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive font-semibold">Super admin access required</p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading Scout resilience...</div>;
  }

  const statusData = status?.data;
  const analyticsData = analytics?.analytics;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Scout Resilience</h1>
          <p className="text-xs text-white/60">
            Gemini fallback health, cooldown state, and degradation telemetry.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-white/10 text-white hover:bg-black/30"
          onClick={() => void load(true)}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error && (
        <Card className="bg-red-950/20 border-red-500/40">
          <CardContent className="p-4 text-sm text-red-200">{error}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-tsCard border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/80">Gemini Provider</CardTitle>
            <CardDescription className="text-xs">Primary model availability</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge variant={statusData?.gemini === "configured" ? "default" : "outline"}>
              {statusData?.gemini || "unknown"}
            </Badge>
            <div className="text-xs text-white/70">
              Cooldown:{" "}
              <span className="font-semibold">
                {formatCooldown(statusData?.geminiFallback?.rateLimitCooldownRemainingMs)}
              </span>
            </div>
            <div className="text-xs text-white/70">
              Unavailable model cache:{" "}
              <span className="font-semibold">
                {Number(statusData?.geminiFallback?.temporarilyUnavailableModelCount || 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/80">Fallback Totals</CardTitle>
            <CardDescription className="text-xs">How often Scout had to degrade</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold text-white">{analyticsData?.fallbacks ?? 0}</div>
            <div className="text-xs text-white/60">queries: {analyticsData?.queries ?? 0}</div>
            <div className="text-xs text-white/60">
              last query:{" "}
              {analyticsData?.lastQuery
                ? new Date(analyticsData.lastQuery).toLocaleString()
                : "none"}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/80">Scout Service</CardTitle>
            <CardDescription className="text-xs">Route + process health</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-white/70">
            <div>server: {statusData?.server || "unknown"}</div>
            <div>cache: {statusData?.cache || "unknown"}</div>
            <div>database: {statusData?.database || "unknown"}</div>
            <div>uptime: {formatDuration(Number(statusData?.uptime || 0))}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-tsCard border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Fallback Reasons</CardTitle>
          <CardDescription>
            Reason-level degradation counts from Scout synthesis paths.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fallbackReasons.length === 0 ? (
            <p className="text-sm text-white/60">No fallback reasons recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {fallbackReasons.map(([reason, count]) => (
                <div
                  key={reason}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                >
                  <span className="text-sm text-white">{reason}</span>
                  <Badge variant="outline">{count}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
