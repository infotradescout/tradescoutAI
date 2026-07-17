import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  User,
  MapPin,
  Briefcase,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ContactOutcomeModal } from "./ContactOutcomeModal";

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
  const [showContactModal, setShowContactModal] = useState(false);
  const [showFitDetails, setShowFitDetails] = useState(false);
  const contactReason =
    recommendation.suggestedIntent === "hire"
      ? `I'm interested in your ${recommendation.targetRole} services and would like to talk about a local project.`
      : recommendation.suggestedIntent === "advise"
        ? `I'd appreciate your advice about ${recommendation.targetRole.toLowerCase()} work in my area.`
        : recommendation.suggestedIntent === "reconnect"
          ? "I'd like to reconnect and catch up."
          : "I'd like to talk about working together locally.";

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
        toast({ title: "Suggestion hidden" });
        onDismiss?.();
      },
      onError: (error: Error) => {
        console.error("Failed to dismiss community suggestion", error);
        toast({
          title: "That didn't work",
          description: "We couldn't hide this suggestion just yet. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  // Get grounded readiness styling without exposing fake precision.
  const getConfidenceBadge = () => {
    if (recommendation.confidenceTier === "auto_allow") {
      return {
        color: "bg-emerald-100 text-emerald-800 border-emerald-300",
        icon: <CheckCircle2 className="w-4 h-4" />,
        label: "Ready to review",
      };
    }

    if (recommendation.confidenceTier === "manual_confirm") {
      return {
        color: "bg-blue-100 text-blue-800 border-blue-300",
        icon: <CheckCircle2 className="w-4 h-4" />,
        label: "Review first",
      };
    }

    if (recommendation.confidenceTier === "caution") {
      return {
        color: "bg-amber-100 text-amber-800 border-amber-300",
        icon: <AlertCircle className="w-4 h-4" />,
        label: "Use care",
      };
    }

    // blocked
    return {
      color: "bg-white/5 text-white/60 border-white/10",
      icon: <XCircle className="w-4 h-4" />,
      label: "More details needed",
    };
  };

  const badge = getConfidenceBadge();

  // Don't render blocked recommendations
  if (recommendation.confidenceTier === "blocked") {
    return null;
  }

  return (
    <>
      <div className="bg-tsCard border border-white/10 rounded-lg p-4 space-y-4 shadow-sm hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="flex items-center gap-2 text-sm text-white/60">
          <TrendingUp className="w-4 h-4" />
          <span className="font-medium">Local match</span>
        </div>

        {/* Target User */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
            <User className="w-6 h-6 text-white/60" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-white/70">{recommendation.targetUserName}</p>
              <span
                className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${badge.color}`}
              >
                {badge.icon}
                {badge.label}
              </span>
            </div>
            <div className="flex items-center gap-1 text-sm text-white/60">
              <Briefcase className="w-3.5 h-3.5" />
              <span>{recommendation.targetRole}</span>
            </div>
            {recommendation.targetLocation && (
              <div className="flex items-center gap-1 text-sm text-white/60">
                <MapPin className="w-3.5 h-3.5" />
                <span>{recommendation.targetLocation}</span>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowFitDetails((current) => !current)}
          className="inline-flex items-center gap-1 text-sm font-medium text-white/70 hover:text-white"
          aria-expanded={showFitDetails}
        >
          Why this appears
          {showFitDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showFitDetails && (
          <div className="space-y-3 rounded-lg border border-white/10 bg-tsBg/60 p-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-white/70">Local fit</p>
              <p className="text-sm text-white/60">
                This profile matches the kind of {recommendation.targetRole.toLowerCase()} help
                you&apos;re looking for
                {recommendation.targetLocation ? ` near ${recommendation.targetLocation}` : ""}.
                Review the profile and choose whether you&apos;d like to connect.
              </p>
            </div>
            {recommendation.confidenceTier === "caution" && recommendation.riskFlags.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-white/70">Review notes</p>
                <p className="text-sm text-white/60">
                  A few details deserve a closer look before you connect.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-white/10">
          {recommendation.confidenceTier === "auto_allow" && (
            <Button
              onClick={handleAccept}
              className="flex-1 bg-tsCard hover:bg-white/5 text-white"
              disabled={actionMutation.isPending}
            >
              Review before contact
            </Button>
          )}

          {recommendation.confidenceTier === "manual_confirm" && (
            <Button
              onClick={handleAccept}
              variant="outline"
              className="flex-1 border-white/10 text-white/70 hover:bg-white/5"
              disabled={actionMutation.isPending}
            >
              Review details
            </Button>
          )}

          {recommendation.confidenceTier === "caution" && (
            <Button
              onClick={handleAccept}
              variant="outline"
              className="flex-1 border-amber-600 text-amber-900 hover:bg-amber-50"
              disabled={actionMutation.isPending}
            >
              Review carefully
            </Button>
          )}

          <Button
            onClick={handleDismiss}
            variant="ghost"
            className="text-white/60 hover:bg-white/5"
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
            reasonForContact: contactReason,
            confidenceScore: recommendation.confidenceScore,
            riskFlags: recommendation.riskFlags,
            sourceScoutRecommendationId: recommendation.recommendationId, // D2: Scout rec ID
            decisionScope: recommendation.decisionScope || "",
            decisionTitle: "Local suggestion",
          }}
          onClose={() => setShowContactModal(false)}
        />
      )}
    </>
  );
};
