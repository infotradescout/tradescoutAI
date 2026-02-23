import React, { memo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth, useLogout } from "@/hooks/useAuth";
import { safeNavigate } from "@/lib/safeNavigate";
import {
  User,
  Bell,
  LogOut,
  Search,
  Menu,
  Home,
  Users,
  ShoppingCart,
  Wrench,
  MapPin,
  Settings,
  HelpCircle,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SimpleNavigation = memo(function SimpleNavigation() {
  const { user, isAuthenticated } = useAuth();
  const logout = useLogout();
  const [location, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const isActivePath = (path: string) => location === path;

  const mainNavItems = [
    { icon: Home, label: "Scout", path: "/scout", testId: "nav-home", key: "home" },
    {
      icon: Users,
      label: "Community",
      path: "/community",
      testId: "nav-community",
      key: "community",
    },
    {
      icon: Wrench,
      label: "Contractors",
      path: "/contractors",
      testId: "nav-contractors",
      key: "contractors",
    },
    {
      icon: ShoppingCart,
      label: "Exchange",
      path: "/exchange",
      testId: "nav-exchange",
      key: "exchange",
    },
    {
      icon: Building,
      label: "HomeScout",
      path: "/real-estate-marketplace",
      testId: "nav-homescout",
      key: "homescout",
    },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Left: Logo */}
          <div className="flex items-center gap-4">
            <Link href={isAuthenticated ? "/home" : "/"} className="flex items-center gap-2 group">
              <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-md group-hover:shadow-lg transition-all">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                  />
                </svg>
              </div>
              <span className="hidden sm:block text-lg font-bold text-slate-900 dark:text-white">
                TradeScout
              </span>
            </Link>

            {/* Search Bar */}
            <div className="hidden md:block relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search TradeScout"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-60 h-9 bg-slate-100 dark:bg-slate-800 border-0 focus-visible:ring-1"
                data-testid="input-search"
              />
            </div>
          </div>

          {/* Center: Main Navigation Icons (Facebook style) */}
          {isAuthenticated && (
            <div className="hidden lg:flex items-center gap-1">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = isActivePath(item.path);
                return (
                  <Link
                    key={item.key || item.path}
                    href={item.path}
                    data-testid={item.testId}
                    className={`relative flex items-center justify-center h-14 px-8 transition-colors ${
                      isActive
                        ? "text-orange-600 dark:text-orange-500 border-b-2 border-orange-600"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </Link>
                );
              })}
            </div>
          )}

          {/* Right: User Actions */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {/* Notifications */}
                <Link href="/notifications">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="relative w-9 h-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                    data-testid="button-notifications"
                  >
                    <Bell className="w-5 h-5" />
                  </Button>
                </Link>

                {/* Profile Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-9 h-9 rounded-full p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
                      data-testid="button-profile-menu"
                    >
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={user?.profileImageUrl} />
                        <AvatarFallback className="bg-orange-500 text-white text-sm">
                          {user?.firstName?.[0] || user?.email?.[0] || "U"}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <div className="px-3 py-2">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {user?.firstName && user?.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user?.email}
                      </div>
                      <div className="text-xs text-slate-500">{user?.email}</div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => safeNavigate(navigate, "/profile")}
                      className="cursor-pointer"
                    >
                      <User className="w-4 h-4 mr-2" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => safeNavigate(navigate, "/groups")}
                      className="cursor-pointer"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      My Groups
                    </DropdownMenuItem>
                    {(user?.role === "hoa_board" || user?.role === "hoa_manager") && (
                      <DropdownMenuItem
                        onSelect={() => safeNavigate(navigate, "/hoa-dashboard")}
                        className="cursor-pointer"
                      >
                        <Home className="w-4 h-4 mr-2" />
                        HOA Management
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onSelect={() => safeNavigate(navigate, "/settings")}
                      className="cursor-pointer"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => safeNavigate(navigate, "/help")}
                      className="cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4 mr-2" />
                      Help Center
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600">
                      <LogOut className="w-4 h-4 mr-2" />
                      Log Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Link href="/pre-scout-setup?mode=signin">
                  <Button variant="ghost" size="sm" data-testid="button-login">
                    Log In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700"
                    data-testid="button-signup"
                  >
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
});

export default SimpleNavigation;
