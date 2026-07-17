import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { MessagesSquare, Hammer, Clock3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { DecisionCard } from "./DecisionCard";
import type { ContactOutcome } from "./ContactOutcomeModal";

type CommunityCTASource = "trade_deal" | "community_post";
type CTAMode = "show" | "ask_scout" | "hide";
type ScoutAction = "COMPLY" | "DEFER" | "BLOCK";

interface CTAAuthority {
  allowed: boolean;
  action: ScoutAction;
  ctaMode: CTAMode;
  explanation: string;
  label?: string;
}

export interface CommunityCTAProps {
  source: CommunityCTASource;
  contextId: string | number;
  ownerUserId?: string;
  canDirectConnect?: boolean;
  canMessage?: boolean;
  disableDirectConnect?: boolean;
  layout?: "inline" | "grid";
  scope?: string; // county FIPS for authority check
}

async function checkCTAAuthority(
  action: "direct_connect" | "message",
  context: CommunityCTASource,
  contextId: string,
  scope?: string
): Promise<CTAAuthority> {
  try {
    const res = await fetch("/api/scout/cta-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action, context, contextId, scope }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("[CTA Authority Check] Failed:", error);
    // Fail safe: require more context on authority check failures.
    return {
      allowed: false,
      action: "DEFER",
      ctaMode: "ask_scout",
      explanation: "We could not check this action right now. Add request details first.",
      label: "Tell us a little more",
    };
  }
}

async function trackCTA(
  action: "ask_scout" | "direct_connect" | "message",
  source: CommunityCTASource
) {
  try {
    const mod = await import("../../agent/activity");
    const recordActivity = (mod as any).recordActivity as
      | ((event: { type: string; ts: string; path: string; meta?: Record<string, any> }) => void)
      | undefined;
    if (!recordActivity || typeof window === "undefined") return;

    const sp = new URLSearchParams(window.location.search || "");
    const scope = sp.get("scope") || undefined;

    recordActivity({
      type: "community.cta.clicked",
      ts: new Date().toISOString(),
      path: window.location.pathname,
      meta: { action, source, scope },
    });
  } catch {
    // Never break UX for analytics failures
  }
}

export const CommunityCTA: React.FC<CommunityCTAProps> = ({
  source,
  contextId,
  ownerUserId,
  canDirectConnect,
  canMessage,
  disableDirectConnect,
  layout = "grid",
  scope,
}) => {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Authority state for each CTA
  const [directConnectAuthority, setDirectConnectAuthority] = useState<CTAAuthority | null>(null);
  const [messageAuthority, setMessageAuthority] = useState<CTAAuthority | null>(null);
  const [loading, setLoading] = useState(true);

  // Decision card state
  const [showDecisionCard, setShowDecisionCard] = useState(false);
  const [pendingAction, setPendingAction] = useState<"contact_person" | "direct_connect" | null>(
    null
  );
  const [decisionCardId, setDecisionCardId] = useState<string | null>(null);

  const id = encodeURIComponent(String(contextId));

  // Check authority on mount
  useEffect(() => {
    let cancelled = false;

    async function checkAuthority() {
      setLoading(true);

      const checks: Promise<void>[] = [];

      if (canDirectConnect && !disableDirectConnect) {
        checks.push(
          checkCTAAuthority("direct_connect", source, String(contextId), scope).then((result) => {
            if (!cancelled) setDirectConnectAuthority(result);
          })
        );
      }

      if (canMessage && ownerUserId) {
        checks.push(
          checkCTAAuthority("message", source, String(contextId), scope).then((result) => {
            if (!cancelled) setMessageAuthority(result);
          })
        );
      }

      await Promise.all(checks);
      if (!cancelled) setLoading(false);
    }

    void checkAuthority();

    return () => {
      cancelled = true;
    };
  }, [source, contextId, canDirectConnect, canMessage, ownerUserId, disableDirectConnect, scope]);

  const handleAskScout = async () => {
    await trackCTA("ask_scout", source);
    if (source === "trade_deal") {
      navigate(`/scout?source=trade_deal&dealId=${id}`);
    } else {
      navigate(`/scout?source=community_post&postId=${id}`);
    }
  };

  // Show decision card before taking action
  const handleDirectConnectClick = () => {
    setPendingAction("direct_connect");
    setDecisionCardId(null);
    setShowDecisionCard(true);
  };

  const handleMessageClick = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in before sending a message.",
        variant: "destructive",
      });
      return;
    }
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dcard_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    setDecisionCardId(id);
    setPendingAction("contact_person");
    setShowDecisionCard(true);
  };

  // Execute action after decision card confirms
  const executeDirectConnect = async () => {
    await trackCTA("direct_connect", source);
    if (source === "trade_deal") {
      navigate(`/direct-connect?dealId=${id}`);
    } else {
      navigate(`/direct-connect?source=community_post&postId=${id}`);
    }
    setShowDecisionCard(false);
  };

  const handleDecisionProceed = () => {
    if (pendingAction === "direct_connect") {
      void executeDirectConnect();
    }
  };

  const handleDecisionCancel = () => {
    setShowDecisionCard(false);
    setPendingAction(null);
  };

  const isTradeDeal = source === "trade_deal";

  // Keep the system decision internal; show the user the outcome they can take.
  const directConnectMode = directConnectAuthority?.ctaMode || "show";
  const showDirectConnect =
    canDirectConnect && !disableDirectConnect && directConnectMode !== "hide";
  const directConnectLabel =
    directConnectMode === "ask_scout"
      ? "Tell us what you need"
      : isTradeDeal
        ? "Ask about this offer"
        : "Find help for this";
  const directConnectFallback = canDirectConnect ? "More details needed" : "Job help soon";

  const messageMode = messageAuthority?.ctaMode || "show";
  const showMessage = canMessage && ownerUserId && messageMode !== "hide";
  const messageLabel = messageMode === "ask_scout" ? "Explain why you want to connect" : "Message";
  const messageFallback = canMessage && ownerUserId ? "More details needed" : "Messaging soon";

  // Get authority for pending action
  const currentAuthority =
    pendingAction === "direct_connect" ? directConnectAuthority : messageAuthority;

  // Render DecisionCard if active
  if (showDecisionCard && pendingAction && currentAuthority) {
    const targetName = "Community member";
    const contactOutcome: ContactOutcome | undefined =
      pendingAction === "contact_person" && ownerUserId
        ? {
            targetUserId: ownerUserId,
            targetUserName: targetName,
            targetRole: isTradeDeal ? "Trade Deal Author" : "Community Post Author",
            suggestedIntent: isTradeDeal ? "hire" : "collaborate",
            reasonForContact: isTradeDeal
              ? "Ask about a local offer and confirm the details."
              : "Follow up on a community post to coordinate next steps.",
            riskFlags:
              currentAuthority.action === "COMPLY"
                ? []
                : ["Add a clear reason for contacting this person before you continue."],
            sourceDecisionCardId: decisionCardId || undefined,
            decisionScope: scope || "community",
            decisionTitle: isTradeDeal ? "Trade deal follow-up" : "Community post follow-up",
          }
        : undefined;

    return (
      <div className="mt-4">
        <DecisionCard
          action={pendingAction === "contact_person" ? "contact_person" : "direct_connect"}
          context={{
            targetName,
            targetRole: isTradeDeal ? "Trade Deal Author" : "Community Post Author",
            communitySignal: "Active in this community",
            absenceNote: !ownerUserId ? "No prior connections yet" : undefined,
          }}
          scoutAction={currentAuthority.action}
          riskFraming={
            currentAuthority.action === "COMPLY"
              ? []
              : currentAuthority.action === "DEFER"
                ? ["We need a little more information about what you want to do."]
                : ["This contact option cannot open with the information available."]
          }
          guidance={
            currentAuthority.action === "COMPLY"
              ? "This is ready to review. You can move forward."
              : currentAuthority.action === "DEFER"
                ? "Add a little more context before moving forward."
                : "Key details are still missing before this action can open."
          }
          explanation=""
          onProceed={handleDecisionProceed}
          onAskScout={handleAskScout}
          onCancel={handleDecisionCancel}
          contactOutcome={contactOutcome}
        />
      </div>
    );
  }

  if (loading) {
    return null;
  }

  if (layout === "inline") {
    return (
      <div className="flex items-center justify-between gap-1 pt-2 text-[11px]">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void handleAskScout();
          }}
          className="flex-1 min-w-0 px-2 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-100 text-left truncate"
        >
          Ask about this
        </button>
        {showDirectConnect && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDirectConnectClick();
            }}
            className={`flex-1 min-w-0 px-2 py-1 rounded-md text-left truncate ml-1 ${
              directConnectMode === "ask_scout"
                ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-100"
                : "bg-ts-orange hover:bg-ts-orange text-black"
            }`}
          >
            {directConnectLabel}
          </button>
        )}
        {showMessage && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleMessageClick();
            }}
            className={`flex-1 min-w-0 px-2 py-1 rounded-md text-left truncate ml-1 hidden sm:block ${
              messageMode === "ask_scout"
                ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-100"
                : "bg-neutral-800 hover:bg-neutral-700 text-neutral-100"
            }`}
          >
            {messageLabel}
          </button>
        )}
        {!showDirectConnect && !showMessage && (
          <div className="flex-1 min-w-0 px-2 py-1 text-neutral-500 text-xs flex items-center gap-1">
            <Clock3 className="w-3 h-3" />
            <span className="truncate">More ways to connect are coming soon</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-3 text-[12px] gap-px rounded-lg overflow-hidden bg-white/10">
      <button
        type="button"
        onClick={() => {
          void handleAskScout();
        }}
        className="flex items-center justify-center gap-1.5 py-2 bg-tsBg hover:bg-tsBg/80 text-white"
      >
        <MessagesSquare className="w-4 h-4" />
        <span>Ask about this</span>
      </button>
      {showDirectConnect && (
        <button
          type="button"
          onClick={handleDirectConnectClick}
          className={`flex items-center justify-center gap-1.5 py-2 border-l border-white/10 ${
            directConnectMode === "ask_scout"
              ? "bg-tsBg hover:bg-tsBg/80 text-white"
              : "bg-tsBg hover:bg-tsBg/80 text-white"
          }`}
        >
          <Hammer className="w-4 h-4" />
          <span>{directConnectLabel}</span>
        </button>
      )}
      {!showDirectConnect && (
        <div className="flex items-center justify-center gap-1.5 py-2 bg-tsBg/50 text-neutral-500 border-l border-white/10">
          <Clock3 className="w-4 h-4" />
          <span className="text-xs">{directConnectFallback}</span>
        </div>
      )}
      {showMessage && (
        <button
          type="button"
          onClick={handleMessageClick}
          className={`flex items-center justify-center gap-1.5 py-2 border-l border-white/10 ${
            messageMode === "ask_scout"
              ? "bg-tsBg hover:bg-tsBg/80 text-white"
              : "bg-tsBg hover:bg-tsBg/80 text-white"
          }`}
        >
          <MessagesSquare className="w-4 h-4" />
          <span>{messageLabel}</span>
        </button>
      )}
      {!showMessage && (
        <div className="flex items-center justify-center gap-1.5 py-2 bg-tsBg/50 text-neutral-500 border-l border-white/10">
          <Clock3 className="w-4 h-4" />
          <span className="text-xs">{messageFallback}</span>
        </div>
      )}
    </div>
  );
};
