import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building,
  CircleDollarSign,
  ClipboardList,
  Compass,
  FolderKanban,
  Heart,
  Home,
  Map,
  Megaphone,
  MessageCircle,
  Settings,
  Share2,
  ShoppingBag,
  Trophy,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

export type ProductNavGroupId =
  | "core"
  | "discover"
  | "work"
  | "business"
  | "assets"
  | "community"
  | "account";

export type ProductNavItem = {
  id: string;
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
  group: ProductNavGroupId;
  aliases?: string[];
  advanced?: boolean;
};

export const PRODUCT_NAV_GROUPS: Array<{
  id: ProductNavGroupId;
  label: string;
  description: string;
}> = [
  { id: "core", label: "Core", description: "Start, ask, and coordinate." },
  { id: "discover", label: "Discover", description: "Find businesses, work, listings, and local activity." },
  { id: "work", label: "Work", description: "Requests, conversations, projects, and job flow." },
  { id: "business", label: "Business", description: "Operate, market, and manage the business." },
  { id: "assets", label: "Assets", description: "Homes, vehicles, property records, and maintenance." },
  { id: "community", label: "Community", description: "Local people, groups, trust, and shared activity." },
  { id: "account", label: "Account & tools", description: "Profile, settings, saved items, and utilities." },
];

/**
 * Canonical presentation taxonomy for the signed-in TradeScout UI.
 * Existing routes remain authoritative; this file organizes them without
 * removing capabilities or changing backend permissions.
 */
export const PRODUCT_NAV_ITEMS: ProductNavItem[] = [
  {
    id: "scout",
    label: "Scout",
    href: "/scout",
    description: "Ask TradeScout what to do next.",
    icon: Compass,
    group: "core",
  },
  {
    id: "requests",
    label: "Requests",
    href: "/direct-connect",
    description: "Create requests, track replies, and continue accepted work.",
    icon: ClipboardList,
    group: "core",
    aliases: ["/direct-connect/active", "/direct-connect/inbox"],
  },
  {
    id: "businesses",
    label: "Businesses",
    href: "/contractors",
    description: "Find businesses by service, location, and available trust signals.",
    icon: Building,
    group: "discover",
    aliases: ["/find-local-businesses", "/directory/businesses"],
  },
  {
    id: "jobs",
    label: "Jobs",
    href: "/direct-connect/opportunities",
    description: "Find work, hire, post jobs or resumes, and manage applicants.",
    icon: Wrench,
    group: "discover",
    aliases: ["/direct-connect/employment"],
  },
  {
    id: "exchange",
    label: "Exchange",
    href: "/exchange",
    description: "Buy, sell, rent, and browse marketplace listings.",
    icon: ShoppingBag,
    group: "discover",
  },
  {
    id: "maps",
    label: "Maps",
    href: "/maps",
    description: "Explore businesses, service coverage, and local activity geographically.",
    icon: Map,
    group: "discover",
    advanced: true,
  },
  {
    id: "projects",
    label: "Projects",
    href: "/project-tracker",
    description: "Track active work, milestones, and project progress.",
    icon: FolderKanban,
    group: "work",
  },
  {
    id: "messages",
    label: "Messages",
    href: "/messages",
    description: "Continue conversations, quotes, and follow-ups.",
    icon: MessageCircle,
    group: "work",
  },
  {
    id: "commercial-work",
    label: "Commercial Work",
    href: "/commercial-directory",
    description: "Review published commercial projects and bid packages.",
    icon: Building,
    group: "work",
  },
  {
    id: "business-home",
    label: "My Business",
    href: "/business-dashboard",
    description: "Manage business activity, profile operations, requests, and work.",
    icon: Building,
    group: "business",
  },
  {
    id: "finances",
    label: "Finances",
    href: "/finances",
    description: "Invoices, expenses, records, reports, clients, payroll, and vendors.",
    icon: Wallet,
    group: "business",
  },
  {
    id: "share",
    label: "Share",
    href: "/share",
    description: "Share attributable TradeScout links and business activity.",
    icon: Share2,
    group: "business",
    advanced: true,
  },
  {
    id: "trade-deals",
    label: "TradeDeals",
    href: "/trade-deals",
    description: "Review partner offers and active campaigns.",
    icon: CircleDollarSign,
    group: "business",
    advanced: true,
  },
  {
    id: "marketing",
    label: "Marketing Tools",
    href: "/marketing/scoutfitters",
    description: "Open TradeScout marketing and promotion tools.",
    icon: Megaphone,
    group: "business",
  },
  {
    id: "analytics",
    label: "Analytics",
    href: "/analytics",
    description: "Review activity, outcomes, and business performance.",
    icon: BarChart3,
    group: "business",
  },
  {
    id: "homes",
    label: "Homes & Assets",
    href: "/homes",
    description: "Track inspections, maintenance, upgrades, and property history.",
    icon: Home,
    group: "assets",
  },
  {
    id: "vehicles",
    label: "Vehicles",
    href: "/vehicles",
    description: "Manage vehicle records and related activity.",
    icon: Wrench,
    group: "assets",
  },
  {
    id: "community",
    label: "Community",
    href: "/community",
    description: "See nearby posts, updates, groups, and local conversations.",
    icon: Users,
    group: "community",
    aliases: ["/community-feed"],
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    href: "/leaderboard",
    description: "See local activity and trust momentum.",
    icon: Trophy,
    group: "community",
    advanced: true,
  },
  {
    id: "community-builders",
    label: "Community Builders",
    href: "/foundation",
    description: "See community funding, contributions, and local impact.",
    icon: Heart,
    group: "community",
    advanced: true,
  },
  {
    id: "profile",
    label: "My Profile",
    href: "/profile",
    description: "Manage account identity and profile information.",
    icon: Users,
    group: "account",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    description: "Manage preferences, privacy, security, and application settings.",
    icon: Settings,
    group: "account",
  },
];

export const PRIMARY_PRODUCT_NAV_IDS = [
  "scout",
  "requests",
  "businesses",
  "jobs",
  "community",
] as const;

export function getProductNavGroup(groupId: ProductNavGroupId): ProductNavItem[] {
  return PRODUCT_NAV_ITEMS.filter((item) => item.group === groupId);
}

export function isProductNavItemActive(item: ProductNavItem, pathname: string): boolean {
  const pathOnly = pathname.split("?")[0].split("#")[0] || "/";
  const paths = [item.href, ...(item.aliases ?? [])];
  return paths.some((candidate) => pathOnly === candidate || pathOnly.startsWith(`${candidate}/`));
}
