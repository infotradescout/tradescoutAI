import React from "react";
import { useLocation } from "wouter";
import { MessagesSquare, Hammer } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type CommunityCTASource = "trade_deal" | "community_post";

export interface CommunityCTAProps {
  source: CommunityCTASource;
  contextId: string | number;
  ownerUserId?: string;
  canDirectConnect?: boolean;
  canMessage?: boolean;
  disableDirectConnect?: boolean;
  layout?: "inline" | "grid";
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
}) => {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const id = encodeURIComponent(String(contextId));

  const handleAskScout = async () => {
    await trackCTA("ask_scout", source);
    if (source === "trade_deal") {
      navigate(`/scout?source=trade_deal&dealId=${id}`);
    } else {
      navigate(`/scout?source=community_post&postId=${id}`);
    }
  };

  const directConnectEnabled = !!canDirectConnect && !disableDirectConnect;

  const handleDirectConnect = async () => {
    if (!directConnectEnabled) return;
    await trackCTA("direct_connect", source);
    if (source === "trade_deal") {
      navigate(`/direct-connect?dealId=${id}`);
    } else {
      navigate(`/direct-connect?source=community_post&postId=${id}`);
    }
  };

  const messageEnabled = !!canMessage && !!ownerUserId;

  const handleMessage = async () => {
    if (!messageEnabled) return;
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to message neighbors.",
        variant: "destructive",
      });
      return;
    }
    await trackCTA("message", source);
    navigate(`/messages?user=${encodeURIComponent(ownerUserId!)}`);
  };

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
        {directConnectEnabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleDirectConnect();
            }}
            className="flex-1 min-w-0 px-2 py-1 rounded-md bg-orange-500 hover:bg-orange-400 text-black text-left truncate ml-1"
          >
            Direct Connect
          </button>
        )}
        {messageEnabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleMessage();
            }}
            className="flex-1 min-w-0 px-2 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-100 text-left truncate ml-1 hidden sm:block"
          >
            Message
          </button>
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
      <button
        type="button"
        disabled={!directConnectEnabled}
        onClick={() => {
          void handleDirectConnect();
        }}
        className="flex items-center justify-center gap-1.5 py-2 bg-tsBg hover:bg-tsBg/80 text-slate-100 border-l border-tsBorder disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Hammer className="w-4 h-4" />
        <span>Direct Connect</span>
      </button>
      <button
        type="button"
        disabled={!messageEnabled}
        onClick={() => {
          void handleMessage();
        }}
        className="flex items-center justify-center gap-1.5 py-2 bg-tsBg hover:bg-tsBg/80 text-slate-100 border-l border-tsBorder disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <MessagesSquare className="w-4 h-4" />
        <span>Message</span>
      </button>
    </div>
  );
};
