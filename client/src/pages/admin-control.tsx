import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  RefreshCw,
  Shield,
  TestTube2,
  ToggleLeft,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminWorkspace,
  AdminWorkspaceSubnav,
} from "@/admin/AdminWorkspace";
import { AuthorityOperations } from "@/components/admin/AuthorityOperations";
import FeatureTogglePanel from "@/components/admin/FeatureTogglePanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { isSuperAdminLike } from "@/lib/roleChecks";
import AdminTestingControls from "@/pages/admin-testing-controls";

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
  window: { from: string; to: string };
  totalEvents: number;
  tiers: { 0: number; 1: number; 2: number; 3: number; unknown: number };
  topReasons: Array<{ reason: string; count: number }>;
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
  window: { from: string; to: string };
  points: Array<{
    day: string;
    tiers: { 0: number; 1: number; 2: number; 3: number; unknown: number };
    total: number;
  }>;
};

function formatDate(value: unknown): string {
  if (!value) return "Not recorded";
  const date = new Date(value as string | number | Date);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : "Invalid date";
}

function PassState({ pass, label }: { pass: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-3 text-sm sm:px-4">
      <span className="text-white/55">{label}</span>
      <span className={pass ? "inline-flex items-center gap-2 text-emerald-200" : "inline-flex items-center gap-2 text-amber-100"}>
        {pass ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        {pass ? "Pass" : "Not ready"}
      </span>
    </div>
  );
}

export default function AdminControl() {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user && isSuperAdminLike(user.role || ""));

  const authorityQuery = useQuery<DecisionCardMetrics>({
    queryKey: ["/api/admin/authority/decision-card-metrics"],
    queryFn: () => apiRequest("GET", "/api/admin/authority/decision-card-metrics"),
    enabled: isSuperAdmin,
    retry: false,
  });
  const testingQuery = useQuery<TestingSettings>({
    queryKey: ["/api/admin/testing-settings"],
    queryFn: () => apiRequest("GET", "/api/admin/testing-settings"),
    enabled: isSuperAdmin,
    retry: false,
  });
  const flagsQuery = useQuery<any[]>({
    queryKey: ["/api/admin/feature-flags"],
    queryFn: () => apiRequest("GET", "/api/admin/feature-flags"),
    enabled: isSuperAdmin,
    retry: false,
  });
  const emailQuery = useQuery<EmailDiagnostics>({
    queryKey: ["/api/admin/email/diagnostics"],
    queryFn: () => apiRequest("GET", "/api/admin/email/diagnostics"),
    enabled: isSuperAdmin,
    retry: false,
  });
  const exposureQuery = useQuery<ProgressiveExposureSummary>({
    queryKey: ["/api/analytics/progressive-exposure/summary"],
    queryFn: () => apiRequest("GET", "/api/analytics/progressive-exposure/summary"),
    enabled: isSuperAdmin,
    retry: false,
  });
  const timelineQuery = useQuery<ProgressiveExposureTimeline>({
    queryKey: ["/api/analytics/progressive-exposure/timeline"],
    queryFn: () => apiRequest("GET", "/api/analytics/progressive-exposure/timeline"),
    enabled: isSuperAdmin,
    retry: false,
  });

  const enabledFlags = useMemo(
    () => (Array.isArray(flagsQuery.data) ? flagsQuery.data.filter((flag) => flag?.enabled).length : null),
    [flagsQuery.data]
  );
  const recentTimeline = useMemo(
    () => (timelineQuery.data?.points || []).slice(-7),
    [timelineQuery.data?.points]
  );
  const maxTimelineTotal = useMemo(
    () => recentTimeline.reduce((maximum, point) => Math.max(maximum, Number(point.total || 0)), 0),
    [recentTimeline]
  );

  const refreshAll = () => {
    authorityQuery.refetch();
    testingQuery.refetch();
    flagsQuery.refetch();
    emailQuery.refetch();
    exposureQuery.refetch();
    timelineQuery.refetch();
  };
  const anyFetching =
    authorityQuery.isFetching ||
    testingQuery.isFetching ||
    flagsQuery.isFetching ||
    emailQuery.isFetching ||
    exposureQuery.isFetching ||
    timelineQuery.isFetching;

  if (!isSuperAdmin) {
    return (
      <AdminWorkspace>
        <AdminEmptyState
          title="Platform Controls require Super Admin access"
          description="The current session cannot read or change authority, testing, or rollout controls."
        />
      </AdminWorkspace>
    );
  }

  const authorityUnavailable = authorityQuery.isError || authorityQuery.data?.available === false;
  const summary = exposureQuery.data;

  return (
    <AdminWorkspace data-testid="admin-platform-controls-v2">
      <AdminSection
        title="Platform control state"
        description="Authority, feature, testing, email, and rollout signals. Unavailable sources remain unavailable instead of being displayed as zero."
        className="pt-0"
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={refreshAll}
            disabled={anyFetching}
            className="border-white/12 bg-white/[0.025] text-white/65 hover:bg-white/[0.06] hover:text-white"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${anyFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Authority cards",
              value: authorityUnavailable ? "—" : authorityQuery.data?.totalShown ?? 0,
              detail: authorityUnavailable
                ? authorityQuery.data?.message || "Decision analytics unavailable"
                : "Decision cards shown",
              tone: authorityUnavailable ? "warning" : "neutral",
            },
            {
              label: "Enabled flags",
              value: flagsQuery.isError || enabledFlags === null ? "—" : enabledFlags,
              detail: flagsQuery.isError ? "Feature flag source unavailable" : "Current enabled rollout flags",
              tone: flagsQuery.isError ? "warning" : "neutral",
            },
            {
              label: "Testing mode",
              value: testingQuery.isError
                ? "—"
                : testingQuery.data?.testingModeEnabled
                  ? "On"
                  : "Off",
              detail: testingQuery.isError
                ? "Testing settings unavailable"
                : `Bug reporting ${testingQuery.data?.bugReportEnabled ? "on" : "off"}`,
              tone: testingQuery.isError ? "warning" : testingQuery.data?.testingModeEnabled ? "warning" : "good",
            },
            {
              label: "Email provider",
              value: emailQuery.isError ? "—" : emailQuery.data?.provider || "none",
              detail: emailQuery.isError
                ? "Email diagnostics unavailable"
                : emailQuery.data?.configured
                  ? `${emailQuery.data.mode} · ${emailQuery.data.defaultFrom}`
                  : "Email provider is not configured",
              tone: emailQuery.isError || !emailQuery.data?.configured ? "warning" : "good",
            },
          ]}
        />
      </AdminSection>

      <Tabs defaultValue="readiness" className="space-y-6">
        <AdminWorkspaceSubnav>
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0">
            {[
              ["readiness", "Rollout readiness"],
              ["authority", "Authority"],
              ["testing", "Testing"],
              ["flags", "Feature flags"],
            ].map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="min-h-10 rounded-lg border border-transparent px-4 text-white/48 data-[state=active]:border-white/10 data-[state=active]:bg-white/[0.055] data-[state=active]:text-white"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </AdminWorkspaceSubnav>

        <TabsContent value="readiness" className="mt-0 space-y-7">
          <AdminSection
            title="Progressive exposure readiness"
            description="Read-only shadow evidence. This workspace does not change user-facing gating."
            className="pt-0"
          >
            {exposureQuery.isLoading ? (
              <div className="flex min-h-48 items-center justify-center border-y border-white/10 text-sm text-white/45">
                <RefreshCw className="mr-3 h-4 w-4 animate-spin" />
                Loading rollout evidence…
              </div>
            ) : exposureQuery.isError || !summary ? (
              <div className="flex items-start gap-3 border-y border-amber-400/20 bg-amber-400/5 px-4 py-5 text-sm leading-6 text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Progressive exposure evidence is unavailable. No rollout state was changed.
              </div>
            ) : (
              <>
                <AdminSummaryStrip
                  items={[
                    {
                      label: "Events",
                      value: summary.totalEvents,
                      detail: `${summary.quality.uniqueUsers} users · ${summary.quality.uniqueSessions} sessions`,
                    },
                    {
                      label: "Verified contact",
                      value: `${summary.signals.verifiedContactPct}%`,
                      detail: `Minimum ${summary.readiness.thresholds.minVerifiedContactPct}%`,
                      tone: summary.readiness.status.verifiedContactOk ? "good" : "warning",
                    },
                    {
                      label: "Unknown tier",
                      value: `${summary.quality.unknownTierPct}%`,
                      detail: `Maximum ${summary.readiness.thresholds.maxUnknownTierPct}%`,
                      tone: summary.readiness.status.unknownTierOk ? "good" : "warning",
                    },
                    {
                      label: "Go / no-go",
                      value: summary.readiness.isReady ? "Ready" : "Not ready",
                      detail: `${formatDate(summary.window.from)} – ${formatDate(summary.window.to)}`,
                      tone: summary.readiness.isReady ? "good" : "warning",
                    },
                  ]}
                />

                <div className="mt-6 grid gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">
                      Tier distribution
                    </p>
                    <AdminList className="mt-3">
                      {[
                        ["Tier 0", summary.tiers[0]],
                        ["Tier 1", summary.tiers[1]],
                        ["Tier 2", summary.tiers[2]],
                        ["Tier 3", summary.tiers[3]],
                        ["Unknown", summary.tiers.unknown],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="flex items-center justify-between gap-4 px-3 py-3 text-sm sm:px-4">
                          <span className="text-white/55">{label}</span>
                          <span className="font-mono text-white/70">{value}</span>
                        </div>
                      ))}
                    </AdminList>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">
                      Readiness checks
                    </p>
                    <div className="mt-3 divide-y divide-white/10 border-y border-white/10">
                      <PassState
                        pass={summary.readiness.status.totalEventsOk}
                        label={`Events ≥ ${summary.readiness.thresholds.minTotalEvents}`}
                      />
                      <PassState
                        pass={summary.readiness.status.uniqueUsersOk}
                        label={`Users ≥ ${summary.readiness.thresholds.minUniqueUsers}`}
                      />
                      <PassState
                        pass={summary.readiness.status.unknownTierOk}
                        label={`Unknown tier ≤ ${summary.readiness.thresholds.maxUnknownTierPct}%`}
                      />
                      <PassState
                        pass={summary.readiness.status.verifiedContactOk}
                        label={`Verified contact ≥ ${summary.readiness.thresholds.minVerifiedContactPct}%`}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">
                      Recent daily tier trend
                    </p>
                    {timelineQuery.isError ? (
                      <div className="mt-3 border-y border-amber-400/20 bg-amber-400/5 px-4 py-5 text-sm text-amber-100">
                        Timeline evidence is unavailable.
                      </div>
                    ) : recentTimeline.length ? (
                      <div className="mt-3 space-y-3 border-y border-white/10 px-3 py-4 sm:px-4">
                        {recentTimeline.map((point) => {
                          const maximum = maxTimelineTotal || 1;
                          return (
                            <div key={point.day}>
                              <div className="flex items-center justify-between gap-3 text-xs text-white/45">
                                <span>{point.day}</span>
                                <span>{point.total} events</span>
                              </div>
                              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
                                <span className="bg-sky-500" style={{ width: `${(point.tiers[0] / maximum) * 100}%` }} />
                                <span className="bg-emerald-500" style={{ width: `${(point.tiers[1] / maximum) * 100}%` }} />
                                <span className="bg-amber-500" style={{ width: `${(point.tiers[2] / maximum) * 100}%` }} />
                                <span className="bg-violet-500" style={{ width: `${(point.tiers[3] / maximum) * 100}%` }} />
                                <span className="bg-zinc-500" style={{ width: `${(point.tiers.unknown / maximum) * 100}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <AdminEmptyState
                        title="No recent rollout events"
                        description="The current timeline contains no daily points."
                      />
                    )}
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">
                      Top reasons
                    </p>
                    {summary.topReasons.length ? (
                      <AdminList className="mt-3">
                        {summary.topReasons.slice(0, 10).map((reason) => (
                          <div key={reason.reason} className="flex items-center justify-between gap-4 px-3 py-3 text-sm sm:px-4">
                            <span className="truncate text-white/55">{reason.reason}</span>
                            <span className="font-mono text-white/70">{reason.count}</span>
                          </div>
                        ))}
                      </AdminList>
                    ) : (
                      <AdminEmptyState title="No reasons recorded" description="No rollout reason is present in this evidence window." />
                    )}
                  </div>
                </div>
              </>
            )}
          </AdminSection>
        </TabsContent>

        <TabsContent value="authority" className="mt-0">
          <AdminSection
            title="Authority governance"
            description="Canonical authority controls and diagnostics. Existing authority operations remain unchanged."
            className="pt-0"
          >
            <div className="[&>div]:rounded-none [&>div]:border-x-0 [&>div]:bg-transparent [&>div]:shadow-none">
              <AuthorityOperations />
            </div>
          </AdminSection>
        </TabsContent>

        <TabsContent value="testing" className="mt-0">
          <AdminSection
            title="Testing controls"
            description="System diagnostics, banners, test-mode controls, and bug-report controls."
            className="pt-0"
          >
            <div className="[&>div]:rounded-none [&>div]:border-x-0 [&>div]:bg-transparent [&>div]:shadow-none">
              <AdminTestingControls />
            </div>
          </AdminSection>
        </TabsContent>

        <TabsContent value="flags" className="mt-0">
          <AdminSection
            title="Feature flags"
            description="Capability toggles and rollout controls. Existing flag mutations remain owned by the feature-flag panel."
            className="pt-0"
          >
            <div className="[&>div]:rounded-none [&>div]:border-x-0 [&>div]:bg-transparent [&>div]:shadow-none">
              <FeatureTogglePanel />
            </div>
          </AdminSection>
        </TabsContent>
      </Tabs>
    </AdminWorkspace>
  );
}
