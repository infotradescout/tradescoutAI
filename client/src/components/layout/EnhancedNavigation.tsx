import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserMenu } from "@/components/navigation/RoleBasedNavigation";
import { useAuth } from "@/hooks/useAuth";
import { Menu, X, ChevronDown } from "lucide-react";
import { ConstructionEmblem } from "@/components/ConstructionEmblem";

interface EnhancedNavigationProps {
  className?: string;
}

export function EnhancedNavigation({ className = "" }: EnhancedNavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    // Prevent /contractors from matching /contractors/for-contractors
    if (path === "/contractors") return location === "/contractors" || location === "/contractors/";
    return location.startsWith(path);
  };

  return (
    <header className={`sticky top-0 z-50 w-full border-b border-slate-700/50 bg-slate-900/98 backdrop-blur-xl shadow-lg ${className}`}>
      <div className="w-full flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center space-x-3 transition-transform hover:scale-105">
            <div className="w-10 h-10">
              <ConstructionEmblem className="w-full h-full text-orange-500" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">TradeScout</span>
          </div>
        </Link>

        {/* Desktop Navigation - Core Tabs + Dropdown */}
        <nav className="hidden lg:flex items-center space-x-2 flex-1 justify-center">
          {/* Core Navigation Tabs */}
          <Link href="/contractors">
            <Button variant={isActive("/contractors") ? "secondary" : "ghost"} size="sm" className="px-4 py-2 rounded-lg nav-button hover:bg-slate-800/60">
              Find Contractors
            </Button>
          </Link>
          <Link href="/contractors/for-contractors">
            <Button variant={isActive("/contractors/for-contractors") ? "secondary" : "ghost"} size="sm" className="px-4 py-2 rounded-lg nav-button hover:bg-slate-800/60">
              For Contractors
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant={isActive("/dashboard") ? "secondary" : "ghost"} size="sm" className="px-4 py-2 rounded-lg nav-button hover:bg-slate-800/60">
              Dashboard
            </Button>
          </Link>
          
          {/* More Menu Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="px-4 py-2 rounded-lg nav-button hover:bg-slate-800/60 flex items-center space-x-1">
                <span>More</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-slate-800 border-slate-700" align="center">
              <Link href="/exchange">
                <DropdownMenuItem className="text-slate-200 hover:text-white hover:bg-slate-700 cursor-pointer">
                  Exchange
                </DropdownMenuItem>
              </Link>
              <Link href="/community">
                <DropdownMenuItem className="text-slate-200 hover:text-white hover:bg-slate-700 cursor-pointer">
                  Community
                </DropdownMenuItem>
              </Link>
              <Link href="/foundation">
                <DropdownMenuItem className="text-slate-200 hover:text-white hover:bg-slate-700 cursor-pointer">
                  Foundation
                </DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>
          

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
              <Link href="/setup">
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
                  <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-red-600 rounded flex items-center justify-center">
                    <span className="text-white font-bold text-xs">TS</span>
                  </div>
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
                    Main
                  </h3>
                  <Link href="/contractors" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start text-slate-200 hover:text-white hover:bg-slate-800/60">
                      Find Contractors
                    </Button>
                  </Link>
                  <Link href="/contractors/for-contractors" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start text-slate-200 hover:text-white hover:bg-slate-800/60">
                      For Contractors
                    </Button>
                  </Link>
                  <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start text-slate-200 hover:text-white hover:bg-slate-800/60">
                      Dashboard
                    </Button>
                  </Link>
                </div>

                {/* Secondary Features */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                    More
                  </h3>
                  <Link href="/exchange" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start text-slate-200 hover:text-white hover:bg-slate-800/60">
                      Exchange
                    </Button>
                  </Link>
                  <Link href="/community" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start text-slate-200 hover:text-white hover:bg-slate-800/60">
                      Community
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
                    <Link href="/setup" onClick={() => setIsMobileMenuOpen(false)}>
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