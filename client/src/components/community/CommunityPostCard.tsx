import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
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

export interface CommunityPostCardAuthor {
  id?: string;
  name?: string;
  avatar?: string;
  role?: string;
  verified?: boolean;
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
      className: "bg-orange-500/10 border-orange-400/50 text-orange-200",
      accentClassName: "border-l-2 border-orange-400/70 pl-4",
      adminNotice: true,
    } as const;
  }

  if (normalized === "recommendations" || normalized === "recommendation") {
    return {
      label: "Recommendation",
      icon: <ThumbsUp className="w-3.5 h-3.5" />, 
      className:
        "bg-emerald-500/10 border-emerald-500/40 text-emerald-300",
      accentClassName: "border-l-2 border-emerald-500/60 pl-4",
    } as const;
  }

  if (normalized === "projects" || normalized === "project") {
    return {
      label: "Project",
      icon: <Hammer className="w-3.5 h-3.5" />, 
      className:
        "bg-purple-500/10 border-purple-500/40 text-purple-300",
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
      className:
        "bg-sky-500/10 border-sky-500/40 text-sky-300",
      accentClassName: "border-l-2 border-sky-500/60 pl-4",
    } as const;
  }

  return {
    label: "Update",
    icon: <MessageSquare className="w-3.5 h-3.5" />, 
    className: "bg-slate-500/10 border-slate-500/40 text-slate-200",
    accentClassName: "border-l-2 border-slate-500/60 pl-4",
  } as const;
}

export function CommunityPostCard({ post, onLike, formatTimeAgo }: CommunityPostCardProps) {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const isAuthor = !!user && !!post.author?.id && post.author.id === user.id;
  const role = (user as any)?.role as string | undefined;
  const canModerate = !!user && (
    (user as any)?.isAdmin === true ||
    (role ? [
      "community_moderator",
      "community_leader",
      "moderator",
      "ops_admin",
      "super_admin",
      "head_admin",
    ].includes(role) : false)
  );

  const handleLikeClick = () => {
    if (onLike) onLike(post.id);
  };

  const handleShareClick = async () => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = `${origin}/community?post=${encodeURIComponent(post.id)}`;
      const title = post.title || 'TradeScout community post';
      const text = (post.content || '').toString().slice(0, 200);

      if (navigator.share) {
        try {
          await navigator.share({ title, text, url });
          return;
        } catch (err: any) {
          if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
            return;
          }
        }
      }

      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(url);
        toast({
          title: 'Link copied',
          description: 'Post link copied to your clipboard.',
        });
      } else {
        toast({
          title: 'Unable to share automatically',
          description: 'Copy the link from your browser address bar to share.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Unable to share',
        description: 'Something went wrong while preparing the share link.',
        variant: 'destructive',
      });
    }
  };

  const categoryMeta = getCategoryMeta(post.category, post.postType, post.author?.role);
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
    navigate("/messages");
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
        description: error?.message || "Something went wrong while updating the post.",
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
        description: error?.message || "Something went wrong while hiding the post.",
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
        description: error?.message || "Something went wrong while removing the post.",
        variant: "destructive",
      });
    }
  };

  const localityLabel = (() => {
    if (post.audienceScope === "county" || (post.location || "").toLowerCase().includes("county")) {
      return "County-wide";
    }
    if (typeof post.distanceMiles === "number" && post.distanceMiles > 0) {
      return `${Math.round(post.distanceMiles)} miles away`;
    }
    return null;
  })();

  return (
    <Card className={`bg-tsCard border border-tsBorder shadow-sm rounded-xl hover:border-orange-500/30 transition-all ${isAdminNotice ? "ring-1 ring-orange-400/40 bg-tsCard/95" : ""}`}>
      <CardContent className="p-4 sm:p-5 space-y-3">
        {(isPinned || isTrending || isAdminNotice) && (
          <div className="-mx-4 sm:-mx-5 -mt-4 sm:-mt-5 px-4 sm:px-5 py-1.5 border-b border-orange-500/15 bg-orange-500/5 flex items-center gap-2 text-[11px] text-orange-200">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-500/30">
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
                <Avatar className="h-12 w-12 sm:h-14 sm:w-14 ring-2 ring-orange-500/40 group-hover:ring-orange-400/70">
                  <AvatarImage src={post.author.avatar} />
                  <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold">
                    {post.author.name?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-base group-hover:text-orange-300">
                      {post.author.name || "Anonymous"}
                    </span>
                    {post.author.role && (
                      <span className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-400">
                        {post.author.role}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
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
                        {localityLabel && <span className="ml-1 text-slate-500">· {localityLabel}</span>}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ) : (
              <>
                <Avatar className="h-12 w-12 sm:h-14 sm:w-14 ring-2 ring-orange-500/40">
                  <AvatarImage src={post.author?.avatar} />
                  <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold">
                    {post.author?.name?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-base">
                      {post.author?.name || "Anonymous"}
                    </span>
                    {post.author?.role && (
                      <span className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-400">
                        {post.author.role}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
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
                        {localityLabel && <span className="ml-1 text-slate-500">· {localityLabel}</span>}
                      </span>
                    )}
                  </div>
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
                  Open Messages with this neighbor
                </DropdownMenuItem>
              )}
              {canOpenMessages && <DropdownMenuSeparator />}
              {canModerate && (
                <>
                  <DropdownMenuItem onClick={handleTogglePin}>
                    <Pin className="w-3.5 h-3.5 mr-2" />
                    {isPinned ? "Unpin post" : "Pin post"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleHidePost}>
                    <EyeOff className="w-3.5 h-3.5 mr-2" />
                    Hide from community feed
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDeletePost} className="text-red-400 focus:text-red-500">
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Remove post
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className={categoryMeta.accentClassName}>
          {post.title && (
            <h3 className="text-base font-medium text-orange-400 mb-1">
              {post.title}
            </h3>
          )}
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
            {post.content}
          </p>
          {post.imageUrls && post.imageUrls.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {post.imageUrls.slice(0, 6).map((url, index) => (
                <div
                  key={url + index}
                  className="relative w-full overflow-hidden rounded-md border border-tsBorder bg-tsBg/40"
                  style={{ paddingBottom: "70%" }}
                >
                  <img
                    src={url}
                    alt="Post image"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {post.tags.map((tag, idx) => (
                <Badge
                  key={idx}
                  variant="secondary"
                  className="text-[10px] bg-orange-500/10 border border-orange-500/30 text-orange-400 px-2 py-0.5"
                >
                  #{tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {!isAdminNotice && (
          <>
            <Separator className="bg-tsBorder" />
            <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium">
              <span>{post.upvotes || 0} likes</span>
              <span>{post.comments || 0} comments</span>
            </div>
            <div className="mt-1 grid grid-cols-3 text-[12px] overflow-hidden border border-tsBorder rounded-lg bg-tsBg/40">
              <button
                onClick={handleLikeClick}
                className="flex items-center justify-center gap-1.5 py-2 hover:bg-tsBg transition-colors"
              >
                <Heart className="w-4 h-4" />
                <span>Like</span>
              </button>
              <button className="flex items-center justify-center gap-1.5 py-2 hover:bg-tsBg transition-colors border-l border-tsBorder">
                <MessageSquare className="w-4 h-4" />
                <span>Comment</span>
              </button>
              <button
                className="flex items-center justify-center gap-1.5 py-2 hover:bg-tsBg transition-colors border-l border-tsBorder"
                onClick={handleShareClick}
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
