import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Menu, X, ChevronDown, Home, Calculator, Users, Wrench, LayoutDashboard, ArrowLeftRight, Building, MessageSquare, MoreHorizontal } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { UserMenu } from "@/components/navigation/RoleBasedNavigation";
import { ConstructionEmblem } from "@/components/ConstructionEmblem";

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
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [adaptiveLayout, setAdaptiveLayout] = useState<'full' | 'compact' | 'minimal'>('full');
  const navRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Smart navigation items with priority system
  const navItems: NavItem[] = useMemo(() => [
    { href: "/contractors", label: "Find Contractors", icon: Users, priority: 10 },
    { href: "/calculator", label: "Calculator", icon: Calculator, priority: 9 },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, priority: 8 },
    { href: "/contractors/for-contractors", label: "For Contractors", icon: Wrench, priority: 7 },
    { href: "/helpers", label: "Helpers", icon: Users, priority: 6 },
    { href: "/exchange", label: "Exchange", icon: ArrowLeftRight, priority: 5 },
    { href: "/foundation", label: "Foundation", icon: Building, priority: 4 },
    { href: "/community", label: "Community", icon: MessageSquare, priority: 3 }
  ], []);

  const allPages = useMemo(() => [
    { href: "/", label: "Home", icon: Home },
    ...navItems,
    { href: "/marketplace", label: "Marketplace", icon: ArrowLeftRight },
    { href: "/leaderboard", label: "Leaderboard", icon: Building },
    { href: "/growth-pack", label: "Growth Pack", icon: Wrench },
    { href: "/workers", label: "Worker Marketplace", icon: Users }
  ], [navItems]);

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    if (path === "/contractors") return location === "/contractors" || location === "/contractors/";
    return location.startsWith(path);
  };

  // Intelligent layout calculation
  useEffect(() => {
    const calculateLayout = () => {
      if (!navRef.current || !mounted) return;

      const width = navRef.current.offsetWidth;
      setContainerWidth(width);

      // Revolutionary adaptive layout system - much more generous breakpoints
      if (width >= 900) {
        setAdaptiveLayout('full'); // Show all items
      } else if (width >= 650) {
        setAdaptiveLayout('compact'); // Show priority items + dropdown
      } else {
        setAdaptiveLayout('minimal'); // Show only top items + dropdown
      }
    };

    setMounted(true);
    const timer = setTimeout(calculateLayout, 50);
    const resizeObserver = new ResizeObserver(calculateLayout);
    
    if (navRef.current) {
      resizeObserver.observe(navRef.current);
    }

    window.addEventListener('resize', calculateLayout);

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
      window.removeEventListener('resize', calculateLayout);
    };
  }, [mounted]);

  // Smart item distribution based on layout
  const { visibleItems, hiddenItems } = useMemo(() => {
    const sorted = [...navItems].sort((a, b) => b.priority - a.priority);
    
    let visible: NavItem[] = [];
    let hidden: NavItem[] = [];

    switch (adaptiveLayout) {
      case 'full':
        visible = sorted.slice(0, 8); // Show all 8 items
        hidden = sorted.slice(8);
        break;
      case 'compact':
        visible = sorted.slice(0, 6); // Show 6 items instead of 5
        hidden = sorted.slice(6);
        break;
      case 'minimal':
        visible = sorted.slice(0, 4); // Show 4 items instead of 3
        hidden = sorted.slice(4);
        break;
      default:
        visible = sorted.slice(0, 5);
        hidden = sorted.slice(5);
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
            <div className="w-8 h-8 lg:w-9 lg:h-9 bg-slate-800 rounded-lg border border-slate-600 flex items-center justify-center group-hover:border-orange-500/50 transition-colors duration-300">
              <ConstructionEmblem className="w-4 h-4 lg:w-5 lg:h-5 text-orange-500" />
            </div>
            <span className="text-lg lg:text-xl font-bold text-white group-hover:text-orange-400 transition-colors duration-300">
              TradeScout
            </span>
          </div>
        </Link>

        {/* Revolutionary Adaptive Navigation */}
        <nav className="hidden md:flex items-center flex-1 justify-center max-w-5xl mx-4" ref={navRef}>
          <div className="flex items-center space-x-1 bg-slate-800/60 rounded-xl p-1.5 border border-slate-700/50 shadow-lg backdrop-blur-sm">
            {/* Priority-based visible items */}
            {visibleItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href}>
                  <div className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap border ${
                    active 
                      ? "bg-orange-500 text-white border-orange-400 shadow-lg shadow-orange-500/25" 
                      : "text-slate-300 hover:text-white hover:bg-slate-700/60 border-transparent hover:border-slate-600"
                  }`}>
                    {adaptiveLayout === 'minimal' ? (
                      <item.icon className="w-4 h-4" />
                    ) : (
                      item.label
                    )}
                  </div>
                </Link>
              );
            })}
            
            {/* Intelligent overflow dropdown */}
            {hiddenItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-700/60 transition-all duration-200 border border-transparent hover:border-slate-600 rounded-lg"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                    {adaptiveLayout !== 'minimal' && (
                      <span className="ml-1 text-xs">More</span>
                    )}
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

          {/* User account button */}
          {isAuthenticated && (
            <Link href="/dashboard/account">
              <div className="flex items-center space-x-2 bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700/50 hover:border-orange-500/50 transition-all duration-300 cursor-pointer backdrop-blur-sm">
                <div className="w-7 h-7 bg-slate-700 rounded-full flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-orange-400" />
                </div>
                <span className="text-sm text-slate-300 hover:text-white transition-colors duration-200 hidden lg:inline">
                  Account
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