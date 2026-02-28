import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import {
  Home,
  Calculator,
  Users,
  Building,
  BarChart3,
  Menu,
  X,
  Settings,
  Gift,
  Crown,
} from "lucide-react";

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const [location, navigate] = useLocation();

  const isContractor = user?.role === "contractor_user";
  const isAdmin = user?.role
    ? ["owner", "ops_admin", "super_admin", "analytics_read"].includes(user.role)
    : false;

  const publicNavItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/scout", label: "Scout", icon: Calculator },
    { href: "/direct-connect", label: "Direct Connect", icon: Building },
    // Growth Pack entry removed
  ];

  const authNavItems = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/scout", label: "Scout", icon: Calculator },
    { href: "/direct-connect", label: "Direct Connect", icon: Building },
    // Contractor-specific navigation keeps contractor tools available
    ...(isContractor
      ? [
          { href: "/contractor-dashboard", label: "My Dashboard", icon: Building },
          { href: "/contractors", label: "Contractors", icon: Users },
        ]
      : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: BarChart3 }] : []),
  ];

  const navItems = isAuthenticated ? authNavItems : publicNavItems;

  return (
    <nav className="bg-tsCard/95 backdrop-blur-sm border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-ts-orange/20 rounded-lg flex items-center justify-center">
                <Building className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-display font-bold text-ts-orange">TradeScout</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-ts-orange/20 text-ts-orange"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* Auth Actions */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                {user && (
                  <div className="flex items-center space-x-2">
                    <span className="text-white/60 text-sm">
                      Welcome, {user.firstName || user.email}
                    </span>
                    {isContractor && (
                      <Badge className="bg-ts-orange/20 text-ts-orange text-xs">Contractor</Badge>
                    )}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/")}
                  className="border-white/10 text-white/60 hover:bg-white/5"
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Link href="/contractors/apply">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange hover:text-white"
                  >
                    Join as Contractor
                  </Button>
                </Link>
                <Button
                  size="sm"
                  onClick={() => navigate("/pre-scout-setup?mode=signin")}
                  className="bg-ts-orange hover:bg-ts-orange-dark text-white shadow-lg shadow-ts-orange/25"
                >
                  Sign In
                </Button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              className="text-white/60 hover:text-white">
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isOpen && (
        <div className="md:hidden bg-tsCard border-t border-white/10">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium ${
                      isActive
                        ? "bg-ts-orange/20 text-ts-orange"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* Mobile Auth Actions */}
          <div className="px-2 py-3 border-t border-white/10">
            {isAuthenticated ? (
              <>
                {user && (
                  <div className="px-3 py-2 text-sm text-white/60">
                    Welcome, {user.firstName || user.email}
                    {isContractor && (
                      <Badge className="ml-2 bg-ts-orange/20 text-ts-orange text-xs">
                        Contractor
                      </Badge>
                    )}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/")}
                  className="w-full mt-2 border-white/10 text-white/60 hover:bg-white/5"
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <div className="space-y-2">
                <Link href="/contractors/apply">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-ts-orange/30 text-ts-orange hover:bg-ts-orange hover:text-white"
                    onClick={() => setIsOpen(false)}
                  >
                    Join as Contractor
                  </Button>
                </Link>
                <Button
                  size="sm"
                  onClick={() => {
                    setIsOpen(false);
                    navigate("/pre-scout-setup?mode=signin");
                  }}
                  className="w-full bg-ts-orange hover:bg-ts-orange-dark text-white shadow-lg shadow-ts-orange/25"
                >
                  Sign In
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
