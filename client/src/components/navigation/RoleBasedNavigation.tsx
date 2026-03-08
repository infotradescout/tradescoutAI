import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { useAuth, logoutUser } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { safeNavigate } from "@/lib/safeNavigate";
import { getRolePermissions, getRoleDisplayName } from "@shared/roles";
import type { UserRole } from "@shared/roles";
import { hasAdminUiAccess } from "@/lib/roleChecks";
import {
  Home,
  Users,
  Settings,
  Shield,
  BarChart,
  MessageSquare,
  Briefcase,
  Building,
  Car,
  Heart,
  CreditCard,
  Search,
  Bell,
  Star,
  UserPlus,
  FileText,
  Hammer,
  TreePine,
  Zap,
  Droplet,
  Paintbrush,
  Menu,
  ChevronDown,
  LogOut,
  HelpCircle,
} from "lucide-react";

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredRoles?: UserRole[];
  requiredPermission?: keyof ReturnType<typeof getRolePermissions>;
  badge?: string;
  children?: NavigationItem[];
}

const NAVIGATION_ITEMS: NavigationItem[] = [
  // Dashboard/Home
  {
    label: "Scout",
    href: "/scout",
    icon: Home,
  },

  // Exchange Features (avoid duplicating what's in main nav)
  {
    label: "Exchange",
    href: "/exchange",
    icon: Briefcase,
    children: [
      { label: "Browse Exchange", href: "/exchange", icon: Briefcase },
      { label: "Business Listing", href: "/business-listing", icon: Building },
    ],
  },

  // HomeScout: real estate portal (separate from Exchange)
  {
    label: "HomeScout",
    href: "/real-estate-marketplace",
    icon: Building,
    children: [{ label: "Browse Homes", href: "/real-estate-marketplace", icon: Building }],
  },

  // Service Provider Features
  {
    label: "Contractor Tools",
    href: "/contractor-dashboard",
    icon: Hammer,
    requiredRoles: ["contractor_user"],
    children: [
      { label: "Dashboard", href: "/contractor-dashboard", icon: Home },
      // Accelerator entry removed
      { label: "Promotions", href: "/promotions", icon: Star },
      // Growth Pack entry removed
    ],
  },

  // Professional Services
  {
    label: "Realtor Tools",
    href: "/realtor-application",
    icon: Building,
    requiredRoles: ["realtor"],
  },
  {
    label: "Auto Sales",
    href: "/car-salesman-application",
    icon: Car,
    requiredRoles: ["car_salesman"],
  },

  // Community Features (avoid duplicating what's in main nav)
  {
    label: "Community Builders",
    href: "/foundation",
    icon: Heart,
  },

  // Communication - These should be embedded elsewhere, not in header navigation

  // Staff & Moderation
  {
    label: "Moderation",
    href: "/content-moderation",
    icon: Shield,
    requiredPermission: "canModerateContent",
  },

  // Admin OS (single entry point)
  {
    label: "Admin Operations",
    href: "/admin",
    icon: Settings,
    requiredPermission: "canAccessAdminPanel",
  },

  // Account Features - These should be embedded elsewhere, not in header navigation
];

interface RoleBasedNavigationProps {
  isMobile?: boolean;
}

