import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Clock, AlertCircle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressFeedbackProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
  className?: string;
  showRewards?: boolean;
}

export function ProgressFeedback({ 
  currentStep, 
  totalSteps, 
  stepLabels, 
  className,
  showRewards = true 
}: ProgressFeedbackProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress((currentStep / totalSteps) * 100);
    }, 100);
    return () => clearTimeout(timer);
  }, [currentStep, totalSteps]);

  const getStepIcon = (stepIndex: number) => {
    if (stepIndex < currentStep) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (stepIndex === currentStep) {
      return <Clock className="h-4 w-4 text-orange-500 pulse-glow" />;
    } else {
      return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Card className={cn("bg-navy-700 border-navy-600", className)}>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Progress Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">
              Progress: Step {currentStep} of {totalSteps}
            </h3>
            {showRewards && currentStep === totalSteps && (
              <div className="flex items-center text-yellow-500 notification-bounce">
                <Trophy className="h-5 w-5 mr-1" />
                <span className="text-sm font-medium">Complete!</span>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress 
              value={animatedProgress} 
              className="h-2 progress-fill"
            />
            <p className="text-sm text-gray-400">
              {Math.round(animatedProgress)}% Complete
            </p>
          </div>

          {/* Step List */}
          <div className="space-y-3">
            {stepLabels.map((label, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center space-x-3 p-2 rounded-lg transition-all",
                  index === currentStep ? "bg-orange-500/10 border border-orange-500/30" : "",
                  index < currentStep ? "opacity-75" : ""
                )}
              >
                {getStepIcon(index)}
                <span 
                  className={cn(
                    "text-sm",
                    index < currentStep ? "text-green-400 line-through" : 
                    index === currentStep ? "text-white font-medium" : 
                    "text-gray-500"
                  )}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Motivational Message */}
          {currentStep < totalSteps && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
              <p className="text-sm text-orange-200">
                {currentStep === 0 ? "Let's get started! Complete each step to find the perfect contractor." :
                 currentStep < totalSteps / 2 ? "Great progress! You're making excellent choices." :
                 "Almost there! Just a few more steps to connect with contractors."}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Quick feedback toast component for instant actions
export function QuickFeedbackToast({ 
  message, 
  type = 'success',
  onClose 
}: { 
  message: string; 
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
    info: <Clock className="h-5 w-5 text-blue-500" />
  };

  const backgrounds = {
    success: "bg-green-900/90 border-green-500/50",
    error: "bg-red-900/90 border-red-500/50", 
    info: "bg-blue-900/90 border-blue-500/50"
  };

  return (
    <div className={cn(
      "fixed top-4 right-4 z-50 flex items-center space-x-3 p-4 rounded-lg border notification-bounce",
      backgrounds[type]
    )}>
      {icons[type]}
      <span className="text-white text-sm font-medium">{message}</span>
      <button 
        onClick={onClose}
        className="text-white/70 hover:text-white ml-2"
      >
        ×
      </button>
    </div>
  );
}