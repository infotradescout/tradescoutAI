import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Menu, X, ChevronDown, Home, Calculator, Users, Wrench, LayoutDashboard, ArrowLeftRight, Building, MessageSquare, MoreHorizontal, Crown, Percent, Shield, Settings, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { UserMenu } from "@/components/navigation/RoleBasedNavigation";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";
import { ContextualHelp } from "@/components/help/HelpSystem";
import { NotificationCenter } from "@/components/ui/notification-center";
import { isSuperAdminLike, isAdminTier } from "@/lib/roleChecks";

interface NextGenNavigationProps {
  className?: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: any;
  priority: number; // Higher priority = more likely to stay visible
}

export function NextGenNavigation({ className = "" }: NextGenNavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const [location] = useLocation();
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [adaptiveLayout, setAdaptiveLayout] = useState<'full' | 'compact' | 'minimal'>('full');
  const navRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Role-based navigation items with dynamic priority system
  const navItems: NavItem[] = useMemo(() => {
    const userRole = user?.role || 'homeowner';
    const isCommunityFirst = Boolean((user as any)?.communityFirst);

    // Direct Connect is the primary coordination hub; contractors/helpers
    // are still accessible from within flows but are no longer top-level
    // navigation for most users.
    const baseItems: NavItem[] = [
      { href: "/scout", label: "Scout", icon: Calculator, priority: 10 },
      { href: "/direct-connect", label: "Direct Connect", icon: LayoutDashboard, priority: 9 },
      { href: "/community", label: "Community", icon: MessageSquare, priority: isCommunityFirst ? 9 : 8 },
      { href: "/trade-deals", label: "TradeDeals", icon: Percent, priority: 7 },
      { href: "/exchange", label: "Exchange", icon: ArrowLeftRight, priority: 6 },
      ...(isAuthenticated
        ? [
            { href: isAdminTier(userRole) ? "/admin" : "/dashboard", label: isSuperAdminLike(userRole) ? "Super Admin" : "Dashboard", icon: LayoutDashboard, priority: 11 },
            { href: "/groups", label: "Groups", icon: Users, priority: 5 },
            { href: "/hoa-dashboard", label: "HOA", icon: Building, priority: 5 },
            { href: "/county-directory", label: "Area Directory", icon: Users, priority: 4 },
            { href: "/foundation", label: "Community Builders", icon: Building, priority: 3 },
            // Accelerator entry removed
            // Admin navigation for admin tier only (super_admin + ops_admin)
            ...(isAdminTier(userRole)
              ? [
                  { href: "/admin/panel", label: "Admin", icon: Shield, priority: 15 },
                  { href: "/admin/users", label: "Admin Users", icon: Settings, priority: 14 },
                ]
              : []),
          ]
        : []),
    ];

    // Adjust priorities based on user role while keeping Direct Connect
    // and Scout as the primary coordination entry points.
    if (isAdminTier(userRole)) {
      return baseItems.map((item) => {
        if (item.href === '/admin/panel') return { ...item, priority: 20 };
        if (item.href === '/admin/users') return { ...item, priority: 19 };
        if (item.href === '/dashboard') return { ...item, priority: 18 };
        return item;
      });
    }

    if (userRole === 'contractor_user' || userRole === 'accelerator_member') {
      return baseItems.map((item) => {
        if (item.href === '/dashboard') return { ...item, priority: 15 };
        if (item.href === '/direct-connect') return { ...item, priority: 14 };
        if (item.href === '/scout') return { ...item, priority: 13 };
        return item;
      });
    }

    if (userRole === 'helper') {
      return baseItems.map((item) => {
        if (item.href === '/dashboard') return { ...item, priority: 15 };
        if (item.href === '/direct-connect') return { ...item, priority: 14 };
        if (item.href === '/scout') return { ...item, priority: 13 };
        return item;
      });
    }

    if (userRole === 'moderator') {
      return baseItems.map((item) => {
        if (item.href === '/dashboard') return { ...item, priority: 15 };
        if (item.href === '/community') return { ...item, priority: 14 };
        return item;
      });
    }

    // homeowner (default)
    return baseItems.map((item) => {
      if (item.href === '/community' && isCommunityFirst) return { ...item, priority: 16 };
      if (item.href === '/dashboard' && isCommunityFirst) return { ...item, priority: 8 };
      return item;
    });
  }, [user, isAuthenticated]);

  const allPages = useMemo(() => [
    { href: "/", label: "Home", icon: Home },
    ...navItems,

    { href: "/leaderboard", label: "Leaderboard", icon: Building },
    // Growth Pack entry removed
  ], [navItems]);

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  // Simplified responsive layout calculation
  useEffect(() => {
    const calculateLayout = () => {
      if (!navRef.current || !mounted) return;

      const width = navRef.current.offsetWidth;
      setContainerWidth(width);

      // Simple, intuitive layout system
      if (width >= 900) {
        setAdaptiveLayout('full'); // Show all items with text labels
      } else if (width >= 600) {
        setAdaptiveLayout('compact'); // Show top priority items with text + others in dropdown
      } else {
        setAdaptiveLayout('minimal'); // Show only icons for top items + dropdown
      }
    };

    setMounted(true);
    const timer = setTimeout(calculateLayout, 50);
    
    // Optimized resize handling
    let resizeTimeout: NodeJS.Timeout;
    const debouncedCalculateLayout = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(calculateLayout, 100);
    };
    
    const resizeObserver = new ResizeObserver(debouncedCalculateLayout);
    
    if (navRef.current) {
      resizeObserver.observe(navRef.current);
    }

    window.addEventListener('resize', debouncedCalculateLayout);

    return () => {
      clearTimeout(timer);
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      window.removeEventListener('resize', debouncedCalculateLayout);
    };
  }, [mounted]);

  // Simplified item distribution - cleaner logic
  const { visibleItems, hiddenItems } = useMemo(() => {
    const sorted = [...navItems].sort((a, b) => b.priority - a.priority);
    
    let visible: NavItem[] = [];
    let hidden: NavItem[] = [];

    switch (adaptiveLayout) {
      case 'full':
        // Show all top priority items when there's plenty of space
        visible = sorted.slice(0, 7);
        hidden = sorted.slice(7);
        break;
      case 'compact':
        // Show only the most important items with text, others in dropdown
        visible = sorted.slice(0, 4);
        hidden = sorted.slice(4);
        break;
      case 'minimal':
        // Show only top 3 items as icons, rest in dropdown
        visible = sorted.slice(0, 3);
        hidden = sorted.slice(3);
        break;
      default:
        visible = sorted.slice(0, 4);
        hidden = sorted.slice(4);
    }

    return { visibleItems: visible, hiddenItems: hidden };
  }, [navItems, adaptiveLayout]);

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  return (
    <header className={`sticky top-0 z-50 w-full border-b border-slate-700/50 bg-slate-900/95 backdrop-blur-xl shadow-xl ${className}`}>
      <div className="w-full flex items-center justify-between px-4 py-3 lg:px-6 lg:py-4">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center space-x-2 lg:space-x-3 group transition-all duration-300">
            <div className="w-8 h-8 lg:w-9 lg:h-9 bg-slate-800 rounded-lg border border-slate-600 flex items-center justify-center group-hover:border-orange-500/50 transition-colors duration-300 overflow-hidden">
              <TradeScoutLogo 
                size="sm" 
                variant="gradient" 
                className="text-orange-500 group-hover:text-orange-400 transition-colors duration-300" 
              />
            </div>
            <span className="text-lg lg:text-xl font-bold text-white group-hover:text-orange-400 transition-colors duration-300">
              TradeScout
            </span>
          </div>
        </Link>

        {/* Revolutionary Adaptive Navigation */}
        <nav className="hidden md:flex items-center flex-1 justify-center max-w-5xl mx-4" ref={navRef} data-navigation data-tutorial="navigation-tour">
          <div className="flex items-center space-x-1 bg-slate-800/60 rounded-xl p-1.5 border border-slate-700/50 shadow-lg backdrop-blur-sm transition-all duration-300 ease-in-out">
            {/* Priority-based visible items with smooth transitions */}
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              const showTextLabel = adaptiveLayout === 'full' || adaptiveLayout === 'compact';
              
              return (
                <Link key={item.href} href={item.href}>
                  <div 
                    className={`rounded-lg text-sm font-medium transition-all duration-300 ease-in-out whitespace-nowrap border flex items-center transform hover:scale-105 ${
                      active 
                        ? "bg-orange-500 text-white border-orange-400 shadow-lg shadow-orange-500/25" 
                        : "text-slate-300 hover:text-white hover:bg-slate-700/60 border-transparent hover:border-slate-600"
                    } ${showTextLabel ? 'px-3 py-2 gap-2' : 'px-2.5 py-2'}`}
                    title={!showTextLabel ? item.label : undefined}
                    data-nav-item={item.label.toLowerCase().replace(/\s+/g, '-')} 
                    data-nav-contractors={item.href === '/contractors' ? 'true' : undefined}
                    data-nav-dashboard={item.href === '/dashboard' ? 'true' : undefined}
                    data-nav-growth={undefined}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 transition-colors duration-300 ${
                      active ? 'text-white' : 'text-orange-400'
                    }`} />
                    <span className={`transition-all duration-300 ease-in-out overflow-hidden ${
                      showTextLabel 
                        ? 'opacity-100 max-w-[120px] ml-2' 
                        : 'opacity-0 max-w-0 ml-0'
                    }`}>
                      {item.label}
                    </span>
                  </div>
                </Link>
              );
            })}
            
            {/* Smart overflow dropdown - only show when items are hidden */}
            {hiddenItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="px-2.5 py-2 text-slate-300 hover:text-white hover:bg-slate-700/60 transition-all duration-300 ease-in-out border border-transparent hover:border-slate-600 rounded-lg flex items-center transform hover:scale-105"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                    <span className={`text-xs transition-all duration-300 ease-in-out overflow-hidden ${
                      adaptiveLayout === 'full' || adaptiveLayout === 'compact'
                        ? 'opacity-100 max-w-[40px] ml-1' 
                        : 'opacity-0 max-w-0 ml-0'
                    }`}>
                      More
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className="bg-slate-800/95 border-slate-700 shadow-2xl backdrop-blur-xl min-w-48"
                  align="end"
                  sideOffset={8}
                >
                  {hiddenItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <DropdownMenuItem 
                        key={item.href} 
                        className={`cursor-pointer transition-colors duration-150 ${
                          active 
                            ? "bg-orange-500/20 text-orange-400" 
                            : "text-slate-200 hover:bg-slate-700/80 hover:text-white focus:bg-slate-700/80 focus:text-white"
                        }`}
                        asChild
                      >
                        <Link href={item.href} className="flex items-center">
                          <Icon className="w-4 h-4 mr-3 text-orange-400" />
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </nav>

        {/* Right side actions */}
        <div className="flex items-center space-x-3">
          {/* All Pages dropdown for desktop */}
          <div className="hidden lg:flex">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors duration-200"
                >
                  <Menu className="w-4 h-4 mr-2" />
                  All Pages
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                className="w-56 bg-slate-800/95 border-slate-700 shadow-2xl backdrop-blur-xl max-h-96 overflow-y-auto"
                align="end"
                sideOffset={8}
              >
                {allPages.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <DropdownMenuItem 
                      key={item.href} 
                      className={`cursor-pointer transition-colors duration-150 ${
                        active 
                          ? "bg-orange-500/20 text-orange-400" 
                          : "text-slate-200 hover:bg-slate-700/80 hover:text-white focus:bg-slate-700/80 focus:text-white"
                      }`}
                      asChild
                    >
                      <Link href={item.href} className="flex items-center">
                        <Icon className="w-4 h-4 mr-3 text-orange-400" />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Help System */}
          <ContextualHelp />

          {/* Notification Center */}
          {isAuthenticated && <NotificationCenter />}

          {/* User account button with profile picture */}
          {isAuthenticated && (
            <Link href="/profile">
              <div className="flex items-center space-x-2 bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700/50 hover:border-orange-500/50 transition-all duration-300 cursor-pointer backdrop-blur-sm">
                {user?.profileImageUrl ? (
                  <img 
                    src={user.profileImageUrl} 
                    alt="Profile"
                    className="w-7 h-7 rounded-full object-cover border border-slate-600"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.setAttribute('style', 'display: flex');
                    }}
                  />
                ) : null}
                <div className={`w-7 h-7 bg-slate-700 rounded-full flex items-center justify-center ${user?.profileImageUrl ? 'hidden' : ''}`}>
                  <Users className="w-3.5 h-3.5 text-orange-400" />
                </div>
                <span className="text-sm text-slate-300 hover:text-white transition-colors duration-200 hidden lg:inline">
                  {isSuperAdminLike(user?.role) ? 'Admin' : 'Profile'}
                </span>
              </div>
            </Link>
          )}

          {/* Mobile menu */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-slate-300 hover:text-white hover:bg-slate-700/50 p-2 transition-colors duration-200"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent 
              side="right" 
              className="w-80 bg-slate-900/98 border-slate-700 backdrop-blur-xl"
            >
              <div className="flex flex-col space-y-6 pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-white">Navigation</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div className="space-y-1">
                  {allPages.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link key={item.href} href={item.href}>
                        <div 
                          className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                            active 
                              ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" 
                              : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                          }`}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <Icon className="w-5 h-5 text-orange-400 flex-shrink-0" />
                          <span className="font-medium">{item.label}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {isAuthenticated && (
                  <div className="border-t border-slate-700 pt-6">
                    <UserMenu />
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}