import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserMenu } from "@/components/navigation/RoleBasedNavigation";
import { useAuth } from "@/hooks/useAuth";
import { Menu, X, ChevronDown } from "lucide-react";
import { TradeScoutLogo, TradeScoutIcon } from "@/components/TradeScoutIcons";
import { ROUTES } from "@/lib/routes";

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
    <header
      className={`sticky top-0 z-50 w-full bg-tsCard/95 backdrop-blur-xl shadow-lg ${className}`}
    >
      <div className="w-full flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center space-x-3 transition-transform hover:scale-105 group">
            <TradeScoutLogo
              size="lg"
              variant="gradient"
              className="text-ts-orange group-hover:text-ts-orange transition-colors duration-300"
            />
            <span className="text-2xl font-bold text-white tracking-tight group-hover:text-ts-orange transition-colors duration-300">
              TradeScout
            </span>
          </div>
        </Link>

        {/* Desktop Navigation - Scout, Direct Connect, Community, TradeDeals, Exchange, HomeScout */}
        <nav className="hidden lg:flex items-center space-x-1 flex-1 justify-center">
          <Link href="/scout">
            <Button
              variant={isActive("/scout") ? "secondary" : "ghost"}
              size="sm"
              className="px-3 py-2 rounded-lg nav-button hover:bg-white/5 text-sm"
            >
              Scout
            </Button>
          </Link>

          <Link href="/direct-connect">
            <Button
              variant={isActive("/direct-connect") ? "secondary" : "ghost"}
              size="sm"
              className="px-3 py-2 rounded-lg nav-button hover:bg-white/5 text-sm"
            >
              Direct Connect
            </Button>
          </Link>

          <Link href="/community">
            <Button
              variant={isActive("/community") ? "secondary" : "ghost"}
              size="sm"
              className="px-3 py-2 rounded-lg nav-button hover:bg-white/5 text-sm"
            >
              Community
            </Button>
          </Link>

          <Link href="/trade-deals">
            <Button
              variant={isActive("/trade-deals") ? "secondary" : "ghost"}
              size="sm"
              className="px-3 py-2 rounded-lg nav-button hover:bg-white/5 text-sm"
            >
              TradeDeals
            </Button>
          </Link>

          <Link href="/exchange">
            <Button
              variant={isActive("/exchange") ? "secondary" : "ghost"}
              size="sm"
              className="px-3 py-2 rounded-lg nav-button hover:bg-white/5 text-sm"
            >
              Exchange
            </Button>
          </Link>

          <Link href="/homescout-listings">
            <Button
              variant={isActive("/homescout-listings") ? "secondary" : "ghost"}
              size="sm"
              className="px-3 py-2 rounded-lg nav-button hover:bg-white/5 text-sm"
            >
              HomeScout
            </Button>
          </Link>
        </nav>

        {/* User Menu / Auth Buttons */}
        <div className="flex items-center space-x-4">
          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <div className="hidden md:flex items-center space-x-3">
              <Link href={ROUTES.LOGIN}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white hover:bg-white/5"
                >
                  Sign In
                </Button>
              </Link>
              <Link href={ROUTES.REGISTER}>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange/10 hover:border-ts-orange/30"
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
                className="text-white/70 hover:text-white hover:bg-white/5 p-2"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-tsCard surface-panel">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <TradeScoutIcon size="sm" variant="gradient" className="text-ts-orange" />
                  <span className="text-lg font-bold text-white">TradeScout</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-6">
                {/* Core Navigation */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
                    Navigation
                  </h3>
                  <Link href="/scout" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-white/70 hover:text-white hover:bg-white/5"
                    >
                      Scout
                    </Button>
                  </Link>
                  <Link href="/direct-connect" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-white/70 hover:text-white hover:bg-white/5"
                    >
                      Direct Connect
                    </Button>
                  </Link>
                  <Link href="/community" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-white/70 hover:text-white hover:bg-white/5"
                    >
                      Community
                    </Button>
                  </Link>
                  <Link href="/trade-deals" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-white/70 hover:text-white hover:bg-white/5"
                    >
                      TradeDeals
                    </Button>
                  </Link>
                  <Link href="/exchange" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-white/70 hover:text-white hover:bg-white/5"
                    >
                      Exchange
                    </Button>
                  </Link>
                  <Link href="/homescout-listings" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-white/70 hover:text-white hover:bg-white/5"
                    >
                      HomeScout
                    </Button>
                  </Link>
                </div>

                {/* Authentication */}
                {!isAuthenticated && (
                  <div className="space-y-2 border-t border-white/10 pt-4">
                    <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
                      Account
                    </h3>
                    <Link href={ROUTES.LOGIN} onClick={() => setIsMobileMenuOpen(false)}>
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-white/70 hover:text-white hover:bg-white/5"
                      >
                        Sign In
                      </Button>
                    </Link>
                    <Link href={ROUTES.REGISTER} onClick={() => setIsMobileMenuOpen(false)}>
                      <Button
                        variant="outline"
                        className="w-full justify-start border-ts-orange/30 text-ts-orange hover:bg-ts-orange/10"
                      >
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
