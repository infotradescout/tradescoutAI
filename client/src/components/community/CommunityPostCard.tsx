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
    <Card className="bg-[#0f1624] border border-[#1f2937] hover:border-orange-500/30 shadow-md hover:shadow-xl transition-all">
      <CardContent className="p-5 sm:p-6">
        {(isPinned || isTrending) && (
          <div className="-mx-5 sm:-mx-6 -mt-5 sm:-mt-6 px-5 sm:px-6 py-1.5 border-b border-orange-500/15 bg-orange-500/5 flex items-center gap-2 text-[11px] text-orange-200 mb-3">
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

        <div className="flex items-start justify-between mb-3">
          <div className="flex gap-3">
            <Avatar className="h-12 w-12 sm:h-14 sm:w-14 ring-2 ring-orange-500/40">
              <AvatarImage src={post.author?.avatar} />
              <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold">
                {post.author?.name?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-white text-base sm:text-lg">
                  {post.author?.name || "Anonymous"}
                </span>
                {post.author?.role && (
                  <span className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-400">
                    {post.author.role}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-[0.8rem] text-slate-400">
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
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-slate-400 hover:text-white hover:bg-[#0f1419]"
          >
            <MoreHorizontal className="w-5 h-5" />
          </Button>
        </div>

        <div className={`mb-3 sm:mb-4 ${categoryMeta.accentClassName}`}>
          {post.title && (
            <h3 className="font-medium text-orange-400 text-sm sm:text-base mb-2">
              {post.title}
            </h3>
          )}
          <p className="text-slate-200 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
            {post.content}
          </p>
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
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

        <Separator className="mb-2 bg-[#1f2937]" />

        <div className="flex items-center justify-between text-xs sm:text-sm text-slate-300 mb-1.5 sm:mb-2 font-medium">
          <span>{post.upvotes || 0} likes</span>
          <span>{post.comments || 0} comments</span>
        </div>

        <div className="flex items-center justify-between pt-1 text-xs sm:text-sm text-slate-400">
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