export function RoleBasedNavigation({ isMobile = false }: RoleBasedNavigationProps) {
  const { user, isAuthenticated } = useAuth();
  const [location, navigate] = useLocation();

  if (!isAuthenticated || !user) {
    return null;
  }

  const toKnownRole = (role: string): UserRole | null => {
    const normalized = (
      role === "owner" || role === "head_admin" ? "super_admin" : role
    ) as UserRole;
    return getRoleDisplayName(normalized) !== normalized || normalized === "homeowner"
      ? normalized
      : null;
  };

  const rawRoleTokens = Array.from(
    new Set(
      [user.activeRole, user.role, ...(Array.isArray(user.roles) ? user.roles : [])]
        .map((role) => (typeof role === "string" ? role.trim() : ""))
        .filter(Boolean)
    )
  );
  const normalizedRoleTokens = rawRoleTokens
    .map((role) => toKnownRole(role))
    .filter((role): role is UserRole => Boolean(role));
  const fallbackRole = normalizedRoleTokens[0] || "homeowner";
  const userRole = fallbackRole as UserRole;
  const hasAdminAccess = hasAdminUiAccess(user);
  const isCommunityFirst = Boolean((user as any)?.communityFirst);
  const permissions = normalizedRoleTokens.reduce(
    (merged, roleToken) => {
      const role = roleToken as UserRole;
      const rolePermissions = getRolePermissions(role);
      (Object.keys(rolePermissions) as Array<keyof typeof rolePermissions>).forEach((key) => {
        merged[key] = merged[key] || rolePermissions[key];
      });
      return merged;
    },
    { ...getRolePermissions(userRole) }
  );

  const isItemVisible = (item: NavigationItem): boolean => {
    // For community-first pilot users, soft-hide role hub/identity-heavy nav groups
    if (
      isCommunityFirst &&
      (item.href === "/contractor-dashboard" ||
        item.href === "/realtor-application" ||
        item.href === "/car-salesman-application")
    ) {
      return false;
    }

    // Check role requirements
    if (
      item.requiredRoles &&
      !item.requiredRoles.some((role) => normalizedRoleTokens.includes(role))
    ) {
      return false;
    }

    // Check permission requirements
    if (item.requiredPermission === "canAccessAdminPanel" && !hasAdminAccess) {
      return false;
    }
    if (
      item.requiredPermission &&
      item.requiredPermission !== "canAccessAdminPanel" &&
      !permissions[item.requiredPermission]
    ) {
      return false;
    }

    return true;
  };

  const isItemActive = (href: string): boolean => {
    if (href === "/" || href === "/scout") {
      return location === "/" || location === "/scout";
    }
    return location.startsWith(href);
  };

  const visibleItems = NAVIGATION_ITEMS.filter(isItemVisible);

  if (isMobile) {
    return (
      <div className="flex flex-col space-y-2 p-4">
        {/* User Info */}
        <div className="flex items-center space-x-3 p-3 bg-secondary/50 rounded-lg mb-4">
          <div className="flex-1">
            <p className="font-medium text-sm">
              {user.firstName} {user.lastName}
            </p>
            <RoleBadge role={userRole} size="sm" />
          </div>
        </div>

        {/* Navigation Items */}
        {visibleItems.map((item, index) => (
          <div key={index}>
            {item.children ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
                <div className="ml-4 space-y-1">
                  {item.children.filter(isItemVisible).map((child, childIndex) => (
                    <Link key={childIndex} href={child.href}>
                      <Button
                        variant={isItemActive(child.href) ? "secondary" : "ghost"}
                        className="w-full justify-start text-sm"
                        size="sm"
                      >
                        <child.icon className="h-4 w-4 mr-2" />
                        {child.label}
                        {child.badge && (
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {child.badge}
                          </Badge>
                        )}
                      </Button>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link href={item.href}>
                <Button
                  variant={isItemActive(item.href) ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  size="sm"
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.label}
                  {item.badge && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {item.badge}
                    </Badge>
                  )}
                </Button>
              </Link>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <nav className="flex items-center space-x-1">
      {/* Main Navigation */}
      {visibleItems.map((item, index) => (
        <div key={index}>
          {item.children ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-1">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {item.children.filter(isItemVisible).map((child, childIndex) => (
                  <DropdownMenuItem
                    key={childIndex}
                    onSelect={() => safeNavigate(navigate, child.href)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <child.icon className="h-4 w-4" />
                    {child.label}
                    {child.badge && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {child.badge}
                      </Badge>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href={item.href}>
              <Button
                variant={isItemActive(item.href) ? "secondary" : "ghost"}
                className="flex items-center gap-1"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {item.badge && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {item.badge}
                  </Badge>
                )}
              </Button>
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}

// User menu with role display and logout
export function UserMenu() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [location, navigate] = useLocation();

  if (!isAuthenticated || !user) {
    return null;
  }

  const userRole = user.role as UserRole;

  const handleLogout = async () => {
    await logoutUser();
  };

  const isVerified = user.emailVerified === true;

  const resendVerification = async () => {
    const email = String(user.email || "").trim();
    if (!email) return;
    try {
      const resp = await apiRequest("POST", "/api/auth/request-email-verification", { email });
      toast({
        title: "Verification email requested",
        description: resp?.message || "If an account exists, a new link has been sent.",
      });
      if ((resp as any)?.verificationToken) {
        console.warn("[EMAIL-VERIFY] Dev token:", (resp as any).verificationToken);
      }
    } catch (err: any) {
      toast({
        title: "Resend failed",
        description: formatUserFacingErrorMessage(err, "Please try again."),
        variant: "destructive",
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2"
          data-profile-dropdown
          data-tutorial="profile-dropdown-tour"
        >
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium">
              {user.firstName} {user.lastName}
            </span>
            <RoleBadge role={userRole} size="sm" />
          </div>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <span className="font-medium">
              {user.firstName} {user.lastName}
            </span>
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <span className="text-xs text-muted-foreground">
              Email: {isVerified ? "Verified" : "Not verified"}
            </span>
            <RoleBadge role={userRole} size="sm" />
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!isVerified && (
          <>
            <DropdownMenuItem onClick={resendVerification} className="cursor-pointer">
              <UserPlus className="h-4 w-4 mr-2" />
              Resend verification
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                const href = `/check-email?email=${encodeURIComponent(
                  String(user.email || "").trim()
                )}&next=${encodeURIComponent(location || "/")}`;
                safeNavigate(navigate, href);
              }}
              className="flex items-center gap-3 cursor-pointer px-3 py-2"
            >
              <Settings className="h-4 w-4" />
              Check email status
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
          </>
        )}
        <DropdownMenuItem
          onSelect={() => safeNavigate(navigate, "/profile")}
          className="flex items-center gap-3 cursor-pointer text-white/70 hover:text-white px-3 py-2 hover:bg-white/10"
          data-profile-link
          data-tutorial="profile-access"
        >
          <Users className="h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          onSelect={() => safeNavigate(navigate, "/notifications")}
          className="flex items-center gap-3 cursor-pointer text-white/70 hover:text-white px-3 py-2 hover:bg-white/10"
        >
          <Bell className="h-4 w-4" />
          Notifications
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => safeNavigate(navigate, "/chat")}
          className="flex items-center gap-3 cursor-pointer text-white/70 hover:text-white px-3 py-2 hover:bg-white/10"
        >
          <MessageSquare className="h-4 w-4" />
          Messages
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => safeNavigate(navigate, "/conversations")}
          className="flex items-center gap-3 cursor-pointer text-white/70 hover:text-white px-3 py-2 hover:bg-white/10"
        >
          <MessageSquare className="h-4 w-4" />
          Conversations
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => safeNavigate(navigate, "/connections")}
          className="flex items-center gap-3 cursor-pointer text-white/70 hover:text-white px-3 py-2 hover:bg-white/10"
        >
          <Users className="h-4 w-4" />
          Connections
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => safeNavigate(navigate, "/saved-ads")}
          className="flex items-center gap-3 cursor-pointer text-white/70 hover:text-white px-3 py-2 hover:bg-white/10"
        >
          <Star className="h-4 w-4" />
          Saved Ads
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          onSelect={() => safeNavigate(navigate, "/payment-history")}
          className="flex items-center gap-3 cursor-pointer text-white/70 hover:text-white px-3 py-2 hover:bg-white/10"
        >
          <CreditCard className="h-4 w-4" />
          Payment History
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          onSelect={() => safeNavigate(navigate, "/settings")}
          className="flex items-center gap-3 cursor-pointer text-white/70 hover:text-white px-3 py-2 hover:bg-white/10"
          data-tutorial="settings-access"
        >
          <Settings className="h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => safeNavigate(navigate, "/help")}
          className="flex items-center gap-3 cursor-pointer text-white/70 hover:text-white px-3 py-2 hover:bg-white/10"
        >
          <HelpCircle className="h-4 w-4" />
          Help Center
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          onClick={handleLogout}
          className="flex items-center gap-3 cursor-pointer text-red-400 hover:text-red-300 px-3 py-2 hover:bg-red-500/10"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
