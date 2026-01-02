/**
 * PostOnboardingActionCard Component
 * Renders deterministic action buttons based on confirmed claims
 * 
 * No LLM, no chat. Pure navigation UI.
 */

import React, { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import type { PostOnboardingAction } from './scoutModeTypes';
import type { ClaimType } from './claimTypes';

export interface PostOnboardingActionCardProps {
  claims: ClaimType[];
  actions: PostOnboardingAction[];
  onActionSelected: (actionId: string, destination: string) => void;
}

export const PostOnboardingActionCard: React.FC<PostOnboardingActionCardProps> = ({
  claims,
  actions,
  onActionSelected,
}) => {
  // Telemetry: card shown
  useEffect(() => {
    if (typeof window !== 'undefined' && window.__telemetry) {
      window.__telemetry('post_onboarding_action_card_shown', {
        claims,
        actionCount: actions.length,
      });
    }
  }, [claims, actions.length]);

  const handleActionClick = (action: PostOnboardingAction) => {
    onActionSelected(action.id, action.destination);
  };

  if (actions.length === 0) {
    return (
      <Card className="p-4 border border-slate-200 rounded-lg">
        <p className="text-sm text-slate-600">
          Great! You're all set. What would you like to do next?
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4 border border-slate-200 rounded-lg">
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-900">
          What's next?
        </p>
        <p className="text-xs text-slate-600">
          Based on what you're looking to do, here are some next steps:
        </p>

        <div className="space-y-2 pt-2">
          {actions.map((action) => (
            <Button
              key={action.id}
              onClick={() => handleActionClick(action)}
              className={`w-full justify-between ${
                action.primary
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
              }`}
            >
              <span>{action.label}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          ))}
        </div>

        <p className="text-xs text-slate-500 pt-2">
          You can always change your mind. Scout is here to help anytime.
        </p>
      </div>
    </Card>
  );
};
