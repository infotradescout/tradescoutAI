import React, { useState } from 'react';
import { X, Grid3x3, Home, Users, ShoppingBag, Building2, Utensils, Settings, BookOpen } from 'lucide-react';
import { Link } from 'wouter';

interface AppModule {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  category: 'commerce' | 'community' | 'tools' | 'admin' | 'learning';
  badge?: string;
}

const APP_MODULES: AppModule[] = [
  // Commerce & Marketplace
  {
    id: 'contractors',
    name: 'Find Contractors',
    description: 'Search verified local contractors by trade',
    icon: <Building2 className="w-8 h-8" />,
    route: '/contractors',
    category: 'commerce',
  },
  {
    id: 'marketplace',
    name: 'Marketplace',
    description: 'Buy and sell local items and services',
    icon: <ShoppingBag className="w-8 h-8" />,
    route: '/marketplace',
    category: 'commerce',
  },
  {
    id: 'daily-deals',
    name: 'Daily Deals',
    description: 'Exclusive local deals and discounts',
    icon: <ShoppingBag className="w-8 h-8" />,
    route: '/daily-deals',
    category: 'commerce',
    badge: 'HOT',
  },
  {
    id: 'mealscout',
    name: 'MealScout',
    description: 'Find food trucks and local eats',
    icon: <Utensils className="w-8 h-8" />,
    route: '/mealscout',
    category: 'commerce',
  },
  
  // Community
  {
    id: 'community-builder',
    name: 'Community Builder',
    description: 'Start and manage local initiatives',
    icon: <Users className="w-8 h-8" />,
    route: '/community-builder',
    category: 'community',
  },
  {
    id: 'community-feed',
    name: 'Community Feed',
    description: 'Local news and neighbor posts',
    icon: <Users className="w-8 h-8" />,
    route: '/community-feed',
    category: 'community',
  },
  {
    id: 'county-hub',
    name: 'County Hub',
    description: 'County-specific info and insights',
    icon: <Home className="w-8 h-8" />,
    route: '/county-hub',
    category: 'community',
  },
  
  // Tools
  {
    id: 'messages',
    name: 'Messages',
    description: 'Chat with contractors and buyers',
    icon: <Users className="w-8 h-8" />,
    route: '/messages',
    category: 'tools',
  },
  {
    id: 'quotes',
    name: 'Quote Calculator',
    description: 'Estimate project costs locally',
    icon: <ShoppingBag className="w-8 h-8" />,
    route: '/quote-calculator',
    category: 'tools',
  },
  
  // Learning & Resources
  {
    id: 'resource-center',
    name: 'Resource Center',
    description: 'Guides, tips, and best practices',
    icon: <BookOpen className="w-8 h-8" />,
    route: '/resource-center',
    category: 'learning',
  },
  
  // Admin (conditional - shown if authenticated as admin)
  {
    id: 'admin',
    name: 'Admin Panel',
    description: 'System administration and analytics',
    icon: <Settings className="w-8 h-8" />,
    route: '/admin',
    category: 'admin',
  },
];

const CATEGORY_LABELS = {
  commerce: '🛍️ Marketplace',
  community: '👥 Community',
  tools: '⚙️ Tools',
  admin: '🔧 Admin',
  learning: '📚 Learning',
};

interface AppDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

export default function AppDrawer({ isOpen, onClose, isAdmin = false }: AppDrawerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter modules based on auth
  const visibleModules = isAdmin
    ? APP_MODULES
    : APP_MODULES.filter(m => m.category !== 'admin');

  const categories = Array.from(
    new Set(visibleModules.map(m => m.category))
  ).sort();

  // Group modules by category
  const groupedModules = categories.reduce(
    (acc, cat) => {
      acc[cat] = visibleModules.filter(m => m.category === cat);
      return acc;
    },
    {} as Record<string, AppModule[]>
  );

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-lg transform transition-transform duration-300 ease-in-out z-50 flex flex-col overflow-hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Grid3x3 className="w-6 h-6" />
            <h2 className="text-xl font-bold">TradeScout Apps</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {categories.map(category => (
            <div key={category} className="border-b last:border-b-0">
              {/* Category Header */}
              <button
                onClick={() =>
                  setSelectedCategory(
                    selectedCategory === category ? null : category
                  )
                }
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition font-semibold text-gray-800"
              >
                <span>{CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}</span>
                <span
                  className={`text-gray-400 transition-transform ${
                    selectedCategory === category ? 'rotate-180' : ''
                  }`}
                >
                  ▼
                </span>
              </button>

              {/* Modules in Category */}
              {selectedCategory === category && (
                <div className="bg-gray-50 border-t">
                  {groupedModules[category].map(module => (
                    <Link key={module.id} href={module.route}>
                      <a className="block px-6 py-4 hover:bg-gray-100 transition border-b last:border-b-0">
                        <div className="flex items-start gap-4">
                          <div className="text-blue-600 flex-shrink-0 mt-1">
                            {module.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">
                                {module.name}
                              </h3>
                              {module.badge && (
                                <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-1 rounded">
                                  {module.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {module.description}
                            </p>
                          </div>
                          <span className="text-gray-400 flex-shrink-0">→</span>
                        </div>
                      </a>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 p-4 text-center text-sm text-gray-600">
          <p>TradeScout OS • Your Local Operating System</p>
        </div>
      </div>
    </>
  );
}
