import type { LucideIcon } from "lucide-react";
import {
  BarChart3, Bookmark, Building, CircleDollarSign, CircleHelp, ClipboardList, Compass,
  FileText, FolderKanban, Heart, Home, Map, Megaphone, MessageCircle, Settings, Share2,
  ShoppingBag, Trophy, Users, Wallet, Wrench,
} from "lucide-react";

export type ProductNavGroupId = "core" | "discover" | "work" | "business" | "assets" | "community" | "account";
export type ProductNavItem = {
  id: string;
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
  group: ProductNavGroupId;
  aliases?: string[];
  keywords?: string[];
  advanced?: boolean;
};

export const PRODUCT_NAV_GROUPS: Array<{ id: ProductNavGroupId; label: string; description: string }> = [
  { id: "core", label: "Start & request", description: "Get help and keep track of requests." },
  { id: "discover", label: "Discover", description: "Find businesses, employment, listings, and local offers." },
  { id: "work", label: "Work", description: "Conversations, projects, and commercial opportunities." },
  { id: "business", label: "Business", description: "Run your business and manage its finances." },
  { id: "assets", label: "Homes & assets", description: "Property records, maintenance, and vehicles." },
  { id: "community", label: "Community", description: "Local people, groups, and community contributions." },
  { id: "account", label: "Account & tools", description: "Saved items, notes, preferences, and support." },
];

// Presentation only. Every destination retains its existing route and server access checks.
export const PRODUCT_NAV_ITEMS: ProductNavItem[] = [
  { id: "scout", label: "Scout", href: "/scout", description: "Describe a need and find your next step.", icon: Compass, group: "core" },
  { id: "requests", label: "Requests", href: "/direct-connect", description: "Create requests, review replies, and continue accepted work.", icon: ClipboardList, group: "core", aliases: ["/direct-connect/active", "/direct-connect/inbox"], keywords: ["direct connect", "incoming", "outgoing"] },
  { id: "businesses", label: "Businesses", href: "/contractors", description: "Find businesses by service, location, and trust signals.", icon: Building, group: "discover", aliases: ["/find-local-businesses", "/directory/businesses", "/direct-connect/pros"], keywords: ["contractors", "providers", "fabricators"] },
  { id: "jobs", label: "Jobs", href: "/direct-connect/opportunities", description: "Find employment, hire, post a resume, and review applicants.", icon: Wrench, group: "discover", aliases: ["/direct-connect/employment"], keywords: ["employment", "hiring", "resumes"] },
  { id: "exchange", label: "Exchange", href: "/exchange", description: "Buy, sell, rent, and browse listings.", icon: ShoppingBag, group: "discover", keywords: ["marketplace", "materials", "equipment", "real estate"] },
  { id: "maps", label: "Maps", href: "/maps", description: "Explore local businesses and service coverage.", icon: Map, group: "discover", advanced: true },
  { id: "projects", label: "Projects", href: "/project-tracker", description: "Track active work, milestones, and project progress.", icon: FolderKanban, group: "work", aliases: ["/lead-management"] },
  { id: "messages", label: "Messages", href: "/messages", description: "Continue conversations, quotes, and follow-ups.", icon: MessageCircle, group: "work" },
  { id: "commercial-work", label: "Commercial Work", href: "/commercial-directory", description: "Review commercial projects and bid packages.", icon: Building, group: "work" },
  { id: "business-home", label: "My Business", href: "/business-dashboard", description: "Manage business activity, requests, and business information.", icon: Building, group: "business", aliases: ["/contractor-dashboard"] },
  { id: "finances", label: "Finances", href: "/finances", description: "Open invoices, expenses, records, reports, clients, and payroll.", icon: Wallet, group: "business", aliases: ["/accounting"] },
  { id: "share", label: "Share", href: "/share", description: "Find and share your attributable TradeScout links.", icon: Share2, group: "business", aliases: ["/affiliate"], advanced: true },
  { id: "trade-deals", label: "TradeDeals", href: "/trade-deals", description: "Review partner offers and active campaigns.", icon: CircleDollarSign, group: "discover", advanced: true },
  { id: "marketing", label: "ScoutFitters", href: "/marketing/scoutfitters", description: "Open branded merchandise and marketing tools.", icon: Megaphone, group: "business", keywords: ["marketing", "merch", "promotions"] },
  { id: "analytics", label: "Analytics", href: "/analytics", description: "Open business activity and performance in My Business.", icon: BarChart3, group: "business" },
  { id: "homes", label: "Homes & Assets", href: "/homes", description: "Track inspections, maintenance, upgrades, and property history.", icon: Home, group: "assets", keywords: ["homeid", "asset management", "property"] },
  { id: "vehicles", label: "Vehicles", href: "/vehicles", description: "Manage vehicle records and related activity.", icon: Wrench, group: "assets" },
  { id: "community", label: "Community", href: "/community", description: "Read and share nearby posts and local updates.", icon: Users, group: "community", aliases: ["/community-feed"] },
  { id: "leaderboard", label: "Leaderboard", href: "/leaderboard", description: "See local activity and trust signals.", icon: Trophy, group: "community", advanced: true },
  { id: "community-builders", label: "Community Builders", href: "/foundation", description: "See community funding, contributions, and local impact.", icon: Heart, group: "community", advanced: true },
  { id: "profile", label: "My Profile", href: "/profile", description: "Manage your account identity and profile information.", icon: Users, group: "account" },
  { id: "settings", label: "Settings", href: "/settings", description: "Manage preferences, privacy, security, and settings.", icon: Settings, group: "account" },
  { id: "invoices", label: "Invoices", href: "/finances/invoices", description: "Create invoices and review their status.", icon: FileText, group: "business" },
  { id: "expenses", label: "Expenses", href: "/finances/expenses", description: "Track costs and receipts.", icon: Wallet, group: "business" },
  { id: "clients", label: "Clients & CRM", href: "/finances/clients", description: "Manage client records and follow-ups.", icon: Users, group: "business", aliases: ["/crm"] },
  { id: "estimates", label: "Estimates", href: "/finances/estimates", description: "Prepare and manage estimates.", icon: FileText, group: "business", keywords: ["quotes", "pricing"] },
  { id: "materials", label: "Materials", href: "/finances/materials", description: "Manage material records and costs.", icon: ShoppingBag, group: "business" },
  { id: "job-records", label: "Job Records", href: "/finances/jobs", description: "Review work and its financial records.", icon: FolderKanban, group: "business" },
  { id: "employees", label: "Employees", href: "/finances/employees", description: "Manage employee records.", icon: Users, group: "business" },
  { id: "payroll", label: "Payroll", href: "/finances/payroll", description: "Open payroll tools and records.", icon: Wallet, group: "business" },
  { id: "vendors", label: "Vendors", href: "/finances/vendors", description: "Manage suppliers and vendor records.", icon: Building, group: "business" },
  { id: "bank-accounts", label: "Bank Accounts", href: "/finances/bank-accounts", description: "Manage finance account records.", icon: Wallet, group: "business" },
  { id: "reports", label: "Financial Reports", href: "/finances/reports", description: "Review business financial reporting.", icon: BarChart3, group: "business" },
  { id: "records", label: "Financial Records", href: "/finances/records", description: "Review the financial activity timeline.", icon: ClipboardList, group: "business" },
  { id: "finance-settings", label: "Finance Settings", href: "/finances/settings", description: "Set finance preferences and defaults.", icon: Settings, group: "business" },
  { id: "groups", label: "Groups", href: "/groups", description: "Find and participate in community groups.", icon: Users, group: "community" },
  { id: "hoa", label: "HOA & Neighborhood", href: "/hoa-dashboard", description: "Open your neighborhood and HOA workspace.", icon: Home, group: "community" },
  { id: "hoa-management", label: "HOA Management", href: "/hoa-management", description: "Manage neighborhood operations.", icon: Building, group: "community" },
  { id: "connections", label: "Approved Contacts", href: "/connections", description: "Find the people you are connected with.", icon: Users, group: "work" },
  { id: "supply-run", label: "Supply Run", href: "/utilities/supply-run", description: "Plan and track supply requests.", icon: ShoppingBag, group: "work", keywords: ["procurement", "suppliers"] },
  { id: "saved-items", label: "Saved Items", href: "/saved-ads", description: "Return to saved listings and items.", icon: Bookmark, group: "account" },
  { id: "saved-businesses", label: "Saved Businesses", href: "/saved-contractors", description: "Return to businesses you saved.", icon: Bookmark, group: "account" },
  { id: "notes", label: "Notes", href: "/notes", description: "Open your notes and editing workspace.", icon: FileText, group: "account" },
  { id: "notifications", label: "Notifications", href: "/notifications", description: "Review updates and activity.", icon: MessageCircle, group: "account" },
  { id: "profile-settings", label: "Profile Settings", href: "/profile-settings", description: "Manage profile appearance and visibility.", icon: Settings, group: "account" },
  { id: "help", label: "Help", href: "/help", description: "Find support and how-to guidance.", icon: CircleHelp, group: "account" },
  { id: "resources", label: "Resource Center", href: "/resource-center", description: "Find guides and reference materials.", icon: FileText, group: "account" },
];

