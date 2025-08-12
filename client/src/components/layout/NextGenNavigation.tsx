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
    <header className={`sticky top-0 z-50 w-full border-b border-slate-700/50 bg-slate-900/90 backdrop-blur-xl shadow-lg ${className}`}>
      
      <div className="w-full flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center space-x-3 group transition-all duration-300">
            <div className="w-9 h-9 bg-slate-800 rounded-lg border border-slate-600 flex items-center justify-center group-hover:border-orange-500/50 transition-colors duration-300">
              <ConstructionEmblem className="w-5 h-5 text-orange-500" />
            </div>
            <span className="text-xl font-bold text-white group-hover:text-orange-400 transition-colors duration-300">
              TradeScout
            </span>
          </div>
        </Link>

        {/* Desktop Navigation - Clean Design */}
        <nav className="hidden lg:flex items-center">
          <div className="flex items-center space-x-1 bg-slate-800/50 rounded-lg p-1 border border-slate-700/50">
            {navItems.map((item, index) => {
              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href}>
                  <div className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                    active 
                      ? "bg-orange-500 text-white" 
                      : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                  }`}>
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Navigation Dropdown for All Items */}
        <div className="hidden lg:flex items-center space-x-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors duration-200"
              >
                <Menu className="w-4 h-4 mr-2" />
                More
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              className="w-56 bg-slate-800 border-slate-700 shadow-xl"
              align="end"
            >
              {dropdownNavItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem 
                    key={item.href} 
                    className="text-slate-200 hover:bg-slate-700 hover:text-white focus:bg-slate-700 focus:text-white cursor-pointer"
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
                  className="text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors duration-200"
                >
                  Sign In
                </Button>
              </Link>
              <Link href="/setup">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400 transition-colors duration-200"
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
                className="text-slate-300 hover:text-white hover:bg-slate-700/50 p-2 transition-colors duration-200"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-slate-900 border-slate-700">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-slate-800 rounded-lg border border-slate-600 flex items-center justify-center">
                    <ConstructionEmblem className="w-4 h-4 text-orange-500" />
                  </div>
                  <span className="text-xl font-bold text-white">TradeScout</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-slate-400 hover:text-white p-2 hover:bg-slate-700/50 transition-colors duration-200"
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
                        <div className={`w-full p-3 rounded-lg transition-colors duration-200 flex items-center space-x-3 ${
                          isActive(item.href)
                            ? "bg-orange-500/20 text-white border border-orange-500/30"
                            : "hover:bg-slate-700/50 text-slate-300 hover:text-white"
                        }`}>
                          <Icon className="w-5 h-5 text-orange-400" />
                          <span className="font-medium">{item.label}</span>
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
                      <Button variant="ghost" className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors duration-200">
                        Sign In
                      </Button>
                    </Link>
                    <Link href="/setup" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full justify-start border-orange-500/50 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400 transition-colors duration-200">
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