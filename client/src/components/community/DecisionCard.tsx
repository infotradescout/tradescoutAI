import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recordActivity } from "@/agent/activity";
import { ContactOutcomeModal, ContactOutcome } from "./ContactOutcomeModal";

type ScoutAction = "COMPLY" | "DEFER" | "BLOCK";

interface DecisionContext {
  targetName: string;
  targetRole: string;
  communitySignal: string;
  absenceNote?: string;
}

interface DecisionCardProps {
  action: "message" | "direct_connect" | "contact_person";
  context: DecisionContext;
  scoutAction: ScoutAction;
  riskFraming: string[];
  guidance: string;
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
  explanation,
  onProceed,
  onAskScout,
  onCancel,
  contactOutcome,
}) => {
  const actionLabel =
    action === "message" ? "Message" : action === "contact_person" ? "Contact" : "Direct Connect";

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

  // Map Scout action to guidance state
  const guidanceState =
    scoutAction === "COMPLY" ? "safe" : scoutAction === "DEFER" ? "caution" : "blocked";

  const getGuidanceIcon = () => {
    switch (guidanceState) {
      case "safe":
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case "caution":
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      case "blocked":
        return <XCircle className="w-5 h-5 text-slate-600" />;
    }
  };

  const getGuidanceText = () => {
    switch (guidanceState) {
      case "safe":
        return "Safe to proceed";
      case "caution":
        return "Pause advised";
      case "blocked":
        return "Blocked by policy";
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-5">
      {/* 1. Context */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-900">
          Who am I about to {action === "message" ? "message" : "connect with"}?
        </h3>
        <div className="space-y-1 text-sm text-slate-700">
          <p className="font-medium">{context.targetName}</p>
          <p className="text-slate-600">{context.targetRole}</p>
          <p className="text-slate-500">{context.communitySignal}</p>
          {context.absenceNote && <p className="text-slate-400 italic">{context.absenceNote}</p>}
        </div>
      </div>

      {/* 2. Risk Framing */}
      {riskFraming.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-900">What could go wrong here?</h3>
          <div className="space-y-1">
            {riskFraming.slice(0, 2).map((risk, i) => (
              <p key={i} className="text-sm text-slate-600">
                {risk}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 3. Scout Guidance */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-900">
          How Scout governs this decision right now
        </h3>
        <div className="flex items-start gap-3">
          {getGuidanceIcon()}
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-slate-900">{getGuidanceText()}</p>
            <p className="text-sm text-slate-600">{guidance}</p>
          </div>
        </div>
      </div>

      {/* 4. Action Choice */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <h3 className="text-sm font-medium text-slate-900">What do you want to do?</h3>
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
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              {actionLabel} now
            </Button>
          )}

          {/* Show "Ask Scout first" for DEFER or BLOCK */}
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
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Ask Scout first
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
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Proceed anyway
            </Button>
          )}

          {scoutAction === "BLOCK" && (
            <Button
              onClick={() => {
                const confirmed = window.confirm(
                  "Scout policy blocks this action right now. Are you sure you want to proceed?"
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
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              I understand the risk
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
            className="text-slate-600 hover:bg-slate-50"
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
