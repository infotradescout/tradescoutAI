import { Badge } from "@/components/ui/badge";
import { Home, Car, Shield, Award } from "lucide-react";

interface ProfessionalBadgeProps {
  userRole: string;
  verificationStatus?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function ProfessionalBadge({ 
  userRole, 
  verificationStatus = 'approved', 
  size = "md",
  showText = true 
}: ProfessionalBadgeProps) {
  if (!userRole || !['realtor', 'car_salesman'].includes(userRole)) {
    return null;
  }

  if (verificationStatus !== 'approved') {
    return null;
  }

  const iconSize = size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  const textSize = size === "sm" ? "text-xs" : size === "lg" ? "text-sm" : "text-xs";

  if (userRole === 'realtor') {
    return (
      <Badge 
        variant="secondary" 
        className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-800 flex items-center gap-1.5"
      >
        <Home className={iconSize} />
        {showText && <span className={textSize}>Verified Realtor</span>}
      </Badge>
    );
  }

  if (userRole === 'car_salesman') {
    return (
      <Badge 
        variant="secondary" 
        className="bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800 flex items-center gap-1.5"
      >
        <Car className={iconSize} />
        {showText && <span className={textSize}>Licensed Dealer</span>}
      </Badge>
    );
  }

  return null;
}

interface TrustIndicatorProps {
  userRole: string;
  verificationStatus?: string;
  transactionCount?: number;
  rating?: number;
}

export function TrustIndicator({ 
  userRole, 
  verificationStatus = 'approved',
  transactionCount = 0,
  rating 
}: TrustIndicatorProps) {
  if (!userRole || !['realtor', 'car_salesman'].includes(userRole) || verificationStatus !== 'approved') {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
      <ProfessionalBadge userRole={userRole} verificationStatus={verificationStatus} size="sm" />
      
      {transactionCount > 0 && (
        <div className="flex items-center gap-1">
          <Award className="h-3 w-3" />
          <span>{transactionCount} completed</span>
        </div>
      )}
      
      {rating && rating > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-yellow-500">★</span>
          <span>{rating.toFixed(1)}</span>
        </div>
      )}
      
      <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
        <Shield className="h-3 w-3" />
        <span className="text-xs">Verified Professional</span>
      </div>
    </div>
  );
}

interface ProfessionalNetworkLinksProps {
  className?: string;
}

export function ProfessionalNetworkLinks({ className = "" }: ProfessionalNetworkLinksProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Professional Networks
      </h3>
      <div className="flex flex-col sm:flex-row gap-2">
        <a
          href="/realtor-application"
          className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-200 rounded-lg transition-colors"
        >
          <Home className="h-4 w-4" />
          Join Realtor Network
        </a>
        <a
          href="/car-salesman-application"
          className="flex items-center gap-2 px-3 py-2 text-sm bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-700 dark:text-red-200 rounded-lg transition-colors"
        >
          <Car className="h-4 w-4" />
          Join Car Sales Network
        </a>
      </div>
    </div>
  );
}