import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { Link } from "wouter";

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
  pinned?: boolean;
  trending?: boolean;
  location?: string;
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

function getCategoryMeta(category?: string) {
  const normalized = (category || "").toLowerCase();

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

  const categoryMeta = getCategoryMeta(post.category);
  const isPinned = post.pinned === true;
  const isTrending = !isPinned && post.trending === true;

  return (
    <Card className="bg-[#0f1624] border border-[#1f2937] shadow-sm rounded-xl hover:border-orange-500/30 transition-all">
      <CardContent className="p-4 sm:p-5 space-y-3">
        {(isPinned || isTrending) && (
          <div className="-mx-4 sm:-mx-5 -mt-4 sm:-mt-5 px-4 sm:px-5 py-1.5 border-b border-orange-500/15 bg-orange-500/5 flex items-center gap-2 text-[11px] text-orange-200">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-500/30">
              {isPinned ? (
                <Heart className="w-3 h-3" />
              ) : (
                <MessageSquare className="w-3 h-3" />
              )}
            </span>
            <span className="font-medium">
              {isPinned ? "Pinned · From TradeScout" : "Trending in your area"}
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
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-[#0f1419] transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
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
                  className="relative w-full overflow-hidden rounded-md border border-[#1f2937] bg-black/40"
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
                  className="text-xs bg-orange-500/10 border border-orange-500/30 text-orange-400 px-3 py-1"
                >
                  #{tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Separator className="bg-[#1f2937]" />

        <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
          <span>{post.upvotes || 0} likes</span>
          <span>{post.comments || 0} comments</span>
        </div>

        <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
          <button
            onClick={handleLikeClick}
            className="inline-flex items-center gap-1.5 hover:text-orange-400 transition-colors"
          >
            <Heart className="w-4 h-4" />
            <span>Like</span>
          </button>
          <button className="inline-flex items-center gap-1.5 hover:text-orange-400 transition-colors">
            <MessageSquare className="w-4 h-4" />
            <span>Comment</span>
          </button>
          <button
            className="inline-flex items-center gap-1.5 hover:text-orange-400 transition-colors"
            onClick={handleShareClick}
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
