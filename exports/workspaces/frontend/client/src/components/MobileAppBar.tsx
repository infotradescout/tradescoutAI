import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import {
  Home,
  Search,
  MessageCircle,
  User,
  Menu,
  Wrench,
  Layout,
  Bell,
  Heart,
  Calculator,
  Package,
  Settings,
  ClipboardList,
  Building,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const mobileNavItems = [
  { href: "/", icon: Home, label: "Home", guest: true },
  { href: "/scout", icon: Calculator, label: "Scout", guest: true },
  { href: "/direct-connect", icon: ClipboardList, label: "Direct Connect", guest: true },
  { href: "/conversations", icon: MessageCircle, label: "Messages", auth: true },
  { href: "/profile", icon: User, label: "Profile", auth: true },
];

const quickActions = [
  { href: "/scout?intent=estimate", icon: Calculator, label: "Estimate", guest: true },
  { href: "/exchange", icon: Package, label: "EXCHANGE", guest: true },
  { href: "/homescout-listings", icon: Building, label: "HomeScout Listings", guest: true },
  { href: "/direct-connect", icon: ClipboardList, label: "New Request", guest: true },
  { href: "/foundation", icon: Heart, label: "Community Builders", guest: true },
];

export function MobileAppBar() {
  const [location] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Unified user hub
  const dashboardLink = "/scout";

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-bottom-nav border-t border-white/10"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          height: "calc(var(--bottom-nav-height, 64px) + env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex items-center justify-around py-2 px-1">
          {mobileNavItems.map((item) => {
            // Skip auth-required items if not authenticated
            if (item.auth && !isAuthenticated) return null;
            // Skip guest items if authenticated (replace with dashboard)
            if (item.href === "/" && isAuthenticated) {
              return (
                <Link key="dashboard" href={dashboardLink}>
                  <button
                    className={cn(
                      "flex flex-col items-center py-2 px-3 rounded-lg transition-all duration-200 min-w-[60px]",
                      location === dashboardLink
                        ? "text-ts-orange bg-ts-orange/15"
                        : "text-white/60 hover:text-white active:bg-white/10"
                    )}
                  >
                    <Layout className="h-5 w-5 mb-1" />
                    <span className="text-xs font-medium">Scout</span>
                  </button>
                </Link>
              );
            }

            const IconComponent = item.icon;
            const isActive =
              location === item.href ||
              (item.href === "/conversations" && location.startsWith("/chat"));

            return (
              <Link key={item.href} href={item.href}>
                <button
                  className={cn(
                    "flex flex-col items-center py-2 px-3 rounded-lg transition-all duration-200 min-w-[60px] relative",
                    isActive
                      ? "text-ts-orange bg-ts-orange/15"
                      : "text-white/60 hover:text-white active:bg-white/10"
                  )}
                >
                  <IconComponent className="h-5 w-5 mb-1" />
                  <span className="text-xs font-medium">{item.label}</span>

                  {/* Notification badge for messages */}
                  {item.href === "/conversations" && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 bg-red-500 text-white text-xs flex items-center justify-center rounded-full">
                      3
                    </Badge>
                  )}
                </button>
              </Link>
            );
          })}

          {/* More menu */}
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center py-2 px-3 rounded-lg transition-all duration-200 min-w-[60px] text-white/60 hover:text-white active:bg-white/10">
                <Menu className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="bg-tsBg border-white/10 rounded-t-2xl">
              <div className="py-4">
                <h3 className="text-white font-semibold mb-4 text-center">Quick Actions</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-6">
                  {quickActions.map((action) => {
                    const IconComponent = action.icon;
                    return (
                      <Link key={action.href} href={action.href}>
                        <button
                          onClick={() => setIsMenuOpen(false)}
                          className="flex flex-col items-center p-4 rounded-xl bg-tsCard hover:bg-tsCard transition-colors"
                        >
                          <IconComponent className="h-6 w-6 text-ts-orange mb-2" />
                          <span className="text-xs text-white/70 text-center leading-tight">
                            {action.label}
                          </span>
                        </button>
                      </Link>
                    );
                  })}
                </div>

                {/* Additional actions */}
                <div className="space-y-2">
                  <Link href="/notifications">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-white/70 hover:text-white hover:bg-tsCard"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Bell className="h-5 w-5 mr-3" />
                      Notifications
                    </Button>
                  </Link>
                  <Link href="/settings">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-white/70 hover:text-white hover:bg-tsCard"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Settings className="h-5 w-5 mr-3" />
                      Settings
                    </Button>
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Spacer for bottom navigation */}
      <div className="md:hidden h-16"></div>
    </>
  );
}
