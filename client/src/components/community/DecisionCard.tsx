import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recordActivity } from "@/agent/activity";
import { ContactOutcomeModal, ContactOutcome } from "./ContactOutcomeModal";

type ScoutAction = "COMPLY" | "DEFER" | "BLOCK";

interface DecisionContext {
  targetName: string;
  targetRole?: string;
  communitySignal?: string;
  absenceNote?: string;
}

interface DecisionCardProps {
  action: "message" | "direct_connect" | "contact_person" | "call_business";
  context: DecisionContext;
  scoutAction: ScoutAction;
  riskFraming: string[];
  guidance?: string;
  explanation: string;
  onProceed: () => void;
  onAskScout: () => void;
  onCancel: () => void;
  // D1: Contact outcome metadata (only if action === "contact_person")
  contactOutcome?: ContactOutcome;
}

export const DecisionCard: React.FC<DecisionCardProps> = ({
  action,
  context,
  scoutAction,
  riskFraming,
  guidance,
  onProceed,
  onAskScout,
  onCancel,
  contactOutcome,
}) => {
  const actionLabel =
    action === "message"
      ? "Send message"
      : action === "contact_person"
        ? "Review message"
        : action === "call_business"
          ? "Call"
          : "Continue";
  const actionVerb =
    action === "message" ? "message" : action === "call_business" ? "call" : "connect with";

  // D1: Contact outcome modal state
  const [showContactModal, setShowContactModal] = useState(false);
  const canUseContactModal = action === "contact_person" && contactOutcome;

  const openContactModal = () => {
    if (canUseContactModal) {
      setShowContactModal(true);
      return;
    }
    onProceed();
  };

  // Track card exposure (metric: card exposure rate)
  useEffect(() => {
    recordActivity({
      type: "decision_card_shown",
      ts: new Date().toISOString(),
      meta: {
        action,
        scoutAction,
        targetRole: context.targetRole,
      },
    });
  }, [action, scoutAction, context.targetRole]);

  // Map the policy action to a user-facing guidance state.
  const guidanceState =
    scoutAction === "COMPLY" ? "safe" : scoutAction === "DEFER" ? "caution" : "blocked";

  const getGuidanceIcon = () => {
    switch (guidanceState) {
      case "safe":
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case "caution":
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      case "blocked":
        return <XCircle className="w-5 h-5 text-white/60" />;
    }
  };

  const getGuidanceText = () => {
    switch (guidanceState) {
      case "safe":
        return "Ready to continue";
      case "caution":
        return "A little more information will help";
      case "blocked":
        return "We need more information first";
    }
  };

  return (
    <div className="space-y-5 rounded-xl border border-white/10 bg-[color:var(--surface-card)] p-5 shadow-lg">
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-white">Before you {actionVerb}</h3>
        <div className="space-y-1 text-sm text-white/70">
          <p className="font-medium text-white">{context.targetName}</p>
          {context.targetRole ? <p className="text-white/60">{context.targetRole}</p> : null}
          {context.communitySignal ? (
            <p className="text-white/60">{context.communitySignal}</p>
          ) : null}
          {context.absenceNote && <p className="text-white/60 italic">{context.absenceNote}</p>}
        </div>
      </div>

      {riskFraming.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white/80">What we still need</h3>
          <div className="space-y-1">
            {riskFraming.slice(0, 2).map((risk, i) => (
              <p key={i} className="text-sm text-white/60">
                {risk}
              </p>
            ))}
          </div>
        </div>
      )}

      {guidance ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white/80">What happens next</h3>
          <div className="flex items-start gap-3">
            {getGuidanceIcon()}
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-white/70">{getGuidanceText()}</p>
              <p className="text-sm text-white/60">{guidance}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-2 pt-2 border-t border-white/10">
        <h3 className="text-sm font-medium text-white/80">Choose what to do</h3>
        <div className="flex flex-wrap gap-2">
          {/* Show "Contact now" only if COMPLY */}
          {scoutAction === "COMPLY" && (
            <Button
              onClick={() => {
                recordActivity({
                  type: "decision_card_choice",
                  ts: new Date().toISOString(),
                  meta: {
                    action,
                    scoutAction,
                    choice: "contact_now",
                  },
                });
                // D1: If contact_person outcome, show modal; otherwise proceed directly
                openContactModal();
              }}
              className="bg-tsCard hover:bg-white/5 text-white"
            >
              {actionLabel}
            </Button>
          )}

          {/* Show a request-detail path for DEFER or BLOCK */}
          {(scoutAction === "DEFER" || scoutAction === "BLOCK") && (
            <Button
              onClick={() => {
                recordActivity({
                  type: "decision_card_choice",
                  ts: new Date().toISOString(),
                  meta: {
                    action,
                    scoutAction,
                    choice: "ask_scout",
                  },
                });
                onAskScout();
              }}
              variant="outline"
              className="border-white/10 text-white/70 hover:bg-white/5"
            >
              Tell us more
            </Button>
          )}

          {/* Always show "Proceed anyway" for DEFER, require confirmation for BLOCK */}
          {scoutAction === "DEFER" && (
            <Button
              onClick={() => {
                recordActivity({
                  type: "decision_card_override",
                  ts: new Date().toISOString(),
                  meta: {
                    action,
                    scoutAction: "DEFER",
                    choice: "proceed_anyway",
                  },
                });
                openContactModal();
              }}
              variant="outline"
              className="border-white/10 text-white/70 hover:bg-white/5"
            >
              Continue without adding details
            </Button>
          )}

          {scoutAction === "BLOCK" && (
            <Button
              onClick={() => {
                const confirmed = window.confirm(
                  "We still need more information for this contact. Do you want to continue anyway?"
                );
                if (confirmed) {
                  recordActivity({
                    type: "decision_card_override",
                    ts: new Date().toISOString(),
                    meta: {
                      action,
                      scoutAction: "BLOCK",
                      choice: "understand_risk",
                    },
                  });
                  openContactModal();
                }
              }}
              variant="outline"
              className="border-white/10 text-white/70 hover:bg-white/5"
            >
              Continue anyway
            </Button>
          )}

          {/* Cancel always available */}
          <Button
            onClick={() => {
              recordActivity({
                type: "decision_card_choice",
                ts: new Date().toISOString(),
                meta: {
                  action,
                  scoutAction,
                  choice: "cancel",
                },
              });
              onCancel();
            }}
            variant="ghost"
            className="text-white/60 hover:bg-white/5"
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* D1: Contact Outcome Modal */}
      {showContactModal && contactOutcome && (
        <ContactOutcomeModal
          outcome={contactOutcome}
          onClose={() => {
            setShowContactModal(false);
            onCancel(); // Close parent decision card
          }}
        />
      )}
    </div>
  );
};
