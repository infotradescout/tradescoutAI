import { useEffect, useState } from "react";
import { Bookmark, HeartHandshake, Loader2, ThumbsUp } from "lucide-react";
import { RecommendationForm } from "@/components/RecommendationForm";
import { ShareButton } from "@/components/ShareButton";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { cn } from "@/lib/utils";

type ProfileTrustAction = "like" | "favorite";

type ProfileTrustActionState = {
  profileSlug: string;
  likeCount: number;
  favoriteCount: number;
  recommendationCount: number;
  viewerLiked: boolean;
  viewerFavorited: boolean;
  viewerIsOwner: boolean;
  recommendationTarget: {
    contractorId: string;
    contractorName: string;
  } | null;
};

type PublicProfileTrustActionsProps = {
  profileSlug: string;
  profileName: string;
  profileShareDestination: string;
  signInHref: string;
  hasViewerSession: boolean;
  initialRecommendationCount?: number;
  tone?: "light" | "dark";
  /** Lux profiles: charcoal + brass chrome (no light TradeScout card). */
  variant?: "default" | "lux";
  /** Captain-obvious eyebrow (“Support this business”). Off for lux. */
  showSupportLabel?: boolean;
  className?: string;
};

type ProfileTrustActionPayload = Partial<ProfileTrustActionState> & {
  message?: unknown;
};

async function readResponseJson(response: Response): Promise<ProfileTrustActionPayload> {
  return response.json().catch(() => ({}));
}

async function fetchTrustActionState(profileSlug: string): Promise<ProfileTrustActionState> {
  const response = await fetch(`/api/u/${encodeURIComponent(profileSlug)}/trust-actions`, {
    credentials: "include",
  });
  const payload = await readResponseJson(response);
  if (!response.ok) {
    throw new Error(String(payload.message || "Profile actions are temporarily unavailable"));
  }
  return payload as ProfileTrustActionState;
}

