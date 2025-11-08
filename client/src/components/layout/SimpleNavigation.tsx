import React, { memo, useState } from 'react';
import { Link } from 'wouter';
import { useAuth, useLogout } from '@/hooks/useAuth';
import { 
  User, Bell, LogOut, LayoutDashboard, Search, ChevronDown,
  Home, Wrench, ShoppingCart, Users, TrendingUp, Award,
  Building, DollarSign, FileText, Settings as SettingsIcon,
  HelpCircle, Star, Coffee, Map, BarChart3, Megaphone,
  Shield, Package, Heart, Briefcase, Car, MapPin
} from 'lucide-react';

const SimpleNavigation = memo(function SimpleNavigation() {
  const { user, isAuthenticated } = useAuth();
  const logout = useLogout();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const handleMouseEnter = (menu: string) => setActiveDropdown(menu);
  const handleMouseLeave = () => setActiveDropdown(null);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl border-b border-white/10">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 rounded-xl flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                TradeScout
              </span>
            </Link>
          </div>

          {/* Main Navigation */}
          <div className="hidden xl:flex items-center space-x-1">
            {/* Contractors */}
            <div 
              className="relative"
              onMouseEnter={() => handleMouseEnter('contractors')}
              onMouseLeave={handleMouseLeave}
            >
              <button className="px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors flex items-center gap-1">
                <Wrench className="w-4 h-4" />
                Contractors
                <ChevronDown className="w-3 h-3" />
              </button>
              {activeDropdown === 'contractors' && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-2">
                  <Link href="/find-contractors" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                    <div className="font-medium">Find Contractors</div>
                    <div className="text-xs text-gray-400">Search by trade & location</div>
                  </Link>
                  <Link href="/contractor-board" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                    <div className="font-medium">Contractor Directory</div>
                    <div className="text-xs text-gray-400">Browse all professionals</div>
                  </Link>
                  <Link href="/quote-calculator" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                    <div className="font-medium">Quote Calculator</div>
                    <div className="text-xs text-gray-400">Estimate project costs</div>
                  </Link>
                  <Link href="/leaderboard" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                    <div className="font-medium">Leaderboard</div>
                    <div className="text-xs text-gray-400">Top rated contractors</div>
                  </Link>
                  <Link href="/contractor-apply" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50 border-t border-slate-700">
                    <div className="font-medium">Become a Contractor</div>
                    <div className="text-xs text-gray-400">Join our network</div>
                  </Link>
                </div>
              )}
            </div>

            {/* Marketplace */}
            <div 
              className="relative"
              onMouseEnter={() => handleMouseEnter('marketplace')}
              onMouseLeave={handleMouseLeave}
            >
              <button className="px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors flex items-center gap-1">
                <ShoppingCart className="w-4 h-4" />
                Marketplace
                <ChevronDown className="w-3 h-3" />
              </button>
              {activeDropdown === 'marketplace' && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-2">
                  <Link href="/marketplace" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                    <div className="font-medium flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      General Marketplace
                    </div>
                    <div className="text-xs text-gray-400">Tools, materials & services</div>
                  </Link>
                  <Link href="/worker-marketplace" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                    <div className="font-medium flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Helpers & Workers
                    </div>
                    <div className="text-xs text-gray-400">Find skilled helpers</div>
                  </Link>
                  <Link href="/vehicle-marketplace" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                    <div className="font-medium flex items-center gap-2">
                      <Car className="w-4 h-4" />
                      Vehicles & Equipment
                    </div>
                    <div className="text-xs text-gray-400">Cars, trucks, machinery</div>
                  </Link>
                  <Link href="/real-estate-marketplace" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                    <div className="font-medium flex items-center gap-2">
                      <Building className="w-4 h-4" />
                      Real Estate
                    </div>
                    <div className="text-xs text-gray-400">Properties & land</div>
                  </Link>
                  <Link href="/handmade-marketplace" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                    <div className="font-medium flex items-center gap-2">
                      <Heart className="w-4 h-4" />
                      Handmade Goods
                    </div>
                    <div className="text-xs text-gray-400">Custom crafts & art</div>
                  </Link>
                </div>
              )}
            </div>

            {/* Community */}
            <div 
              className="relative"
              onMouseEnter={() => handleMouseEnter('community')}
              onMouseLeave={handleMouseLeave}
            >
              <button className="px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors flex items-center gap-1">
                <Users className="w-4 h-4" />
                Community
                <ChevronDown className="w-3 h-3" />
              </button>
              {activeDropdown === 'community' && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-2">
                  <Link href="/groups" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                    <div className="font-medium">Groups</div>
                    <div className="text-xs text-gray-400">Join local communities</div>
                  </Link>
                  <Link href="/county-hub" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                    <div className="font-medium flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      County Hub
                    </div>
                    <div className="text-xs text-gray-400">Explore your county</div>
                  </Link>
                  <Link href="/hoa-management" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                    <div className="font-medium">HOA Management</div>
                    <div className="text-xs text-gray-400">For community associations</div>
                  </Link>
                  <Link href="/community-feed" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                    <div className="font-medium">Community Feed</div>
                    <div className="text-xs text-gray-400">Latest updates & posts</div>
                  </Link>
                  <Link href="/county-directory" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                    <div className="font-medium">County Directory</div>
                    <div className="text-xs text-gray-400">Browse all counties</div>
                  </Link>
                </div>
              )}
            </div>

            {/* Business Tools */}
            {isAuthenticated && (
              <div 
                className="relative"
                onMouseEnter={() => handleMouseEnter('business')}
                onMouseLeave={handleMouseLeave}
              >
                <button className="px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors flex items-center gap-1">
                  <Briefcase className="w-4 h-4" />
                  Business
                  <ChevronDown className="w-3 h-3" />
                </button>
                {activeDropdown === 'business' && (
                  <div className="absolute top-full left-0 mt-1 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-2">
                    <Link href="/boosts" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                      <div className="font-medium flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Boosts & Promotions
                      </div>
                      <div className="text-xs text-gray-400">Increase visibility</div>
                    </Link>
                    <Link href="/analytics" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                      <div className="font-medium flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Analytics
                      </div>
                      <div className="text-xs text-gray-400">Track performance</div>
                    </Link>
                    <Link href="/crm" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                      <div className="font-medium">CRM</div>
                      <div className="text-xs text-gray-400">Manage customers</div>
                    </Link>
                    <Link href="/project-tracker" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                      <div className="font-medium">Project Tracker</div>
                      <div className="text-xs text-gray-400">Track your work</div>
                    </Link>
                    <Link href="/ad-creator" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                      <div className="font-medium flex items-center gap-2">
                        <Megaphone className="w-4 h-4" />
                        Ad Creator
                      </div>
                      <div className="text-xs text-gray-400">Create promotions</div>
                    </Link>
                    <Link href="/accelerator" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50 border-t border-slate-700">
                      <div className="font-medium flex items-center gap-2">
                        <Award className="w-4 h-4" />
                        Accelerator Program
                      </div>
                      <div className="text-xs text-gray-400">Premium membership</div>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* More */}
            <div 
              className="relative"
              onMouseEnter={() => handleMouseEnter('more')}
              onMouseLeave={handleMouseLeave}
            >
              <button className="px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors flex items-center gap-1">
                More
                <ChevronDown className="w-3 h-3" />
              </button>
              {activeDropdown === 'more' && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-2">
                  <Link href="/daily-deals" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                    <div className="font-medium flex items-center gap-2">
                      <Star className="w-4 h-4" />
                      Daily Deals
                    </div>
                    <div className="text-xs text-gray-400">Today's best offers</div>
                  </Link>
                  <Link href="/affiliate" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                    <div className="font-medium flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Affiliate Program
                    </div>
                    <div className="text-xs text-gray-400">Earn commissions</div>
                  </Link>
                  <Link href="/foundation" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                    <div className="font-medium flex items-center gap-2">
                      <Heart className="w-4 h-4" />
                      Foundation
                    </div>
                    <div className="text-xs text-gray-400">Mike Rowe Works</div>
                  </Link>
                  <Link href="/coffee-company" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                    <div className="font-medium flex items-center gap-2">
                      <Coffee className="w-4 h-4" />
                      Coffee Company
                    </div>
                    <div className="text-xs text-gray-400">Support & shop</div>
                  </Link>
                  <Link href="/resource-center" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                    <div className="font-medium">Resource Center</div>
                    <div className="text-xs text-gray-400">Guides & tutorials</div>
                  </Link>
                  <Link href="/about" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50 border-t border-slate-700">
                    <div className="font-medium">About TradeScout</div>
                  </Link>
                  <Link href="/contact" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                    <div className="font-medium">Contact Us</div>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {/* Dashboard */}
                <Link href="/dashboard" className="hidden lg:flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </Link>

                {/* Notifications */}
                <Link href="/notifications" className="relative p-2 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
                </Link>

                {/* User Menu */}
                <div 
                  className="relative"
                  onMouseEnter={() => handleMouseEnter('user')}
                  onMouseLeave={handleMouseLeave}
                >
                  <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors">
                    <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {user?.firstName?.[0] || 'U'}
                    </div>
                    <ChevronDown className="w-3 h-3 hidden lg:block" />
                  </button>
                  {activeDropdown === 'user' && (
                    <div className="absolute top-full right-0 mt-1 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-2">
                      <div className="px-4 py-2 border-b border-slate-700">
                        <div className="text-sm font-medium text-white">{user?.firstName} {user?.lastName}</div>
                        <div className="text-xs text-gray-400">{user?.email}</div>
                      </div>
                      <Link href="/profile" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Profile
                        </div>
                      </Link>
                      <Link href="/settings" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                        <div className="flex items-center gap-2">
                          <SettingsIcon className="w-4 h-4" />
                          Settings
                        </div>
                      </Link>
                      <Link href="/payment-history" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          Payments
                        </div>
                      </Link>
                      <Link href="/help" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50">
                        <div className="flex items-center gap-2">
                          <HelpCircle className="w-4 h-4" />
                          Help
                        </div>
                      </Link>
                      {(user?.role === 'head_admin' || user?.role === 'ops_admin') && (
                        <Link href="/admin-panel" className="block px-4 py-2 text-sm text-orange-400 hover:text-orange-300 hover:bg-slate-700/50 border-t border-slate-700">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Admin Panel
                          </div>
                        </Link>
                      )}
                      <button 
                        onClick={logout}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50 border-t border-slate-700"
                      >
                        <div className="flex items-center gap-2">
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors">
                  Sign In
                </Link>
                <Link href="/signup" className="px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg font-semibold text-white text-sm hover:scale-105 transition-transform shadow-lg">
                  Get Started
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
