import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageLoadingSpinner } from "@/components/LoadingSpinner";
import { Shield, Sparkles, Map as MapIcon, Activity, Users as UsersIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { SuperAdminOSLayout } from "@/admin/SuperAdminOSLayout";
import AdminUsers from "@/pages/admin-users";
import AdminErrorReports from "@/pages/admin-error-reports";
import AdminPricingAnalytics from "@/pages/admin-pricing-analytics";
import AdminAddressVerifications from "@/pages/admin-address-verifications";
import AdminListings from "@/pages/admin-listings";
import AdminAttachments from "@/pages/admin-attachments";
import AdminAffiliates from "@/pages/admin-affiliates";
import { PromptAdminPage } from "@/pages/PromptAdminPage";
import AdminToolDiscovery from "@/pages/admin-tool-discovery";
import { UserHeatmap } from "@/components/UserHeatmap";
import { FinanceLedgerPanel } from "@/components/admin/FinanceLedgerPanel";
import { UIMonitoringDashboard } from "@/components/admin/UIMonitoringDashboard";
import { AICodeFixingDashboard } from "@/components/admin/AICodeFixingDashboard";
import { AdminPanelContent } from "@/pages/admin-panel";
import { AdminWorkspaceContent } from "@/pages/admin-workspace";
import AdminGeoCoverageConsole from "@/pages/admin-geo-coverage";
import AdminUserManagement from "@/pages/AdminUserManagement";
import AdminTestingControls from "@/pages/admin-testing-controls";
import AdminProfessionalVerification from "@/pages/admin-professional-verification";
import AdminCreateAccount from "@/pages/admin-create-account";
import AdminPromotions from "@/pages/admin-promotions";
import AdminControl from "@/pages/admin-control";
import AdminAuthorityDiagnostics from "@/pages/admin-authority-diagnostics";
import PlatformAnalytics from "@/pages/platform-analytics";
import ContentModeration from "@/pages/content-moderation";

type AdminHealthResponse = {
  ok: boolean;
  userId: string | null;
  role: string | null;
  isSuperAdmin: boolean;
};

export default function AdminShell() {
  const { data, isLoading, error } = useQuery<AdminHealthResponse>({
    queryKey: ["/api/admin/health"],
  });

  if (isLoading) {
    return <PageLoadingSpinner message="Verifying super admin access..." />;
  }

  if (error || !data?.ok || !data.isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center py-24">
        <Card className="max-w-md w-full border-red-500/40 bg-slate-900">
          <CardHeader>
            <CardTitle className="text-red-300">Super admin access required</CardTitle>
            <CardDescription className="text-slate-300">
              This portal is restricted to head administrators and super admins. Your current
              session does not have access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-400">
              If you believe this is an error, check your assigned role or contact the
              platform owner.
            </p>
            <div className="flex justify-between items-center text-xs text-slate-500">
              <span>Requested: /admin</span>
              <span>Role: {(data as any)?.role || "unknown"}</span>
            </div>
            <div className="flex gap-2 justify-end">
              <Link href="/">
                <Button variant="outline" size="sm">
                  Return home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <SuperAdminOSLayout>
      <AdminContentRouter />
    </SuperAdminOSLayout>
  );
}

function AdminContentRouter() {
  const [location] = useLocation();
  const path = location || "/admin";
  const subPath = path.startsWith("/admin") ? path.substring("/admin".length) || "/" : path;

  if (subPath === "/" || subPath === "") {
    return <SuperAdminDashboard />;
  }

  if (subPath.startsWith("/users")) {
    return <AdminUsers />;
  }

  if (subPath === "/user-management") {
    return <AdminUserManagement />;
  }

  if (subPath.startsWith("/geo/counties")) {
    return <UserHeatmap />;
  }

  if (subPath.startsWith("/geo/coverage")) {
    return <AdminGeoCoverageConsole />;
  }

  if (subPath === "/impersonate") {
    // Deep-link into the admin workspace, which already hosts
    // the RoleImpersonation tool. We keep all logic in the
    // existing workspace component and only route from the
    // Super Admin OS shell.
    return <AdminWorkspaceContent />;
  }

  if (subPath === "/errors" || subPath === "/error-reports") {
    return <AdminErrorReports />;
  }

  // Growth & Marketplace: reuse the legacy Admin Panel tabs
  // for Ads and Prizes while keeping everything inside the
  // Super Admin OS shell.
  if (subPath === "/ads") {
    return <AdminPanelTabRedirect tab="advertisements" />;
  }

  if (subPath === "/prizes") {
    return <AdminPanelTabRedirect tab="prizes" />;
  }

  if (subPath === "/pricing" || subPath === "/pricing-analytics") {
    return <AdminPricingAnalytics />;
  }

  if (subPath === "/finance") {
    return <FinanceLedgerPanel />;
  }

  if (subPath === "/verification" || subPath === "/address-verifications") {
    return <AdminAddressVerifications />;
  }

  if (subPath === "/professional-verification") {
    return <AdminProfessionalVerification />;
  }

  if (subPath === "/ai-monitoring") {
    return <UIMonitoringDashboard />;
  }

  if (subPath === "/ai-fixes") {
    return <AICodeFixingDashboard />;
  }

  if (subPath === "/panel") {
    return <AdminPanelContent />;
  }

  if (subPath === "/workspace") {
    return <AdminWorkspaceContent />;
  }

  if (subPath === "/attachments") {
    return <AdminAttachments />;
  }

  if (subPath === "/affiliates") {
    return <AdminAffiliates />;
  }

  // Platform Ops: Site and contractor settings, plus
  // notification ops, are still administered via the
  // consolidated Admin Panel tabs. We deep-link into those
  // tabs instead of duplicating logic.
  if (subPath === "/site-settings") {
    return <AdminPanelTabRedirect tab="site-settings" />;
  }

  if (subPath === "/contractors") {
    return <AdminPanelTabRedirect tab="contractor-settings" />;
  }

  if (subPath === "/notifications") {
    return <AdminPanelTabRedirect tab="notification-ops" />;
  }

  if (subPath === "/testing" || subPath === "/testing-controls") {
    return <AdminTestingControls />;
  }

  if (subPath === "/system-prompt") {
    return <PromptAdminPage />;
  }

  if (subPath === "/tool-discovery") {
    return <AdminToolDiscovery />;
  }

  if (subPath === "/listings") {
    return <AdminListings />;
  }

   if (subPath === "/promotions") {
     return <AdminPromotions />;
   }

  if (subPath === "/control") {
    return <AdminControl />;
  }

  if (subPath === "/authority-diagnostics") {
    return <AdminAuthorityDiagnostics />;
  }

  if (subPath === "/platform-analytics") {
    return <PlatformAnalytics />;
  }

   // Intelligence & Automation: LLM admin / knowledge upload
   // still live inside the Admin Panel as a dedicated tab.
   if (subPath === "/llm" || subPath === "/knowledge") {
     return <AdminPanelTabRedirect tab="llm-admin" />;
   }

  if (subPath === "/moderation") {
    return <ContentModeration />;
  }

  if (subPath === "/dashboard") {
    return <SuperAdminDashboard />;
  }

  // For now, any unmapped admin path under /admin is treated as an unknown tool.
  return <UnknownAdminRoute />;
}

function AdminPanelTabRedirect({ tab }: { tab: string }) {
  const [, navigate] = useLocation();

  React.useEffect(() => {
    navigate(`/admin/panel?tab=${encodeURIComponent(tab)}`);
  }, [navigate, tab]);

  return <PageLoadingSpinner message="Opening admin workspace..." />;
}

function SuperAdminDashboard() {
  type CoverageSummary = {
    ok: boolean;
    totalCounties: number;
    unassignedCounties: number;
    partiallyCoveredCounties: number;
    fullyCoveredCounties: number;
    verifiedCoverageRatePercent: number;
    fullCoverageNewLast30: number;
  };

  const { data: coverage } = useQuery<CoverageSummary>({
    queryKey: ["/api/admin/geo/coverage", "overview"],
    queryFn: () => apiRequest("GET", "/api/admin/geo/coverage"),
    staleTime: 60_000,
  });

  // This acts as the Admin Operations Overview: single landing surface for
  // coverage, readiness, and urgent work, backed entirely by canonical
  // geo endpoints and the existing map/console tools.
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Shield className="w-4 h-4 text-scout-500" />
            Admin Operations Overview
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            One control surface for coverage, readiness, and high-safety operations. Use the
            map and coverage console below to drive assignments and repairs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
          <span className="inline-flex items-center gap-1"><MapIcon className="w-3 h-3 text-sky-400" />Map</span>
          <span className="inline-flex items-center gap-1"><UsersIcon className="w-3 h-3 text-emerald-400" />Coverage</span>
          <span className="inline-flex items-center gap-1"><Activity className="w-3 h-3 text-orange-400" />Queues</span>
        </div>
      </div>

      <Separator className="bg-slate-800" />

      {/* Map + queues */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <Card className="bg-slate-950/60 border-slate-800 xl:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm text-slate-100 flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-sky-400" />
                Coverage & Demand Map
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Counties colored by coverage or metrics, with inline tools to assign TMs,
                affiliates, and notes.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
              <UserHeatmap />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-950/60 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-400" />
              Coverage & Risk Queues
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              High-signal slices from the coverage console: focus on where we are not ready
              or recently changed.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-slate-400 space-y-3">
            {!coverage && (
              <p className="text-slate-500">Loading coverage queues hellip;</p>
            )}
            {coverage && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-red-500/40 text-red-300">
                    {coverage.unassignedCounties} unassigned counties
                  </Badge>
                  <Badge variant="outline" className="border-amber-500/40 text-amber-200">
                    {coverage.partiallyCoveredCounties} partial
                  </Badge>
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-200">
                    {coverage.fullyCoveredCounties} full
                  </Badge>
                  <Badge variant="outline" className="border-sky-500/40 text-sky-200">
                    {Math.round(coverage.verifiedCoverageRatePercent)}% verified coverage
                  </Badge>
                </div>
                <ul className="space-y-1 list-disc list-inside">
                  <li>
                    Focus first on <span className="font-semibold text-red-300">unassigned</span> counties to
                    prevent demand from landing with no TM or affiliate.
                  </li>
                  <li>
                    Use the Coverage Console filters for quick slices like
                    <span className="font-mono text-[11px]"> status = partial</span> or
                    <span className="font-mono text-[11px]"> hasRiskNote = true</span>.
                  </li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Embedded coverage console */}
      <Card className="bg-slate-950/60 border-slate-800">
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm text-slate-100">County Coverage Console</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Full county list with readiness filters. Use this table to assign TMs and
              affiliates, then jump into map view for spatial context.
            </CardDescription>
          </div>
          <Link href="/admin/geo/coverage">
            <Button size="sm" variant="outline" className="text-[11px]">
              Open full console
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-slate-400">
          <p className="mb-2">
            The dedicated Coverage Console remains available at <span className="font-mono text-[11px]">/admin/geo/coverage</span>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function UnknownAdminRoute() {
  const [location] = useLocation();

  return (
    <Card className="bg-slate-950/60 border-slate-800">
      <CardHeader>
        <CardTitle className="text-sm text-slate-100">Unknown admin tool</CardTitle>
        <CardDescription className="text-xs text-slate-400">
          This admin path is not wired into the Super Admin OS yet.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 flex justify-between items-center text-xs text-slate-500">
        <span>Requested: {location}</span>
        <Link href="/admin">
          <Button size="sm" variant="outline">
            Go to Super Admin dashboard
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
