import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  Facebook,
  HeartHandshake,
  Instagram,
  Loader2,
  MapPin,
  ThumbsUp,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { PublicProfileAccountCard } from "@/components/profile/PublicProfileAccountCard";
import { RecommendationForm } from "@/components/RecommendationForm";
import { ShareButton } from "@/components/ShareButton";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { resolvePublicProfileIdentity } from "@/data/publicProfileIdentity";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { qualifyPublicProfileItemDestination } from "@/lib/publicProfileItemDestination";
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
  platformBaseHref?: string;
  initialRecommendationCount?: number;
  subjectKind?: "business" | "profile";
  tone?: "light" | "dark";
  density?: "default" | "compact";
  className?: string;
};

type ProfileTrustActionPayload = Partial<ProfileTrustActionState> & {
  message?: unknown;
};

const PUBLIC_PROFILE_SOCIAL_ICONS: Readonly<Record<string, LucideIcon>> = {
  instagram: Instagram,
  facebook: Facebook,
  youtube: Youtube,
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
  platformBaseHref = "",
  initialRecommendationCount = 0,
  subjectKind = "business",
  tone = "dark",
  density = "default",
  className,
}: PublicProfileTrustActionsProps) {
  const { toast } = useToast();
  const [state, setState] = useState<ProfileTrustActionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<ProfileTrustAction | null>(null);
  const [recommendationOpen, setRecommendationOpen] = useState(false);
  const resumedActionRef = useRef(false);
  const isLight = tone === "light";
  const isCompact = density === "compact";
  const publicIdentity = resolvePublicProfileIdentity(profileSlug);

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

  const sendToSignIn = (resumeAction?: "favorite" | "recommend") => {
    if (typeof window === "undefined") return;
    if (!resumeAction) {
      window.location.assign(signInHref);
      return;
    }
    const destination = new URL(signInHref, window.location.origin);
    destination.searchParams.set(
      "next",
      `/u/${encodeURIComponent(profileSlug)}?trustAction=${resumeAction}`
    );
    window.location.assign(destination.toString());
  };

  const continueOnTradeScout = (action: "favorite" | "recommend") => {
    if (!platformBaseHref || typeof window === "undefined") return false;
    const destination = qualifyPublicProfileItemDestination(
      `/u/${encodeURIComponent(profileSlug)}?trustAction=${action}`,
      platformBaseHref
    );
    window.location.assign(destination);
    return true;
  };

  const resolveCurrentState = async () => {
    if (state) return state;
    const nextState = await fetchTrustActionState(profileSlug);
    setState(nextState);
    return nextState;
  };

  const toggleAction = async (action: ProfileTrustAction) => {
    if (action === "favorite" && continueOnTradeScout("favorite")) return;
    if (!hasViewerSession) {
      sendToSignIn(action === "favorite" ? "favorite" : undefined);
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
    if (continueOnTradeScout("recommend")) return;
    if (!hasViewerSession) {
      sendToSignIn("recommend");
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

  useEffect(() => {
    if (platformBaseHref || resumedActionRef.current || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const requestedAction = url.searchParams.get("trustAction");
    if (requestedAction !== "favorite" && requestedAction !== "recommend") return;
    resumedActionRef.current = true;
    url.searchParams.delete("trustAction");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    if (requestedAction === "favorite") void toggleAction("favorite");
    else void openRecommendation();
  }, [platformBaseHref, profileSlug, hasViewerSession]);

  const likeCount = state?.likeCount || 0;
  const favoriteCount = state?.favoriteCount || 0;
  const recommendationCount = state?.recommendationCount ?? initialRecommendationCount;
  const buttonClass = cn(
    "flex min-h-11 w-full min-w-0 flex-row items-center justify-center gap-1.5 rounded-xl px-1.5 py-2 text-[11px] font-bold transition sm:text-xs",
    isLight
      ? "text-stone-700 hover:bg-stone-100 hover:text-stone-950"
      : "text-white/75 hover:bg-white/10 hover:text-white",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ts-orange"
  );
  const activeButtonClass = isLight
    ? "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-300"
    : "bg-ts-orange/15 text-ts-orange-light ring-1 ring-inset ring-ts-orange/40";
  const countClass = cn("text-[10px] font-semibold", isLight ? "text-stone-500" : "text-white/50");
  const ownerBlocked = state?.viewerIsOwner === true;
  const recommendationButtonClass = cn(
    "flex w-full items-center justify-center gap-2.5 rounded-xl px-4 text-sm font-black transition",
    isCompact ? "min-h-11 py-2" : "min-h-14 py-3",
    isLight
      ? "bg-stone-900 text-white hover:bg-stone-800"
      : "border border-ts-orange/40 bg-ts-orange/15 text-ts-orange-light hover:bg-ts-orange/25",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ts-orange"
  );
  const identityLinkClass = cn(
    "flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold transition",
    isLight
      ? "text-stone-700 hover:bg-stone-100 hover:text-stone-950"
      : "text-white/75 hover:bg-white/10 hover:text-white",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ts-orange"
  );

  return (
    <>
      <div
        className={cn(
          "rounded-2xl border p-2.5",
          isCompact && "p-2",
          isLight ? "border-stone-200 bg-white/85 shadow-sm" : "border-white/10 bg-black/20",
          className
        )}
        aria-label={`Trust actions for ${profileName}`}
      >
        <p
          className={cn(
            "px-2 pb-2 pt-0.5 text-[10px] font-black uppercase tracking-[0.18em]",
            isCompact && "pb-1",
            isLight ? "text-stone-500" : "text-white/55"
          )}
        >
          Support this {subjectKind}
        </p>

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
                isLight ? "bg-white/15 text-white" : "bg-ts-orange/20 text-ts-orange-light"
              )}
            >
              {recommendationCount}
            </span>
          ) : null}
        </button>

        <div
          className={cn("grid grid-cols-3 gap-1", isCompact ? "mt-0.5" : "mt-1")}
          role="group"
          aria-label="Profile actions"
        >
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

        {publicIdentity ? (
          <div
            className={cn(
              "mt-2 border-t pt-2",
              isLight ? "border-stone-200" : "border-white/10"
            )}
            data-testid="public-profile-identity"
          >
            {publicIdentity.address ? (
              publicIdentity.address.mapUrl ? (
                <a
                  href={publicIdentity.address.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={identityLinkClass}
                  aria-label={`Get directions to ${publicIdentity.address.formatted}`}
                  data-testid="public-profile-address"
                >
                  <MapPin className="h-4 w-4 flex-none text-ts-orange" aria-hidden="true" />
                  <span className="min-w-0 break-words">{publicIdentity.address.formatted}</span>
                </a>
              ) : (
                <div className={identityLinkClass} data-testid="public-profile-address">
                  <MapPin className="h-4 w-4 flex-none text-ts-orange" aria-hidden="true" />
                  <span className="min-w-0 break-words">{publicIdentity.address.formatted}</span>
                </div>
              )
            ) : null}

            {publicIdentity.socials?.length ? (
              <div
                className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-3"
                aria-label={`${profileName} official social links`}
              >
                {publicIdentity.socials.map((social) => {
                  const Icon = PUBLIC_PROFILE_SOCIAL_ICONS[social.id] || HeartHandshake;
                  return (
                    <a
                      key={social.id}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={identityLinkClass}
                      aria-label={`Open ${profileName} on ${social.label}`}
                      data-testid={`public-profile-social-${social.id}`}
                    >
                      <Icon className="h-4 w-4 flex-none text-ts-orange" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block">{social.label}</span>
                        <span
                          className={cn(
                            "block truncate text-[10px] font-semibold",
                            isLight ? "text-stone-500" : "text-white/50"
                          )}
                        >
                          {social.publicHandle}
                        </span>
                      </span>
                    </a>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {loading && !state ? <span className="sr-only">Loading saved actions.</span> : null}
      </div>

      {profileSlug !== "jw-stone" ? (
        <PublicProfileAccountCard
          profileSlug={profileSlug}
          profileName={profileName}
          tone={tone}
          compact={isCompact}
          className={isCompact ? "mt-2" : "mt-3"}
        />
      ) : null}

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