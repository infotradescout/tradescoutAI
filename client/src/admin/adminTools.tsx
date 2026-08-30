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
  Camera,
  ShoppingCart,
  ClipboardCheck,
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
  description?: string;
  keywords?: string[];
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

export function getAdminToolDescription(tool: AdminTool): string {
  if (tool.description) return tool.description;
  if (tool.path === "/admin") return "Role-aware admin command center.";
  return `Open ${tool.label.toLowerCase()} admin work.`;
}

export function getAdminToolSearchText(tool: AdminTool, section?: string): string {
  return [tool.id, tool.label, tool.path, tool.description, section, ...(tool.keywords || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
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
const AdminDirectConnectRequests = React.lazy(
  () => import("@/pages/admin-direct-connect-requests")
);
const AdminErrorReports = React.lazy(() => import("@/pages/admin-error-reports"));
const AdminPricingAnalytics = React.lazy(() => import("@/pages/admin-pricing-analytics"));
const AdminAddressVerifications = React.lazy(() => import("@/pages/admin-address-verifications"));
const AdminListings = React.lazy(() => import("@/pages/admin-listings"));
const CrmDashboard = React.lazy(() => import("@/pages/CrmDashboard"));
const AdminProfileVerifications = React.lazy(() => import("@/pages/admin-profile-verifications"));
const AdminHomeScoutListings = React.lazy(() => import("@/pages/admin-homescout-listings"));
const AdminHomeScoutSources = React.lazy(() => import("@/pages/admin-homescout-sources"));
const AdminCommercialDirectory = React.lazy(() => import("@/pages/admin-commercial-directory"));
const AdminCommercialContractors = React.lazy(() => import("@/pages/admin-commercial-contractors"));
const AdminAttachments = React.lazy(() => import("@/pages/admin-attachments"));
const AdminAuditLog = React.lazy(() => import("@/pages/admin-audit-log"));
const AdminAuthorityPolicy = React.lazy(() => import("@/pages/admin-authority-policy"));
const AdminAffiliates = React.lazy(() => import("@/pages/admin-affiliates"));
const AdminTradePartnerOps = React.lazy(() => import("@/pages/admin-tradepartner-ops"));
const AdminTradePartnerInterest = React.lazy(() => import("@/pages/admin-tradepartner-interest"));
const AdminTradePartnerRsvps = React.lazy(() => import("@/pages/admin-tradepartner-rsvps"));
const AdminTradePartnerCampaigns = React.lazy(() => import("@/pages/admin-tradepartner-campaigns"));
const AdminCumulusIntelligence = React.lazy(() => import("@/pages/admin-cumulus-intelligence"));
const AdminAuthorityDiagnostics = React.lazy(() => import("@/pages/admin-authority-diagnostics"));
const AdminControl = React.lazy(() => import("@/pages/admin-control"));
const PlatformAnalytics = React.lazy(() => import("@/pages/platform-analytics"));
const ContentModeration = React.lazy(() => import("@/pages/content-moderation"));
const StaffShareLinksPage = React.lazy(() => import("@/pages/staff-share-links"));
const AdminTestingControls = React.lazy(() => import("@/pages/admin-testing-controls"));
const AdminLiveStream = React.lazy(() => import("@/pages/admin-live-stream"));
const AdminProductionAcceptance = React.lazy(
  () => import("@/pages/admin-production-acceptance")
);
const AdminGeoCoverageConsole = React.lazy(() => import("@/pages/admin-geo-coverage"));
const AdminProfessionalVerification = React.lazy(
  () => import("@/pages/admin-professional-verification")
);
const AdminBusinessOnboardingTelemetry = React.lazy(
  () => import("@/pages/admin-business-onboarding-telemetry")
);
const AdminDiscoveryObservatory = React.lazy(() => import("@/pages/admin-discovery-observatory"));
const AdminVaultContributions = React.lazy(() => import("@/pages/admin-vault-contributions"));
const AdminProvisioning = React.lazy(() => import("@/pages/admin-provisioning"));
const AdminPanelContent = React.lazy(() => import("@/pages/admin-panel"));
const PaymentProcessing = React.lazy(() => import("@/pages/payment-processing"));
const AdminProcurement = React.lazy(() => import("@/pages/admin-procurement"));
const AdminProcurementDetail = React.lazy(() => import("@/pages/admin-procurement-detail"));
const AdminProcurementWorkspaces = React.lazy(() => import("@/pages/admin-procurement-workspaces"));
const AdminProcurementWorkspaceDetail = React.lazy(
  () => import("@/pages/admin-procurement-workspace-detail")
);

// Component-based tools
const UserHeatmap = React.lazy(() =>
  import("@/components/UserHeatmap").then((m) => ({ default: m.UserHeatmap }))
);
const FinanceLedgerPanel = React.lazy(() =>
  import("@/components/admin/FinanceLedgerPanel").then((m) => ({ default: m.FinanceLedgerPanel }))
);
const RoleImpersonation = React.lazy(() =>
  import("@/components/admin/RoleImpersonation").then((m) => ({ default: m.RoleImpersonation }))
);

function AdminProcurementRouter() {
  const [location] = useLocation();
  const pathname = normalizePathname(location || "");

  if (/^\/admin\/procurement\/workspaces\/[^/]+$/.test(pathname)) {
    return <AdminProcurementWorkspaceDetail />;
  }

  if (pathname === "/admin/procurement/workspaces") {
    return <AdminProcurementWorkspaces />;
  }

  if (/^\/admin\/procurement\/[^/]+$/.test(pathname)) {
    return <AdminProcurementDetail />;
  }

  return <AdminProcurement />;
}

const tool = (t: Omit<AdminTool, "render"> & { render: AdminTool["render"] }): AdminTool => t;

export const ADMIN_TOOL_SECTIONS: AdminToolSection[] = [
  {
    section: "Core Ops",
    items: [
      tool({
        id: "overview",
        label: "Admin Home",
        path: "/admin",
        icon: Brain,
        description: "Command center for admin signals, law guardrails, and the full tool index.",
        keywords: ["command center", "tools", "home", "overview"],
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
        description:
          "Search accounts, support profiles, and manage audited role or status changes.",
        keywords: ["accounts", "roles", "profile", "support"],
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        render: () => <AdminUsers />,
      }),
      tool({
        id: "provision-user",
        label: "Provision User",
        path: "/admin/provision-user",
        icon: Users,
        description: "Create or normalize user access with admin audit controls.",
        keywords: ["account", "create", "access"],
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <AdminProvisionUser />,
      }),
      tool({
        id: "direct-connect-requests",
        label: "Direct Connect Requests",
        path: "/admin/direct-connect-requests",
        icon: Link2,
        description: "Inspect routed requests while preserving Intent -> Decision Card -> Contact.",
        keywords: ["contact gate", "routing", "requests", "decision card"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminDirectConnectRequests />,
      }),
      tool({
        id: "verification",
        label: "Verification",
        path: "/admin/verification",
        icon: ShieldCheck,
        description:
          "Review adaptive verification queues without converting visibility into access.",
        keywords: ["trust", "address", "claims", "cvs"],
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
        id: "business-verifications",
        label: "Business Verifications",
        path: "/admin/business-verifications",
        icon: ShieldCheck,
        description:
          "Review license, insurance, tax ID, and business registration submissions per profile type.",
        keywords: ["license", "insurance", "tax id", "business registration", "verification"],
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        render: () => <AdminProfileVerifications />,
      }),
      tool({
        id: "moderation",
        label: "Moderation",
        path: "/admin/moderation",
        icon: AlertTriangle,
        description: "Review community reports and flags with read/action boundaries intact.",
        keywords: ["community", "reports", "flags"],
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        render: () => <ContentModeration />,
      }),
      tool({
        id: "impersonation",
        label: "Impersonation",
        path: "/admin/impersonate",
        icon: Users,
        description: "Use audited role simulation for support and QA checks.",
        keywords: ["role", "qa", "support", "audit"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <RoleImpersonation />,
      }),
      tool({
        id: "business-import",
        label: "Business Import",
        path: "/admin/business-import",
        icon: FileUp,
        description: "Stage, enrich, and merge business data before directory publication.",
        keywords: ["csv", "staging", "merge", "directory"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <AdminBusinessImport />,
      }),
      tool({
        id: "business-directory-ops",
        label: "Business Directory Ops",
        path: "/admin/business-directory",
        icon: Building2,
        description: "Run seed jobs and review suggested business directory changes.",
        keywords: ["places", "suggestions", "seeding"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminBusinessDirectoryOps />,
      }),
      tool({
        id: "create-admin",
        label: "Create Admin",
        path: "/admin/create-admin",
        icon: ShieldCheck,
        description: "Create admin-tier accounts with role boundaries.",
        keywords: ["staff", "role", "super admin"],
        visibleIf: { roles: ["super_admin"] },
        navHidden: true,
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
        label: "Counties",
        path: "/admin/geo/counties",
        icon: MapIcon,
        match: "prefix",
        description: "Inspect county coverage and precomputed county intelligence containers.",
        keywords: ["county_metrics", "county_entities", "county_notes", "coverage"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminGeoCoverageConsole />,
      }),
      tool({
        id: "geo-coverage",
        label: "Coverage Console (Legacy)",
        path: "/admin/geo/coverage",
        match: "prefix",
        icon: MapIcon,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <RedirectTool to="/admin/geo/counties" />,
      }),
      tool({
        id: "geo-heatmap",
        label: "Geography Heatmap",
        path: "/admin/geo/heatmap",
        match: "prefix",
        icon: MapIcon,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <UserHeatmap />,
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
        description: "Approve and manage marketplace listings without bypassing trust exposure.",
        keywords: ["exchange", "approval", "marketplace"],
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        render: () => <AdminListings />,
      }),
      tool({
        id: "procurement",
        label: "Procurement",
        path: "/admin/procurement",
        match: "prefix",
        icon: ShoppingCart,
        description: "Operate supply runs, procurement orders, workspaces, and quote review.",
        keywords: ["grunt", "supply run", "orders", "quotes", "workspaces", "procurement"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminProcurementRouter />,
      }),
      tool({
        id: "commercial-directory",
        label: "Commercial Jobs",
        path: "/admin/commercial-directory",
        icon: Briefcase,
        description: "Manage commercial job requests, bids, and project documents.",
        keywords: ["commercial", "jobs", "bids", "hardrock"],
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        render: () => <AdminCommercialDirectory />,
      }),
      tool({
        id: "commercial-contractors",
        label: "Commercial Businesses",
        path: "/admin/commercial-contractors",
        icon: Building2,
        description: "Review commercial business verification and account status.",
        keywords: ["commercial", "businesses", "verification", "documents"],
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <AdminCommercialContractors />,
      }),
      tool({
        id: "homescout-listings",
        label: "HomeScout Listings",
        path: "/admin/homescout/listings",
        icon: Home,
        description: "Review HomeScout listing inventory from the admin side.",
        keywords: ["homes", "listings", "real estate"],
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <AdminHomeScoutListings />,
      }),
      tool({
        id: "homescout-sources",
        label: "HomeScout Sources",
        path: "/admin/homescout/sources",
        icon: Home,
        description: "Manage HomeScout source ingestion and source health.",
        keywords: ["homes", "sources", "ingestion"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <AdminHomeScoutSources />,
      }),
      tool({
        id: "ads",
        label: "Ads",
        path: "/admin/ads",
        icon: Megaphone,
        description: "Open the advertising controls inside the admin panel.",
        keywords: ["advertisements", "campaigns"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <RedirectToAdminPanelTab tab="advertisements" />,
      }),
      tool({
        id: "prizes",
        label: "Prizes",
        path: "/admin/prizes",
        icon: Megaphone,
        description: "Open prize operations inside the admin panel.",
        keywords: ["giveaway", "rewards"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <RedirectToAdminPanelTab tab="prizes" />,
      }),
      tool({
        id: "crm",
        label: "Sales CRM",
        path: "/admin/crm",
        icon: Briefcase,
        description: "Internal contacts, deals, and activity pipeline for the sales/growth team.",
        keywords: ["crm", "contacts", "deals", "sales", "pipeline"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <CrmDashboard />,
      }),
      tool({
        id: "tradepartner-ops",
        label: "TradePartners + TradeDeals",
        path: "/admin/tradepartners",
        icon: Briefcase,
        description: "Operate TradePartner campaigns, deals, and related partner workflow.",
        keywords: ["partners", "deals", "campaigns"],
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
        description: "Review inbound TradePartner interest submissions.",
        keywords: ["partners", "interest", "leads"],
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <AdminTradePartnerInterest />,
      }),
      tool({
        id: "tradepartner-rsvps",
        label: "RSVP Tracker",
        path: "/admin/tradepartner-rsvps",
        icon: Briefcase,
        description: "Track TradePartner RSVP activity and follow-up state.",
        keywords: ["partners", "rsvp", "events"],
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <AdminTradePartnerRsvps />,
      }),
      tool({
        id: "cumulus-intelligence",
        label: "Cumulus Intelligence",
        path: "/admin/cumulus-intelligence",
        icon: Megaphone,
        description: "Read county commercial pressure and partner briefing intelligence.",
        keywords: ["county", "commercial", "signals", "briefing"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <AdminCumulusIntelligence />,
      }),
      tool({
        id: "share-links",
        label: "Share Links",
        path: "/admin/share-links",
        icon: Link2,
        description: "Create and review controlled staff share links.",
        keywords: ["staff", "share", "links"],
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        navHidden: true,
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
        description:
          "Operate site settings, ads, prizes, business/provider settings, and notifications.",
        keywords: ["settings", "configuration"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminPanelContent />,
      }),
      tool({
        id: "site-settings",
        label: "Site Settings",
        path: "/admin/site-settings",
        icon: Settings,
        description: "Open site settings inside the admin panel.",
        keywords: ["configuration", "settings"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <RedirectToAdminPanelTab tab="site-settings" />,
      }),
      tool({
        id: "controls",
        label: "Controls Hub",
        path: "/admin/control",
        icon: ShieldCheck,
        description:
          "Super admin controls for flags, diagnostics, testing, and authority operations.",
        keywords: ["flags", "authority", "diagnostics", "testing"],
        visibleIf: { roles: ["super_admin"] },
        render: () => <AdminControl />,
      }),
      tool({
        id: "contractor-settings",
        label: "Business Provider Settings",
        path: "/admin/business-provider-settings",
        icon: Settings,
        description: "Open business/provider settings inside the admin panel.",
        keywords: ["business", "provider", "settings"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <RedirectToAdminPanelTab tab="contractor-settings" />,
      }),
      tool({
        id: "legacy-contractor-settings",
        label: "Business Provider Settings (Legacy)",
        path: "/admin/contractors",
        icon: Settings,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <RedirectTool to="/admin/business-provider-settings" />,
      }),
      tool({
        id: "notifications",
        label: "Notification Ops",
        path: "/admin/notifications",
        icon: Bell,
        description: "Open notification operations inside the admin panel.",
        keywords: ["email", "alerts", "notifications"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <RedirectToAdminPanelTab tab="notification-ops" />,
      }),
      tool({
        id: "errors",
        label: "Error Reports",
        path: "/admin/errors",
        icon: AlertTriangle,
        description: "Review submitted error reports and admin-facing issue evidence.",
        keywords: ["bugs", "support", "reports"],
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin"] },
        render: () => <AdminErrorReports />,
      }),
      tool({
        id: "authority-diagnostics",
        label: "Authority Diagnostics (Legacy)",
        path: "/admin/authority-diagnostics",
        icon: Brain,
        description:
          "Legacy authority diagnostics for override outcomes and confidence calibration.",
        keywords: ["authority", "diagnostics", "trust", "policy", "legacy"],
        visibleIf: { roles: ["super_admin"] },
        navHidden: true,
        render: () => <AdminAuthorityDiagnostics />,
      }),
      tool({
        id: "provisioning",
        label: "Provisioning (Legacy)",
        path: "/admin/provisioning",
        icon: Users,
        description:
          "Legacy workflow for admin user provisioning and optional business record seeding.",
        keywords: ["users", "provision", "admin"],
        visibleIf: { roles: ["super_admin"] },
        navHidden: true,
        render: () => <AdminProvisioning />,
      }),
      tool({
        id: "testing-controls",
        label: "Testing Controls (Legacy)",
        path: "/admin/testing-controls",
        icon: Wrench,
        description: "Legacy controls for testing flags, banners, and controlled bug tooling.",
        keywords: ["testing", "qa", "flags", "legacy"],
        visibleIf: { roles: ["super_admin"] },
        navHidden: true,
        render: () => <AdminTestingControls />,
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
        description: "Inspect admin-visible uploaded attachments and error report assets.",
        keywords: ["files", "uploads", "assets"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <AdminAttachments />,
      }),
      tool({
        id: "affiliates",
        label: "Affiliates",
        path: "/admin/affiliates",
        icon: Users,
        description: "Review affiliate accounts, rates, and payout actions.",
        keywords: ["commission", "payouts"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
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
        description: "Legacy campaign configuration workflow for TradePartner launches.",
        keywords: ["partners", "campaigns", "trade-partner", "legacy"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <AdminTradePartnerCampaigns />,
      }),
      tool({
        id: "payment-guardrails",
        label: "Payment Guardrails",
        path: "/admin/payment-model",
        icon: ShieldCheck,
        description: "Expose payment guardrails and anti-paywall policy for admin review.",
        keywords: ["payments", "guardrails", "policy", "law", "admin"],
        visibleIf: { roles: ["super_admin"] },
        navHidden: true,
        render: () => <PaymentProcessing />,
      }),
      tool({
        id: "platform-analytics",
        label: "Platform Analytics",
        path: "/admin/platform-analytics",
        icon: BarChart3,
        description: "Open platform analytics and exportable admin reports.",
        keywords: ["analytics", "reports", "metrics"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <PlatformAnalytics />,
      }),
      tool({
        id: "audit-log",
        label: "Audit Log",
        path: "/admin/audit-log",
        icon: ShieldCheck,
        description: "Review audited admin actions and authority-sensitive changes.",
        keywords: ["audit", "admin safety", "authority"],
        visibleIf: { roles: ["super_admin"] },
        navHidden: true,
        render: () => <AdminAuditLog />,
      }),
      tool({
        id: "authority-policy",
        label: "Authority Policy",
        path: "/admin/authority-policy",
        icon: ShieldCheck,
        description: "Inspect privileged authority policy and bypass recognition config.",
        keywords: ["policy", "bypass", "authority"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <AdminAuthorityPolicy />,
      }),
      tool({
        id: "professional-verification",
        label: "Pro Verification",
        path: "/admin/professional-verification",
        icon: ShieldCheck,
        description: "Review professional credential verification evidence and states.",
        keywords: ["business", "provider", "credentials", "trust"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <AdminProfessionalVerification />,
      }),
      tool({
        id: "business-onboarding-telemetry",
        label: "Business Onboarding Telemetry",
        path: "/admin/business-onboarding-telemetry",
        icon: BarChart3,
        description:
          "Track module completion, transition velocity, and onboarding friction for business accounts.",
        keywords: ["business onboarding", "telemetry", "transitions", "completion"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminBusinessOnboardingTelemetry />,
      }),
    ],
  },
  {
    section: "Intelligence & Automation",
    items: [
      tool({
        id: "discovery-observatory",
        label: "Discovery Observatory",
        path: "/admin/discovery-observatory",
        icon: BarChart3,
        description:
          "Follow outside reach through entry, Direct Connect response, and verified outcome with explicit unknowns.",
        keywords: ["discovery", "reach", "entry", "outcome", "experiment", "query"],
        visibleIf: { superOnly: true, roles: ["super_admin"] },
        render: () => <AdminDiscoveryObservatory />,
      }),
      tool({
        id: "mission-control",
        label: "Mission Control",
        path: "/admin/mission-control",
        icon: Brain,
        description: "Focus queue for current failures, demand shifts, and today decisions.",
        keywords: ["one fix", "failures", "demand", "scout"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <MissionControlV0 />,
      }),
      tool({
        id: "ai-monitoring",
        label: "AI Monitoring (Legacy)",
        path: "/admin/ai-monitoring",
        icon: Brain,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <RedirectTool to="/admin/live-stream" />,
      }),
      tool({
        id: "ai-fixes",
        label: "AI Fixes (Legacy)",
        path: "/admin/ai-fixes",
        icon: Wrench,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <RedirectTool to="/admin/live-stream" />,
      }),
      tool({
        id: "pricing",
        label: "Pricing Analytics",
        path: "/admin/pricing",
        icon: BarChart3,
        description: "Analyze pricing, fees, and marketplace performance signals.",
        keywords: ["pricing", "fees", "analytics"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
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
        label: "Telemetry Center",
        path: "/admin/live-stream",
        icon: Radio,
        description: "Unified telemetry center for live evidence, snapshots, and system signals.",
        keywords: ["observability", "live", "crawler", "snapshots"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <AdminLiveStream />,
      }),
      tool({
        id: "production-acceptance",
        label: "Production Acceptance",
        path: "/admin/production-acceptance",
        icon: ClipboardCheck,
        description: "Current production truth across the operating lanes.",
        keywords: ["acceptance", "production", "readiness", "operations"],
        visibleIf: { superOnly: true },
        render: () => <AdminProductionAcceptance />,
      }),
      tool({
        id: "legacy-production-acceptance",
        label: "Production Acceptance (Legacy)",
        path: "/admin/acceptance",
        icon: ClipboardCheck,
        visibleIf: { superOnly: true },
        navHidden: true,
        render: () => <RedirectTool to="/admin/production-acceptance" />,
      }),
      tool({
        id: "observability",
        label: "Observability (Legacy)",
        path: "/admin/observability",
        icon: Brain,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <RedirectTool to="/admin/live-stream" />,
      }),
      tool({
        id: "scout-resilience",
        label: "Scout Resilience",
        path: "/admin/scout-resilience",
        icon: Bot,
        description: "Fix issues that block Scout from completing user actions.",
        keywords: ["scout", "response", "contract", "resilience"],
        visibleIf: { roles: ["super_admin"] },
        render: () => {
          const AdminScoutResilience = React.lazy(() => import("../pages/admin-scout-resilience"));
          return (
            <React.Suspense
              fallback={<div className="p-4 text-sm text-muted-foreground">Loading...</div>}
            >
              <AdminScoutResilience />
            </React.Suspense>
          );
        },
      }),
      tool({
        id: "tool-discovery",
        label: "Tool Discovery (Legacy)",
        path: "/admin/tool-discovery",
        icon: Wrench,
        visibleIf: { roles: ["super_admin"] },
        navHidden: true,
        render: () => <RedirectTool to="/admin/live-stream" />,
      }),
      tool({
        id: "inspection-intelligence",
        label: "Inspection Intelligence (Legacy)",
        path: "/admin/inspection-intelligence",
        icon: Brain,
        visibleIf: { roles: ["ops_admin", "super_admin", "moderator"] },
        navHidden: true,
        render: () => <RedirectTool to="/admin/live-stream" />,
      }),
      tool({
        id: "ai-camera-lab",
        label: "AI Camera Lab",
        path: "/admin/ai-camera-lab",
        icon: Camera,
        description: "Open the AI camera inspection lab.",
        keywords: ["camera", "inspection", "ai"],
        visibleIf: { roles: ["ops_admin", "super_admin", "moderator"] },
        navHidden: true,
        render: () => <RedirectTool to="/zero-base-fee/camera" />,
      }),
      tool({
        id: "system-prompt",
        label: "System Prompt (Legacy)",
        path: "/admin/system-prompt",
        icon: Bot,
        visibleIf: { roles: ["super_admin"] },
        navHidden: true,
        render: () => <RedirectTool to="/admin/live-stream" />,
      }),
      tool({
        id: "llm-admin",
        label: "LLM Admin (Legacy)",
        path: "/admin/llm",
        icon: Bot,
        visibleIf: { roles: ["super_admin"] },
        navHidden: true,
        render: () => <RedirectTool to="/admin/live-stream" />,
      }),
      tool({
        id: "knowledge",
        label: "Knowledge Upload (Legacy)",
        path: "/admin/knowledge",
        icon: FileUp,
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <RedirectTool to="/admin/live-stream" />,
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
        description: "Review finance ledger state and operational finance entries.",
        keywords: ["ledger", "money", "finance"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        render: () => <FinanceLedgerPanel />,
      }),
      tool({
        id: "vault-contributions",
        label: "Vault Contributions",
        path: "/admin/vault-contributions",
        icon: Wallet,
        description: "Review and manage vault contribution records.",
        keywords: ["vault", "contributions", "finance"],
        visibleIf: { roles: ["ops_admin", "super_admin"] },
        navHidden: true,
        render: () => <AdminVaultContributions />,
      }),
    ],
  },
];
