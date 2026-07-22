import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommentsSection } from "./CommentsSection";
import { ReportModal } from "./ReportModal";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { useToast } from "@/hooks/use-toast";
import { share } from "@/utils/share";
import {
  ContactOutcomeModal,
  type ContactOutcome,
} from "@/components/community/ContactOutcomeModal";
import {
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Pin,
  BookmarkPlus,
  Flag,
  Calendar,
  MapPin,
  Users,
  TrendingUp,
  UserRound,
  Briefcase,
  UserPlus,
} from "lucide-react";

interface PostCardProps {
  post: any;
}

export function PostCard({ post }: PostCardProps) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [showComments, setShowComments] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [contactOutcome, setContactOutcome] = useState<ContactOutcome | null>(null);
  const [isLiked, setIsLiked] = useState(Boolean(post.userReaction || post.isLiked));
  const [likeCount, setLikeCount] = useState(
    (post._count && typeof post._count.reactions === "number"
      ? post._count.reactions
      : post.likeCount) || 0
  );

  // Like/unlike mutation (uses reactions endpoint with "like" reactionType)
  const likeMutation = useMutation({
    mutationFn: () => {
      if (isLiked) {
        return apiRequest("DELETE", `/api/social/posts/${post.id}/reactions`);
      }
      return apiRequest("POST", `/api/social/posts/${post.id}/reactions`, {
        reactionType: "like",
      });
    },
    onSuccess: () => {
      setIsLiked(!isLiked);
      setLikeCount((prev: number) => (isLiked ? prev - 1 : prev + 1));
      queryClient.invalidateQueries({ queryKey: ["/api/social/feed"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: formatUserFacingErrorMessage(error, "Failed to update like"),
        variant: "destructive",
      });
    },
  });

  // Save/bookmark mutation
  const saveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/social/posts/${post.id}/save`),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Post saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: formatUserFacingErrorMessage(error, "Failed to save post"),
        variant: "destructive",
      });
    },
  });

  const handleLike = () => {
    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please login to like posts",
        variant: "destructive",
      });
      return;
    }
    likeMutation.mutate();
  };

  const handleShare = () => {
    void share({
      path: `/community/post/${post.id}`,
      title: post.title || "TradeScout community post",
      text: String(post.content || ""),
      contextLabel: "Post link",
      kind: "community_post",
      imageUrl: Array.isArray(post.imageUrls)
        ? post.imageUrls[0]
        : Array.isArray(post.images)
          ? post.images[0]
          : undefined,
    });
  };

  const handleSave = () => {
    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please login to save posts",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  const handleReport = () => {
    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please login to report posts",
        variant: "destructive",
      });
      return;
    }
    setShowReportModal(true);
  };

  const targetUserId = String(post?.author?.id || post?.authorId || "").trim();
  const targetUserName = [post?.author?.firstName, post?.author?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const handleOpenProfile = () => {
    if (!targetUserId) return;
    navigate(`/community/u/${encodeURIComponent(targetUserId)}`);
  };

  const handleOpenDirectConnect = () => {
    if (!targetUserId) return;
    const params = new URLSearchParams({
      source: "social_post_card",
      target: targetUserId,
    });
    if (targetUserName) {
      params.set("targetName", targetUserName);
    }
    navigate(`/direct-connect?${params.toString()}`);
  };

  const handleConnectionRequest = () => {
    if (!targetUserId) return;
    setContactOutcome({
      targetUserId,
      targetUserName: targetUserName || "Community member",
      targetRole: String(post?.author?.role || "Member"),
      targetLocation: post?.location || undefined,
      suggestedIntent: "collaborate",
      reasonForContact: post?.title
        ? `I saw your post "${post.title}" and want to connect.`
        : "I saw your post and want to connect.",
      riskFlags: [],
      decisionScope: `social_post:${post.id}`,
      decisionTitle: "Community connection request",
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  const getPostTypeColor = (type: string) => {
    const colors = {
      general: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      projects: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      recommendations: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
      questions: "bg-ts-orange/10 text-ts-orange dark:bg-ts-orange/10 dark:text-ts-orange",
      marketplace: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
      events: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    };
    return colors[type as keyof typeof colors] || colors.general;
  };

  const getPostTypeIcon = (type: string) => {
    const icons = {
      projects: TrendingUp,
      events: Calendar,
      marketplace: Users,
      default: MessageCircle,
    };
    const IconComponent = icons[type as keyof typeof icons] || icons.default;
    return <IconComponent className="h-4 w-4" />;
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleOpenProfile}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ts-orange/70"
              title="View public profile"
              aria-label={`View ${targetUserName || "member"} profile`}
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={post.author.profileImageUrl} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {post.author.firstName?.[0]}
                  {post.author.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
            </button>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="font-semibold text-sm hover:text-ts-orange text-left"
                  onClick={handleOpenProfile}
                  title="View public profile"
                >
                  {post.author.firstName} {post.author.lastName}
                </button>
                <Badge
                  variant="secondary"
                  className={`text-xs px-1.5 py-0.5 ${
                    post.author.isVerified ? "text-green-300" : "text-white/70"
                  }`}
                  title={
                    post.author.isVerified
                      ? "Verified profile"
                      : "Unverified profile. Verified members are more likely to be accepted."
                  }
                >
                  {post.author.isVerified ? "Verified" : "Unverified"}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatDate(post.createdAt)}</span>
                {post.location && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span>{post.location}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${getPostTypeColor(post.postType)}`}>
              <div className="flex items-center gap-1">
                {getPostTypeIcon(post.postType)}
                <span className="capitalize">{post.postType.replace("_", " ")}</span>
              </div>
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {targetUserId && (
                  <DropdownMenuItem onClick={handleOpenProfile}>
                    <UserRound className="h-4 w-4 mr-2" />
                    View public profile
                  </DropdownMenuItem>
                )}
                {targetUserId && (
                  <DropdownMenuItem onClick={handleOpenDirectConnect}>
                    <Briefcase className="h-4 w-4 mr-2" />
                    Start a Request
                  </DropdownMenuItem>
                )}
                {targetUserId && (
                  <DropdownMenuItem onClick={handleConnectionRequest}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Send connection request
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleSave}>
                  <BookmarkPlus className="h-4 w-4 mr-2" />
                  Save post
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleReport}>
                  <Flag className="h-4 w-4 mr-2" />
                  Report post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Post Title */}
        {post.title && <h3 className="text-lg font-semibold leading-tight">{post.title}</h3>}

        {/* Post Content */}
        <div className="prose prose-sm max-w-none">
          <p className="text-white dark:text-white whitespace-pre-wrap">{post.content}</p>
        </div>

        {/* Post Images */}
        {post.imageUrls && post.imageUrls.length > 0 && (
          <div
            className={`grid gap-2 ${post.imageUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
          >
            {post.imageUrls.slice(0, 4).map((url: string, index: number) => (
              <div key={index} className="relative">
                <img
                  src={url}
                  alt={`Post image ${index + 1}`}
                  className="w-full h-48 object-cover rounded-lg"
                  loading="lazy"
                />
                {post.imageUrls.length > 4 && index === 3 && (
                  <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                    <span className="text-white font-semibold">
                      +{post.imageUrls.length - 4} more
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Post Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag: string, index: number) => (
              <Badge key={index} variant="outline" className="text-xs">
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Engagement Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10 dark:border-white/10">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className={`flex items-center space-x-2 ${
                isLiked
                  ? "text-red-500 hover:text-red-600"
                  : "text-muted-foreground hover:text-red-500"
              }`}
              disabled={likeMutation.isPending}
            >
              <Heart className={`h-4 w-4 ${isLiked ? "fill-current" : ""}`} />
              <span>{likeCount}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComments(!showComments)}
              className="flex items-center space-x-2 text-muted-foreground hover:text-primary"
            >
              <MessageCircle className="h-4 w-4" />
              <span>{post.commentCount || 0}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="flex items-center space-x-2 text-muted-foreground hover:text-primary"
            >
              <Share2 className="h-4 w-4" />
              <span>Share</span>
            </Button>
          </div>

          {/* Engagement Stats */}
          {(likeCount > 0 || post.commentCount > 0 || post.shareCount > 0) && (
            <div className="text-xs text-muted-foreground">
              {likeCount > 0 && <span>{likeCount} likes</span>}
              {post.commentCount > 0 && (
                <>
                  {likeCount > 0 && <span> • </span>}
                  <span>{post.commentCount} comments</span>
                </>
              )}
              {post.shareCount > 0 && (
                <>
                  {(likeCount > 0 || post.commentCount > 0) && <span> • </span>}
                  <span>{post.shareCount} shares</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="border-t border-white/10 dark:border-white/10 pt-4">
            <CommentsSection postId={post.id} />
          </div>
        )}
      </CardContent>

      {contactOutcome && (
        <ContactOutcomeModal outcome={contactOutcome} onClose={() => setContactOutcome(null)} />
      )}

      {/* Report Modal */}
      <ReportModal
        open={showReportModal}
        onOpenChange={setShowReportModal}
        contentId={post.id}
        contentType="community_post"
      />
    </Card>
  );
}
