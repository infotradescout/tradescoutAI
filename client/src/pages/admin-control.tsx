import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, TestTube2, ToggleLeft, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AuthorityOperations } from "@/components/admin/AuthorityOperations";
import FeatureTogglePanel from "@/components/admin/FeatureTogglePanel";
import AdminTestingControls from "@/pages/admin-testing-controls";
import { apiRequest } from "@/lib/queryClient";
import { isSuperAdminLike } from "@/lib/roleChecks";

type DecisionCardMetrics = {
  available?: boolean;
  message?: string;
  totalShown: number;
  guidanceDistribution: {
    COMPLY: number;
    DEFER: number;
    BLOCK: number;
  };
};

type TestingSettings = {
  bugReportEnabled?: boolean;
  testingModeEnabled?: boolean;
  showTestingBanner?: boolean;
};

type EmailDiagnostics = {
  configured: boolean;
  provider: "sendgrid" | "brevo" | "none";
  mode: "all" | "account_creation_only";
  defaultFrom: string;
};

type ProgressiveExposureSummary = {
  window: {
    from: string;
    to: string;
  };
  totalEvents: number;
  tiers: {
    0: number;
    1: number;
    2: number;
    3: number;
    unknown: number;
  };
  topReasons: Array<{
    reason: string;
    count: number;
  }>;
  signals: {
    avgAccountAgeDays: number;
    avgMeaningfulActivityCount: number;
    setupCompletionPct: number;
    verifiedContactPct: number;
  };
  quality: {
    uniqueUsers: number;
    uniqueSessions: number;
    eventsPerUser: number;
    eventsPerSession: number;
    missingSessionKeyPct: number;
    unknownTierPct: number;
  };
  readiness: {
    thresholds: {
      minTotalEvents: number;
      minUniqueUsers: number;
      maxUnknownTierPct: number;
      minVerifiedContactPct: number;
    };
    status: {
      totalEventsOk: boolean;
      uniqueUsersOk: boolean;
      unknownTierOk: boolean;
      verifiedContactOk: boolean;
    };
    isReady: boolean;
  };
};

type ProgressiveExposureTimeline = {
  window: {
    from: string;
    to: string;
  };
  points: Array<{
    day: string;
    tiers: {
      0: number;
      1: number;
      2: number;
      3: number;
      unknown: number;
    };
    total: number;
  }>;
};

