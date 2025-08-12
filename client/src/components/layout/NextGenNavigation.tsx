import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Menu, X, ChevronDown, Home, Calculator, Users, Wrench, LayoutDashboard, ArrowLeftRight, Building, MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { UserMenu } from "@/components/navigation/RoleBasedNavigation";
import { ConstructionEmblem } from "@/components/ConstructionEmblem";

interface NextGenNavigationProps {
  className?: string;
}

export function NextGenNavigation({ className = "" }: NextGenNavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    if (path === "/contractors") return location === "/contractors" || location === "/contractors/";
    return location.startsWith(path);
  };

  const navItems = [
    { href: "/contractors", label: "Find Contractors", icon: Users },
    { href: "/calculator", label: "Calculator", icon: Calculator },
    { href: "/contractors/for-contractors", label: "For Contractors", icon: Wrench },
    { href: "/helpers", label: "Helpers", icon: Users },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/exchange", label: "Exchange", icon: ArrowLeftRight },
    { href: "/foundation", label: "Foundation", icon: Building },
    { href: "/community", label: "Community", icon: MessageSquare }
  ];

  // Extended dropdown navigation with all available routes
  const dropdownNavItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/contractors", label: "Find Contractors", icon: Users },
    { href: "/calculator", label: "Calculator", icon: Calculator },
    { href: "/contractors/for-contractors", label: "For Contractors", icon: Wrench },
    { href: "/helpers", label: "Helpers", icon: Users },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/exchange", label: "Exchange", icon: ArrowLeftRight },
    { href: "/foundation", label: "Foundation", icon: Building },
    { href: "/community", label: "Community", icon: MessageSquare },
    { href: "/marketplace", label: "Marketplace", icon: ArrowLeftRight },
    { href: "/leaderboard", label: "Leaderboard", icon: Building },
    { href: "/growth-pack", label: "Growth Pack", icon: Wrench },
    { href: "/workers", label: "Worker Marketplace", icon: Users }
  ];

  return (
    <header className={`sticky top-0 z-50 w-full border-b border-white/[0.08] bg-gradient-to-r from-slate-950/95 via-slate-900/95 to-slate-950/95 backdrop-blur-3xl shadow-2xl ${className}`}>
      {/* Ambient glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/[0.03] via-transparent to-orange-500/[0.03] pointer-events-none"></div>
      
      <div className="relative w-full flex items-center justify-between px-8 py-3">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center space-x-3 group transition-all duration-500 hover:scale-105">
            <div className="relative w-11 h-11">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-orange-600/20 rounded-2xl blur-sm group-hover:blur-none group-hover:from-orange-400/30 group-hover:to-orange-600/30 transition-all duration-500"></div>
              <div className="relative w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-white/10 flex items-center justify-center group-hover:border-orange-400/30 transition-all duration-500">
                <ConstructionEmblem className="w-6 h-6 text-orange-500 group-hover:text-orange-400 transition-colors duration-500" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold bg-gradient-to-r from-white via-slate-100 to-orange-100 bg-clip-text text-transparent tracking-tight group-hover:from-orange-100 group-hover:via-white group-hover:to-orange-200 transition-all duration-500">
                TradeScout
              </span>
              <div className="h-0.5 w-0 bg-gradient-to-r from-orange-400 to-orange-600 group-hover:w-full transition-all duration-500 rounded-full"></div>
            </div>
          </div>
        </Link>

        {/* Desktop Navigation - Futuristic Pill Design */}
        <nav className="hidden lg:flex items-center">
          <div className="relative bg-slate-800/40 backdrop-blur-2xl rounded-3xl border border-white/[0.08] p-1.5 shadow-2xl">
            {/* Ambient inner glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/[0.05] via-transparent to-orange-500/[0.05] rounded-3xl pointer-events-none"></div>
            
            <div className="relative flex items-center space-x-1">
              {navItems.map((item, index) => {
                const active = isActive(item.href);
                return (
                  <Link key={item.href} href={item.href}>
                    <div className={`relative px-4 py-2.5 rounded-2xl transition-all duration-500 group overflow-hidden ${
                      active 
                        ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25 border border-orange-400/20" 
                        : "hover:bg-white/[0.08] text-slate-300 hover:text-white"
                    }`}>
                      {/* Animated background for active state */}
                      {active && (
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"></div>
                      )}
                      
                      {/* Hover glow effect for inactive items */}
                      {!active && (
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 to-orange-600/0 group-hover:from-orange-500/10 group-hover:to-orange-600/10 rounded-2xl transition-all duration-500"></div>
                      )}
                      
                      <span className="relative z-10 font-medium text-xs tracking-wide whitespace-nowrap">
                        {item.label}
                      </span>
                      
                      {/* Micro-interaction indicator */}
                      <div className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 h-0.5 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-500 ${
                        active ? "w-4" : "w-0 group-hover:w-3"
                      }`}></div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Navigation Dropdown for All Items */}
        <div className="hidden lg:flex items-center space-x-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-slate-300 hover:text-white hover:bg-white/10 transition-all duration-300 backdrop-blur-xl border border-transparent hover:border-white/20 rounded-xl"
              >
                <Menu className="w-4 h-4 mr-2" />
                All Pages
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              className="w-56 bg-slate-800/95 backdrop-blur-2xl border-slate-700/50 shadow-2xl"
              align="end"
            >
              {dropdownNavItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem 
                    key={item.href} 
                    className="text-slate-200 hover:bg-slate-700/50 hover:text-white focus:bg-slate-700/50 focus:text-white cursor-pointer"
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

        {/* User Menu / Auth Buttons */}
        <div className="flex items-center space-x-4">
          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <div className="hidden md:flex items-center space-x-3">
              <Link href="/login">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-slate-300 hover:text-white hover:bg-white/10 transition-all duration-300 backdrop-blur-xl border border-transparent hover:border-white/20 rounded-xl"
                >
                  Sign In
                </Button>
              </Link>
              <Link href="/setup">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-gradient-to-r from-orange-500/10 to-orange-600/10 border-orange-500/30 text-orange-400 hover:bg-gradient-to-r hover:from-orange-500/20 hover:to-orange-600/20 hover:border-orange-500/50 hover:text-orange-300 transition-all duration-300 backdrop-blur-xl rounded-xl shadow-lg"
                >
                  Get Started
                </Button>
              </Link>
            </div>
          )}

          {/* Mobile Menu */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-slate-300 hover:text-white hover:bg-white/10 p-2 rounded-xl border border-transparent hover:border-white/20 transition-all duration-300 backdrop-blur-xl"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-gradient-to-b from-slate-950 to-slate-900 border-slate-700/50 backdrop-blur-3xl">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold text-sm">TS</span>
                  </div>
                  <span className="text-xl font-bold bg-gradient-to-r from-white to-orange-100 bg-clip-text text-transparent">TradeScout</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-all duration-300"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-4">
                    Navigation
                  </h3>
                  {dropdownNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.href} href={item.href} onClick={() => setIsMobileMenuOpen(false)}>
                        <div className={`w-full p-4 rounded-xl transition-all duration-300 group flex items-center space-x-3 ${
                          isActive(item.href)
                            ? "bg-gradient-to-r from-orange-500/20 to-orange-600/20 border border-orange-500/30 text-white"
                            : "hover:bg-white/5 text-slate-300 hover:text-white border border-transparent hover:border-white/10"
                        }`}>
                          <Icon className="w-5 h-5 text-orange-400" />
                          <span className="font-medium tracking-wide">{item.label}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Authentication */}
                {!isAuthenticated && (
                  <div className="space-y-3 border-t border-slate-700/50 pt-6">
                    <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-4">
                      Account
                    </h3>
                    <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start text-slate-300 hover:text-white hover:bg-white/10 rounded-xl border border-transparent hover:border-white/20 transition-all duration-300">
                        Sign In
                      </Button>
                    </Link>
                    <Link href="/setup" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full justify-start bg-gradient-to-r from-orange-500/10 to-orange-600/10 border-orange-500/30 text-orange-400 hover:bg-gradient-to-r hover:from-orange-500/20 hover:to-orange-600/20 hover:border-orange-500/50 rounded-xl transition-all duration-300">
                        Get Started
                      </Button>
                    </Link>
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