import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { useAuth } from "@/hooks/useAuth";
import { getRolePermissions, getRoleDisplayName } from "@shared/roles";
import type { UserRole } from "@shared/roles";
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
  LogOut
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
    label: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  
  // Exchange Features (avoid duplicating what's in main nav)
  {
    label: "Exchange",
    href: "/exchange",
    icon: Briefcase,
    children: [
      { label: "Browse Exchange", href: "/exchange", icon: Briefcase },
      { label: "Real Estate", href: "/real-estate-marketplace", icon: Building },
      { label: "Business Listing", href: "/business-listing", icon: Building },
    ],
  },
  
  // Service Provider Features
  {
    label: "Contractor Tools",
    href: "/contractor-dashboard",
    icon: Hammer,
    requiredRoles: ['contractor_user', 'accelerator_member'],
    children: [
      { label: "Dashboard", href: "/contractor-dashboard", icon: Home },
      { label: "Accelerator", href: "/accelerator", icon: Star },
      { label: "Promotions", href: "/promotions", icon: Star },
      { label: "Growth Pack", href: "/growth-pack", icon: UserPlus },
    ],
  },
  
  // Professional Services
  {
    label: "Realtor Tools",
    href: "/realtor-application",
    icon: Building,
    requiredRoles: ['realtor'],
  },
  {
    label: "Auto Sales",
    href: "/car-salesman-application", 
    icon: Car,
    requiredRoles: ['car_salesman'],
  },
  
  // Community Features (avoid duplicating what's in main nav)
  {
    label: "Foundation",
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
  
  // Admin Features
  {
    label: "Admin Panel",
    href: "/admin/panel",
    icon: Settings,
    requiredPermission: "canAccessAdminPanel",
    children: [
      { label: "Dashboard", href: "/admin-panel", icon: Home },
      { label: "Panel", href: "/admin/panel", icon: Settings },
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Analytics", href: "/admin/workspace", icon: BarChart },
      { label: "Error Reports", href: "/admin/error-reports", icon: FileText },
      { label: "Testing", href: "/admin/testing", icon: Settings },
      { label: "Listings", href: "/admin/listings", icon: Briefcase },
      { label: "Verification", href: "/admin/professional-verification", icon: Shield },
    ],
  },
  
  // Account Features - These should be embedded elsewhere, not in header navigation
];

interface RoleBasedNavigationProps {
  isMobile?: boolean;
}

export function RoleBasedNavigation({ isMobile = false }: RoleBasedNavigationProps) {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();

  if (!isAuthenticated || !user) {
    return null;
  }

  const userRole = user.role as UserRole;
  const permissions = getRolePermissions(userRole);

  const isItemVisible = (item: NavigationItem): boolean => {
    // Check role requirements
    if (item.requiredRoles && !item.requiredRoles.includes(userRole)) {
      return false;
    }
    
    // Check permission requirements
    if (item.requiredPermission && !permissions[item.requiredPermission]) {
      return false;
    }
    
    return true;
  };

  const isItemActive = (href: string): boolean => {
    if (href === "/" || href === "/dashboard") {
      return location === "/" || location === "/dashboard";
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
            <p className="font-medium text-sm">{user.firstName} {user.lastName}</p>
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
                        {child.badge && <Badge variant="secondary" className="ml-auto text-xs">{child.badge}</Badge>}
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
                  {item.badge && <Badge variant="secondary" className="ml-auto text-xs">{item.badge}</Badge>}
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
                  <DropdownMenuItem key={childIndex} asChild>
                    <Link href={child.href} className="flex items-center gap-2 cursor-pointer">
                      <child.icon className="h-4 w-4" />
                      {child.label}
                      {child.badge && <Badge variant="secondary" className="ml-auto text-xs">{child.badge}</Badge>}
                    </Link>
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
                {item.badge && <Badge variant="secondary" className="ml-1 text-xs">{item.badge}</Badge>}
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

  if (!isAuthenticated || !user) {
    return null;
  }

  const userRole = user.role as UserRole;

  const handleLogout = async () => {
    try {
      const response = await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2" data-profile-dropdown data-tutorial="profile-dropdown-tour">
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium">{user.firstName} {user.lastName}</span>
            <RoleBadge role={userRole} size="sm" />
          </div>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <span className="font-medium">{user.firstName} {user.lastName}</span>
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <RoleBadge role={userRole} size="sm" />
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="flex items-center gap-3 cursor-pointer text-slate-200 hover:text-white px-3 py-2 hover:bg-slate-700/60" data-profile-link data-tutorial="profile-access">
            <Users className="h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-slate-700" />
        <DropdownMenuItem asChild>
          <Link href="/notifications" className="flex items-center gap-3 cursor-pointer text-slate-200 hover:text-white px-3 py-2 hover:bg-slate-700/60">
            <Bell className="h-4 w-4" />
            Notifications
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/chat" className="flex items-center gap-3 cursor-pointer text-slate-200 hover:text-white px-3 py-2 hover:bg-slate-700/60">
            <MessageSquare className="h-4 w-4" />
            Messages
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/chat" className="flex items-center gap-3 cursor-pointer text-slate-200 hover:text-white px-3 py-2 hover:bg-slate-700/60">
            <MessageSquare className="h-4 w-4" />
            Conversations
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/saved-ads" className="flex items-center gap-3 cursor-pointer text-slate-200 hover:text-white px-3 py-2 hover:bg-slate-700/60">
            <Star className="h-4 w-4" />
            Saved Ads
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-slate-700" />
        <DropdownMenuItem asChild>
          <Link href="/payment-history" className="flex items-center gap-3 cursor-pointer text-slate-200 hover:text-white px-3 py-2 hover:bg-slate-700/60">
            <CreditCard className="h-4 w-4" />
            Payment History
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-slate-700" />
        <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-3 cursor-pointer text-red-400 hover:text-red-300 px-3 py-2 hover:bg-red-500/10">
          <LogOut className="h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}