export function PublicProfileTrustActions({
  profileSlug,
  profileName,
  profileShareDestination,
  signInHref,
  hasViewerSession,
  initialRecommendationCount = 0,
  tone = "dark",
  variant = "default",
  showSupportLabel = true,
  className,
}: PublicProfileTrustActionsProps) {
  const { toast } = useToast();
  const [state, setState] = useState<ProfileTrustActionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<ProfileTrustAction | null>(null);
  const [recommendationOpen, setRecommendationOpen] = useState(false);
  const isLux = variant === "lux";
  const isLight = !isLux && tone === "light";

  useEffect(() => {
    let current = true;
    setLoading(true);
    fetchTrustActionState(profileSlug)
      .then((nextState) => {
        if (current) setState(nextState);
      })
      .catch(() => {
        // Keep the action bar useful if the read request has a transient
        // failure. Mutations surface their own actionable error message.
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [profileSlug]);

  const sendToSignIn = () => {
    if (typeof window !== "undefined") window.location.assign(signInHref);
  };

  const resolveCurrentState = async () => {
    if (state) return state;
    const nextState = await fetchTrustActionState(profileSlug);
    setState(nextState);
    return nextState;
  };

  const toggleAction = async (action: ProfileTrustAction) => {
    if (!hasViewerSession) {
      sendToSignIn();
      return;
    }
    if (pendingAction) return;

    setPendingAction(action);
    try {
      const currentState = await resolveCurrentState().catch(() => null);
      if (currentState?.viewerIsOwner) {
        toast({
          title: "This is your profile",
          description: "Community actions must come from another TradeScout member.",
        });
        return;
      }
      const isActive =
        action === "like"
          ? currentState?.viewerLiked === true
          : currentState?.viewerFavorited === true;
      const response = await fetch(
        `/api/u/${encodeURIComponent(profileSlug)}/trust-actions/${action}`,
        {
          method: isActive ? "DELETE" : "POST",
          credentials: "include",
          headers: { Accept: "application/json" },
        }
      );
      const payload = await readResponseJson(response);
      if (response.status === 401) {
        sendToSignIn();
        return;
      }
      if (!response.ok) {
        throw new Error(String(payload.message || "Unable to update this profile action"));
      }
      setState(payload as ProfileTrustActionState);
    } catch (error) {
      toast({
        title: "Action not saved",
        description: formatUserFacingErrorMessage(error, "Please try again in a moment."),
        variant: "destructive",
      });
    } finally {
      setPendingAction(null);
    }
  };

  const openRecommendation = async () => {
    if (!hasViewerSession) {
      sendToSignIn();
      return;
    }

    try {
      const currentState = await resolveCurrentState();
      if (currentState.viewerIsOwner) {
        toast({
          title: "This is your profile",
          description: "Customer recommendations must come from another TradeScout member.",
        });
        return;
      }
      if (!currentState.recommendationTarget) {
        toast({
          title: "Recommendations are not open yet",
          description: `${profileName} still needs to finish provider setup.`,
        });
        return;
      }
      setRecommendationOpen(true);
    } catch (error) {
      toast({
        title: "Recommendations are temporarily unavailable",
        description: formatUserFacingErrorMessage(error, "Please try again in a moment."),
        variant: "destructive",
      });
    }
  };

  const likeCount = state?.likeCount || 0;
  const favoriteCount = state?.favoriteCount || 0;
  const recommendationCount = state?.recommendationCount ?? initialRecommendationCount;
  const focusRing = isLux
    ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent,#d9a441)]"
    : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ts-orange";
  const buttonClass = cn(
    "flex min-h-11 w-full min-w-0 flex-row items-center justify-center gap-1.5 px-1.5 py-2 text-[11px] font-bold transition sm:text-xs",
    isLux ? "" : "rounded-xl",
    isLight
      ? "text-stone-700 hover:bg-stone-100 hover:text-stone-950"
      : isLux
        ? "text-white/75 hover:bg-white/10 hover:text-white"
        : "text-white/75 hover:bg-white/10 hover:text-white",
    focusRing
  );
  const activeButtonClass = isLight
    ? "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-300"
    : isLux
      ? "bg-[var(--brand-accent,#d9a441)]/15 text-[var(--brand-accent,#d9a441)] ring-1 ring-inset ring-[var(--brand-accent,#d9a441)]/45"
      : "bg-ts-orange/15 text-ts-orange-light ring-1 ring-inset ring-ts-orange/40";
  const countClass = cn("text-[10px] font-semibold", isLight ? "text-stone-500" : "text-white/50");
  const ownerBlocked = state?.viewerIsOwner === true;
  const recommendationButtonClass = cn(
    "flex min-h-14 w-full items-center justify-center gap-2.5 px-4 py-3 text-sm font-black transition",
    isLux ? "" : "rounded-xl",
    isLight
      ? "bg-stone-900 text-white hover:bg-stone-800"
      : isLux
        ? "border border-[var(--brand-accent,#d9a441)]/70 bg-[var(--brand-accent,#d9a441)] text-[#17100b] hover:bg-[var(--brand-accent,#d9a441)]/90"
        : "border border-ts-orange/40 bg-ts-orange/15 text-ts-orange-light hover:bg-ts-orange/25",
    focusRing
  );

  return (
    <>
      <div
        className={cn(
          "border p-2.5",
          isLux
            ? "rounded-none border-white/10 bg-[#0c0a08]"
            : isLight
              ? "rounded-2xl border-stone-200 bg-white/85 shadow-sm"
              : "rounded-2xl border-white/10 bg-black/20",
          className
        )}
        aria-label={`Trust actions for ${profileName}`}
        data-trust-variant={variant}
      >
        {showSupportLabel ? (
          <p
            className={cn(
              "px-2 pb-2 pt-0.5 text-[10px] font-black uppercase tracking-[0.18em]",
              isLight ? "text-stone-500" : "text-white/55"
            )}
          >
            Support this business
          </p>
        ) : null}

        <button
          type="button"
          className={recommendationButtonClass}
          onClick={openRecommendation}
          title={
            ownerBlocked
              ? "Profile owners cannot recommend their own profile"
              : `Recommend ${profileName}`
          }
          data-testid="button-public-profile-recommend"
        >
          <HeartHandshake className="h-5 w-5 flex-none" />
          <span>Recommend</span>
          {recommendationCount > 0 ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-black",
                isLight
                  ? "bg-white/15 text-white"
                  : isLux
                    ? "bg-[#17100b]/15 text-[#17100b]"
                    : "bg-ts-orange/20 text-ts-orange-light"
              )}
            >
              {recommendationCount}
            </span>
          ) : null}
        </button>

        <div className="mt-1 grid grid-cols-3 gap-1" role="group" aria-label="Profile actions">
          <button
            type="button"
            className={cn(buttonClass, state?.viewerLiked && activeButtonClass)}
            onClick={() => toggleAction("like")}
            disabled={pendingAction !== null}
            aria-pressed={state?.viewerLiked === true}
            title={
              ownerBlocked ? "Profile owners cannot like their own profile" : `Like ${profileName}`
            }
            data-testid="button-public-profile-like"
          >
            {pendingAction === "like" ? (
              <Loader2 className="h-4 w-4 flex-none animate-spin" />
            ) : (
              <ThumbsUp className={cn("h-4 w-4 flex-none", state?.viewerLiked && "fill-current")} />
            )}
            <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
              <span>Like</span>
              {likeCount > 0 ? <span className={countClass}>{likeCount}</span> : null}
            </span>
          </button>

          <button
            type="button"
            className={cn(buttonClass, state?.viewerFavorited && activeButtonClass)}
            onClick={() => toggleAction("favorite")}
            disabled={pendingAction !== null}
            aria-pressed={state?.viewerFavorited === true}
            title={
              ownerBlocked
                ? "Profile owners cannot favorite their own profile"
                : `Favorite ${profileName}`
            }
            data-testid="button-public-profile-favorite"
          >
            {pendingAction === "favorite" ? (
              <Loader2 className="h-4 w-4 flex-none animate-spin" />
            ) : (
              <Bookmark
                className={cn("h-4 w-4 flex-none", state?.viewerFavorited && "fill-current")}
              />
            )}
            <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
              <span>Favorite</span>
              {favoriteCount > 0 ? <span className={countClass}>{favoriteCount}</span> : null}
            </span>
          </button>

          <ShareButton
            destination={profileShareDestination}
            title={profileName}
            text={`See ${profileName} on TradeScout`}
            variant="ghost"
            size="sm"
            label="Share"
            className={cn(
              buttonClass,
              "!h-auto border-0 [&>span]:!ml-0",
              isLight ? "hover:bg-stone-100" : "hover:bg-white/10"
            )}
          />
        </div>
        {loading && !state ? <span className="sr-only">Loading saved actions.</span> : null}
      </div>

      <Dialog open={recommendationOpen} onOpenChange={setRecommendationOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto p-0">
          <DialogTitle className="sr-only">Recommend {profileName}</DialogTitle>
          <DialogDescription className="sr-only">
            Share a customer experience for moderation before it appears publicly.
          </DialogDescription>
          {state?.recommendationTarget ? (
            <RecommendationForm
              contractorId={state.recommendationTarget.contractorId}
              contractorName={state.recommendationTarget.contractorName}
              defaultOpen
              onCancel={() => setRecommendationOpen(false)}
              onSuccess={() => {
                setRecommendationOpen(false);
                fetchTrustActionState(profileSlug)
                  .then(setState)
                  .catch(() => undefined);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default PublicProfileTrustActions;
