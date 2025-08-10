import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { 
  Home, 
  Search, 
  Calculator, 
  Users, 
  Settings, 
  LogOut,
  Menu,
  X 
} from "lucide-react";
import { useState } from "react";

export function Navigation() {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Home", icon: Home, show: isAuthenticated },
    { href: "/contractors/board", label: "Find Contractors", icon: Search, show: true },
    { href: "/quote", label: "Get Quote", icon: Calculator, show: true },
    { href: "/growth-pack", label: "Growth Pack", icon: Users, show: !isAuthenticated },
    { href: "/contractor/dashboard", label: "Dashboard", icon: Settings, show: isAuthenticated && user?.role === 'contractor_user' },
    { href: "/admin", label: "Admin", icon: Settings, show: isAuthenticated && (user?.role === 'owner' || user?.role === 'ops_admin') },
  ].filter(item => item.show);

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center space-x-1 bg-navy-800/50 backdrop-blur-sm rounded-lg p-1">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Button
              variant={location === item.href ? "default" : "ghost"}
              size="sm"
              className={cn(
                "flex items-center space-x-2 transition-all duration-200",
                location === item.href 
                  ? "bg-orange-500 hover:bg-orange-600 text-white glow-effect" 
                  : "text-gray-300 hover:text-white hover:bg-navy-600"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Button>
          </Link>
        ))}
        
        {isAuthenticated && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/api/logout'}
            className="text-gray-300 hover:text-white hover:bg-red-600/20 flex items-center space-x-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </Button>
        )}
        
        {!isAuthenticated && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.href = '/api/login'}
            className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
          >
            Login
          </Button>
        )}
      </nav>

      {/* Mobile Navigation */}
      <div className="md:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-white"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        {mobileMenuOpen && (
          <div className="absolute top-16 left-0 right-0 bg-navy-800 border border-navy-600 rounded-lg mx-4 p-4 z-50">
            <div className="flex flex-col space-y-2">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={location === item.href ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "w-full justify-start flex items-center space-x-2",
                      location === item.href 
                        ? "bg-orange-500 hover:bg-orange-600 text-white" 
                        : "text-gray-300 hover:text-white hover:bg-navy-600"
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              ))}
              
              {isAuthenticated && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    window.location.href = '/api/logout';
                  }}
                  className="w-full justify-start text-gray-300 hover:text-white hover:bg-red-600/20 flex items-center space-x-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </Button>
              )}
              
              {!isAuthenticated && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    window.location.href = '/api/login';
                  }}
                  className="w-full border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
                >
                  Login
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}