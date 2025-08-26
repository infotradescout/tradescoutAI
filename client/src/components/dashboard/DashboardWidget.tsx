import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContextualTooltip } from "@/components/ui/contextual-tooltip";
import { 
  TrendingUp, 
  Users, 
  Calendar, 
  DollarSign, 
  Star, 
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight
} from "lucide-react";

interface DashboardWidgetProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    label: string;
  };
  status?: 'success' | 'warning' | 'danger' | 'info';
  actionLabel?: string;
  actionHref?: string;
  tooltipContent?: string;
  tooltipIllustration?: 'wrench' | 'hammer' | 'hardhat' | 'drill' | 'screwdriver' | 'paintbrush' | 'ruler';
  className?: string;
  children?: ReactNode;
}

export function DashboardWidget({
  title,
  value,
  subtitle,
  icon,
  trend,
  status,
  actionLabel,
  actionHref,
  tooltipContent,
  tooltipIllustration = 'wrench',
  className = "",
  children
}: DashboardWidgetProps) {
  
  const statusStyles = {
    success: 'border-green-500/30 bg-green-500/5',
    warning: 'border-yellow-500/30 bg-yellow-500/5',
    danger: 'border-red-500/30 bg-red-500/5',
    info: 'border-blue-500/30 bg-blue-500/5'
  };

  const statusIcons = {
    success: CheckCircle,
    warning: AlertTriangle,
    danger: AlertTriangle,
    info: Clock
  };

  return (
    <Card className={`bg-navy-800 border-navy-600 hover:border-orange-500/50 transition-all duration-300 ${status ? statusStyles[status] : ''} ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center justify-between text-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              {icon}
            </div>
            <span>{title}</span>
          </div>
          {tooltipContent && (
            <ContextualTooltip
              content={tooltipContent}
              illustration={tooltipIllustration}
              variant="contractor"
              size="sm"
            />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Value */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold text-white">{value}</div>
            {subtitle && (
              <div className="text-sm text-gray-400 mt-1">{subtitle}</div>
            )}
          </div>
          
          {/* Status Indicator */}
          {status && (
            <div className={`p-2 rounded-lg ${
              status === 'success' ? 'bg-green-500/20 text-green-400' :
              status === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
              status === 'danger' ? 'bg-red-500/20 text-red-400' :
              'bg-blue-500/20 text-blue-400'
            }`}>
              {statusIcons[status] && 
                (() => {
                  const StatusIcon = statusIcons[status];
                  return <StatusIcon className="h-5 w-5" />;
                })()
              }
            </div>
          )}
        </div>

        {/* Trend Indicator */}
        {trend && (
          <div className="flex items-center gap-2">
            <TrendingUp className={`h-4 w-4 ${trend.isPositive ? 'text-green-400' : 'text-red-400 rotate-180'}`} />
            <span className={`text-sm font-medium ${trend.isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {trend.isPositive ? '+' : ''}{trend.value}%
            </span>
            <span className="text-sm text-gray-400">{trend.label}</span>
          </div>
        )}

        {/* Children Content */}
        {children && (
          <div className="mt-4">
            {children}
          </div>
        )}

        {/* Action Button */}
        {actionLabel && actionHref && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full mt-4 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 border border-orange-500/30 hover:border-orange-500/50"
            asChild
          >
            <a href={actionHref} className="flex items-center justify-center gap-2">
              {actionLabel}
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Pre-built dashboard widgets for common use cases
export function LeadsWidget({ count, newToday }: { count: number; newToday: number }) {
  return (
    <DashboardWidget
      title="Active Connections"
      value={count}
      subtitle="Total inquiries"
      icon={<Users className="h-5 w-5 text-orange-400" />}
      trend={newToday > 0 ? {
        value: newToday,
        isPositive: true,
        label: "new today"
      } : undefined}
      status={count > 10 ? 'success' : count > 5 ? 'warning' : 'info'}
      tooltipContent="Track customer inquiries and manage your sales pipeline like organizing your job queue"
      tooltipIllustration="wrench"
      actionLabel="Manage Connections"
      actionHref="/lead-management"
    />
  );
}

export function RevenueWidget({ amount, monthlyChange }: { amount: number; monthlyChange: number }) {
  return (
    <DashboardWidget
      title="Monthly Revenue"
      value={`$${amount.toLocaleString()}`}
      subtitle="This month"
      icon={<DollarSign className="h-5 w-5 text-orange-400" />}
      trend={{
        value: Math.abs(monthlyChange),
        isPositive: monthlyChange >= 0,
        label: "vs last month"
      }}
      status={monthlyChange >= 0 ? 'success' : 'warning'}
      tooltipContent="Track your earnings like monitoring job profitability - keep an eye on trends to grow your business"
      tooltipIllustration="ruler"
      actionLabel="View Reports"
      actionHref="/dashboard/financials"
    />
  );
}

export function RatingWidget({ rating, recommendationCount }: { rating: number; recommendationCount: number }) {
  return (
    <DashboardWidget
      title="Customer Rating"
      value={`${rating.toFixed(1)} ⭐`}
      subtitle={`From ${recommendationCount} reviews`}
      icon={<Star className="h-5 w-5 text-orange-400" />}
      status={rating >= 4.5 ? 'success' : rating >= 4.0 ? 'warning' : 'danger'}
      tooltipContent="Your reputation score - like your Better Business Bureau rating but for the digital age"
      tooltipIllustration="paintbrush"
      actionLabel="Manage Recommendations"
      actionHref="/recommendations"
    />
  );
}

export function MessagesWidget({ unreadCount }: { unreadCount: number }) {
  return (
    <DashboardWidget
      title="Messages"
      value={unreadCount}
      subtitle="Unread messages"
      icon={<MessageSquare className="h-5 w-5 text-orange-400" />}
      status={unreadCount > 5 ? 'warning' : unreadCount > 0 ? 'info' : 'success'}
      tooltipContent="Stay on top of customer communication - quick responses win more jobs than low prices"
      tooltipIllustration="hammer"
      actionLabel="View Messages"
      actionHref="/dashboard/messages"
    />
  );
}

export function ScheduleWidget({ upcomingJobs }: { upcomingJobs: number }) {
  return (
    <DashboardWidget
      title="Upcoming Jobs"
      value={upcomingJobs}
      subtitle="Next 7 days"
      icon={<Calendar className="h-5 w-5 text-orange-400" />}
      status={upcomingJobs > 0 ? 'success' : 'info'}
      tooltipContent="Your work schedule - like your project calendar but smarter about timing and resources"
      tooltipIllustration="drill"
      actionLabel="View Schedule"
      actionHref="/dashboard/schedule"
    >
      {upcomingJobs === 0 && (
        <Badge variant="outline" className="text-orange-300 border-orange-500/30">
          Schedule is clear
        </Badge>
      )}
    </DashboardWidget>
  );
}