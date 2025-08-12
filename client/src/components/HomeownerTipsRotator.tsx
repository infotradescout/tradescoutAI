import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Snowflake, 
  Sun, 
  Leaf, 
  CloudRain,
  Calendar,
  Clock,
  Thermometer,
  Droplets,
  Shield,
  Lightbulb,
  Wrench,
  Home
} from "lucide-react";

interface HomeownerTip {
  id: string;
  title: string;
  description: string;
  category: 'seasonal' | 'monthly' | 'daily' | 'weekly';
  season?: 'winter' | 'spring' | 'summer' | 'fall';
  month?: number;
  urgency: 'low' | 'medium' | 'high';
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  actionText: string;
  actionUrl: string;
}

const HOMEOWNER_TIPS: HomeownerTip[] = [
  // Winter Tips
  {
    id: 'winter-prep',
    title: 'Winter Home Maintenance',
    description: 'Get your home ready for winter with our recommended contractor checklist.',
    category: 'seasonal',
    season: 'winter',
    urgency: 'high',
    icon: Snowflake,
    gradient: 'from-blue-500/10 to-blue-600/10',
    actionText: 'View Checklist',
    actionUrl: '/tips/winter-maintenance'
  },
  {
    id: 'heating-check',
    title: 'Heating System Check',
    description: 'Schedule annual HVAC maintenance before the cold hits hard.',
    category: 'seasonal',
    season: 'winter',
    urgency: 'high',
    icon: Thermometer,
    gradient: 'from-red-500/10 to-orange-600/10',
    actionText: 'Find HVAC Pros',
    actionUrl: '/contractors?service=hvac'
  },
  
  // Spring Tips
  {
    id: 'spring-cleaning',
    title: 'Spring Deep Clean',
    description: 'Time for gutters, power washing, and exterior maintenance.',
    category: 'seasonal',
    season: 'spring',
    urgency: 'medium',
    icon: CloudRain,
    gradient: 'from-green-500/10 to-green-600/10',
    actionText: 'Get Quotes',
    actionUrl: '/quote-calculator'
  },
  {
    id: 'roof-inspection',
    title: 'Roof Inspection Season',
    description: 'Check for winter damage and prepare for spring storms.',
    category: 'seasonal',
    season: 'spring',
    urgency: 'high',
    icon: Shield,
    gradient: 'from-purple-500/10 to-purple-600/10',
    actionText: 'Find Roofers',
    actionUrl: '/contractors?service=roofing'
  },
  
  // Summer Tips
  {
    id: 'ac-maintenance',
    title: 'AC Tune-Up Time',
    description: 'Beat the heat with professional cooling system maintenance.',
    category: 'seasonal',
    season: 'summer',
    urgency: 'high',
    icon: Sun,
    gradient: 'from-yellow-500/10 to-orange-600/10',
    actionText: 'Schedule Service',
    actionUrl: '/contractors?service=hvac'
  },
  {
    id: 'deck-maintenance',
    title: 'Deck & Patio Care',
    description: 'Perfect weather for staining, sealing, and outdoor repairs.',
    category: 'seasonal',
    season: 'summer',
    urgency: 'medium',
    icon: Home,
    gradient: 'from-amber-500/10 to-amber-600/10',
    actionText: 'Find Contractors',
    actionUrl: '/contractors?service=decking'
  },
  
  // Fall Tips
  {
    id: 'fall-prep',
    title: 'Fall Preparation',
    description: 'Weatherproofing and insulation before winter arrives.',
    category: 'seasonal',
    season: 'fall',
    urgency: 'high',
    icon: Leaf,
    gradient: 'from-orange-500/10 to-red-600/10',
    actionText: 'Weatherproof Now',
    actionUrl: '/contractors?service=insulation'
  },
  
  // Monthly Tips
  {
    id: 'filter-change',
    title: 'Monthly Filter Change',
    description: 'Replace HVAC filters to maintain air quality and efficiency.',
    category: 'monthly',
    urgency: 'medium',
    icon: Droplets,
    gradient: 'from-blue-500/10 to-cyan-600/10',
    actionText: 'Order Filters',
    actionUrl: '/exchange?category=filters'
  },
  {
    id: 'safety-check',
    title: 'Safety Device Check',
    description: 'Test smoke detectors, carbon monoxide alarms, and security systems.',
    category: 'monthly',
    urgency: 'high',
    icon: Shield,
    gradient: 'from-red-500/10 to-red-600/10',
    actionText: 'Safety Guide',
    actionUrl: '/tips/home-safety'
  },
  
  // Weekly Tips
  {
    id: 'maintenance-walk',
    title: 'Weekly Home Walk-Through',
    description: 'Check for leaks, cracks, and small issues before they become big problems.',
    category: 'weekly',
    urgency: 'low',
    icon: Wrench,
    gradient: 'from-gray-500/10 to-gray-600/10',
    actionText: 'Inspection Guide',
    actionUrl: '/tips/weekly-checklist'
  },
  
  // Daily Tips
  {
    id: 'energy-tips',
    title: 'Daily Energy Savings',
    description: 'Simple habits that reduce utility bills and improve home efficiency.',
    category: 'daily',
    urgency: 'low',
    icon: Lightbulb,
    gradient: 'from-yellow-500/10 to-yellow-600/10',
    actionText: 'Learn More',
    actionUrl: '/tips/energy-savings'
  }
];

