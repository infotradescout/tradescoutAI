
import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { 
  Home, Search, MessageCircle, User, Menu, 
  Wrench, Layout, Bell, Heart, Calculator, Package, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const mobileNavItems = [
  { href: '/', icon: Home, label: 'Home', guest: true },
  { href: '/contractors/board', icon: Search, label: 'Find', guest: true },
  { href: '/conversations', icon: MessageCircle, label: 'Messages', auth: true },
  { href: '/profile', icon: User, label: 'Profile', auth: true },
];

const quickActions = [
  { href: '/quote-calculator', icon: Calculator, label: 'Quote', guest: true },
  { href: '/marketplace', icon: Package, label: 'Exchange', guest: true },
  { href: '/contractors/board', icon: Wrench, label: 'Join Network', guest: true },
  { href: '/foundation', icon: Heart, label: 'Foundation', guest: true },
];

export function MobileAppBar() {
  const [location] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isContractor = user?.role && ['contractor_user', 'accelerator_member'].includes(user.role);
  const isHomeowner = user?.role === 'homeowner';

  // Get dashboard link based on user type
  const dashboardLink = isContractor ? '/contractor-dashboard' : 
                       isHomeowner ? '/homeowner-dashboard' : '/dashboard';

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-navy-900/95 backdrop-blur-lg border-t border-navy-700">
        <div className="flex items-center justify-around py-2 px-1">
          {mobileNavItems.map((item) => {
            // Skip auth-required items if not authenticated
            if (item.auth && !isAuthenticated) return null;
            // Skip guest items if authenticated (replace with dashboard)
            if (item.href === '/' && isAuthenticated) {
              return (
                <Link key="dashboard" href={dashboardLink}>
                  <button
                    className={cn(
                      "flex flex-col items-center py-2 px-3 rounded-lg transition-all duration-200 min-w-[60px]",
                      location === dashboardLink
                        ? "text-orange-500 bg-orange-500/15"
                        : "text-gray-400 hover:text-white active:bg-white/10"
                    )}
                  >
                    <Layout className="h-5 w-5 mb-1" />
                    <span className="text-xs font-medium">Dashboard</span>
                  </button>
                </Link>
              );
            }

            const IconComponent = item.icon;
            const isActive = location === item.href || 
                           (item.href === '/conversations' && location.startsWith('/chat'));

            return (
              <Link key={item.href} href={item.href}>
                <button
                  className={cn(
                    "flex flex-col items-center py-2 px-3 rounded-lg transition-all duration-200 min-w-[60px] relative",
                    isActive
                      ? "text-orange-500 bg-orange-500/15"
                      : "text-gray-400 hover:text-white active:bg-white/10"
                  )}
                >
                  <IconComponent className="h-5 w-5 mb-1" />
                  <span className="text-xs font-medium">{item.label}</span>
                  
                  {/* Notification badge for messages */}
                  {item.href === '/conversations' && (
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
              <button className="flex flex-col items-center py-2 px-3 rounded-lg transition-all duration-200 min-w-[60px] text-gray-400 hover:text-white active:bg-white/10">
                <Menu className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="bg-navy-900 border-navy-700 rounded-t-2xl">
              <div className="py-4">
                <h3 className="text-white font-semibold mb-4 text-center">Quick Actions</h3>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {quickActions.map((action) => {
                    const IconComponent = action.icon;
                    return (
                      <Link key={action.href} href={action.href}>
                        <button
                          onClick={() => setIsMenuOpen(false)}
                          className="flex flex-col items-center p-4 rounded-xl bg-navy-800 hover:bg-navy-700 transition-colors"
                        >
                          <IconComponent className="h-6 w-6 text-orange-500 mb-2" />
                          <span className="text-xs text-gray-300 text-center leading-tight">
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
                      className="w-full justify-start text-gray-300 hover:text-white hover:bg-navy-800"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Bell className="h-5 w-5 mr-3" />
                      Notifications
                    </Button>
                  </Link>
                  <Link href="/settings">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-gray-300 hover:text-white hover:bg-navy-800"
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
