import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Star, 
  Smile, 
  Meh, 
  Frown,
  ThumbsUp,
  MessageSquare,
  X,
  Gift
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface UserSatisfactionWidgetProps {
  onClose?: () => void;
  trigger?: 'time' | 'action' | 'manual';
  context?: string;
}

export function UserSatisfactionWidget({ 
  onClose,
  trigger = 'manual',
  context = 'general'
}: UserSatisfactionWidgetProps) {
  const [step, setStep] = useState<'rating' | 'feedback' | 'thanks'>('rating');
  const [rating, setRating] = useState(0);
  const [satisfaction, setSatisfaction] = useState<'happy' | 'neutral' | 'sad' | null>(null);
  const [feedback, setFeedback] = useState('');
  const { toast } = useToast();

  const handleRatingSubmit = () => {
    if (rating > 0 || satisfaction) {
      setStep('feedback');
    }
  };

  const handleFeedbackSubmit = async () => {
    // Submit feedback to backend
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          satisfaction,
          feedback,
          context,
          trigger
        })
      });
      
      setStep('thanks');
      
      // Show reward if high rating
      if (rating >= 4) {
        toast({
          title: "Thank you! 🎉",
          description: "Your positive feedback helps us improve. Check your notifications for a small reward!",
        });
      }
    } catch (error) {
      toast({
        title: "Thanks for your feedback!",
        description: "Your input helps us make TradeScout better.",
      });
      setStep('thanks');
    }
  };

  const getSatisfactionColor = (type: string) => {
    switch (type) {
      case 'happy': return 'text-green-500 bg-green-500/20 border-green-500/30';
      case 'neutral': return 'text-yellow-500 bg-yellow-500/20 border-yellow-500/30';
      case 'sad': return 'text-red-500 bg-red-500/20 border-red-500/30';
      default: return 'text-gray-500 bg-gray-500/20 border-gray-500/30';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 notification-bounce">
      <Card className="bg-navy-700 border-navy-600 shadow-2xl">
        <CardContent className="p-6">
          {/* Close Button */}
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-2 right-2 text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {step === 'rating' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">
                How was your experience?
              </h3>
              
              {/* Star Rating */}
              <div className="space-y-2">
                <p className="text-sm text-gray-300">Rate your experience:</p>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className="transition-all hover:scale-110"
                    >
                      <Star
                        className={cn(
                          "h-6 w-6",
                          star <= rating ? "text-yellow-500 fill-current" : "text-gray-500"
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Emoji Satisfaction */}
              <div className="space-y-2">
                <p className="text-sm text-gray-300">Quick feedback:</p>
                <div className="flex space-x-3">
                  {[
                    { type: 'happy', icon: Smile, label: 'Great!' },
                    { type: 'neutral', icon: Meh, label: 'Okay' },
                    { type: 'sad', icon: Frown, label: 'Poor' }
                  ].map(({ type, icon: Icon, label }) => (
                    <button
                      key={type}
                      onClick={() => setSatisfaction(type as any)}
                      className={cn(
                        "flex flex-col items-center p-3 rounded-lg border transition-all",
                        satisfaction === type 
                          ? getSatisfactionColor(type)
                          : "text-gray-500 bg-gray-500/10 border-gray-500/20 hover:border-gray-500/40"
                      )}
                    >
                      <Icon className="h-6 w-6 mb-1" />
                      <span className="text-xs">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Button 
                onClick={handleRatingSubmit}
                disabled={rating === 0 && !satisfaction}
                className="w-full"
              >
                Continue
              </Button>
            </div>
          )}

          {step === 'feedback' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">
                Tell us more (optional)
              </h3>
              
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="What could we improve? Any specific features you love?"
                className="w-full p-3 bg-navy-800 border border-navy-600 rounded-lg text-white text-sm resize-none"
                rows={4}
              />

              <div className="flex space-x-2">
                <Button 
                  onClick={() => setStep('rating')}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  Back
                </Button>
                <Button 
                  onClick={handleFeedbackSubmit}
                  size="sm"
                  className="flex-1"
                >
                  Submit
                </Button>
              </div>
            </div>
          )}

          {step === 'thanks' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                {rating >= 4 ? (
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                    <Gift className="h-8 w-8 text-green-500" />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <ThumbsUp className="h-8 w-8 text-blue-500" />
                  </div>
                )}
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Thank you!
                </h3>
                <p className="text-sm text-gray-300">
                  Your feedback helps us make TradeScout better for everyone.
                </p>
                {rating >= 4 && (
                  <Badge className="bg-green-500/20 text-green-400 mt-2">
                    <Gift className="h-3 w-3 mr-1" />
                    Reward earned!
                  </Badge>
                )}
              </div>

              <Button 
                onClick={onClose}
                size="sm" 
                className="w-full"
              >
                Done
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Hook to trigger satisfaction widget based on user actions
export function useSatisfactionTracking() {
  const [showWidget, setShowWidget] = useState(false);

  const triggerSatisfactionWidget = (context?: string) => {
    // Show widget based on certain conditions
    const shouldShow = Math.random() < 0.3; // 30% chance
    if (shouldShow) {
      setShowWidget(true);
    }
  };

  useEffect(() => {
    // Trigger after certain time on site
    const timer = setTimeout(() => {
      triggerSatisfactionWidget('time-based');
    }, 120000); // 2 minutes

    return () => clearTimeout(timer);
  }, []);

  return {
    showWidget,
    setShowWidget,
    triggerSatisfactionWidget
  };
}