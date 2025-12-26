import { Badge } from "@/components/ui/badge";
import { getTradeDisplayName, TRADE_CATEGORIES } from "@shared/roles";
import type { TradeCategory } from "@shared/roles";
import { 
  Hammer, 
  Zap, 
  Droplet, 
  Paintbrush, 
  Trees, 
  Shield, 
  Home,
  Building,
  Settings
} from "lucide-react";

interface TradeBadgeProps {
  trade: TradeCategory;
  showIcon?: boolean;
  variant?: "default" | "secondary" | "error" | "outline";
  size?: "sm" | "md" | "lg";
}

function getTradeIcon(trade: TradeCategory) {
  // Construction & General
  if (TRADE_CATEGORIES.construction.includes(trade as any)) {
    return <Building className="h-3 w-3" />;
  }
  
  // Structural & Foundation
  if (TRADE_CATEGORIES.structural.includes(trade as any)) {
    return <Shield className="h-3 w-3" />;
  }
  
  // Building Envelope
  if (TRADE_CATEGORIES.building_envelope.includes(trade as any)) {
    return <Home className="h-3 w-3" />;
  }
  
  // Electrical & Technology
  if (TRADE_CATEGORIES.electrical.includes(trade as any)) {
    return <Zap className="h-3 w-3" />;
  }
  
  // Plumbing & HVAC
  if (TRADE_CATEGORIES.plumbing_hvac.includes(trade as any)) {
    return <Droplet className="h-3 w-3" />;
  }
  
  // Interior Finishing
  if (TRADE_CATEGORIES.interior.includes(trade as any)) {
    return <Paintbrush className="h-3 w-3" />;
  }
  
  // Kitchen & Bath
  if (TRADE_CATEGORIES.kitchen_bath.includes(trade as any)) {
    return <Settings className="h-3 w-3" />;
  }
  
  // Outdoor & Landscaping
  if (TRADE_CATEGORIES.outdoor.includes(trade as any)) {
    return <Trees className="h-3 w-3" />;
  }
  
  // Default for specialty services
  return <Hammer className="h-3 w-3" />;
}

function getTradeColor(trade: TradeCategory): string {
  // Construction & General - Blue
  if (TRADE_CATEGORIES.construction.includes(trade as any)) {
    return "bg-blue-600 text-white";
  }
  
  // Structural & Foundation - Gray
  if (TRADE_CATEGORIES.structural.includes(trade as any)) {
    return "bg-gray-600 text-white";
  }
  
  // Building Envelope - Purple
  if (TRADE_CATEGORIES.building_envelope.includes(trade as any)) {
    return "bg-purple-600 text-white";
  }
  
  // Electrical & Technology - Yellow
  if (TRADE_CATEGORIES.electrical.includes(trade as any)) {
    return "bg-yellow-600 text-black";
  }
  
  // Plumbing & HVAC - Cyan
  if (TRADE_CATEGORIES.plumbing_hvac.includes(trade as any)) {
    return "bg-cyan-600 text-white";
  }
  
  // Interior Finishing - Pink
  if (TRADE_CATEGORIES.interior.includes(trade as any)) {
    return "bg-pink-600 text-white";
  }
  
  // Kitchen & Bath - Orange
  if (TRADE_CATEGORIES.kitchen_bath.includes(trade as any)) {
    return "bg-orange-600 text-white";
  }
  
  // Outdoor & Landscaping - Green
  if (TRADE_CATEGORIES.outdoor.includes(trade as any)) {
    return "bg-green-600 text-white";
  }
  
  // Specialty Services - Indigo
  return "bg-indigo-600 text-white";
}

export function TradeBadge({ 
  trade, 
  showIcon = true, 
  variant = "default",
  size = "md"
}: TradeBadgeProps) {
  const displayName = getTradeDisplayName(trade);
  const icon = showIcon ? getTradeIcon(trade) : null;
  
  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1", 
    lg: "text-base px-3 py-1.5"
  };
  
  return (
    <Badge 
      variant={variant}
      className={`${sizeClasses[size]} ${getTradeColor(trade)} flex items-center gap-1 font-medium`}
    >
      {icon}
      {displayName}
    </Badge>
  );
}

// Trade category grouping component
interface TradeCategoryHeaderProps {
  category: keyof typeof TRADE_CATEGORIES;
  trades: TradeCategory[];
}

export function TradeCategoryHeader({ category, trades }: TradeCategoryHeaderProps) {
  const categoryNames = {
    construction: "Construction & General",
    structural: "Structural & Foundation", 
    building_envelope: "Building Envelope",
    electrical: "Electrical & Technology",
    plumbing_hvac: "Plumbing & HVAC",
    interior: "Interior Finishing",
    kitchen_bath: "Kitchen & Bath",
    outdoor: "Outdoor & Landscaping",
    specialty: "Specialty Services",
  };
  
  const categoryIcons = {
    construction: <Building className="h-4 w-4" />,
    structural: <Shield className="h-4 w-4" />,
    building_envelope: <Home className="h-4 w-4" />,
    electrical: <Zap className="h-4 w-4" />,
    plumbing_hvac: <Droplet className="h-4 w-4" />,
    interior: <Paintbrush className="h-4 w-4" />,
    kitchen_bath: <Settings className="h-4 w-4" />,
    outdoor: <Trees className="h-4 w-4" />,
    specialty: <Hammer className="h-4 w-4" />,
  };
  
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        {categoryIcons[category]}
        <h3 className="text-lg font-semibold text-foreground">
          {categoryNames[category]}
        </h3>
        <Badge variant="secondary" className="text-xs">
          {trades.length} trades
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {trades.map((trade) => (
          <TradeBadge key={trade} trade={trade} size="sm" />
        ))}
      </div>
    </div>
  );
}