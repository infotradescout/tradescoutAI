import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle, User, MapPin, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type Intent = "hire" | "advise" | "collaborate" | "reconnect";

export interface ContactOutcome {
  targetUserId: string;
  targetUserName: string;
  targetRole: string;
  targetLocation?: string;
  suggestedIntent: Intent;
  reasonForContact: string;
  confidenceScore: number; // 0.0-1.0
  riskFlags: string[];
  sourceDecisionCardId?: string; // Optional: only if from Decision Card
  sourceScoutRecommendationId?: string; // Optional: only if from Scout rec
  decisionScope: string;
  decisionTitle: string;
}

interface ContactOutcomeModalProps {
  outcome: ContactOutcome;
  onClose: () => void;
}

export const ContactOutcomeModal: React.FC<ContactOutcomeModalProps> = ({
  outcome,
  onClose,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [confirmed, setConfirmed] = useState(false);

  // Create conversation mutation
  const createConversation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/social/conversations/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          targetUserId: outcome.targetUserId,
          intent: outcome.suggestedIntent,
          // D1: If from Decision Card
          ...(outcome.sourceDecisionCardId && {
            authorityGate: "decision_card",
            sourceDecisionCardId: outcome.sourceDecisionCardId,
          }),
          // D2: If from Scout Recommendation
          ...(outcome.sourceScoutRecommendationId && {
            authorityGate: "scout_recommendation",
            initiatedFromScoutRecommendationId: outcome.sourceScoutRecommendationId,
          }),
          confidenceScore: outcome.confidenceScore,
          decisionScope: outcome.decisionScope,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to start conversation");
      }

      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/conversations"] });
      toast({
        title: "Contact initiated",
        description: `You can now message ${outcome.targetUserName}`,
      });
      // Navigate to conversation
      setLocation(`/messages?thread=${data.threadId}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Contact failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConfirm = () => {
    if (!confirmed) {
      toast({
        title: "Confirmation required",
        description: "Please confirm you understand the intent before proceeding",
        variant: "destructive",
      });
      return;
    }
    createConversation.mutate();
  };

  // Determine confidence level styling
  const getConfidenceColor = () => {
    if (outcome.confidenceScore >= 0.85) return "text-emerald-600";
    if (outcome.confidenceScore >= 0.70) return "text-blue-600";
    if (outcome.confidenceScore >= 0.50) return "text-amber-600";
    return "text-slate-600";
  };

  const getConfidenceIcon = () => {
    if (outcome.confidenceScore >= 0.70) {
      return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
    }
    return <AlertCircle className="w-5 h-5 text-amber-600" />;
  };

  const getConfidenceText = () => {
    if (outcome.confidenceScore >= 0.85) return "High confidence match";
    if (outcome.confidenceScore >= 0.70) return "Good match";
    if (outcome.confidenceScore >= 0.50) return "Proceed with caution";
    return "Consider alternatives";
  };

  // Block if confidence too low
  if (outcome.confidenceScore < 0.30) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-slate-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">
                Contact not recommended
              </h2>
              <p className="text-sm text-slate-600">
                Scout's assessment shows this contact is not a good match for your decision right now.
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <h3 className="text-sm font-medium text-slate-900">Why Scout blocked this</h3>
            <ul className="space-y-1 text-sm text-slate-600">
              {outcome.riskFlags.map((flag, i) => (
                <li key={i}>• {flag}</li>
              ))}
            </ul>
          </div>

          <div className="pt-4 flex gap-2">
            <Button
              onClick={onClose}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white"
            >
              Understood
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-5">
        {/* Header: Decision Context */}
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">
            Ready to contact {outcome.targetUserName}?
          </h2>
          <p className="text-sm text-slate-600">
            Decision: {outcome.decisionTitle}
          </p>
        </div>

        {/* Section 1: Who */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <h3 className="text-sm font-medium text-slate-900">Who you'll contact</h3>
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
              <User className="w-6 h-6 text-slate-500" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-medium text-slate-900">{outcome.targetUserName}</p>
              <div className="flex items-center gap-1 text-sm text-slate-600">
                <Briefcase className="w-3.5 h-3.5" />
                <span>{outcome.targetRole}</span>
              </div>
              {outcome.targetLocation && (
                <div className="flex items-center gap-1 text-sm text-slate-500">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{outcome.targetLocation}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Why (Intent - READ ONLY) */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-900">Why you're contacting them</h3>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
            <p className="text-sm font-medium text-slate-900 capitalize">
              Intent: {outcome.suggestedIntent}
            </p>
            <p className="text-sm text-slate-600">{outcome.reasonForContact}</p>
            <p className="text-xs text-slate-500 italic mt-2">
              This intent was determined by Scout and cannot be changed.
            </p>
          </div>
        </div>

        {/* Section 3: Scout Assessment */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-900">Scout's assessment</h3>
          <div className="flex items-start gap-3">
            {getConfidenceIcon()}
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-slate-900">
                {getConfidenceText()}
              </p>
              <p className={`text-sm font-mono ${getConfidenceColor()}`}>
                Confidence: {(outcome.confidenceScore * 100).toFixed(0)}%
              </p>
            </div>
          </div>

          {/* Risk Flags (if caution level) */}
          {outcome.confidenceScore < 0.70 && outcome.riskFlags.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1 mt-2">
              <p className="text-sm font-medium text-amber-900">Caution points</p>
              <ul className="space-y-0.5 text-sm text-amber-800">
                {outcome.riskFlags.slice(0, 2).map((flag, i) => (
                  <li key={i}>• {flag}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Section 4: Confirmation Checkbox */}
        <div className="pt-2 border-t border-slate-100">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <span className="text-sm text-slate-700">
              I understand this contact is for <strong>{outcome.suggestedIntent}</strong> related to{" "}
              <strong>{outcome.decisionTitle}</strong>, and Scout has assessed this match at{" "}
              <strong>{(outcome.confidenceScore * 100).toFixed(0)}%</strong> confidence.
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-slate-300 text-slate-700"
            disabled={createConversation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white"
            disabled={!confirmed || createConversation.isPending}
          >
            {createConversation.isPending ? "Connecting..." : "Confirm & Send"}
          </Button>
        </div>
      </div>
    </div>
  );
};