export default function AdminControl() {
  const { user } = useAuth();
  const isSuperAdmin = !!user && isSuperAdminLike(user.role || "");

  const {
    data: authorityMetrics,
    isError: authorityMetricsFailed,
    error: authorityMetricsError,
  } = useQuery<DecisionCardMetrics>({
    queryKey: ["/api/admin/authority/decision-card-metrics"],
    queryFn: async () => apiRequest("GET", "/api/admin/authority/decision-card-metrics"),
    enabled: isSuperAdmin,
    retry: false,
  });

  const { data: testingSettings, isError: testingSettingsFailed } = useQuery<TestingSettings>({
    queryKey: ["/api/admin/testing-settings"],
    queryFn: async () => apiRequest("GET", "/api/admin/testing-settings"),
    enabled: isSuperAdmin,
    retry: false,
  });

  const { data: featureFlags, isError: featureFlagsFailed } = useQuery<any[]>({
    queryKey: ["/api/admin/feature-flags"],
    queryFn: async () => apiRequest("GET", "/api/admin/feature-flags"),
    enabled: isSuperAdmin,
    retry: false,
  });

  const { data: emailDiagnostics, isError: emailDiagnosticsFailed } = useQuery<EmailDiagnostics>({
    queryKey: ["/api/admin/email/diagnostics"],
    queryFn: async () => apiRequest("GET", "/api/admin/email/diagnostics"),
    enabled: isSuperAdmin,
    retry: false,
  });

  const { data: progressiveExposureSummary, isError: progressiveExposureFailed } =
    useQuery<ProgressiveExposureSummary>({
      queryKey: ["/api/analytics/progressive-exposure/summary"],
      queryFn: async () => apiRequest("GET", "/api/analytics/progressive-exposure/summary"),
      enabled: isSuperAdmin,
      retry: false,
    });

  const { data: progressiveExposureTimeline, isError: progressiveExposureTimelineFailed } =
    useQuery<ProgressiveExposureTimeline>({
      queryKey: ["/api/analytics/progressive-exposure/timeline"],
      queryFn: async () => apiRequest("GET", "/api/analytics/progressive-exposure/timeline"),
      enabled: isSuperAdmin,
      retry: false,
    });

  const enabledFlags = useMemo(
    () => (Array.isArray(featureFlags) ? featureFlags.filter((f) => f?.enabled).length : 0),
    [featureFlags]
  );

  const progressiveExposureRecentPoints = useMemo(() => {
    if (!progressiveExposureTimeline?.points?.length) return [];
    return progressiveExposureTimeline.points.slice(-7);
  }, [progressiveExposureTimeline]);

  const progressiveExposureMaxDailyTotal = useMemo(() => {
    return progressiveExposureRecentPoints.reduce(
      (max, point) => Math.max(max, point.total || 0),
      0
    );
  }, [progressiveExposureRecentPoints]);

  const authorityUnavailable = authorityMetricsFailed || authorityMetrics?.available === false;
  const authorityMessage = authorityMetricsFailed
    ? "Decision analytics endpoint is currently unavailable"
    : authorityMetrics?.message || "Decision analytics unavailable";

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive font-semibold">Super admin access required</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-tsCard border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/70 flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-400" />
              Authority Cards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-white">
              {authorityUnavailable ? "N/A" : (authorityMetrics?.totalShown ?? 0)}
            </p>
            <p className="text-xs text-white/60 mt-1">
              {authorityUnavailable ? authorityMessage : "Decision cards shown"}
            </p>
            {authorityMetricsFailed ? (
              <p className="text-[11px] text-red-300 mt-2">
                {String((authorityMetricsError as any)?.message || "Request failed")}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/70 flex items-center gap-2">
              <ToggleLeft className="h-4 w-4 text-emerald-400" />
              Feature Flags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-white">
              {featureFlagsFailed ? "N/A" : enabledFlags}
            </p>
            <p className="text-xs text-white/60 mt-1">
              {featureFlagsFailed ? "Feature flags endpoint unavailable" : "Flags enabled"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/70 flex items-center gap-2">
              <TestTube2 className="h-4 w-4 text-amber-400" />
              Testing State
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <Badge
              variant={
                !testingSettingsFailed && testingSettings?.testingModeEnabled
                  ? "default"
                  : "outline"
              }
            >
              testing mode:{" "}
              {testingSettingsFailed
                ? "unknown"
                : testingSettings?.testingModeEnabled
                  ? "on"
                  : "off"}
            </Badge>
            <Badge
              variant={
                !testingSettingsFailed && testingSettings?.bugReportEnabled ? "default" : "outline"
              }
              className="ml-2"
            >
              bug reports:{" "}
              {testingSettingsFailed ? "unknown" : testingSettings?.bugReportEnabled ? "on" : "off"}
            </Badge>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/70 flex items-center gap-2">
              <Mail className="h-4 w-4 text-ts-orange" />
              Email Status
            </CardTitle>
            <CardDescription className="text-xs text-white/60">
              Confirms provider + mode on the backend.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge
              variant={
                !emailDiagnosticsFailed && emailDiagnostics?.configured ? "default" : "outline"
              }
            >
              configured:{" "}
              {emailDiagnosticsFailed ? "unknown" : emailDiagnostics?.configured ? "yes" : "no"}
            </Badge>
            <Badge variant="outline" className="ml-2">
              provider:{" "}
              {emailDiagnosticsFailed ? "unknown" : emailDiagnostics?.provider || "unknown"}
            </Badge>
            <div className="text-xs text-white/60">
              mode: {emailDiagnosticsFailed ? "unknown" : emailDiagnostics?.mode || "unknown"} -
              from:{" "}
              {emailDiagnosticsFailed ? "unknown" : emailDiagnostics?.defaultFrom || "unknown"}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10 md:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/70 flex items-center gap-2">
              <Shield className="h-4 w-4 text-violet-400" />
              Progressive Exposure (Shadow)
            </CardTitle>
            <CardDescription className="text-xs text-white/60">
              Read-only readiness distribution. No user-facing gating changes applied.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {progressiveExposureFailed || !progressiveExposureSummary ? (
              <p className="text-xs text-white/60">Shadow analytics endpoint unavailable.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">events: {progressiveExposureSummary.totalEvents}</Badge>
                  <Badge variant="outline">tier0: {progressiveExposureSummary.tiers[0]}</Badge>
                  <Badge variant="outline">tier1: {progressiveExposureSummary.tiers[1]}</Badge>
                  <Badge variant="outline">tier2: {progressiveExposureSummary.tiers[2]}</Badge>
                  <Badge variant="outline">tier3: {progressiveExposureSummary.tiers[3]}</Badge>
                  {progressiveExposureSummary.tiers.unknown > 0 ? (
                    <Badge variant="outline">
                      unknown: {progressiveExposureSummary.tiers.unknown}
                    </Badge>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-white/70">
                  <div>
                    avg account age: {progressiveExposureSummary.signals.avgAccountAgeDays} days
                  </div>
                  <div>
                    avg meaningful activity:{" "}
                    {progressiveExposureSummary.signals.avgMeaningfulActivityCount}
                  </div>
                  <div>
                    verified contact: {progressiveExposureSummary.signals.verifiedContactPct}%
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-white/70">
                  <div>unique users: {progressiveExposureSummary.quality.uniqueUsers}</div>
                  <div>unique sessions: {progressiveExposureSummary.quality.uniqueSessions}</div>
                  <div>events/user: {progressiveExposureSummary.quality.eventsPerUser}</div>
                  <div>events/session: {progressiveExposureSummary.quality.eventsPerSession}</div>
                  <div>
                    missing session key: {progressiveExposureSummary.quality.missingSessionKeyPct}%
                  </div>
                  <div>unknown tier: {progressiveExposureSummary.quality.unknownTierPct}%</div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/50 mb-1">
                    Readiness thresholds (go/no-go)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={progressiveExposureSummary.readiness.isReady ? "default" : "outline"}
                    >
                      ready: {progressiveExposureSummary.readiness.isReady ? "yes" : "no"}
                    </Badge>
                    <Badge
                      variant={
                        progressiveExposureSummary.readiness.status.totalEventsOk
                          ? "default"
                          : "outline"
                      }
                    >
                      events ≥ {progressiveExposureSummary.readiness.thresholds.minTotalEvents}:{" "}
                      {progressiveExposureSummary.readiness.status.totalEventsOk ? "pass" : "fail"}
                    </Badge>
                    <Badge
                      variant={
                        progressiveExposureSummary.readiness.status.uniqueUsersOk
                          ? "default"
                          : "outline"
                      }
                    >
                      users ≥ {progressiveExposureSummary.readiness.thresholds.minUniqueUsers}:{" "}
                      {progressiveExposureSummary.readiness.status.uniqueUsersOk ? "pass" : "fail"}
                    </Badge>
                    <Badge
                      variant={
                        progressiveExposureSummary.readiness.status.unknownTierOk
                          ? "default"
                          : "outline"
                      }
                    >
                      unknown ≤ {progressiveExposureSummary.readiness.thresholds.maxUnknownTierPct}
                      %:{" "}
                      {progressiveExposureSummary.readiness.status.unknownTierOk ? "pass" : "fail"}
                    </Badge>
                    <Badge
                      variant={
                        progressiveExposureSummary.readiness.status.verifiedContactOk
                          ? "default"
                          : "outline"
                      }
                    >
                      verified ≥{" "}
                      {progressiveExposureSummary.readiness.thresholds.minVerifiedContactPct}%:{" "}
                      {progressiveExposureSummary.readiness.status.verifiedContactOk
                        ? "pass"
                        : "fail"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/50 mb-1">Top reasons</p>
                  {progressiveExposureSummary.topReasons.length === 0 ? (
                    <p className="text-xs text-white/60">No reasons logged in this window.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {progressiveExposureSummary.topReasons.map((item) => (
                        <Badge key={item.reason} variant="outline">
                          {item.reason}: {item.count}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/50 mb-1">
                    Daily tier trend (last 7 days with events)
                  </p>
                  {progressiveExposureTimelineFailed ? (
                    <p className="text-xs text-white/60">Timeline endpoint unavailable.</p>
                  ) : progressiveExposureRecentPoints.length === 0 ? (
                    <p className="text-xs text-white/60">
                      No timeline events logged in this window.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {progressiveExposureRecentPoints.map((point) => {
                        const max = progressiveExposureMaxDailyTotal || 1;
                        const t0 = (point.tiers[0] / max) * 100;
                        const t1 = (point.tiers[1] / max) * 100;
                        const t2 = (point.tiers[2] / max) * 100;
                        const t3 = (point.tiers[3] / max) * 100;
                        const unknown = (point.tiers.unknown / max) * 100;

                        return (
                          <div key={point.day} className="text-xs text-white/70">
                            <div className="flex items-center justify-between mb-1">
                              <span>{point.day}</span>
                              <span>total {point.total}</span>
                            </div>
                            <div className="h-2 w-full rounded bg-white/10 overflow-hidden flex">
                              <div className="bg-blue-500" style={{ width: `${t0}%` }} />
                              <div className="bg-emerald-500" style={{ width: `${t1}%` }} />
                              <div className="bg-amber-500" style={{ width: `${t2}%` }} />
                              <div className="bg-violet-500" style={{ width: `${t3}%` }} />
                              <div className="bg-zinc-500" style={{ width: `${unknown}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-tsCard border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Authority Governance</CardTitle>
          <CardDescription>Canonical authority controls and diagnostics.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthorityOperations />
        </CardContent>
      </Card>

      <Card className="bg-tsCard border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Testing Controls</CardTitle>
          <CardDescription>System diagnostics and test-mode controls.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminTestingControls />
        </CardContent>
      </Card>

      <Card className="bg-tsCard border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Feature Flags</CardTitle>
          <CardDescription>Platform capability toggles and rollout controls.</CardDescription>
        </CardHeader>
        <CardContent>
          <FeatureTogglePanel />
        </CardContent>
      </Card>
    </div>
  );
}
