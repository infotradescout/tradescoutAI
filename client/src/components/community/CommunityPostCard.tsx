import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  Clock,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserBadges } from "@/components/user-badges";
import { CommunityCTA } from "./CommunityCTA";
import { ContactOutcomeModal, type ContactOutcome } from "./ContactOutcomeModal";
import { formatContextTag, toContextTagKey } from "@/utils/formatContextTag";
import { cn } from "@/lib/utils";

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
  postType?: string;
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
  authorityLabel?: string;
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
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      className: "bg-ts-orange/10 border-ts-orange/20 text-ts-orange",
      accentClassName: "border-l-2 border-ts-orange/30 pl-4",
      adminNotice: true,
    } as const;
  }

  if (normalized === "recommendations" || normalized === "recommendation") {
    return {
      label: "Trust Signal",
      icon: <ThumbsUp className="w-3.5 h-3.5" />,
      className: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
      accentClassName: "border-l-2 border-emerald-500/60 pl-4",
    } as const;
  }

  if (normalized === "projects" || normalized === "project") {
    return {
      label: "Project",
      icon: <Hammer className="w-3.5 h-3.5" />,
      className: "bg-purple-500/10 border-purple-500/20 text-purple-400",
      accentClassName: "border-l-2 border-purple-500/60 pl-4",
    } as const;
  }

  if (normalized === "safety") {
    return {
      label: "Safety Alert",
      icon: <AlertCircle className="w-3.5 h-3.5" />,
      className: "bg-red-500/10 border-red-500/20 text-red-400",
      accentClassName: "border-l-2 border-red-500/60 pl-4",
    } as const;
  }

  if (normalized === "questions" || normalized === "question") {
    return {
      label: "Question",
      icon: <HelpCircle className="w-3.5 h-3.5" />,
      className: "bg-sky-500/10 border-sky-500/20 text-sky-400",
      accentClassName: "border-l-2 border-sky-500/60 pl-4",
    } as const;
  }

  return {
    label: "Update",
    icon: <MessageSquare className="w-3.5 h-3.5" />,
    className: "bg-white/5 border-white/10 text-white/60",
    accentClassName: "border-l-2 border-white/15 pl-4",
  } as const;
}

export function CommunityPostCard({ post, onLike, formatTimeAgo }: CommunityPostCardProps) {
  const { toast } = useToast();
  const { data: authoritySurfaces } = useCommunityAuthoritySurfaces();
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.upvotes || 0);

  const isAuthor =
    !!user && !!post.author?.id && String(post.author.id) === String((user as any).id);
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
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to like posts.",
        variant: "destructive",
      });
      return;
    }
    setIsLiked(!isLiked);
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
    if (onLike) onLike(post.id);
  };

  const handleShareClick = async () => {
    await share({
      path: `/community?post=${encodeURIComponent(post.id)}`,
      title: post.title || "TradeScout community post",
      text: (post.content || "").toString(),
      contextLabel: "Post link",
    });
  };

  const categoryMeta = getCategoryMeta(post.category, post.postType, post.author?.role);
  const isPinned = post.pinned === true;
  const isTrending = !isPinned && post.trending === true;
  const canOpenMessages = isAuthenticated && !!post.author?.id && !isAuthor;

  return (
    <Card className="bg-[#141414] border-white/5 overflow-hidden hover:border-white/10 transition-all group">
      <CardContent className="p-0">
        {/* Header Section */}
        <div className="p-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-10 w-10 border border-white/10">
                <AvatarImage src={post.author?.avatar} />
                <AvatarFallback className="bg-ts-orange text-black font-bold text-sm">
                  {post.author?.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              {post.author?.verified && (
                <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-ts-orange fill-ts-orange/20" />
                </div>
              )}
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white hover:underline cursor-pointer">
                  {post.author?.name || "Community Member"}
                </span>
                {post.author?.role && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">
                    {post.author.role.replace("_", " ")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-white/40">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimeAgo(post.createdAt)}</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span>{post.location || "Local"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              className={cn(
                "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                categoryMeta.className
              )}
            >
              {categoryMeta.icon}
              {categoryMeta.label}
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/5"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#1A1A1A] border-white/10 text-white">
                <DropdownMenuItem
                  onClick={handleShareClick}
                  className="hover:bg-white/5 cursor-pointer"
                >
                  <Share2 className="w-4 h-4 mr-2" /> Share Post
                </DropdownMenuItem>
                {canModerate && (
                  <>
                    <DropdownMenuSeparator className="bg-white/5" />
                    <DropdownMenuItem className="text-ts-orange hover:bg-ts-orange/10 cursor-pointer">
                      <Pin className="w-4 h-4 mr-2" /> {isPinned ? "Unpin Post" : "Pin Post"}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-400 hover:bg-red-400/10 cursor-pointer">
                      <Trash2 className="w-4 h-4 mr-2" /> Delete Post
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content Section */}
        <div className="px-4 pb-4 space-y-3">
          {post.title && (
            <h3 className="text-lg font-bold text-white leading-tight">{post.title}</h3>
          )}
          <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap break-words">
            {post.content}
          </p>

          {post.imageUrls && post.imageUrls.length > 0 && (
            <div
              className={cn(
                "grid gap-2 rounded-xl overflow-hidden border border-white/5",
                post.imageUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"
              )}
            >
              {post.imageUrls.map((url, i) => (
                <div key={url + i} className="relative aspect-video bg-white/5">
                  <img
                    src={url}
                    alt="Post"
                    className="w-full h-full object-cover"
                    onError={(e) => handleCommunityImageError(e.currentTarget)}
                  />
                </div>
              ))}
            </div>
          )}

          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {post.tags.map((tag) => (
                <span key={tag} className="text-xs text-ts-orange hover:underline cursor-pointer">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLikeClick}
              className={cn(
                "h-9 px-3 gap-2 rounded-full transition-all",
                isLiked
                  ? "text-red-400 bg-red-400/10"
                  : "text-white/40 hover:text-white hover:bg-white/5"
              )}
            >
              <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
              <span className="text-xs font-bold">{likeCount}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3 gap-2 rounded-full text-white/40 hover:text-white hover:bg-white/5"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-xs font-bold">{post.comments || 0}</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {canOpenMessages && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 rounded-full border-white/10 text-white/60 hover:text-white hover:bg-white/5 text-[11px] font-bold"
              >
                <MessagesSquare className="w-3.5 h-3.5 mr-1.5" />
                Message
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShareClick}
              className="h-8 w-8 rounded-full text-white/40 hover:text-white hover:bg-white/5"
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
