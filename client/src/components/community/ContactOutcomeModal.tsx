import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle, User, MapPin, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type Intent = "hire" | "advise" | "collaborate" | "reconnect";

const intentLabels: Record<Intent, string> = {
  hire: "a job or service",
  advise: "asking for advice",
  collaborate: "working together",
  reconnect: "reconnecting",
};

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
      // Recommendation IDs are not yet validated end-to-end, so decision_card is the safe gate.
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
          description: `${outcome.targetUserName} will review your first message before the conversation opens.`,
        });
        setLocation("/messages");
        return;
      }
      toast({
        title: "Conversation ready",
        description: `You can now message ${outcome.targetUserName}.`,
      });
      // Navigate to conversation
      setLocation(`/messages?thread=${data.threadId}`);
    },
    onError: (error: Error) => {
      toast({
        title: "That message didn't send",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const handleConfirm = () => {
    if (!confirmed) {
      toast({
        title: "One quick check",
        description: "Confirm that your message is about this post before sending it.",
        variant: "destructive",
      });
      return;
    }
    if (!(contactPreview || "").trim()) {
      toast({
        title: "Write a message first",
        description: "Tell them why you're reaching out.",
        variant: "destructive",
      });
      return;
    }
    createConversation.mutate();
  };

  const hasConfidenceScore = typeof outcome.confidenceScore === "number";
  const policyScore = hasConfidenceScore ? Number(outcome.confidenceScore) : 0.7;

  // Keep the policy check internal. The user only sees what they can do next.
  if (hasConfidenceScore && policyScore < 0.3) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-white/10 bg-[color:var(--surface-card)] p-6 shadow-2xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-amber-400" />
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-white">Tell us a little more</h2>
              <p className="text-sm text-white/60">
                We need a clearer reason for the message before it can be sent.
              </p>
            </div>
          </div>
          <div className="pt-4 flex gap-2">
            <Button onClick={onClose} className="flex-1">
              Go back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md space-y-5 rounded-xl border border-white/10 bg-[color:var(--surface-card)] p-6 shadow-2xl">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-white">
            Send a message to {outcome.targetUserName}
          </h2>
          <p className="text-sm text-white/60">Review what they will see first.</p>
        </div>

        <div className="space-y-3 border-t border-white/10 pt-3">
          <h3 className="text-sm font-medium text-white/80">Who you&apos;ll contact</h3>
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              <User className="h-6 w-6 text-white/60" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-medium text-white">{outcome.targetUserName}</p>
              <div className="flex items-center gap-1 text-sm text-white/60">
                <Briefcase className="h-3.5 w-3.5" />
                <span>{outcome.targetRole}</span>
              </div>
              {outcome.targetLocation ? (
                <div className="flex items-center gap-1 text-sm text-white/60">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{outcome.targetLocation}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white/80">Your first message</h3>
          <Textarea
            value={contactPreview}
            onChange={(event) => setContactPreview(event.target.value)}
            placeholder="Introduce yourself and explain why you're reaching out."
            rows={4}
            className="border-white/10 bg-black/20 text-white"
            disabled={createConversation.isPending}
          />
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-white">Your privacy stays protected</p>
            <p className="text-xs text-white/60">
              Personal contact details stay private until both people choose to share them.
            </p>
          </div>
        </div>

        <div className="border-t border-white/10 pt-3">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-white/10 text-ts-orange focus:ring-ts-orange/70"
            />
            <span className="text-sm text-white/70">
              I&apos;m contacting this person about {intentLabels[outcome.suggestedIntent]} and will
              keep the conversation respectful and on-topic.
            </span>
          </label>
        </div>

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
            className="flex-1"
            disabled={!confirmed || createConversation.isPending}
          >
            {createConversation.isPending ? "Sending..." : "Send message"}
          </Button>
        </div>
      </div>
    </div>
  );
};
