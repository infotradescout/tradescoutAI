import React from "react";
import type { LucideIcon } from "lucide-react";
import {
  Users,
  ShieldCheck,
  Map as MapIcon,
  Megaphone,
  Settings,
  Bell,
  AlertTriangle,
  Brain,
  DollarSign,
  Bot,
  Wrench,
  BarChart3,
  FileUp,
  Building2,
  Briefcase,
  Home,
  Link2,
  Wallet,
  Radio,
} from "lucide-react";
import { useLocation } from "wouter";
import { PageLoadingSpinner } from "@/components/LoadingSpinner";

export type AdminRole = "moderator" | "ops_admin" | "super_admin" | "owner";

export type AdminToolVisibility = {
  roles?: AdminRole[];
  superOnly?: boolean;
};

export type AdminTool = {
  id: string;
  label: string;
  path: string; // canonical /admin/... path
  icon: LucideIcon;
  match?: "exact" | "prefix";
  visibleIf?: AdminToolVisibility;
  navHidden?: boolean;
  render: () => React.ReactNode;
};

export type AdminToolSection = {
  section: string;
  items: AdminTool[];
};

let didValidate = false;
function validateAdminToolsOnce() {
  if (didValidate) return;
  didValidate = true;

  try {
    const tools = getAllAdminTools();
    const ids = new Map<string, number>();
    const paths = new Map<string, number>();
    for (const t of tools) {
      ids.set(t.id, (ids.get(t.id) || 0) + 1);
      paths.set(t.path, (paths.get(t.path) || 0) + 1);
    }

    const dupIds = Array.from(ids.entries())
      .filter(([, c]) => c > 1)
      .map(([k]) => k);
    const dupPaths = Array.from(paths.entries())
      .filter(([, c]) => c > 1)
      .map(([k]) => k);

    if (dupIds.length || dupPaths.length) {
      console.error("[AdminTools] Duplicate admin tool ids/paths detected.", {
        dupIds,
        dupPaths,
      });
    }
  } catch {
    // no-op
  }
}