export const PRIMARY_PRODUCT_NAV_IDS = ["scout", "requests", "businesses", "jobs", "community"] as const;
export const DESKTOP_PRODUCT_NAV_IDS = [...PRIMARY_PRODUCT_NAV_IDS, "exchange", "share"] as const;

export function getProductNavGroup(groupId: ProductNavGroupId): ProductNavItem[] {
  return PRODUCT_NAV_ITEMS.filter((item) => item.group === groupId);
}

function pathOnly(value: string): string {
  return (value.split(/[?#]/, 1)[0] || "/").replace(/\/+$/, "") || "/";
}

/** The most-specific destination wins, so Jobs never also selects Requests. */
export function getActiveProductNavItem(
  pathname: string,
  items: readonly ProductNavItem[] = PRODUCT_NAV_ITEMS
): ProductNavItem | undefined {
  const current = pathOnly(pathname);
  let winner: ProductNavItem | undefined;
  let longest = -1;
  for (const item of items) {
    for (const candidate of [item.href, ...(item.aliases ?? [])]) {
      const path = pathOnly(candidate);
      if ((current === path || current.startsWith(`${path}/`)) && path.length > longest) {
        winner = item;
        longest = path.length;
      }
    }
  }
  return winner;
}

export function isProductNavItemActive(item: ProductNavItem, pathname: string): boolean {
  return getActiveProductNavItem(pathname)?.id === item.id;
}

function normalizeSearch(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Searches destinations only, never customer records or private business data. */
export function searchProductNavigation(query: string): ProductNavItem[] {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [...PRODUCT_NAV_ITEMS];
  return PRODUCT_NAV_ITEMS.filter((item) => {
    const group = PRODUCT_NAV_GROUPS.find((entry) => entry.id === item.group);
    const text = normalizeSearch([item.label, item.description, item.href, group?.label,
      ...(item.aliases ?? []), ...(item.keywords ?? [])].join(" "));
    return terms.every((term) => text.includes(term));
  });
}
