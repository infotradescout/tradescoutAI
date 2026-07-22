import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Facebook, Mail, MessageSquare, Share2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  SHARE_CARD_EVENT,
  shareToPlatform,
  type ShareCardPayload,
  type ShareContextKind,
} from "@/utils/share";

const kindLabels: Record<ShareContextKind, string> = {
  community_post: "Community post",
  profile: "Profile",
  business: "Business",
  listing: "Listing",
  offer: "Offer",
  event: "Event",
  page: "TradeScout",
};

function communityLead(kind: ShareContextKind): string {
  switch (kind) {
    case "profile":
    case "business":
      return "Worth checking out";
    case "listing":
    case "offer":
      return "Sharing this in case someone needs it";
    case "event":
      return "Something people may want to know about";
    case "community_post":
      return "Passing this along";
    default:
      return "Thought this was worth sharing";
  }
}

function communityOrigin(): string {
  if (typeof window === "undefined") return "https://www.thetradescout.com";
  const host = window.location.hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host.endsWith("thetradescout.com")
    ? window.location.origin
    : "https://www.thetradescout.com";
}

export function ShareCardHost() {
  const [payload, setPayload] = useState<ShareCardPayload | null>(null);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const next = (event as CustomEvent<ShareCardPayload>).detail;
      if (!next?.url) return;
      setPayload(next);
      setNote("");
      setCopied(false);
    };
    window.addEventListener(SHARE_CARD_EVENT, handleOpen);
    return () => window.removeEventListener(SHARE_CARD_EVENT, handleOpen);
  }, []);

  const destinationHost = useMemo(() => {
    if (!payload) return "";
    try {
      return new URL(payload.url).hostname.replace(/^www\./, "");
    } catch {
      return "TradeScout";
    }
  }, [payload]);

  if (!payload) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(payload.url);
      setCopied(true);
      toast({ title: "Link copied", description: "Ready to paste anywhere." });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({
        title: "Could not copy the link",
        description: "Try More options instead.",
        variant: "destructive",
      });
    }
  };

  const shareToCommunity = () => {
    const prefill = [note.trim() || communityLead(payload.kind), payload.title, payload.url]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 1800);
    const params = new URLSearchParams({
      compose: "1",
      category: "general",
      prefill,
      shared: payload.kind,
    });
    const communityPath = `/community-feed?${params.toString()}`;
    const target = isAuthenticated
      ? `${communityOrigin()}${communityPath}`
      : `${communityOrigin()}/login?next=${encodeURIComponent(communityPath)}`;
    window.location.assign(target);
  };

  const openNativeShare = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: payload.title, text: payload.text, url: payload.url });
        return;
      } catch (error: any) {
        if (error?.name === "AbortError") return;
      }
    }
    await copyLink();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && setPayload(null)}>
      <DialogContent
        className="max-w-[520px] overflow-hidden border-[var(--border-primary)] bg-[var(--surface-card)] p-0 text-[var(--text-primary)] shadow-2xl"
        data-testid="share-card"
      >
        <DialogHeader className="border-b border-white/[0.07] px-5 pb-4 pt-5 text-left">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-ts-orange/25 bg-ts-orange/10 text-ts-orange">
              <Share2 className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-lg font-semibold">Share</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-white/48">
                Choose where this should go.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 p-5">
          <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035]">
            {payload.imageUrl ? (
              <img src={payload.imageUrl} alt="" className="h-36 w-full object-cover" />
            ) : null}
            <div className="flex gap-3 p-4">
              {!payload.imageUrl ? (
                <TradeScoutLogo size="sm" className="h-10 w-10 shrink-0 bg-transparent ring-0" />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ts-orange">
                  <span>{kindLabels[payload.kind]}</span>
                  <span className="text-white/25">·</span>
                  <span className="truncate text-white/38">{destinationHost}</span>
                </div>
                <h3 className="mt-1.5 line-clamp-2 text-base font-semibold leading-6 text-white">
                  {payload.title}
                </h3>
                {payload.text ? (
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-white/52">
                    {payload.text}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-ts-orange/25 bg-[linear-gradient(120deg,rgba(255,107,0,0.12),rgba(255,255,255,0.025))] p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ts-orange text-black">
                <MessageSquare className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-white">Share to Community</h3>
                <p className="mt-0.5 text-xs leading-5 text-white/50">
                  Add your take, then let people respond, recommend, or take the next step.
                </p>
              </div>
            </div>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={communityLead(payload.kind)}
              rows={2}
              className="mt-3 min-h-[72px] resize-none rounded-xl border-white/[0.08] bg-black/25 text-sm text-white placeholder:text-white/34"
            />
            <Button
              type="button"
              onClick={shareToCommunity}
              className="mt-3 w-full rounded-xl bg-ts-orange font-bold text-black hover:bg-ts-orange-dark"
              data-testid="share-to-community"
            >
              Share to Community
            </Button>
          </section>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button
              type="button"
              variant="outline"
              onClick={copyLink}
              className="border-white/10 bg-white/[0.025]"
            >
              {copied ? (
                <Check className="mr-2 h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void shareToPlatform({
                  platform: "facebook",
                  url: payload.url,
                  title: payload.title,
                  text: payload.text,
                })
              }
              className="border-white/10 bg-white/[0.025]"
            >
              <Facebook className="mr-2 h-4 w-4" /> Facebook
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void shareToPlatform({
                  platform: "email",
                  url: payload.url,
                  title: payload.title,
                  text: payload.text,
                })
              }
              className="border-white/10 bg-white/[0.025]"
            >
              <Mail className="mr-2 h-4 w-4" /> Email
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={openNativeShare}
              className="border-white/10 bg-white/[0.025]"
            >
              <ExternalLink className="mr-2 h-4 w-4" /> More
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
