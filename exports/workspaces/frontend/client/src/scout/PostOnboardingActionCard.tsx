/**
 * PostOnboardingActionCard Component
 * Renders deterministic action buttons based on confirmed claims
 *
 * No LLM, no chat. Pure navigation UI.
 */

import React, { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import type { PostOnboardingAction } from "./scoutModeTypes";
import type { ClaimType } from "./claimTypes";

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
    if (typeof window !== "undefined" && window.__telemetry) {
      window.__telemetry("post_onboarding_action_card_shown", {
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
      <Card
        className="p-4 rounded-lg"
        style={{
          borderColor: "var(--border-subtle)",
          backgroundColor: "var(--surface-card)",
        }}
      >
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Great! You're all set. What would you like to do next?
        </p>
      </Card>
    );
  }

  return (
    <Card
      className="p-4 rounded-lg"
      style={{
        borderColor: "var(--border-subtle)",
        backgroundColor: "var(--surface-card)",
      }}
    >
      <div className="space-y-3">
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Ready for the next move?
        </p>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Here are the clearest ways to keep going.
        </p>

        <div className="space-y-2 pt-2">
          {actions.map((action) => (
            <Button
              key={action.id}
              onClick={() => handleActionClick(action)}
              className="w-full justify-between"
              style={
                action.primary
                  ? {
                      backgroundColor: "var(--theme-accent-primary)",
                      color: "var(--ts-text-on-accent, #0B0F14)",
                    }
                  : {
                      backgroundColor:
                        "color-mix(in oklab, var(--surface-intermediate) 90%, transparent)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-subtle)",
                    }
              }
            >
              <span>{action.label}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          ))}
        </div>

        <p className="text-xs pt-2" style={{ color: "var(--text-secondary)" }}>
          Not sure yet? You can come back to Scout anytime.
        </p>
      </div>
    </Card>
  );
};
