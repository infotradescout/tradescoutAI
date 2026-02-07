import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  User,
  MapPin,
  Briefcase,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { ContactOutcomeModal, ContactOutcome } from "./ContactOutcomeModal";

export interface ScoutRecommendation {
  recommendationId: string;
  targetUserId: string;
  targetUserName: string;
  targetRole: string;
  targetLocation?: string;
  suggestedIntent: "hire" | "advise" | "collaborate" | "reconnect";
  reasoning: string;
  confidenceScore: number; // 0.0-1.0
  confidenceTier: "auto_allow" | "manual_confirm" | "caution" | "blocked";
  confidenceComponents: {
    expertise_match: number;
    location_match: number;
    trust_signal: number;
    past_success: number;
    availability_match: number;
  };
  riskFlags: string[];
  decisionScope?: string;
  createdAt: Date;
}

interface ScoutRecommendationCardProps {
  recommendation: ScoutRecommendation;
  onDismiss?: () => void;
}

export const ScoutRecommendationCard: React.FC<ScoutRecommendationCardProps> = ({
  recommendation,
  onDismiss,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [showContactModal, setShowContactModal] = useState(false);

  // Action mutation (accept/dismiss)
  const actionMutation = useMutation({
    mutationFn: async (action: "accept" | "dismiss") => {
      const res = await fetch(
        `/api/scout/recommendations/${recommendation.recommendationId}/action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action }),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || `Failed to ${action} recommendation`);
      }

      return res.json();
    },
  });

  const handleAccept = () => {
    // Open contact outcome modal with recommendation details
    setShowContactModal(true);
  };

  const handleDismiss = () => {
    actionMutation.mutate("dismiss", {
      onSuccess: () => {
        toast({ title: "Recommendation dismissed" });
        onDismiss?.();
      },
      onError: (error: Error) => {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      },
    });
  };

  // Get confidence styling
  const getConfidenceBadge = () => {
    const score = Math.round(recommendation.confidenceScore * 100);

    if (recommendation.confidenceTier === "auto_allow") {
      return {
        color: "bg-emerald-100 text-emerald-800 border-emerald-300",
        icon: <CheckCircle2 className="w-4 h-4" />,
        label: `${score}% match`,
      };
    }

    if (recommendation.confidenceTier === "manual_confirm") {
      return {
        color: "bg-blue-100 text-blue-800 border-blue-300",
        icon: <CheckCircle2 className="w-4 h-4" />,
        label: `${score}% match`,
      };
    }

    if (recommendation.confidenceTier === "caution") {
      return {
        color: "bg-amber-100 text-amber-800 border-amber-300",
        icon: <AlertCircle className="w-4 h-4" />,
        label: `${score}% match`,
      };
    }

    // blocked
    return {
      color: "bg-slate-100 text-slate-600 border-slate-300",
      icon: <XCircle className="w-4 h-4" />,
      label: "Not recommended",
    };
  };

  const badge = getConfidenceBadge();

  // Don't render blocked recommendations
  if (recommendation.confidenceTier === "blocked") {
    return null;
  }

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4 shadow-sm hover:shadow-md transition-shadow">
        {/* Header: governance framing */}
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <TrendingUp className="w-4 h-4" />
          <span className="font-medium">Human recommendation, Scout-governed</span>
        </div>

        {/* Target User */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
            <User className="w-6 h-6 text-slate-500" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-slate-900">{recommendation.targetUserName}</p>
              <span
                className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${badge.color}`}
              >
                {badge.icon}
                {badge.label}
              </span>
            </div>
            <div className="flex items-center gap-1 text-sm text-slate-600">
              <Briefcase className="w-3.5 h-3.5" />
              <span>{recommendation.targetRole}</span>
            </div>
            {recommendation.targetLocation && (
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <MapPin className="w-3.5 h-3.5" />
                <span>{recommendation.targetLocation}</span>
              </div>
            )}
          </div>
        </div>

        {/* Reasoning */}
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-900">Why this contact makes sense:</p>
          <p className="text-sm text-slate-600">{recommendation.reasoning}</p>
          {recommendation.decisionScope && (
            <p className="text-sm text-slate-500 italic">{recommendation.decisionScope}</p>
          )}
        </div>

        {/* Confidence Components (for transparency) */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-600">Skills match:</span>
            <span className="font-medium text-slate-900">
              {Math.round(recommendation.confidenceComponents.expertise_match * 100)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Location:</span>
            <span className="font-medium text-slate-900">
              {Math.round(recommendation.confidenceComponents.location_match * 100)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Trust signals:</span>
            <span className="font-medium text-slate-900">
              {Math.round(recommendation.confidenceComponents.trust_signal * 100)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Past success:</span>
            <span className="font-medium text-slate-900">
              {Math.round(recommendation.confidenceComponents.past_success * 100)}%
            </span>
          </div>
        </div>

        {/* Risk Flags (if caution level) */}
        {recommendation.confidenceTier === "caution" && recommendation.riskFlags.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
            <p className="text-sm font-medium text-amber-900">Considerations:</p>
            <ul className="space-y-0.5 text-sm text-amber-800">
              {recommendation.riskFlags.map((flag, i) => (
                <li key={i}>• {flag}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-slate-100">
          {recommendation.confidenceTier === "auto_allow" && (
            <Button
              onClick={handleAccept}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white"
              disabled={actionMutation.isPending}
            >
              Proceed with contact
            </Button>
          )}

          {recommendation.confidenceTier === "manual_confirm" && (
            <Button
              onClick={handleAccept}
              variant="outline"
              className="flex-1 border-slate-900 text-slate-900 hover:bg-slate-50"
              disabled={actionMutation.isPending}
            >
              Review & confirm
            </Button>
          )}

          {recommendation.confidenceTier === "caution" && (
            <Button
              onClick={handleAccept}
              variant="outline"
              className="flex-1 border-amber-600 text-amber-900 hover:bg-amber-50"
              disabled={actionMutation.isPending}
            >
              Proceed with caution
            </Button>
          )}

          <Button
            onClick={handleDismiss}
            variant="ghost"
            className="text-slate-600 hover:bg-slate-50"
            disabled={actionMutation.isPending}
          >
            Dismiss
          </Button>
        </div>
      </div>

      {/* Contact Outcome Modal */}
      {showContactModal && (
        <ContactOutcomeModal
          outcome={{
            targetUserId: recommendation.targetUserId,
            targetUserName: recommendation.targetUserName,
            targetRole: recommendation.targetRole,
            targetLocation: recommendation.targetLocation,
            suggestedIntent: recommendation.suggestedIntent,
            reasonForContact: recommendation.reasoning,
            confidenceScore: recommendation.confidenceScore,
            riskFlags: recommendation.riskFlags,
            sourceScoutRecommendationId: recommendation.recommendationId, // D2: Scout rec ID
            decisionScope: recommendation.decisionScope || "",
            decisionTitle: "Scout Recommendation",
          }}
          onClose={() => setShowContactModal(false)}
        />
      )}
    </>
  );
};
