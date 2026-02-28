import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle, User, MapPin, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  confidenceScore?: number; // 0.0-1.0 (optional when policy-only)
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

export const ContactOutcomeModal: React.FC<ContactOutcomeModalProps> = ({ outcome, onClose }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [confirmed, setConfirmed] = useState(false);
  const [contactPreview, setContactPreview] = useState(() => outcome.reasonForContact || "");

  // Create conversation mutation
  const createConversation = useMutation({
    mutationFn: async () => {
      const preview = (contactPreview || "").trim();
      if (!preview) {
        throw new Error("Contact preview required");
      }

      // Always ensure we have a durable decision card backing authority.
      // Scout recommendation IDs are not yet validated end-to-end, so decision_card is the safe gate.
      let decisionCardId = outcome.sourceDecisionCardId;
      if (!decisionCardId) {
        const res = await fetch("/api/decision-cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            intent: outcome.suggestedIntent,
            decisionScope: outcome.decisionScope,
            title: outcome.decisionTitle,
            description: preview,
          }),
        });

        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(error.message || "Failed to create decision card");
        }

        const json = await res.json().catch(() => ({}));
        decisionCardId = json?.id;
        if (!decisionCardId) {
          throw new Error("Failed to create decision card");
        }
      }

      const res = await fetch("/api/social/conversations/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          targetUserId: outcome.targetUserId,
          intent: outcome.suggestedIntent,
          authorityGate: "decision_card",
          sourceDecisionCardId: decisionCardId,
          confidenceScore: outcome.confidenceScore,
          decisionScope: outcome.decisionScope,
          contactPreview: preview,
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
      if (data?.pending) {
        toast({
          title: "Request sent",
          description: `${outcome.targetUserName} will review your first-contact preview before chat opens.`,
        });
        setLocation("/messages");
        return;
      }
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
    if (!(contactPreview || "").trim()) {
      toast({
        title: "Preview required",
        description: "Write a short first-contact preview before sending.",
        variant: "destructive",
      });
      return;
    }
    createConversation.mutate();
  };

  const hasConfidenceScore = typeof outcome.confidenceScore === "number";
  const policyScore: number = hasConfidenceScore ? outcome.confidenceScore! : 0.7;

  // Determine confidence level styling
  const getConfidenceColor = () => {
    if (policyScore >= 0.85) return "text-emerald-600";
    if (policyScore >= 0.7) return "text-blue-600";
    if (policyScore >= 0.5) return "text-amber-600";
    return "text-white/60";
  };

  const getConfidenceIcon = () => {
    if (policyScore >= 0.7) {
      return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
    }
    return <AlertCircle className="w-5 h-5 text-amber-600" />;
  };

  const getConfidenceText = () => {
    if (policyScore >= 0.85) return "High confidence match";
    if (policyScore >= 0.7) return "Good match";
    if (policyScore >= 0.5) return "Proceed with caution";
    return "Consider alternatives";
  };

  // Block if confidence too low
  if (hasConfidenceScore && policyScore < 0.3) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-white/60 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-white/70">Contact blocked by policy</h2>
              <p className="text-sm text-white/60">
                Scout policy indicates this contact is not a good match for your decision right now.
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-white/10">
            <h3 className="text-sm font-medium text-white/70">Why policy blocked this</h3>
            <ul className="space-y-1 text-sm text-white/60">
              {outcome.riskFlags.map((flag, i) => (
                <li key={i}>* {flag}</li>
              ))}
            </ul>
          </div>

          <div className="pt-4 flex gap-2">
            <Button onClick={onClose} className="flex-1 bg-tsCard hover:bg-white/5 text-white">
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
          <h2 className="text-lg font-semibold text-white/70">
            Ready to contact {outcome.targetUserName}?
          </h2>
          <p className="text-sm text-white/60">Decision: {outcome.decisionTitle}</p>
          <p className="text-xs text-white/60">
            Contact remains intent-based until this authority-confirmed step is completed.
          </p>
        </div>

        {/* Section 1: Who */}
        <div className="space-y-3 pt-2 border-t border-white/10">
          <h3 className="text-sm font-medium text-white/70">Who you'll contact</h3>
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
              <User className="w-6 h-6 text-white/60" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-medium text-white/70">{outcome.targetUserName}</p>
              <div className="flex items-center gap-1 text-sm text-white/60">
                <Briefcase className="w-3.5 h-3.5" />
                <span>{outcome.targetRole}</span>
              </div>
              {outcome.targetLocation && (
                <div className="flex items-center gap-1 text-sm text-white/60">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{outcome.targetLocation}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Why (Intent - LOCKED) */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white/70">Why you're contacting them</h3>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-1">
            <p className="text-sm font-medium text-white/70 capitalize">
              Intent: {outcome.suggestedIntent}
            </p>
            <p className="text-xs text-white/60 mt-2">
              Intent is locked by policy. Your preview is editable.
            </p>
            <div className="mt-2">
              <Textarea
                value={contactPreview}
                onChange={(e) => setContactPreview(e.target.value)}
                placeholder="Write a short intro and why you want to connect"
                rows={4}
                className="bg-white border-white/10 text-white/70"
                disabled={createConversation.isPending}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Scout Assessment */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white/70">Policy assessment</h3>
          <div className="flex items-start gap-3">
            {getConfidenceIcon()}
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-white/70">{getConfidenceText()}</p>
              {hasConfidenceScore ? (
                <p className={`text-sm font-mono ${getConfidenceColor()}`}>
                  Confidence: {(policyScore * 100).toFixed(0)}%
                </p>
              ) : (
                <p className="text-xs text-white/60">Authority verified by Scout policy.</p>
              )}
            </div>
          </div>

          {/* Risk Flags (if caution level) */}
          {policyScore < 0.7 && outcome.riskFlags.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1 mt-2">
              <p className="text-sm font-medium text-amber-900">Caution points</p>
              <ul className="space-y-0.5 text-sm text-amber-800">
                {outcome.riskFlags.slice(0, 2).map((flag, i) => (
                  <li key={i}>* {flag}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Section 4: Confirmation Checkbox */}
        <div className="pt-2 border-t border-white/10">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-white/10 text-white/70 focus:ring-ts-orange/70"
            />
            <span className="text-sm text-white/70">
              I understand this contact is for <strong>{outcome.suggestedIntent}</strong> related to{" "}
              <strong>{outcome.decisionTitle}</strong>, and Scout has verified the authority for
              this contact.
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-white/10 text-white/70"
            disabled={createConversation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1 bg-tsCard hover:bg-white/5 text-white"
            disabled={!confirmed || createConversation.isPending}
          >
            {createConversation.isPending ? "Connecting..." : "Confirm & Send"}
          </Button>
        </div>
      </div>
    </div>
  );
};
