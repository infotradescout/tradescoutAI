import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { RoleBasedNavigation, UserMenu } from "@/components/navigation/RoleBasedNavigation";
import { useAuth } from "@/hooks/useAuth";
import { Menu, X } from "lucide-react";

interface EnhancedNavigationProps {
  className?: string;
}

export function EnhancedNavigation({ className = "" }: EnhancedNavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  return (
    <header className={`sticky top-0 z-50 w-full border-b border-slate-700 bg-slate-900/95 backdrop-blur ${className}`}>
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">TS</span>
            </div>
            <span className="text-xl font-bold text-white">TradeScout</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center space-x-4">
          {/* Core Services */}
          <Link href="/contractors">
            <Button variant={isActive("/contractors") ? "secondary" : "ghost"} size="sm" className="flex items-center space-x-1">
              <span>🔨</span>
              <span>Find Contractors</span>
            </Button>
          </Link>
          <Link href="/quote">
            <Button variant={isActive("/quote") ? "secondary" : "ghost"} size="sm" className="flex items-center space-x-1">
              <span>📊</span>
              <span>Calculator</span>
            </Button>
          </Link>
          <Link href="/marketplace">
            <Button variant={isActive("/marketplace") ? "secondary" : "ghost"} size="sm" className="flex items-center space-x-1">
              <span>🏪</span>
              <span>Marketplace</span>
            </Button>
          </Link>
          <Link href="/community">
            <Button variant={isActive("/community") ? "secondary" : "ghost"} size="sm" className="flex items-center space-x-1">
              <span>👥</span>
              <span>Community</span>
            </Button>
          </Link>
          <Link href="/leaderboard">
            <Button variant={isActive("/leaderboard") ? "secondary" : "ghost"} size="sm" className="flex items-center space-x-1">
              <span>🏆</span>
              <span>Leaderboard</span>
            </Button>
          </Link>
          <Link href="/workers">
            <Button variant={isActive("/workers") ? "secondary" : "ghost"} size="sm" className="flex items-center space-x-1">
              <span>👷</span>
              <span>Helpers</span>
            </Button>
          </Link>
          
          {/* Authenticated Navigation */}
          {isAuthenticated && <RoleBasedNavigation />}
        </div>

        {/* User Menu / Auth Buttons */}
        <div className="flex items-center space-x-3">
          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <div className="hidden md:flex items-center space-x-2">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/setup">
                <Button variant="outline" size="sm">
                  Get Started
                </Button>
              </Link>
            </div>
          )}

          {/* Mobile Menu */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="sm">
                <Menu className="h-5 w-5" />
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
              
              <div className="space-y-4">
                {/* Public Links */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                    Explore
                  </h3>
                  <Link href="/contractors" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      <span className="mr-2">🔨</span>Find Contractors
                    </Button>
                  </Link>
                  <Link href="/quote" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      <span className="mr-2">📊</span>Calculator
                    </Button>
                  </Link>
                  <Link href="/marketplace" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      <span className="mr-2">🏪</span>Marketplace
                    </Button>
                  </Link>
                  <Link href="/community" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      <span className="mr-2">👥</span>Community
                    </Button>
                  </Link>
                  <Link href="/leaderboard" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      <span className="mr-2">🏆</span>Leaderboard
                    </Button>
                  </Link>
                  <Link href="/workers" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      <span className="mr-2">👷</span>Helpers
                    </Button>
                  </Link>
                </div>

                {/* Authentication */}
                {!isAuthenticated ? (
                  <div className="space-y-2 border-t border-slate-700 pt-4">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                      Account
                    </h3>
                    <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start">
                        Sign In
                      </Button>
                    </Link>
                    <Link href="/setup" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full justify-start">
                        Get Started
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="border-t border-slate-700 pt-4">
                    <RoleBasedNavigation isMobile />
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