import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import {
  Menu,
  X,
  Settings,
  LogOut,
  User,
  Bookmark,
  Search,
  Calculator,
  Users,
  Package,
  Palette,
  MessageCircle,
  Shield,
  Layout,
  Wrench,
  Home,
  ChevronDown,
  Zap,
  Star,
  Trophy,
  UserPlus,
  Share,
  Heart,
  DollarSign,
} from "lucide-react";
import { ConstructionEmblem } from "@/components/ConstructionEmblem";
import { NotificationBell } from "@/components/NotificationBell";
import { cn } from "@/lib/utils";
import { isAdminTier } from "@/lib/roleChecks";

export default function Navigation() {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 20;
      setIsScrolled(scrolled);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Admin tier = super_admin or ops_admin only
  // Moderators, analytics, territory managers are NOT admin tier and should not see admin nav
  const isAdmin = isAdminTier(user?.role);
  const isContractor = user && user.role && ["contractor_user"].includes(user.role);
  const isHomeowner = user && user.role === "homeowner";

  const { data: walletBalanceData } = useQuery<{ balance: string } | null>({
    queryKey: ["/api/wallet/balance"],
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });

  const navItems = [
    {
      href: "/direct-connect",
      label: "Direct Connect",
      icon: Search,
      public: true,
      description: "Route jobs to trusted local providers",
    },
    {
      href: "/pricing",
      label: "Pricing",
      icon: Calculator,
      public: true,
      description: "Plans and value guide",
    },
    ...(!isHomeowner
      ? [
          {
            href: "/contractor-apply",
            label: "For Contractors",
            icon: Wrench,
            public: true,
            description: "Join our contractor network",
          },
        ]
      : []),
    {
      href: "/exchange",
      label: "EXCHANGE",
      icon: Package,
      public: true,
      description: "Premium equipment & valuable items",
    },
    {
      href: "/leaderboard",
      label: "Leaderboard",
      icon: Trophy,
      public: true,
      description: "Top contributors by recommendations",
    },
    {
      href: "/community",
      label: "Community",
      icon: MessageCircle,
      public: true,
      description: "Connect with neighbors",
    },
    {
      href: "/foundation",
      label: "Community Builders",
      icon: Heart,
      public: true,
      description: "County-level philanthropy and community vault",
    },
  ];

  const authenticatedNavItems = [
    {
      href: "/conversations",
      label: "Messages",
      icon: MessageCircle,
      description: "Your marketplace conversations",
    },
    {
      href: "/invite",
      label: "Invite Friends",
      icon: UserPlus,
      description: "Invite friends to join TradeScout",
    },
    {
      href: "/affiliate",
      label: "Affiliate Program",
      icon: Share,
      description: "Earn 25% commissions on referrals",
    },
    { href: "/wallet", label: "Wallet", icon: DollarSign, description: "Your TradeScout balance" },
    {
      href: "/moderation",
      label: "Moderate Community",
      icon: Shield,
      description: "Review posts, reports, and flags",
    },
    {
      href: "/scout",
      label: "Scout",
      icon: Layout,
      description: "Assistant-first hub with your live dashboard",
    },
    ...(isAdmin
      ? [
          {
            href: "/admin",
            label: "Admin Operations",
            icon: Settings,
            description: "Open Admin OS for all tools",
          },
        ]
      : []),
  ];

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <nav
      className={cn(
        "border-b sticky top-0 z-50 backdrop-blur-md transition-all duration-300 pt-[env(safe-area-inset-top)]",
        isScrolled && "shadow-lg"
      )}
      style={{
        backgroundColor: "var(--surface-frame)",
        borderColor: "var(--surface-frame-border)",
      }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="relative flex items-center justify-center h-10 w-10 rounded-full bg-orange-500/15">
                <ConstructionEmblem className="w-6 h-6 md:w-8 md:h-8 transition-transform duration-200 group-hover:scale-110" />
                <div className="absolute inset-0 bg-orange-400/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </div>
              <h1 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-orange-500 to-orange-400 bg-clip-text text-transparent group-hover:from-orange-400 group-hover:to-orange-300 transition-all duration-200">
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
                    <div
                      className={`group relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                        location === item.href
                          ? "text-orange-500 bg-orange-500/15 shadow-lg shadow-orange-500/20"
                          : "text-gray-300 hover:text-white hover:bg-white/10 hover:shadow-lg hover:shadow-white/10"
                      }`}
                    >
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

              {isAuthenticated &&
                authenticatedNavItems.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        className={`group relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                          location === item.href
                            ? "text-orange-500 bg-orange-500/15 shadow-lg shadow-orange-500/20"
                            : "text-gray-300 hover:text-white hover:bg-white/10 hover:shadow-lg hover:shadow-white/10"
                        }`}
                      >
                        <IconComponent className="w-4 h-4" />
                        <span>{item.label}</span>
                        {item.label === "Admin" && (
                          <Badge className="ml-2 bg-purple-600 text-white text-xs">Admin</Badge>
                        )}
                        {item.label === "Moderation" && (
                          <Badge className="ml-2 bg-blue-600 text-white text-xs">New</Badge>
                        )}

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

                <div className="flex items-center space-x-2">
                  <NotificationBell />

                  {walletBalanceData && (
                    <Link href="/wallet">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-100 transition-all duration-200 hidden xl:inline-flex"
                      >
                        <DollarSign className="h-4 w-4 mr-1" />
                        <span className="text-xs">
                          ${Number(walletBalanceData.balance || "0").toFixed(2)}
                        </span>
                      </Button>
                    </Link>
                  )}

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

                  <Link href="/conversations">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/20 text-gray-300 hover:bg-white/10 hover:text-white transition-all duration-200"
                    >
                      <MessageCircle className="h-4 w-4 mr-1" />
                      <span className="hidden xl:inline">Messages</span>
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

                  <a
                    href="/auth/logout"
                    onClick={async (e) => {
                      e.preventDefault();
                      const { logoutUser } = await import("@/hooks/useAuth");
                      await logoutUser();
                    }}
                  >
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
              <a href="/login">
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
              <SheetContent
                side="right"
                className="border w-72"
                style={{
                  backgroundColor: "var(--surface-frame)",
                  borderColor: "var(--surface-frame-border)",
                }}
              >
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
                        <div
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium cursor-pointer transition-all duration-200 ${
                            location === item.href
                              ? "text-orange-500 bg-orange-500/15 shadow-lg shadow-orange-500/20"
                              : "text-gray-300 hover:text-white hover:bg-white/10"
                          }`}
                        >
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
                            <div
                              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium cursor-pointer transition-all duration-200 ${
                                location === item.href
                                  ? "text-orange-500 bg-orange-500/15 shadow-lg shadow-orange-500/20"
                                  : "text-gray-300 hover:text-white hover:bg-white/10"
                              }`}
                            >
                              <IconComponent className="w-5 h-5" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{item.label}</span>
                                  {item.label === "Admin" && (
                                    <Badge className="bg-purple-600 text-white text-xs">
                                      Admin
                                    </Badge>
                                  )}
                                  {item.label === "Moderation" && (
                                    <Badge className="bg-blue-600 text-white text-xs">New</Badge>
                                  )}
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
                      <a
                        href="/auth/logout"
                        onClick={async (e) => {
                          e.preventDefault();
                          const { logoutUser } = await import("@/hooks/useAuth");
                          await logoutUser();
                        }}
                      >
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

          {/* Mobile Navigation Buttons */}
          <div className="md:hidden flex items-center space-x-1">
            {/* Find Contractors - Always visible */}
            <Link href="/contractors">
              <Button
                variant="ghost"
                size="sm"
                className={`text-[11px] px-2 py-1 rounded-md ${
                  location === "/contractors"
                    ? "text-orange-500 bg-orange-500/15"
                    : "text-gray-300 hover:text-white"
                }`}
                onClick={closeMobileMenu}
              >
                <Search className="h-4 w-4" />
              </Button>
            </Link>

            {/* For Contractors - marketing entry point for non-homeowners */}
            {!isHomeowner && (
              <Link href="/contractor-apply">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`text-[11px] px-2 py-1 rounded-md ${
                    location === "/contractor-apply"
                      ? "text-orange-500 bg-orange-500/15"
                      : "text-gray-300 hover:text-white"
                  }`}
                  onClick={closeMobileMenu}
                >
                  <Wrench className="h-4 w-4" />
                </Button>
              </Link>
            )}

            {/* Dashboard - Only show if authenticated */}
            {isAuthenticated && (
              <Link href="/scout">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`text-[11px] px-2 py-1 rounded-md ${
                    location === "/scout"
                      ? "text-orange-500 bg-orange-500/15"
                      : "text-gray-300 hover:text-white"
                  }`}
                  onClick={closeMobileMenu}
                >
                  <Layout className="h-4 w-4" />
                </Button>
              </Link>
            )}

            {/* Menu button */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="border w-72"
                style={{
                  backgroundColor: "var(--surface-frame)",
                  borderColor: "var(--surface-frame-border)",
                }}
              >
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
                        <div
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium cursor-pointer transition-all duration-200 ${
                            location === item.href
                              ? "text-orange-500 bg-orange-500/15 shadow-lg shadow-orange-500/20"
                              : "text-gray-300 hover:text-white hover:bg-white/10"
                          }`}
                        >
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
                            <div
                              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium cursor-pointer transition-all duration-200 ${
                                location === item.href
                                  ? "text-orange-500 bg-orange-500/15 shadow-lg shadow-orange-500/20"
                                  : "text-gray-300 hover:text-white hover:bg-white/10"
                              }`}
                            >
                              <IconComponent className="w-5 h-5" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{item.label}</span>
                                  {item.label === "Admin" && (
                                    <Badge className="bg-purple-600 text-white text-xs">
                                      Admin
                                    </Badge>
                                  )}
                                  {item.label === "Moderation" && (
                                    <Badge className="bg-blue-600 text-white text-xs">New</Badge>
                                  )}
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
                          <p className="text-gray-300 px-3">Welcome, {user.firstName}</p>
                        )}

                        <Link href="/saved-ads" onClick={closeMobileMenu}>
                          <Button
                            variant="outline"
                            className="w-full justify-start border text-gray-200 hover:bg-navy-900/60 hover:text-white"
                            style={{ borderColor: "var(--surface-frame-border)" }}
                          >
                            <Bookmark className="h-4 w-4 mr-2" />
                            Saved Ads
                          </Button>
                        </Link>

                        <Link href="/profile" onClick={closeMobileMenu}>
                          <Button
                            variant="outline"
                            className="w-full justify-start border text-gray-200 hover:bg-navy-900/60 hover:text-white"
                            style={{ borderColor: "var(--surface-frame-border)" }}
                          >
                            <User className="h-4 w-4 mr-2" />
                            My Profile
                          </Button>
                        </Link>

                        <Link href="/profile-settings" onClick={closeMobileMenu}>
                          <Button
                            variant="outline"
                            className="w-full justify-start border text-gray-200 hover:bg-navy-900/60 hover:text-white"
                            style={{ borderColor: "var(--surface-frame-border)" }}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Profile Settings
                          </Button>
                        </Link>

                        <a
                          href="/auth/logout"
                          onClick={async (e) => {
                            e.preventDefault();
                            const { logoutUser } = await import("@/hooks/useAuth");
                            await logoutUser();
                          }}
                        >
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
                      <a href="/login" onClick={closeMobileMenu}>
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
