import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, TestTube2, ToggleLeft, Layers, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AuthorityOperations } from "@/components/admin/AuthorityOperations";
import FeatureTogglePanel from "@/components/admin/FeatureTogglePanel";
import AdminTestingControls from "@/pages/admin-testing-controls";
import { apiRequest } from "@/lib/queryClient";

type DecisionCardMetrics = {
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

export default function AdminControl() {
  const { user } = useAuth();
  const isSuperAdmin =
    !!user && ["super_admin", "head_admin", "owner", "ops_admin"].includes(user.role || "");

  const { data: authorityMetrics } = useQuery<DecisionCardMetrics>({
    queryKey: ["/api/admin/authority/decision-card-metrics"],
    queryFn: async () => apiRequest("GET", "/api/admin/authority/decision-card-metrics"),
    enabled: isSuperAdmin,
    retry: false,
  });

  const { data: testingSettings } = useQuery<TestingSettings>({
    queryKey: ["/api/admin/testing-settings"],
    queryFn: async () => apiRequest("GET", "/api/admin/testing-settings"),
    enabled: isSuperAdmin,
    retry: false,
  });

  const { data: featureFlags } = useQuery<any[]>({
    queryKey: ["/api/admin/feature-flags"],
    queryFn: async () => apiRequest("GET", "/api/admin/feature-flags"),
    enabled: isSuperAdmin,
    retry: false,
  });

  const { data: emailDiagnostics } = useQuery<EmailDiagnostics>({
    queryKey: ["/api/admin/email/diagnostics"],
    queryFn: async () => apiRequest("GET", "/api/admin/email/diagnostics"),
    enabled: isSuperAdmin,
    retry: false,
  });

  const enabledFlags = useMemo(
    () => (Array.isArray(featureFlags) ? featureFlags.filter((f) => f?.enabled).length : 0),
    [featureFlags]
  );

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive font-semibold">Super admin access required</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Layers className="h-6 w-6 text-orange-400" />
          Admin Controls Hub
        </h1>
        <p className="text-sm text-slate-400">
          Single source of truth for governance, testing, and feature controls.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-400" />
              Authority Cards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-white">{authorityMetrics?.totalShown ?? 0}</p>
            <p className="text-xs text-slate-400 mt-1">Decision cards shown</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
              <ToggleLeft className="h-4 w-4 text-emerald-400" />
              Feature Flags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-white">{enabledFlags}</p>
            <p className="text-xs text-slate-400 mt-1">Flags enabled</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
              <TestTube2 className="h-4 w-4 text-amber-400" />
              Testing State
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <Badge variant={testingSettings?.testingModeEnabled ? "default" : "outline"}>
              testing mode: {testingSettings?.testingModeEnabled ? "on" : "off"}
            </Badge>
            <Badge
              variant={testingSettings?.bugReportEnabled ? "default" : "outline"}
              className="ml-2"
            >
              bug reports: {testingSettings?.bugReportEnabled ? "on" : "off"}
            </Badge>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
              <Mail className="h-4 w-4 text-orange-400" />
              Email Status
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Confirms provider + mode on the backend.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge variant={emailDiagnostics?.configured ? "default" : "outline"}>
              configured: {emailDiagnostics?.configured ? "yes" : "no"}
            </Badge>
            <Badge variant="outline" className="ml-2">
              provider: {emailDiagnostics?.provider || "unknown"}
            </Badge>
            <div className="text-xs text-slate-400">
              mode: {emailDiagnostics?.mode || "unknown"} · from:{" "}
              {emailDiagnostics?.defaultFrom || "unknown"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-100">Authority Governance</CardTitle>
          <CardDescription>Canonical authority controls and diagnostics.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthorityOperations />
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-100">Testing Controls</CardTitle>
          <CardDescription>System diagnostics and test-mode controls.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminTestingControls />
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-100">Feature Flags</CardTitle>
          <CardDescription>Platform capability toggles and rollout controls.</CardDescription>
        </CardHeader>
        <CardContent>
          <FeatureTogglePanel />
        </CardContent>
      </Card>
    </div>
  );
}
