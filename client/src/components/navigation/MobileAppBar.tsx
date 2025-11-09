import { memo } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Home, Users, ShoppingCart, Wrench, User, Bell } from 'lucide-react';

const MobileAppBar = memo(function MobileAppBar() {
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();

  if (!isAuthenticated) return null;

  const navItems = [
    { icon: Home, label: 'Home', path: '/dashboard', testId: 'mobile-nav-home' },
    { icon: Users, label: 'Community', path: '/dashboard', testId: 'mobile-nav-community' },
    { icon: Wrench, label: 'Contractors', path: '/find-contractors', testId: 'mobile-nav-contractors' },
    { icon: ShoppingCart, label: 'Marketplace', path: '/marketplace', testId: 'mobile-nav-marketplace' },
    { icon: User, label: 'Profile', path: '/profile', testId: 'mobile-nav-profile' },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-lg">
      <div className="grid grid-cols-5 h-14">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          
          return (
            <Link
              key={item.path}
              href={item.path}
              data-testid={item.testId}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive
                  ? 'text-orange-600 dark:text-orange-500'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
});

export default MobileAppBar;
