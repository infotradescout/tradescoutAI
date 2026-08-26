import { memo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { safeNavigate } from "@/lib/safeNavigate";
import { hasAdminUiAccess, hasBusinessProviderToolAccess } from "@/lib/roleChecks";
import { getRolePermissions } from "@shared/roles";
import type { UserRole } from "@shared/roles";
import {
  Home,
  Users,
  Search,
  Bell,
  MessageSquare,
  Settings,
  Shield,
  BarChart,
  Briefcase,
  Building,
  Car,
  Heart,
  CreditCard,
  Star,
  UserPlus,
  FileText,
  Hammer,
  Calendar,
  ShoppingBag,
  TrendingUp,
  Award,
  DollarSign,
  Package,
  Truck,
  HomeIcon,
  MapPin,
  ChevronDown,
  Menu,
  X,
  Zap,
  Users as GroupIcon,
  Building2,
  LayoutDashboard,
  Target,
  Megaphone,
  Percent,
  Gift,
  ChartBar,
  UserCheck,
  ClipboardList,
  Wrench,
  PaintBucket,
  Droplets,
  TreePine,
  Lightbulb,
  Wind,
  Flame,
  Snowflake,
  Sparkles,
  BadgeCheck,
  FileCheck,
  Calculator,
  Tags,
  Filter,
  PlusCircle,
  ListChecks,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
  requiresBusinessProvider?: boolean;
  permission?: keyof ReturnType<typeof getRolePermissions>;
  children?: NavItem[];
}

// Complete navigation structure for ALL features
const ALL_NAVIGATION: NavItem[] = [
  // CORE PLATFORM
  {
    label: "Direct Connect",
    href: "/direct-connect",
    icon: ClipboardList,
  },
  {
    label: "Community",
    href: "/community",
    icon: Users,
    children: [
      { label: "Community Feed", href: "/community", icon: Users },
      { label: "Groups", href: "/groups", icon: GroupIcon },
      {
        label: "Events",
        href: "/community-feed?compose=1&category=event",
        icon: Calendar,
      },
      { label: "Leaderboard", href: "/leaderboard", icon: Award },
    ],
  },

  // LOCAL BUSINESSES
  {
    label: "Local Businesses",
    href: "/direct-connect",
    icon: Hammer,
    children: [
      { label: "Find Local Help", href: "/direct-connect", icon: Search },
      // { label: 'Scout Estimates', href: '/scout?intent=estimate', icon: Calculator }, // Hidden from nav, contextual only
      { label: "Top Providers", href: "/contractors/top", icon: Award },
    ],
  },

  // BUSINESS PROVIDER TOOLS
  {
    label: "Business Dashboard",
    href: "/business-dashboard",
    icon: Wrench,
    requiresBusinessProvider: true,
    children: [
      { label: "Dashboard", href: "/business-dashboard", icon: LayoutDashboard },
      {
        label: "Local Requests",
        href: "/direct-connect/inbox",
        icon: ClipboardList,
        requiresBusinessProvider: true,
      },
      {
        label: "My Projects",
        href: "/direct-connect/inbox",
        icon: ListChecks,
        requiresBusinessProvider: true,
      },
      {
        label: "Promotions",
        href: "/promotions",
        icon: Megaphone,
        requiresBusinessProvider: true,
      },
      {
        label: "Performance Analytics",
        href: "/business-dashboard",
        icon: ChartBar,
        requiresBusinessProvider: true,
      },
      {
        label: "Recommendations & Trust (CVS)",
        href: "/business-dashboard",
        icon: Star,
        requiresBusinessProvider: true,
      },
      {
        label: "Claim or Create Business",
        href: "/claim-my-business?source=comprehensive_navigation",
        icon: UserPlus,
      },
    ],
  },

  // EXCHANGE LISTINGS (legacy marketplace routes)
  {
    label: "Exchange",
    href: "/marketplace",
    icon: ShoppingBag,
    children: [
      { label: "Browse Exchange", href: "/marketplace", icon: ShoppingBag },
      { label: "Vehicles", href: "/vehicle-marketplace", icon: Car },
      { label: "Handmade & Crafts", href: "/handmade-marketplace", icon: Sparkles },
      { label: "TradeDeals Directory", href: "/trade-deals", icon: Tags },
      { label: "My Listings", href: "/marketplace/new", icon: FileText },
      { label: "Saved Items", href: "/saved-ads", icon: Heart },
    ],
  },

  // HOMESCOUT (Real Estate Portal) - separate from Exchange
  {
    label: "HomeScout Listings",
    href: "/homescout-listings",
    icon: Building,
    children: [
      { label: "HomeScout Listings", href: "/homescout-listings", icon: Building },
      {
        label: "HomeScout Listings",
        href: "/exchange?tab=sell&category=real-estate",
        icon: Building,
      },
    ],
  },

  // EXCHANGE TOOLS
  {
    label: "Exchange Tools",
    href: "/exchange",
    icon: Briefcase,
    children: [
      { label: "Browse Exchange", href: "/exchange", icon: Briefcase },
      { label: "Rental Property", href: "/exchange/rental-property", icon: Building },
      { label: "Rental Equipment", href: "/exchange/rental-equipment", icon: Briefcase },
      { label: "List Item", href: "/exchange/list", icon: PlusCircle },
      { label: "Sell a Business", href: "/exchange/sell-business", icon: Building2 },
      { label: "My Exchange Items", href: "/exchange", icon: Package },
    ],
  },

  // PROFESSIONAL DASHBOARDS
  {
    label: "Professional Tools",
    href: "#",
    icon: Briefcase,
    roles: ["realtor", "car_salesman", "insurance_agent", "mortgage_broker", "property_manager"],
    children: [
      {
        label: "Realtor Dashboard",
        href: "/realtor-dashboard",
        icon: Building,
        roles: ["realtor"],
      },
      { label: "Realtor Application", href: "/realtor-application", icon: UserPlus },
      {
        label: "Car Sales Dashboard",
        href: "/car-salesman-dashboard",
        icon: Car,
        roles: ["car_salesman"],
      },
      { label: "Car Sales Application", href: "/car-salesman-application", icon: UserPlus },
      // Dealer Dashboard deprecated in favor of action-aware flows
      { label: "Dealer Application", href: "/dealer-application", icon: UserPlus },
      // Insurance Dashboard deprecated in favor of action-aware flows
      { label: "Insurance Application", href: "/insurance-agent-application", icon: UserPlus },
      // Mortgage Dashboard deprecated in favor of action-aware flows
      { label: "Mortgage Application", href: "/mortgage-broker-application", icon: UserPlus },
      // Property Manager Dashboard deprecated in favor of action-aware flows
      {
        label: "Property Manager Application",
        href: "/property-manager-application",
        icon: UserPlus,
      },
      // Calculator and financial tools hidden from nav, contextual only
    ],
  },

  // HOA MANAGEMENT (Available for property_manager role)
  {
    label: "HOA Management",
    href: "/hoa-management",
    icon: Building2,
    roles: ["property_manager", "community_leader"],
    children: [
      { label: "HOA Dashboard", href: "/hoa-dashboard", icon: LayoutDashboard },
      { label: "HOA Management", href: "/hoa-management", icon: Building2 },
      { label: "Residents", href: "/hoa/residents", icon: Users },
      { label: "Violations", href: "/hoa/violations", icon: FileCheck },
      { label: "Maintenance Requests", href: "/hoa/maintenance", icon: Wrench },
      { label: "Documents", href: "/hoa/documents", icon: FileText },
    ],
  },

  // BUSINESS OWNER
  {
    label: "Business Owner",
    href: "/business-dashboard",
    icon: Building2,
    roles: ["business_owner"],
    children: [
      {
        label: "Business Dashboard",
        href: "/business-dashboard",
        icon: LayoutDashboard,
        roles: ["business_owner"],
      },
      { label: "Public Profile", href: "/profile", icon: Building2 },
      {
        label: "Business Analytics",
        href: "/business-dashboard",
        icon: ChartBar,
        roles: ["business_owner"],
      },
      {
        label: "Customer recommendations",
        href: "/business-dashboard",
        icon: Star,
        roles: ["business_owner"],
      },
    ],
  },

  // HELPER/WORKER
  {
    label: "Helper Marketplace",
    href: "/worker-marketplace",
    icon: Users,
    children: [
      { label: "Find Work", href: "/worker-marketplace", icon: Search },
      {
        label: "Helper Dashboard",
        href: "/helper-dashboard",
        icon: LayoutDashboard,
        roles: ["helper"],
      },
      { label: "My Jobs", href: "/helper/jobs", icon: ClipboardList, roles: ["helper"] },
    ],
  },

  // AFFILIATE PROGRAM
  {
    label: "Affiliate Program",
    href: "/affiliate",
    icon: Percent,
    children: [
      { label: "Affiliate Dashboard", href: "/affiliate", icon: LayoutDashboard },
      { label: "Referral Links", href: "/affiliate/links", icon: Target },
      { label: "Earnings", href: "/affiliate/earnings", icon: DollarSign },
      { label: "Commission History", href: "/affiliate/history", icon: ChartBar },
    ],
  },

  // COMMUNITY BUILDERS (PHILANTHROPY OS)
  {
    label: "Community Builders",
    href: "/foundation",
    icon: Heart,
  },

  // MODERATION
  {
    label: "Moderation",
    href: "/admin/moderation",
    icon: Shield,
    permission: "canModerateContent",
    children: [
      { label: "Content Moderation", href: "/admin/moderation", icon: Shield },
      { label: "Community Moderation", href: "/community-moderation", icon: Users },
      { label: "Reported Content", href: "/moderation/reports", icon: FileCheck },
    ],
  },

  // ADMIN PANEL
  {
    label: "Admin Panel",
    href: "/admin",
    icon: Settings,
    permission: "canAccessAdminPanel",
    children: [
      { label: "Admin Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Admin Panel", href: "/admin/panel", icon: Settings },
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Workspace", href: "/admin/control", icon: Building2 },
      { label: "Error Reports", href: "/admin/errors", icon: FileCheck },
      { label: "Testing Controls", href: "/admin/control", icon: Wrench },
      { label: "Address Verifications", href: "/admin/verification", icon: MapPin },
      {
        label: "Professional Verification",
        href: "/admin/professional-verification",
        icon: UserCheck,
      },
      { label: "Listings Management", href: "/admin/listings", icon: FileText },
      { label: "Attachments", href: "/admin/attachments", icon: Package },
      { label: "Pricing Analytics", href: "/admin/pricing", icon: ChartBar },
      { label: "Create Account", href: "/admin/provision-user", icon: UserPlus },
      { label: "Platform Analytics", href: "/admin/platform-analytics", icon: ChartBar },
    ],
  },

  // ACCOUNT & SETTINGS
  {
    label: "Account",
    href: "/profile",
    icon: Users,
    children: [
      { label: "My Profile", href: "/profile", icon: Users },
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Dashboard Settings", href: "/dashboard-settings", icon: LayoutDashboard },
      { label: "Notifications", href: "/notifications", icon: Bell },
      { label: "Messages", href: "/chat", icon: MessageSquare },
      { label: "Payment History", href: "/payment-history", icon: CreditCard },
      { label: "Invite Friends", href: "/invite", icon: UserPlus },
    ],
  },

  // UTILITIES
  {
    label: "More",
    href: "#",
    icon: Menu,
    children: [
      { label: "Advanced Search", href: "/advanced-search", icon: Search },
      { label: "Interactive Map", href: "/interactive-county-map", icon: MapPin },
      { label: "Nationwide Dashboard", href: "/nationwide-dashboard", icon: BarChart },
      { label: "Help & Support", href: "/help", icon: FileText },
      { label: "Story Generator", href: "/story-generator", icon: Sparkles },
    ],
  },
];

const ComprehensiveNav = memo(function ComprehensiveNav() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isCommunityFirst = Boolean((user as any)?.communityFirst);
  const isAdminUser = hasAdminUiAccess(user);

  const hasPermission = (item: NavItem): boolean => {
    if (!user) return !item.roles && !item.permission && !item.requiresBusinessProvider;

    if (item.requiresBusinessProvider && !hasBusinessProviderToolAccess(user)) {
      return false;
    }

    // Check role requirement
    if (item.roles && item.roles.length > 0) {
      const userRoles = user.roles || [user.role];
      const hasRole = item.roles.some((role) => userRoles.includes(role));
      if (!hasRole) return false;
    }

    // Check permission requirement
    if (item.permission) {
      const permissions = getRolePermissions(user.activeRole || user.role || "homeowner");
      if (!permissions[item.permission]) return false;
    }

    return true;
  };

  const filterItems = (items: NavItem[]): NavItem[] => {
    return items.filter((item) => {
      // For community-first pilot users, soft-hide identity/role hub sections
      if (
        isCommunityFirst &&
        [
          "Business Dashboard",
          "Professional Tools",
          "HOA Management",
          "Business Owner",
          "Helper Marketplace",
          "Affiliate Program",
        ].includes(item.label)
      ) {
        return false;
      }

      if (!hasPermission(item)) return false;
      if (item.children) {
        item.children = filterItems(item.children);
      }
      return true;
    });
  };

  const visibleItems = filterItems(ALL_NAVIGATION);

  const NavMenuItem = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const isActive = location === item.href;

    if (item.children && item.children.length > 0) {
      return (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Icon className="h-4 w-4 mr-2" />
            {item.label}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {item.children.map((child) => (
              <NavMenuItem key={child.href} item={child} />
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      );
    }

    return (
      <DropdownMenuItem
        onSelect={() => safeNavigate(navigate, item.href)}
        className="cursor-pointer"
      >
        <Icon className="h-4 w-4 mr-2" />
        <span className={isActive ? "font-semibold text-ts-orange" : ""}>{item.label}</span>
      </DropdownMenuItem>
    );
  };

  return (
    <div className="bg-white dark:bg-white/5 border-b border-white/10 dark:border-white/10 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href={isAdminUser ? "/admin" : "/direct-connect"}>
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">T</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
                TradeScout
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-2">
            {visibleItems.slice(0, 6).map((item) => {
              if (item.children && item.children.length > 0) {
                return (
                  <DropdownMenu key={item.label}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-1">
                        <item.icon className="h-4 w-4" />
                        {item.label}
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      {item.children.map((child) => (
                        <NavMenuItem key={child.href} item={child} />
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={location === item.href ? "default" : "ghost"}
                    size="sm"
                    className={
                      location === item.href ? "bg-ts-orange-dark hover:bg-ts-orange-dark" : ""
                    }
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}

            {/* All Features Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  <Menu className="h-4 w-4" />
                  All Features
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 max-h-[600px] overflow-y-auto">
                <DropdownMenuLabel>Complete Platform Access</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {visibleItems.map((item) => (
                  <NavMenuItem key={item.href || item.label} item={item} />
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-white/10 dark:border-white/10 py-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              {visibleItems.map((item) => {
                if (item.children && item.children.length > 0) {
                  return (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white/70 dark:text-white/70">
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </div>
                      <div className="pl-8 space-y-1">
                        {item.children.map((child) => (
                          <Link key={child.href} href={child.href}>
                            <div
                              className={`flex items-center gap-2 px-4 py-2 text-sm hover:bg-white/5 dark:hover:bg-white/10 rounded-lg transition-colors ${
                                location === child.href
                                  ? "bg-ts-orange/10 dark:bg-ts-orange/10 text-ts-orange font-medium"
                                  : ""
                              }`}
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              <child.icon className="h-4 w-4" />
                              {child.label}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                }

                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={`flex items-center gap-2 px-4 py-2 text-sm hover:bg-white/5 dark:hover:bg-white/10 rounded-lg transition-colors ${
                        location === item.href
                          ? "bg-ts-orange/10 dark:bg-ts-orange/10 text-ts-orange font-medium"
                          : ""
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default ComprehensiveNav;
