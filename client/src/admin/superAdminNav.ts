import {
  Users,
  ShieldCheck,
  Map,
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
  Briefcase,
} from "lucide-react";

export type AdminRole = "moderator" | "ops_admin" | "super_admin" | "head_admin";

export type VisibilityRule = {
  roles?: AdminRole[];
};

export type SuperAdminNavItem = {
  id: string;
  label: string;
  path: string;
  icon: any;
  visibleIf?: VisibilityRule;
};

export type SuperAdminNavSection = {
  section: string;
  items: SuperAdminNavItem[];
};

/**
 * ADMIN RULE:
 * All admin tools MUST render inside the Super Admin OS shell.
 * No admin page may define its own navigation or header.
 *
 * This config is the single source of truth for Super Admin navigation.
 */
export const SUPER_ADMIN_NAV: SuperAdminNavSection[] = [
  {
    section: "Core Ops",
    items: [
      // Primary flow: Overview → Users → Geography (separate section) → Verification → Moderation
      {
        id: "dashboard",
        label: "Overview",
        path: "/admin",
        icon: ShieldCheck,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin", "head_admin"] },
      },
      {
        id: "users",
        label: "Users",
        path: "/admin/users",
        icon: Users,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin", "head_admin"] },
      },
      {
        id: "provision-user",
        label: "Provision User",
        path: "/admin/provision-user",
        icon: Users,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin", "head_admin"] },
      },
      {
        id: "verification",
        label: "Verification",
        path: "/admin/verification",
        icon: ShieldCheck,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin", "head_admin"] },
      },
      {
        id: "moderation",
        label: "Moderation",
        path: "/admin/moderation",
        icon: AlertTriangle,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin", "head_admin"] },
      },
      {
        id: "impersonation",
        label: "Impersonation",
        path: "/admin/impersonate",
        icon: Users,
        visibleIf: { roles: ["ops_admin", "super_admin", "head_admin"] },
      },
      {
        id: "business-import",
        label: "Business Import",
        path: "/admin/business-import",
        icon: FileUp,
        visibleIf: { roles: ["ops_admin", "super_admin", "head_admin"] },
      },
      {
        id: "create-admin",
        label: "Create Admin",
        path: "/admin/create-admin",
        icon: ShieldCheck,
        visibleIf: { roles: ["ops_admin", "super_admin", "head_admin"] },
      },
    ],
  },

  {
    section: "Geo Intelligence",
    items: [
      {
        id: "county-map",
        label: "Geography",
        path: "/admin/geo/counties",
        icon: Map,
        visibleIf: { roles: ["ops_admin", "super_admin", "head_admin"] },
      },
      {
        id: "county-coverage",
        label: "Coverage Console",
        path: "/admin/geo/coverage",
        icon: Map,
        visibleIf: { roles: ["ops_admin", "super_admin", "head_admin"] },
      },
    ],
  },

  {
    section: "Growth & Marketplace",
    items: [
      {
        id: "listings",
        label: "Listings Approval",
        path: "/admin/listings",
        icon: Briefcase,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin", "head_admin"] },
      },
      {
        id: "ads",
        label: "Ads",
        path: "/admin/ads",
        icon: Megaphone,
        visibleIf: { roles: ["ops_admin", "super_admin", "head_admin"] },
      },
      {
        id: "prizes",
        label: "Prizes",
        path: "/admin/prizes",
        icon: Megaphone,
        visibleIf: { roles: ["ops_admin", "super_admin", "head_admin"] },
      },
      {
        id: "tradedeals",
        label: "TradeDeals Ops",
        path: "/admin/tradedeals",
        icon: Briefcase,
        visibleIf: { roles: ["ops_admin", "super_admin", "head_admin"] },
      },
    ],
  },

  {
    section: "Platform Ops",
    items: [
      {
        id: "site-settings",
        label: "Site Settings",
        path: "/admin/site-settings",
        icon: Settings,
        visibleIf: { roles: ["ops_admin", "super_admin", "head_admin"] },
      },
      {
        id: "controls",
        label: "Controls Hub",
        path: "/admin/control",
        icon: ShieldCheck,
        visibleIf: { roles: ["ops_admin", "super_admin", "head_admin"] },
      },
      {
        id: "contractor-settings",
        label: "Contractor Settings",
        path: "/admin/contractors",
        icon: Settings,
        visibleIf: { roles: ["ops_admin", "super_admin", "head_admin"] },
      },
      {
        id: "notifications",
        label: "Notification Ops",
        path: "/admin/notifications",
        icon: Bell,
        visibleIf: { roles: ["ops_admin", "super_admin", "head_admin"] },
      },
      {
        id: "errors",
        label: "Error Reports",
        path: "/admin/errors",
        icon: AlertTriangle,
        visibleIf: { roles: ["moderator", "ops_admin", "super_admin", "head_admin"] },
      },
    ],
  },

  {
    section: "Intelligence & Automation",
    items: [
      {
        id: "mission-control",
        label: "Mission Control",
        path: "/admin/mission-control",
        icon: Brain,
        visibleIf: { roles: ["ops_admin", "super_admin", "head_admin"] },
      },
      {
        id: "ai-monitoring",
        label: "AI Monitoring",
        path: "/admin/ai-monitoring",
        icon: Brain,
        visibleIf: { roles: ["ops_admin", "super_admin", "head_admin"] },
      },
      {
        id: "ai-fixes",
        label: "AI Fixes",
        path: "/admin/ai-fixes",
        icon: Wrench,
        visibleIf: { roles: ["ops_admin", "super_admin", "head_admin"] },
      },
      {
        id: "pricing",
        label: "Pricing Analytics",
        path: "/admin/pricing",
        icon: BarChart3,
        visibleIf: { roles: ["ops_admin", "super_admin", "head_admin"] },
      },
      {
        id: "llm-admin",
        label: "LLM Admin",
        path: "/admin/llm",
        icon: Bot,
        visibleIf: { roles: ["super_admin", "head_admin"] },
      },
      {
        id: "knowledge",
        label: "Knowledge Upload",
        path: "/admin/knowledge",
        icon: FileUp,
        visibleIf: { roles: ["ops_admin", "super_admin", "head_admin"] },
      },
    ],
  },

  {
    section: "Finance",
    items: [
      {
        id: "finance",
        label: "Finance / Ledger",
        path: "/admin/finance",
        icon: DollarSign,
        visibleIf: { roles: ["super_admin", "head_admin"] },
      },
    ],
  },
];

export const canSee = (item: SuperAdminNavItem, role: AdminRole): boolean => {
  if (!item.visibleIf || !item.visibleIf.roles || item.visibleIf.roles.length === 0) {
    return true;
  }
  return item.visibleIf.roles.includes(role);
};

export const getSuperAdminNavForRole = (role: AdminRole): SuperAdminNavSection[] => {
  return SUPER_ADMIN_NAV.map((section) => ({
    section: section.section,
    items: section.items.filter((item) => canSee(item, role)),
  })).filter((section) => section.items.length > 0);
};
