import React, { forwardRef } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, Wrench, Hammer, HardHat, Drill, Settings, Paintbrush, Ruler } from "lucide-react";

interface ContextualTooltipProps {
  content: string;
  illustration?: 'wrench' | 'hammer' | 'hardhat' | 'drill' | 'screwdriver' | 'paintbrush' | 'ruler';
  title?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'contractor' | 'homeowner';
  children?: React.ReactNode;
}

const illustrations = {
  wrench: Wrench,
  hammer: Hammer,
  hardhat: HardHat,
  drill: Drill,
  screwdriver: Settings,
  paintbrush: Paintbrush,
  ruler: Ruler
};

const contractorQuips = [
  "Like having a level - always keeping things straight!",
  "Think of it as your trusty toolbox - everything you need in one place.",
  "Just like measuring twice, cut once - we've got you covered.",
  "Better than duct tape for fixing problems!",
  "More reliable than finding a parking spot at the hardware store.",
  "Smoother than a freshly sanded surface.",
  "Works better than WD-40 on rusty hinges.",
  "More precise than a laser level.",
  "Stronger than contractor-grade coffee.",
  "Cleaner than a fresh coat of primer."
];

const wittyTips = {
  search: {
    title: "Finding What You Need",
    content: "Search works like a GPS for contractors - tells you exactly where to go without the wrong turns.",
    illustration: 'ruler' as const
  },
  filter: {
    title: "Filtering Results", 
    content: "Filters are like sorting your toolbox - keeps the 10mm socket where you can actually find it.",
    illustration: 'wrench' as const
  },
  profile: {
    title: "Your Professional Profile",
    content: "Your profile is your work truck - keep it clean, organized, and ready to impress clients.",
    illustration: 'hardhat' as const
  },
  messaging: {
    title: "Client Communication",
    content: "Good communication is like a solid foundation - everything else builds on it.",
    illustration: 'hammer' as const
  },
  scheduling: {
    title: "Project Scheduling",
    content: "Scheduling projects is like planning electrical work - one wrong move and everything goes dark.",
    illustration: 'drill' as const
  },
  pricing: {
    title: "Quote Calculator",
    content: "Our calculator is more accurate than eyeballing measurements from across the room.",
    illustration: 'ruler' as const
  },
  reviews: {
    title: "Customer Recommendations",
    content: "Recommendations are like referrals - they do the talking so you don't have to.",
    illustration: 'paintbrush' as const
  },
  tools: {
    title: "Platform Tools",
    content: "These tools are sharper than your favorite chisel and twice as useful.",
    illustration: 'screwdriver' as const
  }
};

export const ContextualTooltip = forwardRef<
  HTMLButtonElement,
  ContextualTooltipProps
>(({ 
  content, 
  illustration, 
  title, 
  placement = 'top',
  size = 'md',
  variant = 'contractor',
  children 
}, ref) => {
  const IconComponent = illustration ? illustrations[illustration] : HelpCircle;
  
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5', 
    lg: 'h-6 w-6'
  };

  const variantClasses = {
    default: 'text-gray-400 hover:text-gray-300',
    contractor: 'text-orange-400 hover:text-orange-300',
    homeowner: 'text-blue-400 hover:text-blue-300'
  };

  const TriggerButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    (props, ref) => (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center transition-colors ${variantClasses[variant]}`}
        {...props}
      >
        <IconComponent className={sizeClasses[size]} />
      </button>
    )
  );

  TriggerButton.displayName = "ContextualTooltipTrigger";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children || <TriggerButton ref={ref} />}
        </TooltipTrigger>
        <TooltipContent 
          side={placement}
          className="max-w-xs bg-navy-800 border-navy-600 text-white p-4 rounded-lg shadow-xl"
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <IconComponent className="h-6 w-6 text-orange-400" />
            </div>
            <div className="flex-1">
              {title && (
                <h4 className="font-semibold text-orange-400 mb-1">{title}</h4>
              )}
              <p className="text-sm text-gray-200">{content}</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

ContextualTooltip.displayName = "ContextualTooltip";

// Simplified tooltip components to prevent infinite loops
export function SearchTooltip({ children }: { children?: React.ReactNode }) {
  return children || null;
}

export function FilterTooltip({ children }: { children?: React.ReactNode }) {
  return children || null;
}

export function ProfileTooltip({ children }: { children?: React.ReactNode }) {
  return children || null;
}

export function MessagingTooltip({ children }: { children?: React.ReactNode }) {
  return children || null;
}

export function SchedulingTooltip({ children }: { children?: React.ReactNode }) {
  return children || null;
}

export function PricingTooltip({ children }: { children?: React.ReactNode }) {
  return children || null;
}

export function RecommendationsTooltip({ children }: { children?: React.ReactNode }) {
  return children || null;
}

export function ToolsTooltip({ children }: { children?: React.ReactNode }) {
  return children || null;
}