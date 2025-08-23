import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Home, 
  Search, 
  Calendar, 
  Users, 
  Settings,
  Menu,
  X
} from 'lucide-react';

export const SimpleNavigation = memo(function SimpleNavigation() {
  return (
    <nav className="bg-navy-900 border-b border-navy-700 sticky top-0 z-40">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              TradeScout
            </div>
            <Badge className="ml-2 bg-green-600 text-white text-xs">
              Live
            </Badge>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-6">
            <Button 
              variant="ghost" 
              size="sm"
              className="text-slate-300 hover:text-white hover:bg-slate-700"
            >
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              className="text-slate-300 hover:text-white hover:bg-slate-700"
            >
              <Search className="w-4 h-4 mr-2" />
              Find Contractors
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              className="text-slate-300 hover:text-white hover:bg-slate-700"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Daily Deals
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              className="text-slate-300 hover:text-white hover:bg-slate-700"
            >
              <Users className="w-4 h-4 mr-2" />
              Community
            </Button>
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              size="sm"
              className="border-orange-500 text-orange-400 hover:bg-orange-500 hover:text-white"
            >
              Sign In
            </Button>
            <Button 
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Get Started
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
});

export default SimpleNavigation;