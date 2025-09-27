import { memo, useState } from 'react';
import { useAuth, useLogout } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Menu, X, Home, Search, Users, User, Settings, Bell } from 'lucide-react';

const MobileAppBar = memo(function MobileAppBar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user } = useAuth();
  const logout = useLogout();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Mobile App Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-between h-16 px-4">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2" onClick={closeMenu}>
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white">TradeScout</span>
          </a>

          {/* Menu Button */}
          <Button
            variant="ghost" 
            size="sm"
            onClick={toggleMenu}
            data-testid="button-mobile-menu"
            className="text-white hover:bg-white/10"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>

        {/* Mobile Menu Overlay */}
        {isMenuOpen && (
          <div className="fixed inset-0 top-16 bg-slate-900/95 backdrop-blur-xl z-40">
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {/* Main Navigation */}
                <a 
                  href="/" 
                  onClick={closeMenu}
                  data-testid="link-home"
                  className="flex items-center gap-3 p-3 rounded-lg text-white hover:bg-white/10 transition-colors"
                >
                  <Home className="w-5 h-5" />
                  <span>Home</span>
                </a>
                
                <a 
                  href="/find-contractors" 
                  onClick={closeMenu}
                  data-testid="link-find-contractors"
                  className="flex items-center gap-3 p-3 rounded-lg text-white hover:bg-white/10 transition-colors"
                >
                  <Search className="w-5 h-5" />
                  <span>Find Contractors</span>
                </a>

                <a 
                  href="/worker-marketplace" 
                  onClick={closeMenu}
                  data-testid="link-marketplace"
                  className="flex items-center gap-3 p-3 rounded-lg text-white hover:bg-white/10 transition-colors"
                >
                  <Users className="w-5 h-5" />
                  <span>Marketplace</span>
                </a>

                <a 
                  href="/groups" 
                  onClick={closeMenu}
                  data-testid="link-groups"
                  className="flex items-center gap-3 p-3 rounded-lg text-white hover:bg-white/10 transition-colors"
                >
                  <Users className="w-5 h-5" />
                  <span>Groups</span>
                </a>

                {user && (
                  <>
                    <a 
                      href="/profile" 
                      onClick={closeMenu}
                      data-testid="link-profile"
                      className="flex items-center gap-3 p-3 rounded-lg text-white hover:bg-white/10 transition-colors"
                    >
                      <User className="w-5 h-5" />
                      <span>Profile</span>
                    </a>

                    <a 
                      href="/notifications" 
                      onClick={closeMenu}
                      data-testid="link-notifications"
                      className="flex items-center gap-3 p-3 rounded-lg text-white hover:bg-white/10 transition-colors"
                    >
                      <Bell className="w-5 h-5" />
                      <span>Notifications</span>
                    </a>
                  </>
                )}
              </div>

              {/* User Section */}
              <div className="border-t border-white/10 p-4">
                {user ? (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-300 px-3">
                      Signed in as {user.email}
                    </div>
                    <Button
                      onClick={() => {
                        logout();
                        closeMenu();
                      }}
                      data-testid="button-sign-out"
                      variant="outline"
                      className="w-full text-white border-white/20 hover:bg-white/10"
                    >
                      Sign Out
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <a href="/login" onClick={closeMenu}>
                      <Button 
                        variant="outline" 
                        className="w-full text-white border-white/20 hover:bg-white/10"
                        data-testid="button-sign-in"
                      >
                        Sign In
                      </Button>
                    </a>
                    <a href="/signup" onClick={closeMenu}>
                      <Button 
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                        data-testid="button-sign-up"
                      >
                        Sign Up
                      </Button>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Spacer for mobile content */}
      <div className="lg:hidden h-16"></div>
    </>
  );
});

export default MobileAppBar;