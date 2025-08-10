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
  Crown
} from "lucide-react";

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const [location] = useLocation();

  const isContractor = user?.role === 'contractor_user';
  const isAdmin = user?.role ? ['owner', 'ops_admin', 'analytics_read'].includes(user.role) : false;

  const publicNavItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/quote-calculator", label: "Estimate Calculator", icon: Calculator },
    { href: "/contractors/board", label: "Find Contractors", icon: Users },
    { href: "/growth-pack", label: "Growth Pack", icon: Gift },
  ];

  const authNavItems = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/quote-calculator", label: "Estimate Calculator", icon: Calculator },
    { href: "/contractors/board", label: "Contractors", icon: Users },
    ...(isContractor ? [
      { href: "/contractors/dashboard", label: "My Dashboard", icon: Building },
      { href: "/contractors/accelerator", label: "Accelerator", icon: Crown },
    ] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: BarChart3 }] : []),
  ];

  const navItems = isAuthenticated ? authNavItems : publicNavItems;

  return (
    <nav className="bg-navy-800 border-b border-navy-600 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <Building className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Trade Scout</span>
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
                        ? "bg-orange-500/20 text-orange-400"
                        : "text-gray-300 hover:text-white hover:bg-navy-700"
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
                    <span className="text-gray-300 text-sm">
                      Welcome, {user.firstName || user.email}
                    </span>
                    {isContractor && (
                      <Badge className="bg-orange-500/20 text-orange-400 text-xs">
                        Contractor
                      </Badge>
                    )}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.href = "/api/logout"}
                  className="border-gray-600 text-gray-300 hover:bg-navy-700"
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Link href="/contractors/apply">
                  <Button variant="outline" size="sm" className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white">
                    Join as Contractor
                  </Button>
                </Link>
                <Button
                  size="sm"
                  onClick={() => window.location.href = "/api/login"}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
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
              className="text-gray-300 hover:text-white"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isOpen && (
        <div className="md:hidden bg-navy-700 border-t border-navy-600">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium ${
                      isActive
                        ? "bg-orange-500/20 text-orange-400"
                        : "text-gray-300 hover:text-white hover:bg-navy-600"
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
          <div className="px-2 py-3 border-t border-navy-600">
            {isAuthenticated ? (
              <>
                {user && (
                  <div className="px-3 py-2 text-sm text-gray-300">
                    Welcome, {user.firstName || user.email}
                    {isContractor && (
                      <Badge className="ml-2 bg-orange-500/20 text-orange-400 text-xs">
                        Contractor
                      </Badge>
                    )}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.href = "/api/logout"}
                  className="w-full mt-2 border-gray-600 text-gray-300 hover:bg-navy-600"
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
                    className="w-full border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
                    onClick={() => setIsOpen(false)}
                  >
                    Join as Contractor
                  </Button>
                </Link>
                <Button
                  size="sm"
                  onClick={() => {
                    setIsOpen(false);
                    window.location.href = "/api/login";
                  }}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
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