interface HomeownerTipsRotatorProps {
  className?: string;
}

export function HomeownerTipsRotator({ className = "" }: HomeownerTipsRotatorProps) {
  const [currentTip, setCurrentTip] = useState<HomeownerTip | null>(null);

  const getCurrentSeason = (): 'winter' | 'spring' | 'summer' | 'fall' => {
    const month = new Date().getMonth() + 1; // 1-12
    if (month >= 12 || month <= 2) return 'winter';
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    return 'fall';
  };

  const getRelevantTips = (): HomeownerTip[] => {
    const now = new Date();
    const currentSeason = getCurrentSeason();
    const currentMonth = now.getMonth() + 1;
    const dayOfWeek = now.getDay();
    const dayOfMonth = now.getDate();

    // Priority system: seasonal > monthly > weekly > daily
    let relevantTips: HomeownerTip[] = [];

    // Add seasonal tips (highest priority)
    const seasonalTips = HOMEOWNER_TIPS.filter(tip => 
      tip.category === 'seasonal' && tip.season === currentSeason
    );
    relevantTips.push(...seasonalTips);

    // Add monthly tips (second priority)
    const monthlyTips = HOMEOWNER_TIPS.filter(tip => tip.category === 'monthly');
    relevantTips.push(...monthlyTips);

    // Add weekly tips (Sunday = 0, so show weekly tips on Sundays)
    if (dayOfWeek === 0) {
      const weeklyTips = HOMEOWNER_TIPS.filter(tip => tip.category === 'weekly');
      relevantTips.push(...weeklyTips);
    }

    // Add daily tips
    const dailyTips = HOMEOWNER_TIPS.filter(tip => tip.category === 'daily');
    relevantTips.push(...dailyTips);

    return relevantTips;
  };

  const selectTip = (): HomeownerTip => {
    const relevantTips = getRelevantTips();
    
    // Sort by urgency (high first) then by category priority
    const sortedTips = relevantTips.sort((a, b) => {
      const urgencyOrder = { high: 3, medium: 2, low: 1 };
      const categoryOrder = { seasonal: 4, monthly: 3, weekly: 2, daily: 1 };
      
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
      }
      
      return categoryOrder[b.category] - categoryOrder[a.category];
    });

    // Use date-based rotation to ensure consistent daily selection
    const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const selectedIndex = dayOfYear % sortedTips.length;
    
    return sortedTips[selectedIndex] || HOMEOWNER_TIPS[0];
  };

  useEffect(() => {
    setCurrentTip(selectTip());
    
    // Update tip daily at midnight
    const updateTip = () => setCurrentTip(selectTip());
    const now = new Date();
    const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0).getTime() - now.getTime();
    
    const timeoutId = setTimeout(() => {
      updateTip();
      // Then update every 24 hours
      const intervalId = setInterval(updateTip, 24 * 60 * 60 * 1000);
      return () => clearInterval(intervalId);
    }, msUntilMidnight);

    return () => clearTimeout(timeoutId);
  }, []);

  if (!currentTip) return null;

  const IconComponent = currentTip.icon;

  return (
    <div className={`p-4 bg-gradient-to-r ${currentTip.gradient} border border-orange-500/20 rounded-lg ${className}`}>
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-white font-semibold flex items-center gap-2">
          <IconComponent className="h-5 w-5 text-orange-500" />
          {currentTip.title}
        </h4>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          {currentTip.category === 'seasonal' && <Calendar className="h-3 w-3" />}
          {currentTip.category === 'monthly' && <Calendar className="h-3 w-3" />}
          {currentTip.category === 'weekly' && <Calendar className="h-3 w-3" />}
          {currentTip.category === 'daily' && <Clock className="h-3 w-3" />}
          <span className="capitalize">{currentTip.category}</span>
        </div>
      </div>
      <p className="text-gray-300 text-sm mb-3">
        {currentTip.description}
      </p>
      <Button 
        size="sm" 
        className="bg-orange-500 hover:bg-orange-600 text-white"
        onClick={() => window.location.href = currentTip.actionUrl}
      >
        {currentTip.actionText}
      </Button>
    </div>
  );
}