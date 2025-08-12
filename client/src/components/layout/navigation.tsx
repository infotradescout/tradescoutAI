import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { 
  Menu, X, Settings, LogOut, User, Crown, Bookmark, 
  Search, Calculator, Users, Package, Palette, 
  MessageCircle, Shield, Layout, Wrench, Home,
  ChevronDown, Zap, Star, Trophy, UserPlus, Share, Heart
} from "lucide-react";
import { ConstructionEmblem } from "@/components/ConstructionEmblem";
import { NotificationBell } from "@/components/NotificationBell";

export default function Navigation() {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdmin = user && user.role && ['owner', 'ops_admin', 'analytics_read', 'territory_manager', 'contractor_success'].includes(user.role);
  const isContractor = user && user.role && ['contractor_user', 'accelerator_member'].includes(user.role);
  const isHomeowner = user && user.role === 'homeowner';

  const navItems = [
    { href: "/contractors/board", label: "Find Contractors", icon: Search, public: true, description: "Find verified local contractors" },
    { href: "/quote", label: "Quote Calculator", icon: Calculator, public: true, description: "Get instant project estimates" },
    ...(!isHomeowner ? [{ href: "/contractors", label: "For Contractors", icon: Wrench, public: true, description: "Join our contractor network" }] : []),
    { href: "/workers", label: "Helpers", icon: Users, public: true, description: "Find skilled helpers" },
    { href: "/marketplace", label: "Exchange", icon: Package, public: true, description: "Premium equipment & valuable items" },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy, public: true, description: "Top contractors by recommendations" },
    { href: "/community", label: "Community", icon: MessageCircle, public: true, description: "Connect with neighbors" },
    { href: "/foundation", label: "Foundation", icon: Heart, public: true, description: "Community foundation and charitable initiatives" },
  ];

  const authenticatedNavItems = [
    { href: "/conversations", label: "Messages", icon: MessageCircle, description: "Your marketplace conversations" },
    { href: "/invite", label: "Invite Friends", icon: UserPlus, description: "Invite friends to join TradeScout" },
    { href: "/affiliate", label: "Affiliate Program", icon: Share, description: "Earn 25% commissions on referrals" },
    { href: "/moderation", label: "Moderation", icon: Shield, description: "Community moderation" },
    ...(isContractor ? [
      { href: "/contractor-dashboard", label: "Dashboard", icon: Layout, description: "Your contractor hub" },
      { href: "/contractor-promos", label: "My Promos", icon: Star, description: "Manage promotions" }
    ] : []),
    ...(isAdmin ? [
      { href: "/admin", label: "Admin", icon: Settings, description: "Admin controls" },
      { href: "/admin/panel", label: "Admin Panel", icon: Crown, description: "Management panel" },
      { href: "/admin/professional-verification", label: "Professional Verification", icon: Shield, description: "Verify professionals" }
    ] : []),
  ];

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <nav className="nav-glass sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 md:h-16">
          {/* Logo */}
          <div className="flex items-center space-x-8">
            <Link href="/" onClick={closeMobileMenu}>
              <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 group">
                <div className="relative">
                  <ConstructionEmblem className="w-6 h-6 md:w-8 md:h-8 transition-transform duration-200 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-orange-400/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                </div>
                <h1 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-orange-500 to-orange-400 bg-clip-text text-transparent cursor-pointer group-hover:from-orange-400 group-hover:to-orange-300 transition-all duration-200">
                  TradeScout
                </h1>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:block">
              <div className="ml-10 flex items-center space-x-1">
                {navItems.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <Link key={item.href} href={item.href}>
                      <div className={`group relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                        location === item.href
                          ? 'text-orange-500 bg-orange-500/15 shadow-lg shadow-orange-500/20'
                          : 'text-gray-300 hover:text-white hover:bg-white/10 hover:shadow-lg hover:shadow-white/10'
                      }`}>
                        <IconComponent className="w-4 h-4" />
                        <span>{item.label}</span>

                        {/* Tooltip */}
                        <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                          {item.description}
                          <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                        </div>
                      </div>
                    </Link>
                  );
                })}

                {isAuthenticated && authenticatedNavItems.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <Link key={item.href} href={item.href}>
                      <div className={`group relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                        location === item.href
                          ? 'text-orange-500 bg-orange-500/15 shadow-lg shadow-orange-500/20'
                          : 'text-gray-300 hover:text-white hover:bg-white/10 hover:shadow-lg hover:shadow-white/10'
                      }`}>
                        <IconComponent className="w-4 h-4" />
                        <span>{item.label}</span>
                        {item.label === "Admin" && <Badge className="ml-2 bg-purple-600 text-white text-xs">Admin</Badge>}
                        {item.label === "Moderation" && <Badge className="ml-2 bg-blue-600 text-white text-xs">New</Badge>}

                        {/* Tooltip */}
                        <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                          {item.description}
                          <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Desktop Auth Section */}
          <div className="hidden lg:flex items-center space-x-3">
            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                {user?.firstName && (
                  <div className="text-right">
                    <div className="text-sm text-gray-300">Welcome back,</div>
                    <div className="text-sm font-medium text-white">{user.firstName}</div>
                  </div>
                )}

                {user?.role === 'accelerator_member' && (
                  <Badge className="bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg">
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
                      className="border-white/20 text-gray-300 hover:bg-white/10 hover:text-white transition-all duration-200"
                    >
                      <Bookmark className="h-4 w-4 mr-1" />
                      <span className="hidden xl:inline">Saved</span>
                    </Button>
                  </Link>

                  <Link href="/profile">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-white/20 text-gray-300 hover:bg-white/10 hover:text-white transition-all duration-200"
                    >
                      <User className="h-4 w-4 mr-1" />
                      <span className="hidden xl:inline">Profile</span>
                    </Button>
                  </Link>

                  <a href="/api/logout">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-red-400/50 text-red-400 hover:bg-red-500 hover:text-white transition-all duration-200"
                    >
                      <LogOut className="h-4 w-4 mr-1" />
                      <span className="hidden xl:inline">Sign Out</span>
                    </Button>
                  </a>
                </div>
              </div>
            ) : (
              <a href="/api/login">
                <Button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-2 rounded-lg font-medium shadow-lg hover:shadow-orange-500/25 transition-all duration-300">
                  <User className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
              </a>
            )}
          </div>

          {/* Medium Screen Menu */}
          <div className="hidden md:flex lg:hidden items-center space-x-2">
            {isAuthenticated && <NotificationBell />}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="border-white/20 text-gray-300 hover:bg-white/10 hover:text-white"
                >
                  <Menu className="h-4 w-4 mr-1" />
                  Menu
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-gradient-to-br from-navy-900 to-navy-800 border-navy-600 w-80">
                <div className="flex flex-col space-y-2 mt-8">
                  {/* Mobile Brand */}
                  <div className="flex items-center gap-3 px-3 pb-6 border-b border-navy-600">
                    <ConstructionEmblem className="w-8 h-8" />
                    <h2 className="text-xl font-bold text-orange-500">TradeScout</h2>
                  </div>

                  {/* Navigation Items for Medium Screens */}
                  {navItems.map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <Link key={item.href} href={item.href} onClick={closeMobileMenu}>
                        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium cursor-pointer transition-all duration-200 ${
                          location === item.href
                            ? 'text-orange-500 bg-orange-500/15 shadow-lg shadow-orange-500/20'
                            : 'text-gray-300 hover:text-white hover:bg-white/10'
                        }`}>
                          <IconComponent className="w-5 h-5" />
                          <div className="flex-1">
                            <div className="font-medium">{item.label}</div>
                            <div className="text-xs text-gray-400">{item.description}</div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}

                  {isAuthenticated && (
                    <div className="border-t border-navy-600 pt-2 mt-2">
                      {authenticatedNavItems.map((item) => {
                        const IconComponent = item.icon;
                        return (
                          <Link key={item.href} href={item.href} onClick={closeMobileMenu}>
                            <div className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium cursor-pointer transition-all duration-200 ${
                              location === item.href
                                ? 'text-orange-500 bg-orange-500/15 shadow-lg shadow-orange-500/20'
                                : 'text-gray-300 hover:text-white hover:bg-white/10'
                            }`}>
                              <IconComponent className="w-5 h-5" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{item.label}</span>
                                  {item.label === "Admin" && <Badge className="bg-purple-600 text-white text-xs">Admin</Badge>}
                                  {item.label === "Moderation" && <Badge className="bg-blue-600 text-white text-xs">New</Badge>}
                                </div>
                                <div className="text-xs text-gray-400">{item.description}</div>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {/* Auth section in medium screen menu */}
                  {isAuthenticated && (
                    <div className="border-t border-navy-600 pt-4 mt-4 space-y-2">
                      <Link href="/saved-ads" onClick={closeMobileMenu}>
                        <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-200">
                          <Bookmark className="w-5 h-5" />
                          <span>Saved Ads</span>
                        </div>
                      </Link>
                      <Link href="/profile" onClick={closeMobileMenu}>
                        <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-200">
                          <User className="w-5 h-5" />
                          <span>Profile</span>
                        </div>
                      </Link>
                      <a href="/api/logout">
                        <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:text-white hover:bg-red-500/20 transition-all duration-200">
                          <LogOut className="w-5 h-5" />
                          <span>Sign Out</span>
                        </div>
                      </a>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
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
              <SheetContent side="right" className="bg-gradient-to-br from-navy-900 to-navy-800 border-navy-600 w-80">
                <div className="flex flex-col space-y-2 mt-8">
                  {/* Mobile Brand */}
                  <div className="flex items-center gap-3 px-3 pb-6 border-b border-navy-600">
                    <ConstructionEmblem className="w-8 h-8" />
                    <h2 className="text-xl font-bold text-orange-500">TradeScout</h2>
                  </div>

                  {/* Mobile Navigation Items */}
                  {navItems.map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <Link key={item.href} href={item.href} onClick={closeMobileMenu}>
                        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium cursor-pointer transition-all duration-200 ${
                          location === item.href
                            ? 'text-orange-500 bg-orange-500/15 shadow-lg shadow-orange-500/20'
                            : 'text-gray-300 hover:text-white hover:bg-white/10'
                        }`}>
                          <IconComponent className="w-5 h-5" />
                          <div className="flex-1">
                            <div className="font-medium">{item.label}</div>
                            <div className="text-xs text-gray-400">{item.description}</div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}

                  {isAuthenticated && (
                    <div className="border-t border-navy-600 pt-2 mt-2">
                      {authenticatedNavItems.map((item) => {
                        const IconComponent = item.icon;
                        return (
                          <Link key={item.href} href={item.href} onClick={closeMobileMenu}>
                            <div className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium cursor-pointer transition-all duration-200 ${
                              location === item.href
                                ? 'text-orange-500 bg-orange-500/15 shadow-lg shadow-orange-500/20'
                                : 'text-gray-300 hover:text-white hover:bg-white/10'
                            }`}>
                              <IconComponent className="w-5 h-5" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{item.label}</span>
                                  {item.label === "Admin" && <Badge className="bg-purple-600 text-white text-xs">Admin</Badge>}
                                  {item.label === "Moderation" && <Badge className="bg-blue-600 text-white text-xs">New</Badge>}
                                </div>
                                <div className="text-xs text-gray-400">{item.description}</div>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}

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