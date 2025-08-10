import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { Menu, X, Settings, LogOut, User, Crown, Bookmark } from "lucide-react";
import { ConstructionEmblem } from "@/components/ConstructionEmblem";
import { NotificationBell } from "@/components/NotificationBell";

export default function Navigation() {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdmin = user && user.role && ['owner', 'ops_admin', 'analytics_read', 'territory_manager', 'contractor_success'].includes(user.role);
  const isContractor = user && user.role && ['contractor_user', 'accelerator_member'].includes(user.role);

  const navItems = [
    { href: "/contractors/board", label: "Find Contractors", public: true },
    { href: "/workers", label: "Worker Marketplace", public: true },
    { href: "/quote", label: "Get Estimate", public: true },
    { href: "/growth-pack", label: "For Contractors", public: true },
  ];

  const authenticatedNavItems = [
    ...(isContractor ? [{ href: "/contractors/dashboard", label: "Dashboard" }] : []),
    ...(isAdmin ? [
      { href: "/admin", label: "Admin" },
      { href: "/admin/panel", label: "Admin Panel" }
    ] : []),
  ];

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <nav className="nav-glass sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-8">
            <Link href="/" onClick={closeMobileMenu}>
              <div className="flex-shrink-0 flex items-center gap-3">
                <ConstructionEmblem className="w-8 h-8" />
                <h1 className="text-2xl font-bold text-white cursor-pointer hover:text-orange-400 transition-colors">
                  Trade Scout
                </h1>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <span className={`px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                      location === item.href
                        ? 'text-orange-500 bg-orange-500/10'
                        : 'text-gray-300 hover:text-white hover:bg-navy-600'
                    }`}>
                      {item.label}
                    </span>
                  </Link>
                ))}
                
                {isAuthenticated && authenticatedNavItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <span className={`px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                      location === item.href
                        ? 'text-orange-500 bg-orange-500/10'
                        : 'text-gray-300 hover:text-white hover:bg-navy-600'
                    }`}>
                      {item.label}
                      {item.label === "Admin" && <Badge className="ml-2 bg-purple-600 text-white">Admin</Badge>}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Desktop Auth Section */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                {user?.firstName && (
                  <span className="text-gray-300 text-sm">
                    Welcome, {user.firstName}
                  </span>
                )}
                
                {user?.role === 'accelerator_member' && (
                  <Badge className="bg-purple-600 text-white">
                    <Crown className="h-3 w-3 mr-1" />
                    Accelerator
                  </Badge>
                )}

                <div className="flex items-center space-x-2">
                  <NotificationBell />
                  
                  <Link href="/saved-ads">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-navy-500 text-gray-300 hover:bg-navy-600 hover:text-white"
                    >
                      <Bookmark className="h-4 w-4 mr-1" />
                      Saved Ads
                    </Button>
                  </Link>
                  
                  <Link href="/profile">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-navy-500 text-gray-300 hover:bg-navy-600 hover:text-white"
                    >
                      <User className="h-4 w-4 mr-1" />
                      Profile
                    </Button>
                  </Link>
                  
                  <a href="/api/logout">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
                    >
                      <LogOut className="h-4 w-4 mr-1" />
                      Sign Out
                    </Button>
                  </a>
                </div>
              </div>
            ) : (
              <a href="/api/login">
                <Button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium glow-effect transition-all duration-300">
                  Sign In
                </Button>
              </a>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-gray-400 hover:text-white"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-navy-800 border-navy-600">
                <div className="flex flex-col space-y-4 mt-8">
                  {/* Mobile Navigation Items */}
                  {navItems.map((item) => (
                    <Link key={item.href} href={item.href} onClick={closeMobileMenu}>
                      <span className={`block px-3 py-2 rounded-md text-base font-medium cursor-pointer transition-colors ${
                        location === item.href
                          ? 'text-orange-500 bg-orange-500/10'
                          : 'text-gray-300 hover:text-white hover:bg-navy-600'
                      }`}>
                        {item.label}
                      </span>
                    </Link>
                  ))}

                  {isAuthenticated && authenticatedNavItems.map((item) => (
                    <Link key={item.href} href={item.href} onClick={closeMobileMenu}>
                      <span className={`block px-3 py-2 rounded-md text-base font-medium cursor-pointer transition-colors ${
                        location === item.href
                          ? 'text-orange-500 bg-orange-500/10'
                          : 'text-gray-300 hover:text-white hover:bg-navy-600'
                      }`}>
                        {item.label}
                        {item.label === "Admin" && <Badge className="ml-2 bg-purple-600 text-white">Admin</Badge>}
                      </span>
                    </Link>
                  ))}

                  <div className="border-t border-navy-600 pt-4 mt-4">
                    {isAuthenticated ? (
                      <div className="space-y-3">
                        {user?.firstName && (
                          <p className="text-gray-300 px-3">
                            Welcome, {user.firstName}
                          </p>
                        )}
                        
                        {user?.role === 'accelerator_member' && (
                          <Badge className="bg-purple-600 text-white mx-3">
                            <Crown className="h-3 w-3 mr-1" />
                            Accelerator Member
                          </Badge>
                        )}

                        <Link href="/saved-ads" onClick={closeMobileMenu}>
                          <Button 
                            variant="outline" 
                            className="w-full justify-start border-navy-500 text-gray-300 hover:bg-navy-600 hover:text-white"
                          >
                            <Bookmark className="h-4 w-4 mr-2" />
                            Saved Ads
                          </Button>
                        </Link>
                        
                        <Link href="/profile" onClick={closeMobileMenu}>
                          <Button 
                            variant="outline" 
                            className="w-full justify-start border-navy-500 text-gray-300 hover:bg-navy-600 hover:text-white"
                          >
                            <User className="h-4 w-4 mr-2" />
                            Profile Settings
                          </Button>
                        </Link>
                        
                        <a href="/api/logout">
                          <Button 
                            variant="outline" 
                            className="w-full justify-start border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
                          >
                            <LogOut className="h-4 w-4 mr-2" />
                            Sign Out
                          </Button>
                        </a>
                      </div>
                    ) : (
                      <a href="/api/login" onClick={closeMobileMenu}>
                        <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white glow-effect">
                          Sign In
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
