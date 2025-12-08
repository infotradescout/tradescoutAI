import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserMenu } from "@/components/navigation/RoleBasedNavigation";
import { useAuth } from "@/hooks/useAuth";
import { Menu, X, ChevronDown } from "lucide-react";
import { TradeScoutLogo, TradeScoutIcon } from "@/components/TradeScoutIcons";

interface EnhancedNavigationProps {
  className?: string;
}

export function EnhancedNavigation({ className = "" }: EnhancedNavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    if (path === "/find-contractors") return location === "/find-contractors" || location.startsWith("/contractor-board") || location.startsWith("/contractors");
    return location.startsWith(path);
  };

  return (
    <header className={`sticky top-0 z-50 w-full border-b border-slate-700/50 bg-slate-900/98 backdrop-blur-xl shadow-lg ${className}`}>
      <div className="w-full flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center space-x-3 transition-transform hover:scale-105 group">
            <TradeScoutLogo 
              size="lg" 
              variant="gradient" 
              className="text-orange-500 group-hover:text-orange-400 transition-colors duration-300" 
            />
            <span className="text-2xl font-bold text-white tracking-tight group-hover:text-orange-400 transition-colors duration-300">
              TradeScout
            </span>
          </div>
        </Link>

        {/* Desktop Navigation - All 7 Items in Header */}
        <nav className="hidden lg:flex items-center space-x-1 flex-1 justify-center">
          <Link href="/find-contractors">
            <Button variant={isActive("/find-contractors") ? "secondary" : "ghost"} size="sm" className="px-3 py-2 rounded-lg nav-button hover:bg-slate-800/60 text-sm">
              Find Contractors
            </Button>
          </Link>
          
          <Link href="/quote-calculator">
            <Button variant={isActive("/quote-calculator") ? "secondary" : "ghost"} size="sm" className="px-3 py-2 rounded-lg nav-button hover:bg-slate-800/60 text-sm">
              Calculator
            </Button>
          </Link>
          
          <Link href="/contractor-board">
            <Button variant={isActive("/contractor-board") ? "secondary" : "ghost"} size="sm" className="px-3 py-2 rounded-lg nav-button hover:bg-slate-800/60 text-sm">
              For Contractors
            </Button>
          </Link>
          
          <Link href="/worker-marketplace">
            <Button variant={isActive("/worker-marketplace") ? "secondary" : "ghost"} size="sm" className="px-3 py-2 rounded-lg nav-button hover:bg-slate-800/60 text-sm">
              Helpers
            </Button>
          </Link>
          
          <Link href="/dashboard">
            <Button variant={isActive("/dashboard") ? "secondary" : "ghost"} size="sm" className="px-3 py-2 rounded-lg nav-button hover:bg-slate-800/60 text-sm">
              Dashboard
            </Button>
          </Link>
          
          <Link href="/exchange">
            <Button variant={isActive("/exchange") ? "secondary" : "ghost"} size="sm" className="px-3 py-2 rounded-lg nav-button hover:bg-slate-800/60 text-sm">
              Exchange
            </Button>
          </Link>
          
          <Link href="/foundation">
            <Button variant={isActive("/foundation") ? "secondary" : "ghost"} size="sm" className="px-3 py-2 rounded-lg nav-button hover:bg-slate-800/60 text-sm">
              Foundation
            </Button>
          </Link>

        </nav>

        {/* User Menu / Auth Buttons */}
        <div className="flex items-center space-x-4">
          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <div className="hidden md:flex items-center space-x-3">
              <Link href="/login">
                <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-800/60">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button variant="outline" size="sm" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10 hover:border-orange-500">
                  Get Started
                </Button>
              </Link>
            </div>
          )}

          {/* Mobile Menu */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-800/60 p-2">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-slate-900 border-slate-700">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <TradeScoutIcon 
                    size="sm" 
                    variant="gradient" 
                    className="text-orange-500" 
                  />
                  <span className="text-lg font-bold text-white">TradeScout</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              
              <div className="space-y-6">
                {/* Core Navigation */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                    Navigation
                  </h3>
                  <Link href="/find-contractors" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start text-slate-200 hover:text-white hover:bg-slate-800/60">
                      Find Contractors
                    </Button>
                  </Link>
                  <Link href="/quote-calculator" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start text-slate-200 hover:text-white hover:bg-slate-800/60">
                      Calculator
                    </Button>
                  </Link>
                  <Link href="/contractor-board" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start text-slate-200 hover:text-white hover:bg-slate-800/60">
                      For Contractors
                    </Button>
                  </Link>
                  <Link href="/worker-marketplace" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start text-slate-200 hover:text-white hover:bg-slate-800/60">
                      Helpers
                    </Button>
                  </Link>
                  <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start text-slate-200 hover:text-white hover:bg-slate-800/60">
                      Dashboard
                    </Button>
                  </Link>
                  <Link href="/exchange" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start text-slate-200 hover:text-white hover:bg-slate-800/60">
                      Exchange
                    </Button>
                  </Link>
                  <Link href="/foundation" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start text-slate-200 hover:text-white hover:bg-slate-800/60">
                      Foundation
                    </Button>
                  </Link>
                </div>

                {/* Authentication */}
                {!isAuthenticated && (
                  <div className="space-y-2 border-t border-slate-700 pt-4">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                      Account
                    </h3>
                    <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start text-slate-200 hover:text-white hover:bg-slate-800/60">
                        Sign In
                      </Button>
                    </Link>
                    <Link href="/signup" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full justify-start border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
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