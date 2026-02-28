import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Play, RotateCcw } from "lucide-react";
import { useOnboarding } from "./OnboardingProvider";
import { cn } from "@/lib/utils";

interface OnboardingTriggerProps {
  tourKey: string;
  children?: React.ReactNode;
  variant?: "default" | "outline" | "ghost" | "badge";
  size?: "sm" | "default" | "lg";
  className?: string;
  disabled?: boolean;
}

export function OnboardingTrigger({ 
  tourKey, 
  children, 
  variant = "outline",
  size = "sm",
  className,
  disabled = false
}: OnboardingTriggerProps) {
  const { startTour, isTourCompleted } = useOnboarding();

  const handleClick = () => {
    if (!disabled) {
      startTour(tourKey);
    }
  };

  if (variant === "badge") {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "cursor-pointer hover:bg-ts-orange/10 text-ts-orange border-ts-orange/30",
          "flex items-center gap-1",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        onClick={handleClick}
      >
        {isTourCompleted(tourKey) ? (
          <RotateCcw className="h-3 w-3" />
        ) : (
          <Lightbulb className="h-3 w-3" />
        )}
        {children || (isTourCompleted(tourKey) ? "Replay Tour" : "Take Tour")}
      </Badge>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2",
        variant === "outline" && "border-ts-orange/30 text-ts-orange hover:bg-ts-orange/10",
        className
      )}
    >
      {isTourCompleted(tourKey) ? (
        <RotateCcw className="h-4 w-4" />
      ) : (
        <Play className="h-4 w-4" />
      )}
      {children || (isTourCompleted(tourKey) ? "Replay Tour" : "Take Tour")}
    </Button>
  );
}