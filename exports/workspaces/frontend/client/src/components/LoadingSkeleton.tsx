import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  className?: string;
  variant?: 'default' | 'card' | 'text' | 'avatar' | 'button';
  lines?: number;
}

export function LoadingSkeleton({ 
  className, 
  variant = 'default', 
  lines = 1 
}: LoadingSkeletonProps) {
  const baseClasses = "animate-pulse bg-white/10 skeleton";
  
  const variants = {
    default: "h-4 rounded",
    card: "h-32 rounded-lg",
    text: "h-4 rounded",
    avatar: "h-10 w-10 rounded-full",
    button: "h-10 rounded-md"
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn(
              baseClasses,
              variants.text,
              index === lines - 1 ? "w-3/4" : "w-full",
              className
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn(baseClasses, variants[variant], className)} />
  );
}

export function ContractorCardSkeleton() {
  return (
    <div className="bg-tsCard border border-white/10 rounded-lg p-6 space-y-4">
      <div className="flex items-center space-x-4">
        <LoadingSkeleton variant="avatar" />
        <div className="space-y-2 flex-1">
          <LoadingSkeleton className="h-5 w-3/4" />
          <LoadingSkeleton className="h-4 w-1/2" />
        </div>
      </div>
      <LoadingSkeleton variant="text" lines={2} />
      <div className="flex space-x-2">
        <LoadingSkeleton className="h-6 w-16 rounded-full" />
        <LoadingSkeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function DashboardCardSkeleton() {
  return (
    <div className="bg-tsCard border border-white/10 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <LoadingSkeleton className="h-6 w-32" />
        <LoadingSkeleton variant="avatar" className="h-8 w-8" />
      </div>
      <LoadingSkeleton className="h-8 w-20 mb-2" />
      <LoadingSkeleton className="h-4 w-full" />
    </div>
  );
}