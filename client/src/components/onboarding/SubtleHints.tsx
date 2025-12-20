import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Users, Calculator, Search, Star, MessageCircle, Bug } from 'lucide-react';

interface FeatureHint {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: string;
  actionUrl?: string;
  delay: number; // When to show this hint (in seconds)
}

export function SubtleHints() {
  const { user } = useAuth();
  const [activeHint, setActiveHint] = useState<FeatureHint | null>(null);
  const [shownHints, setShownHints] = useState<Set<string>>(new Set());

  const getHintsForRole = (role: string): FeatureHint[] => {
    if (role === 'contractor_user') {
      return [
        {
          id: 'contractor-welcome',
          title: "Welcome, Contractor!",
          description: "Complete your profile to showcase your business to homeowners",
          icon: <Users className="w-5 h-5 text-orange-500" />,
          action: "Complete Profile",
          actionUrl: "/profile",
          delay: 2
        },
        {
          id: 'contractor-board',
          title: "Get Listed",
          description: "Your profile will appear on the contractor board once verified",
          icon: <Search className="w-5 h-5 text-blue-500" />,
          action: "View Board",
          actionUrl: "/contractors",
          delay: 8
        },
        {
          id: 'recommendations',
          title: "Build Reputation",
          description: "Ask satisfied customers to leave recommendations",
          icon: <Star className="w-5 h-5 text-yellow-500" />,
          delay: 14
        },
        {
          id: 'bug-report',
          title: "Found a Bug?",
          description: "Use the red bug report button (bottom-right) to send instant feedback with screenshots",
          icon: <Bug className="w-5 h-5 text-red-500" />,
          delay: 20
        }
      ];
    } else {
      return [
        {
          id: 'homeowner-welcome',
          title: "Welcome to TradeScout!",
          description: "Find verified contractors and get instant project quotes",
          icon: <Users className="w-5 h-5 text-orange-500" />,
          delay: 2
        },
        {
          id: 'find-contractors',
          title: "Browse Contractors",
          description: "Filter by location and trade to find the perfect match",
          icon: <Search className="w-5 h-5 text-blue-500" />,
          action: "Browse Now",
          actionUrl: "/contractors",
          delay: 8
        },
        {
          id: 'scout-estimates',
          title: "Ask Scout for Estimates",
          description: "Get a ballpark cost before contacting contractors",
          icon: <Calculator className="w-5 h-5 text-green-500" />,
          action: "Ask Scout",
          actionUrl: "/scout?intent=estimate",
          delay: 14
        },
        {
          id: 'bug-report',
          title: "Found a Bug?",
          description: "Use the red bug report button (bottom-right) to send instant feedback with screenshots",
          icon: <Bug className="w-5 h-5 text-red-500" />,
          delay: 20
        }
      ];
    }
  };

  useEffect(() => {
    if (user && user.role && !user.preferences?.completedTours?.includes('subtle-hints')) {
      const hints = getHintsForRole(user.role);

      const timers: number[] = [];
      const finalTimer = window.setTimeout(() => {
        markHintsCompleted();
      }, 25000); // After 25 seconds

      hints.forEach((hint) => {
        const timer = window.setTimeout(() => {
          if (!shownHints.has(hint.id)) {
            setActiveHint(hint);
            setShownHints(prev => new Set([...Array.from(prev), hint.id]));

            // Auto-hide after 6 seconds
            window.setTimeout(() => {
              setActiveHint(current => current?.id === hint.id ? null : current);
            }, 6000);
          }
        }, hint.delay * 1000);

        timers.push(timer);
      });

      return () => {
        timers.forEach(timer => window.clearTimeout(timer));
        window.clearTimeout(finalTimer);
      };
    }
  }, [user]);

  const markHintsCompleted = async () => {
    try {
      await fetch('/api/users/preferences', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedTours: [...(user?.preferences?.completedTours || []), 'subtle-hints']
        })
      });
    } catch (error) {
      console.error('Failed to update hints completion:', error);
    }
  };

  const handleAction = (url?: string) => {
    if (url) {
      window.location.href = url;
    }
    setActiveHint(null);
  };

  const handleDismiss = () => {
    setActiveHint(null);
  };

  if (!activeHint || !user) return null;

  return (
    <div className="fixed top-20 right-4 z-40 max-w-sm">
      <Card className="bg-white dark:bg-navy-800 border border-orange-200 dark:border-orange-500/30 shadow-lg animate-in slide-in-from-right-2 duration-500">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              {activeHint.icon}
              <div>
                <h4 className="font-medium text-sm text-gray-900 dark:text-white">
                  {activeHint.title}
                </h4>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-navy-700 opacity-60 hover:opacity-100"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>

          <p className="text-xs text-gray-600 dark:text-gray-300 mb-3 leading-relaxed">
            {activeHint.description}
          </p>

          {activeHint.action && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleAction(activeHint.actionUrl)}
                className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-3 py-1.5 h-7 font-medium"
              >
                {activeHint.action}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="text-xs px-3 py-1.5 h-7 hover:bg-gray-100 dark:hover:bg-navy-700"
              >
                Later
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}