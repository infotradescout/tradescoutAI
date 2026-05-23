import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { share } from "@/utils/share";
import { useCommunityAuthoritySurfaces } from "@/hooks/useCommunityAuthoritySurfaces";
import {
  MapPin,
  MessageSquare,
  Share2,
  Heart,
  MoreHorizontal,
  HelpCircle,
  ThumbsUp,
  Hammer,
  Info,
  Pin,
  EyeOff,
  Trash2,
  MessagesSquare,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserBadges } from "@/components/user-badges";
import { CommunityCTA } from "./CommunityCTA";
import { ContactOutcomeModal, type ContactOutcome } from "./ContactOutcomeModal";
import { formatContextTag, toContextTagKey } from "@/utils/formatContextTag";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";

const UPLOAD_ID_PATH_PATTERN = /\/uploads\/[0-9a-f-]{36}$/i;
const UPLOAD_FALLBACK_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"] as const;

function handleCommunityImageError(image: HTMLImageElement) {
  const currentSrc = image.currentSrc || image.src || "";
  const attempt = Number.parseInt(image.dataset.fallbackAttempt || "0", 10) || 0;
  if (attempt < UPLOAD_FALLBACK_EXTENSIONS.length && UPLOAD_ID_PATH_PATTERN.test(currentSrc)) {
    const base = currentSrc.replace(/([?#].*)$/, "");
    const suffix = currentSrc.slice(base.length);
    image.dataset.fallbackAttempt = String(attempt + 1);
    image.src = `${base}${UPLOAD_FALLBACK_EXTENSIONS[attempt]}${suffix}`;
    return;
  }

  image.style.display = "none";
}

export interface CommunityPostCardAuthor {
  id?: string;
  name?: string;
  avatar?: string;
  role?: string;
  verified?: boolean;
  cvsScore?: number | string | null;
  verificationStatus?: string;
  badges?: string[];
}

export interface CommunityPostCardData {
  id: string;
  title?: string;
  content: string;
  author?: CommunityPostCardAuthor;
  category?: string;
  postType?: string; // new: explicit post type if provided by backend
  pinned?: boolean;
  trending?: boolean;
  location?: string;
  county?: string;
  state?: string;
  audienceScope?: "neighborhood" | "county" | "area" | "global";
  distanceMiles?: number;
  createdAt: string;
  upvotes?: number;
  comments?: number;
  tags?: string[];
  imageUrls?: string[];
  hasWorkRequest?: boolean;
  workRequestId?: string | null;
  authorityLabel?: string; // Scout authority interpretive label
}

export interface CommunityPostCardProps {
  post: CommunityPostCardData;
  onLike?: (postId: string) => void;
  formatTimeAgo: (dateString: string) => string;
}

function getCategoryMeta(category?: string, postTypeRaw?: string, authorRole?: string) {
  const normalized = (postTypeRaw || category || "").toLowerCase();
  const isAdmin = (authorRole || "").toLowerCase().includes("admin");

  if (normalized === "admin_notice" || (isAdmin && normalized === "admin")) {
    return {
      label: "Official Update",
      icon: <Info className="w-3.5 h-3.5" />,
      className: "bg-ts-orange/10 border-ts-orange/30 text-ts-orange",
      accentClassName: "border-l-2 border-ts-orange/30 pl-4",
      adminNotice: true,
    } as const;
  }

  if (normalized === "recommendations" || normalized === "recommendation") {
    return {
      label: "Trust Signal",
      icon: <ThumbsUp className="w-3.5 h-3.5" />,
      className: "bg-emerald-500/10 border-emerald-500/40 text-emerald-300",
      accentClassName: "border-l-2 border-emerald-500/60 pl-4",
    } as const;
  }

  if (normalized === "projects" || normalized === "project") {
    return {
      label: "Project",
      icon: <Hammer className="w-3.5 h-3.5" />,
      className: "bg-purple-500/10 border-purple-500/40 text-purple-300",
      accentClassName: "border-l-2 border-purple-500/60 pl-4",
    } as const;
  }

  if (normalized === "safety") {
    return {
      label: "Safety Alert",
      icon: <Info className="w-3.5 h-3.5" />,
      className: "bg-red-500/10 border-red-500/40 text-red-300",
      accentClassName: "border-l-2 border-red-500/60 pl-4",
    } as const;
  }

  if (normalized === "questions" || normalized === "question") {
    return {
      label: "Question",
      icon: <HelpCircle className="w-3.5 h-3.5" />,
      className: "bg-sky-500/10 border-sky-500/40 text-sky-300",
      accentClassName: "border-l-2 border-sky-500/60 pl-4",
    } as const;
  }

  return {
    label: "Update",
    icon: <MessageSquare className="w-3.5 h-3.5" />,
    className: "bg-white/10 border-white/15 text-white/70",
    accentClassName: "border-l-2 border-white/15 pl-4",
  } as const;
}

export function CommunityPostCard({ post, onLike, formatTimeAgo }: CommunityPostCardProps) {
  const { toast } = useToast();
  const { data: authoritySurfaces } = useCommunityAuthoritySurfaces();
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const showAuthorityLabels = authoritySurfaces?.phase2bAuthorityLabelsEnabled === true;
  const isAuthor =
    !!user && !!post.author?.id && String(post.author.id) === String((user as any).id);
  const initialWorkBoardState = (() => {
    if (post.workRequestId) {
      return { sent: true, workRequestId: String(post.workRequestId) };
    }
    if (post.hasWorkRequest) {
      return { sent: true, workRequestId: undefined };
    }
    return { sent: false, workRequestId: undefined };
  })();
  const [workBoardInfo, setWorkBoardInfo] = useState<{ sent: boolean; workRequestId?: string }>(
    initialWorkBoardState
  );
  const [contactOutcome, setContactOutcome] = useState<ContactOutcome | null>(null);
  const role = (user as any)?.role as string | undefined;
  const canModerate =
    !!user &&
    ((user as any)?.isAdmin === true ||
      (role
        ? [
            "community_moderator",
            "community_leader",
            "moderator",
            "ops_admin",
            "super_admin",
          ].includes(role)
        : false));

  const handleLikeClick = () => {
    if (onLike) onLike(post.id);
  };

  const handleShareClick = async () => {
    await share({
      path: `/community-feed?post=${encodeURIComponent(post.id)}`,
      title: post.title || "TradeScout community post",
      text: (post.content || "").toString(),
      contextLabel: "Post link",
    });
  };

  const categoryMeta = getCategoryMeta(post.category, post.postType, post.author?.role);
  const rawCvs =
    typeof post.author?.cvsScore === "number"
      ? post.author.cvsScore
      : typeof post.author?.cvsScore === "string" && post.author.cvsScore.trim().length > 0
        ? Number(post.author.cvsScore)
        : null;
  const cvsScore = Number.isFinite(rawCvs as number) ? Number(rawCvs) : null;
  const verificationStatus = String(post.author?.verificationStatus || "").toLowerCase();
  const verificationLabel =
    verificationStatus === "approved"
      ? "Professional Verified"
      : verificationStatus === "under_review"
        ? "Verification Review"
        : verificationStatus === "pending"
          ? "Verification Pending"
          : null;
  const isPinned = post.pinned === true;
  const isTrending = !isPinned && post.trending === true;
  const isAdminNotice = (categoryMeta as any).adminNotice === true;
  const canOpenMessages = isAuthenticated && !!post.author?.id && !isAuthor;

  const invalidateCommunityQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
  };

  const handleOpenMessages = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to message community members.",
        variant: "destructive",
      });
      return;
    }
    if (!post.author?.id) {
      navigate("/messages");
      return;
    }

    const authorName = post.author?.name || "Community member";
    const targetLocation =
      post.county && post.state ? `${post.county}, ${post.state}` : post.location || undefined;
    const suggestedIntent: ContactOutcome["suggestedIntent"] = post.hasWorkRequest
      ? "hire"
      : "collaborate";

    setContactOutcome({
      targetUserId: String(post.author.id),
      targetUserName: authorName,
      targetRole: post.author?.role || "Member",
      targetLocation,
      suggestedIntent,
      reasonForContact: post.title
        ? `I saw your post \"${post.title}\" and I'd like to connect.`
        : "I saw your post and I'd like to connect.",
      riskFlags: [],
      decisionScope: `community_post:${post.id}`,
      decisionTitle: "Community contact request",
    });
  };

  const handleTogglePin = async () => {
    if (!canModerate) return;
    try {
      await apiRequest("PATCH", `/api/community/posts/${post.id}/pin`, { isPinned: !isPinned });
      invalidateCommunityQueries();
      toast({
        title: isPinned ? "Post unpinned" : "Post pinned",
        description: isPinned
          ? "The post will now follow normal sort order."
          : "The post is now highlighted for your community.",
      });
    } catch (error: any) {
      toast({
        title: "Unable to update pin state",
        description: formatUserFacingErrorMessage(
          error,
          "Something went wrong while updating the post."
        ),
        variant: "destructive",
      });
    }
  };

  const handleHidePost = async () => {
    if (!canModerate) return;
    try {
      await apiRequest("PATCH", `/api/community/posts/${post.id}/hide`, { isHidden: true });
      invalidateCommunityQueries();
      toast({
        title: "Post hidden",
        description: "This post is now hidden from the main community feed.",
      });
    } catch (error: any) {
      toast({
        title: "Unable to hide post",
        description: formatUserFacingErrorMessage(
          error,
          "Something went wrong while hiding the post."
        ),
        variant: "destructive",
      });
    }
  };

  const handleDeletePost = async () => {
    if (!canModerate) return;
    const confirmed = window.confirm("Remove this post and its comments from the community?");
    if (!confirmed) return;

    try {
      await apiRequest("DELETE", `/api/community/posts/${post.id}`);
      invalidateCommunityQueries();
      toast({
        title: "Post removed",
        description: "The post has been removed from the community.",
      });
    } catch (error: any) {
      toast({
        title: "Unable to remove post",
        description: formatUserFacingErrorMessage(
          error,
          "Something went wrong while removing the post."
        ),
        variant: "destructive",
      });
    }
  };

  const handleSendToWorkBoard = async () => {
    if (!isAuthor || workBoardInfo.sent) return;
    try {
      const workRequest = await apiRequest("POST", `/api/community/posts/${post.id}/send-to-board`);
      setWorkBoardInfo({
        sent: true,
        workRequestId: workRequest?.id ? String(workRequest.id) : workBoardInfo.workRequestId,
      });
      return workRequest;
    } catch (error: any) {
      toast({
        title: "Unable to send to Direct Connect",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const localityLabel = (() => {
    if (post.audienceScope === "county" || (post.location || "").toLowerCase().includes("county")) {
      return "Area-wide";
    }
    if (typeof post.distanceMiles === "number" && post.distanceMiles > 0) {
      return `${Math.round(post.distanceMiles)} miles away`;
    }
    return null;
  })();

  const canDirectConnect =
    !!post.hasWorkRequest ||
    post.category === "recommendation_request" ||
    post.postType === "recommendation_request";

  const isContractor = (role || "").toLowerCase().includes("contractor");

  return (
    <>
      <Card
        className={`bg-tsCard border border-white/10 shadow-sm rounded-xl hover:border-ts-orange/30 transition-all ${isAdminNotice ? "ring-1 ring-ts-orange/70 bg-tsCard/95" : ""}`}
      >
        <CardContent className="p-4 sm:p-5 space-y-3">
          {(isPinned || isTrending || isAdminNotice) && (
            <div className="-mx-4 sm:-mx-5 -mt-4 sm:-mt-5 px-4 sm:px-5 py-1.5 border-b border-ts-orange/30 bg-ts-orange/5 flex items-center gap-2 text-[11px] text-ts-orange">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-ts-orange/30">
                {isPinned ? (
                  <Heart className="w-3 h-3" />
                ) : isAdminNotice ? (
                  <Info className="w-3 h-3" />
                ) : (
                  <MessageSquare className="w-3 h-3" />
                )}
              </span>
              <span className="font-medium">
                {isPinned
                  ? "Pinned · From TradeScout"
                  : isAdminNotice
                    ? `Official TradeScout Update${post.county ? ` — ${post.county}` : post.location ? ` — ${post.location}` : ""}`
                    : "Trending in your area"}
              </span>
            </div>
          )}

          <div className="flex items-start justify-between">
            <div className="flex gap-3">
              {post.author?.id ? (
                <Link
                  href={`/community/u/${encodeURIComponent(post.author.id)}`}
                  className="flex gap-3 group cursor-pointer"
                >
                  <Avatar className="h-11 w-11 sm:h-12 sm:w-12 ring-2 ring-ts-orange/70 group-hover:ring-ts-orange/70">
                    <AvatarImage src={post.author.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold">
                      <TradeScoutLogo size="sm" className="h-8 w-8 bg-transparent ring-0" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-base group-hover:text-ts-orange">
                        {post.author.name || "Anonymous"}
                      </span>
                      {post.author.role && (
                        <span className="text-[0.7rem] uppercase tracking-[0.16em] text-white/60">
                          {post.author.role}
                        </span>
                      )}
                      {post.author?.verified !== undefined && (
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0.5 ${
                            post.author.verified ? "text-green-300" : "text-white/70"
                          }`}
                          title={
                            post.author.verified
                              ? "Verified profile"
                              : "Unverified profile. Verified members are more likely to be accepted."
                          }
                        >
                          {post.author.verified ? "Verified" : "Unverified"}
                        </Badge>
                      )}
                      {verificationLabel && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0.5 border-[color:var(--border-subtle)]"
                        >
                          {verificationLabel}
                        </Badge>
                      )}
                      {cvsScore !== null && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0.5 border-[color:var(--border-subtle)]"
                        >
                          {`CVS ${Math.round(cvsScore)}`}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${categoryMeta.className}`}
                      >
                        {categoryMeta.icon}
                        <span className="font-medium">{categoryMeta.label}</span>
                      </span>
                      <span>• {formatTimeAgo(post.createdAt)}</span>
                      {post.location && (
                        <span className="inline-flex items-center gap-1">
                          <span>•</span>
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{post.location}</span>
                          {localityLabel && (
                            <span className="ml-1 text-white/60">· {localityLabel}</span>
                          )}
                        </span>
                      )}
                    </div>
                    {post.author.badges && post.author.badges.length > 0 && (
                      <UserBadges
                        badges={post.author.badges}
                        size="sm"
                        maxVisible={3}
                        className="mt-1"
                      />
                    )}
                  </div>
                </Link>
              ) : (
                <>
                  <Avatar className="h-11 w-11 sm:h-12 sm:w-12 ring-2 ring-ts-orange/70">
                    <AvatarImage src={post.author?.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold">
                      <TradeScoutLogo size="sm" className="h-8 w-8 bg-transparent ring-0" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-base">
                        {post.author?.name || "Anonymous"}
                      </span>
                      {post.author?.role && (
                        <span className="text-[0.7rem] uppercase tracking-[0.16em] text-white/60">
                          {post.author.role}
                        </span>
                      )}
                      {post.author?.verified !== undefined && (
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0.5 ${
                            post.author.verified ? "text-green-300" : "text-white/70"
                          }`}
                          title={
                            post.author.verified
                              ? "Verified profile"
                              : "Unverified profile. Verified members are more likely to be accepted."
                          }
                        >
                          {post.author.verified ? "Verified" : "Unverified"}
                        </Badge>
                      )}
                      {verificationLabel && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0.5 border-[color:var(--border-subtle)]"
                        >
                          {verificationLabel}
                        </Badge>
                      )}
                      {cvsScore !== null && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0.5 border-[color:var(--border-subtle)]"
                        >
                          {`CVS ${Math.round(cvsScore)}`}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${categoryMeta.className}`}
                      >
                        {categoryMeta.icon}
                        <span className="font-medium">{categoryMeta.label}</span>
                      </span>
                      <span>• {formatTimeAgo(post.createdAt)}</span>
                      {post.location && (
                        <span className="inline-flex items-center gap-1">
                          <span>•</span>
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{post.location}</span>
                          {localityLabel && (
                            <span className="ml-1 text-white/60">· {localityLabel}</span>
                          )}
                        </span>
                      )}
                    </div>
                    {post.author?.badges && post.author.badges.length > 0 && (
                      <UserBadges
                        badges={post.author.badges}
                        size="sm"
                        maxVisible={3}
                        className="mt-1"
                      />
                    )}
                  </div>
                </>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-tsBg transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[190px] text-xs">
                {canOpenMessages && (
                  <DropdownMenuItem onClick={handleOpenMessages}>
                    <MessagesSquare className="w-3.5 h-3.5 mr-2" />
                    Open Messages
                  </DropdownMenuItem>
                )}
                {canOpenMessages && <DropdownMenuSeparator />}
                {isAuthor && (
                  <>
                    {!workBoardInfo.sent ? (
                      <DropdownMenuItem onClick={handleSendToWorkBoard}>
                        <Hammer className="w-3.5 h-3.5 mr-2" />
                        Send to Direct Connect
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem disabled>
                          <Hammer className="w-3.5 h-3.5 mr-2 text-emerald-400" />
                          <span className="text-emerald-300">✓ Sent to Direct Connect</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate("/direct-connect")}>
                          <Hammer className="w-3.5 h-3.5 mr-2" />
                          Open Direct Connect
                        </DropdownMenuItem>
                      </>
                    )}
                    {canModerate && <DropdownMenuSeparator />}
                  </>
                )}
                {canModerate && (
                  <>
                    <DropdownMenuItem onClick={handleTogglePin}>
                      <Pin className="w-3.5 h-3.5 mr-2" />
                      {isPinned ? "Unpin post" : "Pin post"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleHidePost}>
                      <EyeOff className="w-3.5 h-3.5 mr-2" />
                      Hide from feed
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleDeletePost}
                      className="text-red-400 focus:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" />
                      Remove from feed
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className={categoryMeta.accentClassName}>
            {post.title && (
              <h3 className="text-base font-medium text-ts-orange mb-1">{post.title}</h3>
            )}
            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
              {post.content}
            </p>
            {post.imageUrls && post.imageUrls.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {post.imageUrls.slice(0, 6).map((url, index) => (
                  <div
                    key={url + index}
                    className="relative w-full overflow-hidden rounded-md border border-white/10 bg-tsBg/40"
                    style={{ paddingBottom: "70%" }}
                  >
                    <img
                      src={url}
                      alt="Post image"
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(event) => handleCommunityImageError(event.currentTarget)}
                    />
                  </div>
                ))}
              </div>
            )}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {post.tags
                  .map((raw) => ({
                    key: toContextTagKey(raw),
                    label: formatContextTag(raw),
                  }))
                  .filter((t) => t.key && t.label)
                  .slice(0, 12)
                  .map((tag, idx) => {
                    return (
                      <button
                        key={`${tag.key}-${idx}`}
                        type="button"
                        onClick={() =>
                          navigate(`/community-feed?tag=${encodeURIComponent(tag.key)}`)
                        }
                        className="focus:outline-none"
                        aria-label={`View topic ${tag.label}`}
                        title={`View topic: ${tag.label}`}
                      >
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-ts-orange/10 border border-ts-orange/30 text-ts-orange px-2 py-0.5 hover:bg-ts-orange/20"
                        >
                          {tag.label}
                        </Badge>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          {!isAdminNotice && (
            <>
              <Separator className="bg-white/10" />
              <div className="flex items-center justify-between text-[11px] text-white/70 font-medium">
                <span>{post.upvotes || 0} likes</span>
                <span>{post.comments || 0} comments</span>
              </div>
              <div className="mt-1 grid grid-cols-3 text-[12px] overflow-hidden border border-white/10 rounded-lg bg-tsBg/40">
                <button
                  onClick={handleLikeClick}
                  className="flex items-center justify-center gap-1.5 py-2 hover:bg-tsBg transition-colors"
                >
                  <Heart className="w-4 h-4" />
                  <span>Like</span>
                </button>
                <button className="flex items-center justify-center gap-1.5 py-2 hover:bg-tsBg transition-colors border-l border-white/10">
                  <MessageSquare className="w-4 h-4" />
                  <span>Comment</span>
                </button>
                <button
                  className="flex items-center justify-center gap-1.5 py-2 hover:bg-tsBg transition-colors border-l border-white/10"
                  onClick={handleShareClick}
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>
              </div>
              <CommunityCTA
                layout="grid"
                source="community_post"
                contextId={post.id}
                ownerUserId={post.author?.id ? String(post.author.id) : undefined}
                canDirectConnect={canDirectConnect}
                canMessage={canOpenMessages}
                disableDirectConnect={isContractor}
                scope={post.county} // Pass county for authority scope
              />

              {/* Authority label - interpretive guidance from Scout */}
              {showAuthorityLabels && post.authorityLabel && (
                <div className="mt-3 pt-3 border-t border-white/10 flex items-start gap-2">
                  <Info className="h-4 w-4 text-white/60 mt-0.5 shrink-0" />
                  <span className="text-xs text-white/60 italic leading-relaxed">
                    {post.authorityLabel}
                  </span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      {contactOutcome && (
        <ContactOutcomeModal outcome={contactOutcome} onClose={() => setContactOutcome(null)} />
      )}
    </>
  );
}