function normalizePathname(raw: string): string {
  // wouter locations may include ?query and/or #hash; tool matching expects just the path.
  return raw.split(/[?#]/, 1)[0] || "/";
}

function normalizeAdminRole(role: string | null | undefined): Exclude<AdminRole, "owner"> {
  const raw = typeof role === "string" ? role.trim().toLowerCase() : "";
  if (!raw) return "ops_admin";
  if (raw === "owner" || raw === "head_admin") return "super_admin";
  if (raw === "super_admin" || raw === "ops_admin" || raw === "moderator") return raw;
  return "ops_admin";
}

function isSuperAdminLike(role: string | null | undefined, isSuperAdminFlag?: boolean): boolean {
  const normalizedRole = normalizeAdminRole(role);
  return Boolean(isSuperAdminFlag === true || normalizedRole === "super_admin");
}

export function canSeeAdminTool(tool: AdminTool, role: AdminRole, isSuperAdminFlag?: boolean) {
  const normalizedRole = normalizeAdminRole(role);
  if (!tool.visibleIf) return true;
  if (tool.visibleIf.superOnly && !isSuperAdminLike(normalizedRole, isSuperAdminFlag)) return false;
  if (!tool.visibleIf.roles || tool.visibleIf.roles.length === 0) return true;
  return tool.visibleIf.roles.includes(normalizedRole);
}

export function getAdminNavSectionsForRole(
  role: AdminRole,
  isSuperAdminFlag?: boolean
): AdminToolSection[] {
  return ADMIN_TOOL_SECTIONS.map((section) => ({
    section: section.section,
    items: section.items.filter(
      (tool) => tool.navHidden !== true && canSeeAdminTool(tool, role, isSuperAdminFlag)
    ),
  })).filter((section) => section.items.length > 0);
}

export function getAllAdminTools(): AdminTool[] {
  return ADMIN_TOOL_SECTIONS.flatMap((s) => s.items);
}

export function findActiveAdminTool(pathname: string | null): AdminTool | null {
  if (!pathname) return null;
  const normalized = normalizePathname(pathname);
  const tools = getAllAdminTools();
  for (const tool of tools) {
    if (normalized === tool.path) return tool;
    if ((tool.match || "exact") === "prefix" && normalized.startsWith(tool.path + "/")) return tool;
  }
  if (normalized.startsWith("/admin")) {
    return tools.find((t) => t.path === "/admin") ?? null;
  }
  return null;
}

export function resolveAdminToolByLocation(
  location: string,
  role: AdminRole,
  isSuperAdminFlag?: boolean
): { tool: AdminTool | null; allowed: boolean } {
  validateAdminToolsOnce();
  const tools = getAllAdminTools();
  const pathname = normalizePathname(location || "/admin");

  let match: AdminTool | null = null;
  for (const tool of tools) {
    const mode = tool.match || "exact";
    if (mode === "exact" && pathname === tool.path) {
      match = tool;
      break;
    }
    if (mode === "prefix" && (pathname === tool.path || pathname.startsWith(tool.path + "/"))) {
      match = tool;
      break;
    }
  }

  if (!match && pathname.startsWith("/admin")) {
    match = tools.find((t) => t.path === "/admin") ?? null;
  }

  if (!match) return { tool: null, allowed: false };
  return { tool: match, allowed: canSeeAdminTool(match, role, isSuperAdminFlag) };
}

function RedirectTool({ to }: { to: string }) {
  const [, navigate] = useLocation();
  React.useEffect(() => {
    navigate(to);
  }, [navigate, to]);
  return <PageLoadingSpinner message="Redirecting..." />;
}

function RedirectToAdminPanelTab({ tab }: { tab: string }) {
  const [, navigate] = useLocation();

  React.useEffect(() => {
    navigate(`/admin/panel?tab=${encodeURIComponent(tab)}`);
  }, [navigate, tab]);

  return <PageLoadingSpinner message="Opening admin workspace..." />;
}

// Lazy tools (keep the Admin OS entry stable, pages load on demand)
const MissionControlV0 = React.lazy(() => import("@/pages/MissionControlV0"));
const AdminUsers = React.lazy(() => import("@/pages/admin-users"));
const AdminBusinessImport = React.lazy(() => import("@/pages/admin-business-import"));
const AdminBusinessDirectoryOps = React.lazy(() => import("@/pages/admin-business-directory-ops"));
const AdminCreateAccount = React.lazy(() => import("@/pages/admin-create-account"));
const AdminProvisionUser = React.lazy(() => import("@/pages/admin-provision-user"));
const AdminErrorReports = React.lazy(() => import("@/pages/admin-error-reports"));
const AdminPricingAnalytics = React.lazy(() => import("@/pages/admin-pricing-analytics"));
const AdminAddressVerifications = React.lazy(() => import("@/pages/admin-address-verifications"));
const AdminListings = React.lazy(() => import("@/pages/admin-listings"));
const AdminHomeScoutListings = React.lazy(() => import("@/pages/admin-homescout-listings"));
const AdminHomeScoutSources = React.lazy(() => import("@/pages/admin-homescout-sources"));
const AdminAttachments = React.lazy(() => import("@/pages/admin-attachments"));
const AdminAuditLog = React.lazy(() => import("@/pages/admin-audit-log"));
const AdminAuthorityPolicy = React.lazy(() => import("@/pages/admin-authority-policy"));
const AdminAffiliates = React.lazy(() => import("@/pages/admin-affiliates"));
const AdminTradePartnerOps = React.lazy(() => import("@/pages/admin-tradepartner-ops"));
const AdminTradePartnerInterest = React.lazy(() => import("@/pages/admin-tradepartner-interest"));
const AdminTradePartnerRsvps = React.lazy(() => import("@/pages/admin-tradepartner-rsvps"));
const AdminCumulusIntelligence = React.lazy(() => import("@/pages/admin-cumulus-intelligence"));
const AdminControl = React.lazy(() => import("@/pages/admin-control"));
const PlatformAnalytics = React.lazy(() => import("@/pages/platform-analytics"));
const ContentModeration = React.lazy(() => import("@/pages/content-moderation"));
const StaffShareLinksPage = React.lazy(() => import("@/pages/staff-share-links"));
const AdminObservability = React.lazy(() => import("@/pages/admin-observability"));
const AdminLiveStream = React.lazy(() => import("@/pages/admin-live-stream"));
const AdminToolDiscovery = React.lazy(() => import("@/pages/admin-tool-discovery"));
const AdminScoutResilience = React.lazy(() => import("@/pages/admin-scout-resilience"));
const AdminGeoCoverageConsole = React.lazy(() => import("@/pages/admin-geo-coverage"));
const AdminProfessionalVerification = React.lazy(
  () => import("@/pages/admin-professional-verification")
);
const AdminVaultContributions = React.lazy(() => import("@/pages/admin-vault-contributions"));
const PromptAdminPage = React.lazy(() =>
  import("@/pages/PromptAdminPage").then((m) => ({ default: m.PromptAdminPage }))
);
const AdminKnowledgeUploadPage = React.lazy(() => import("@/pages/admin-knowledge-upload"));
const AdminPanelContent = React.lazy(() => import("@/pages/admin-panel"));

// Component-based tools
const UserHeatmap = React.lazy(() =>
  import("@/components/UserHeatmap").then((m) => ({ default: m.UserHeatmap }))
);
const FinanceLedgerPanel = React.lazy(() =>
  import("@/components/admin/FinanceLedgerPanel").then((m) => ({ default: m.FinanceLedgerPanel }))
);
const UIMonitoringDashboard = React.lazy(() =>
  import("@/components/admin/UIMonitoringDashboard").then((m) => ({
    default: m.UIMonitoringDashboard,
  }))
);
const AICodeFixingDashboard = React.lazy(() =>
  import("@/components/admin/AICodeFixingDashboard").then((m) => ({
    default: m.AICodeFixingDashboard,
  }))
);
const RoleImpersonation = React.lazy(() =>
  import("@/components/admin/RoleImpersonation").then((m) => ({ default: m.RoleImpersonation }))
);

const tool = (t: Omit<AdminTool, "render"> & { render: AdminTool["render"] }): AdminTool => t;

export const ADMIN_TOOL_SECTIONS: AdminToolSection[] = [
  {
    section: "Core Ops",
    items: [
      tool({
        id: "overview",
        label: "Mission Control",
        path: "/admin",
        icon: Brain,
        visibleIf: {
          roles: ["ops_admin", "super_admin"],
        },
        render: () => <MissionControlV0 />,
      }),
      tool({
        id: "users",
        label: "Users",
        path: "/admin/users",
        icon: Users,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        render: () => <AdminUsers />,
      }),
      tool({
        id: "provision-user",
        label: "Provision User",
        path: "/admin/provision-user",
        icon: Users,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        render: () => <AdminProvisionUser />,
      }),
      tool({
        id: "verification",
        label: "Verification",
        path: "/admin/verification",
        icon: ShieldCheck,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        render: () => <AdminAddressVerifications />,
      }),
      tool({
        id: "legacy-address-verifications",
        label: "Address Verifications (Legacy)",
        path: "/admin/address-verifications",
        icon: ShieldCheck,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <RedirectTool to="/admin/verification" />,
      }),
      tool({
        id: "moderation",
        label: "Moderation",
        path: "/admin/moderation",
        icon: AlertTriangle,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        render: () => <ContentModeration />,
      }),
      tool({
        id: "impersonation",
        label: "Impersonation",
        path: "/admin/impersonate",
        icon: Users,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <RoleImpersonation />,
      }),
      tool({
        id: "business-import",
        label: "Business Import",
        path: "/admin/business-import",
        icon: FileUp,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminBusinessImport />,
      }),
      tool({
        id: "business-directory-ops",
        label: "Business Directory Ops",
        path: "/admin/business-directory",
        icon: Building2,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminBusinessDirectoryOps />,
      }),
      tool({
        id: "create-admin",
        label: "Create Admin",
        path: "/admin/create-admin",
        icon: ShieldCheck,
        visibleIf: { roles: ["super_admin"] },
        render: () => <AdminCreateAccount />,
      }),
      // Legacy aliases (kept so old buttons/links still work)
      tool({
        id: "legacy-workspace",
        label: "Workspace (Legacy)",
        path: "/admin/workspace",
        icon: Wrench,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <RedirectTool to="/admin/control" />,
      }),
      tool({
        id: "legacy-dashboard",
        label: "Dashboard (Legacy)",
        path: "/admin/dashboard",
        icon: ShieldCheck,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <RedirectTool to="/admin" />,
      }),
      tool({
        id: "legacy-users",
        label: "Users (Legacy)",
        path: "/admin-users",
        icon: Users,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <RedirectTool to="/admin/users" />,
      }),
      tool({
        id: "legacy-user-management",
        label: "User Management (Legacy)",
        path: "/admin/user-management",
        icon: Users,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <RedirectTool to="/admin/users" />,
      }),
    ],
  },
  {
    section: "Geo Intelligence",
    items: [
      tool({
        id: "geo-map",
        label: "Geography",
        path: "/admin/geo/counties",
        icon: MapIcon,
        match: "prefix",
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <UserHeatmap />,
      }),
      tool({
        id: "geo-coverage",
        label: "Coverage Console",
        path: "/admin/geo/coverage",
        match: "prefix",
        icon: MapIcon,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminGeoCoverageConsole />,
      }),
    ],
  },
  {
    section: "Growth & Marketplace",
    items: [
      tool({
        id: "listings",
        label: "Listings Approval",
        path: "/admin/listings",
        icon: Briefcase,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        render: () => <AdminListings />,
      }),
      tool({
        id: "homescout-listings",
        label: "HomeScout Listings",
        path: "/admin/homescout/listings",
        icon: Home,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        render: () => <AdminHomeScoutListings />,
      }),
      tool({
        id: "homescout-sources",
        label: "HomeScout Sources",
        path: "/admin/homescout/sources",
        icon: Home,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminHomeScoutSources />,
      }),
      tool({
        id: "ads",
        label: "Ads",
        path: "/admin/ads",
        icon: Megaphone,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <RedirectToAdminPanelTab tab="advertisements" />,
      }),
      tool({
        id: "prizes",
        label: "Prizes",
        path: "/admin/prizes",
        icon: Megaphone,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <RedirectToAdminPanelTab tab="prizes" />,
      }),
      tool({
        id: "tradepartner-ops",
        label: "TradePartners + TradeDeals",
        path: "/admin/tradepartners",
        icon: Briefcase,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminTradePartnerOps />,
      }),
      tool({
        id: "legacy-tradedeals",
        label: "TradeDeals Ops (Legacy)",
        path: "/admin/tradedeals",
        icon: Briefcase,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <RedirectTool to="/admin/tradepartners" />,
      }),
      tool({
        id: "tradepartner-interest",
        label: "Partner Interest",
        path: "/admin/tradepartner-interest",
        icon: Briefcase,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        render: () => <AdminTradePartnerInterest />,
      }),
      tool({
        id: "tradepartner-rsvps",
        label: "RSVP Tracker",
        path: "/admin/tradepartner-rsvps",
        icon: Briefcase,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        render: () => <AdminTradePartnerRsvps />,
      }),
      tool({
        id: "cumulus-intelligence",
        label: "Cumulus Intelligence",
        path: "/admin/cumulus-intelligence",
        icon: Megaphone,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminCumulusIntelligence />,
      }),
      tool({
        id: "share-links",
        label: "Share Links",
        path: "/admin/share-links",
        icon: Link2,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        render: () => <StaffShareLinksPage />,
      }),
    ],
  },
  {
    section: "Platform Ops",
    items: [
      tool({
        id: "panel",
        label: "Admin Panel",
        path: "/admin/panel",
        icon: Settings,
        match: "prefix",
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminPanelContent />,
      }),
      tool({
        id: "site-settings",
        label: "Site Settings",
        path: "/admin/site-settings",
        icon: Settings,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <RedirectToAdminPanelTab tab="site-settings" />,
      }),
      tool({
        id: "controls",
        label: "Controls Hub",
        path: "/admin/control",
        icon: ShieldCheck,
        visibleIf: { roles: ["super_admin"] },
        render: () => <AdminControl />,
      }),
      tool({
        id: "contractor-settings",
        label: "Contractor Settings",
        path: "/admin/contractors",
        icon: Settings,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <RedirectToAdminPanelTab tab="contractor-settings" />,
      }),
      tool({
        id: "notifications",
        label: "Notification Ops",
        path: "/admin/notifications",
        icon: Bell,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <RedirectToAdminPanelTab tab="notification-ops" />,
      }),
      tool({
        id: "errors",
        label: "Error Reports",
        path: "/admin/errors",
        icon: AlertTriangle,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        render: () => <AdminErrorReports />,
      }),
      tool({
        id: "legacy-error-reports",
        label: "Error Reports (Legacy)",
        path: "/admin/error-reports",
        icon: AlertTriangle,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <RedirectTool to="/admin/errors" />,
      }),
      tool({
        id: "attachments",
        label: "Attachments",
        path: "/admin/attachments",
        icon: FileUp,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminAttachments />,
      }),
      tool({
        id: "affiliates",
        label: "Affiliates",
        path: "/admin/affiliates",
        icon: Users,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminAffiliates />,
      }),
      tool({
        id: "legacy-promotions",
        label: "Promotions (Legacy)",
        path: "/admin/promotions",
        icon: Megaphone,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <RedirectTool to="/admin/tradepartners" />,
      }),
      tool({
        id: "legacy-tradepartner-campaigns",
        label: "TradePartner Campaigns (Legacy)",
        path: "/admin/tradepartner-campaigns",
        icon: Megaphone,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <RedirectTool to="/admin/tradepartners" />,
      }),
      tool({
        id: "platform-analytics",
        label: "Platform Analytics",
        path: "/admin/platform-analytics",
        icon: BarChart3,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <PlatformAnalytics />,
      }),
      tool({
        id: "audit-log",
        label: "Audit Log",
        path: "/admin/audit-log",
        icon: ShieldCheck,
        visibleIf: { roles: ["super_admin"] },
        render: () => <AdminAuditLog />,
      }),
      tool({
        id: "authority-policy",
        label: "Authority Policy",
        path: "/admin/authority-policy",
        icon: ShieldCheck,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminAuthorityPolicy />,
      }),
      tool({
        id: "professional-verification",
        label: "Pro Verification",
        path: "/admin/professional-verification",
        icon: ShieldCheck,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminProfessionalVerification />,
      }),
    ],
  },
  {
    section: "Intelligence & Automation",
    items: [
      tool({
        id: "mission-control",
        label: "Mission Control",
        path: "/admin/mission-control",
        icon: Brain,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        // /admin already lands super admins on Mission Control; keep this route working but hide it from nav.
        navHidden: true,
        render: () => <MissionControlV0 />,
      }),
      tool({
        id: "ai-monitoring",
        label: "AI Monitoring",
        path: "/admin/ai-monitoring",
        icon: Brain,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <UIMonitoringDashboard />,
      }),
      tool({
        id: "ai-fixes",
        label: "AI Fixes",
        path: "/admin/ai-fixes",
        icon: Wrench,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AICodeFixingDashboard />,
      }),
      tool({
        id: "pricing",
        label: "Pricing Analytics",
        path: "/admin/pricing",
        icon: BarChart3,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminPricingAnalytics />,
      }),
      tool({
        id: "legacy-pricing-analytics",
        label: "Pricing Analytics (Legacy)",
        path: "/admin/pricing-analytics",
        icon: BarChart3,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <RedirectTool to="/admin/pricing" />,
      }),
      tool({
        id: "live-stream",
        label: "Live Stream",
        path: "/admin/live-stream",
        icon: Radio,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminLiveStream />,
      }),
      tool({
        id: "observability",
        label: "Observability",
        path: "/admin/observability",
        icon: Brain,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminObservability />,
      }),
      tool({
        id: "scout-resilience",
        label: "Scout Resilience",
        path: "/admin/scout-resilience",
        icon: Bot,
        visibleIf: { roles: ["super_admin"] },
        render: () => <AdminScoutResilience />,
      }),
      tool({
        id: "tool-discovery",
        label: "Tool Discovery",
        path: "/admin/tool-discovery",
        icon: Wrench,
        visibleIf: { roles: ["super_admin"] },
        render: () => <AdminToolDiscovery />,
      }),
      tool({
        id: "system-prompt",
        label: "System Prompt",
        path: "/admin/system-prompt",
        icon: Bot,
        visibleIf: { roles: ["super_admin"] },
        navHidden: true,
        render: () => <RedirectTool to="/admin/llm" />,
      }),
      tool({
        id: "llm-admin",
        label: "LLM Admin",
        path: "/admin/llm",
        icon: Bot,
        visibleIf: { roles: ["super_admin"] },
        render: () => <PromptAdminPage />,
      }),
      tool({
        id: "knowledge",
        label: "Knowledge Upload",
        path: "/admin/knowledge",
        icon: FileUp,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminKnowledgeUploadPage />,
      }),
    ],
  },
  {
    section: "Finance",
    items: [
      tool({
        id: "finance",
        label: "Finance / Ledger",
        path: "/admin/finance",
        icon: DollarSign,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <FinanceLedgerPanel />,
      }),
      tool({
        id: "vault-contributions",
        label: "Vault Contributions",
        path: "/admin/vault-contributions",
        icon: Wallet,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminVaultContributions />,
      }),
    ],
  },
];
