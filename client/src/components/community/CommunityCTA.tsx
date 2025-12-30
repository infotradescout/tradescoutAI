import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { MessagesSquare, Hammer, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { DecisionCard } from "./DecisionCard";

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
    // Fail open: allow on error
    return {
      allowed: true,
      action: "COMPLY",
      ctaMode: "show",
      explanation: "Check failed, allowing action",
    };
  }
}

async function trackCTA(action: "ask_scout" | "direct_connect" | "message", source: CommunityCTASource) {
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
  const [pendingAction, setPendingAction] = useState<"message" | "direct_connect" | null>(null);

  const id = encodeURIComponent(String(contextId));
  
  // Check authority on mount
  useEffect(() => {
    let cancelled = false;
    
    async function checkAuthority() {
      setLoading(true);
      
      const checks = [];
      
      if (canDirectConnect && !disableDirectConnect) {
        checks.push(
          checkCTAAuthority("direct_connect", source, String(contextId), scope)
            .then(result => {
              if (!cancelled) setDirectConnectAuthority(result);
            })
        );
      }
      
      if (canMessage && ownerUserId) {
        checks.push(
          checkCTAAuthority("message", source, String(contextId), scope)
            .then(result => {
              if (!cancelled) setMessageAuthority(result);
            })
        );
      }
      
      await Promise.all(checks);
      if (!cancelled) setLoading(false);
    }
    
    void checkAuthority();
    
    return () => { cancelled = true; };
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
    setShowDecisionCard(true);
  };

  const handleMessageClick = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to message neighbors.",
        variant: "destructive",
      });
      return;
    }
    setPendingAction("message");
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

  const executeMessage = async () => {
    await trackCTA("message", source);
    navigate(`/messages?user=${encodeURIComponent(ownerUserId!)}`);
    setShowDecisionCard(false);
  };

  const handleDecisionProceed = () => {
    if (pendingAction === "direct_connect") {
      void executeDirectConnect();
    } else if (pendingAction === "message") {
      void executeMessage();
    }
  };

  const handleDecisionCancel = () => {
    setShowDecisionCard(false);
    setPendingAction(null);
  };
  
  // Determine what to show for Direct Connect CTA
  const directConnectMode = directConnectAuthority?.ctaMode || "show";
  const showDirectConnect = (canDirectConnect && !disableDirectConnect) && directConnectMode !== "hide";
  const directConnectLabel = directConnectMode === "ask_scout" 
    ? (directConnectAuthority?.label || "Ask Scout")
    : "Direct Connect";
  
  // Determine what to show for Message CTA
  const messageMode = messageAuthority?.ctaMode || "show";
  const showMessage = (canMessage && ownerUserId) && messageMode !== "hide";
  const messageLabel = messageMode === "ask_scout"
    ? (messageAuthority?.label || "Ask Scout")
    : "Message";
  
  // Get authority for pending action
  const currentAuthority = pendingAction === "direct_connect" ? directConnectAuthority : messageAuthority;
  
  // Render DecisionCard if active
  if (showDecisionCard && pendingAction && currentAuthority) {
    return (
      <div className="mt-4">
        <DecisionCard
          action={pendingAction}
          context={{
            targetName: ownerUserId || "Community member",
            targetRole: source === "trade_deal" ? "Trade Deal Author" : "Community Post Author",
            communitySignal: "Active in this community",
            absenceNote: !ownerUserId ? "No prior connections yet" : undefined,
          }}
          scoutAction={currentAuthority.action}
          riskFraming={currentAuthority.explanation ? [currentAuthority.explanation] : []}
          guidance={
            currentAuthority.action === "COMPLY"
              ? "This looks like a normal contact. You're good to proceed."
              : currentAuthority.action === "DEFER"
              ? "Before contacting, Scout suggests clarifying your scope to avoid misalignment."
              : "Scout recommends waiting. Missing details here increase the chance of a bad outcome."
          }
          explanation={currentAuthority.explanation}
          onProceed={handleDecisionProceed}
          onAskScout={handleAskScout}
          onCancel={handleDecisionCancel}
        />
      </div>
    );
  }

  // Show loading state briefly
  if (loading) {
    return (
      <div className={layout === "inline" 
        ? "flex items-center gap-1 pt-2 text-[11px] text-neutral-500" 
        : "mt-2 grid grid-cols-3 text-[12px] gap-px rounded-lg overflow-hidden bg-tsBorder/70"
      }>
        <div className="flex items-center justify-center py-2 text-neutral-600">
          Loading...
        </div>
      </div>
    );
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
          Ask Scout
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
                : "bg-orange-500 hover:bg-orange-400 text-black"
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
        {!showDirectConnect && !showMessage && directConnectAuthority?.label && (
          <div className="flex-1 min-w-0 px-2 py-1 text-neutral-500 text-xs flex items-center gap-1">
            <Info className="w-3 h-3" />
            <span className="truncate">{directConnectAuthority.label}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-3 text-[12px] gap-px rounded-lg overflow-hidden bg-tsBorder/70">
      <button
        type="button"
        onClick={() => {
          void handleAskScout();
        }}
        className="flex items-center justify-center gap-1.5 py-2 bg-tsBg hover:bg-tsBg/80 text-slate-100"
      >
        <MessagesSquare className="w-4 h-4" />
        <span>Ask Scout</span>
      </button>
      {showDirectConnect && (
        <button
          type="button"
          onClick={handleDirectConnectClick}
          className={`flex items-center justify-center gap-1.5 py-2 border-l border-tsBorder ${
            directConnectMode === "ask_scout"
              ? "bg-tsBg hover:bg-tsBg/80 text-slate-100"
              : "bg-tsBg hover:bg-tsBg/80 text-slate-100"
          }`}
        >
          <Hammer className="w-4 h-4" />
          <span>{directConnectLabel}</span>
        </button>
      )}
      {!showDirectConnect && (
        <div className="flex items-center justify-center gap-1.5 py-2 bg-tsBg/50 text-neutral-600 border-l border-tsBorder">
          <Info className="w-4 h-4" />
          <span className="text-xs">{directConnectAuthority?.label || "Unavailable"}</span>
        </div>
      )}
      {showMessage && (
        <button
          type="button"
          onClick={handleMessageClick}
          className={`flex items-center justify-center gap-1.5 py-2 border-l border-tsBorder ${
            messageMode === "ask_scout"
              ? "bg-tsBg hover:bg-tsBg/80 text-slate-100"
              : "bg-tsBg hover:bg-tsBg/80 text-slate-100"
          }`}
        >
          <MessagesSquare className="w-4 h-4" />
          <span>{messageLabel}</span>
        </button>
      )}
      {!showMessage && (
        <div className="flex items-center justify-center gap-1.5 py-2 bg-tsBg/50 text-neutral-600 border-l border-tsBorder">
          <Info className="w-4 h-4" />
          <span className="text-xs">{messageAuthority?.label || "Unavailable"}</span>
        </div>
      )}
    </div>
  );
};
