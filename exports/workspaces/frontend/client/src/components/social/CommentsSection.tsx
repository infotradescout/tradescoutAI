import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { useToast } from "@/hooks/use-toast";
import {
  ContactOutcomeModal,
  type ContactOutcome,
} from "@/components/community/ContactOutcomeModal";
import {
  Heart,
  Reply,
  MoreHorizontal,
  Flag,
  MessageCircle,
  Send,
  Loader2,
  UserRound,
  Briefcase,
  UserPlus,
} from "lucide-react";

const commentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(500, "Comment must be less than 500 characters"),
});

type CommentFormData = z.infer<typeof commentSchema>;

interface CommentsSectionProps {
  postId: string;
}

interface CommentProps {
  comment: any;
  postId: string;
  level?: number;
}

function Comment({ comment, postId, level = 0 }: CommentProps) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(level === 0);
  const [contactOutcome, setContactOutcome] = useState<ContactOutcome | null>(null);
  const [isLiked, setIsLiked] = useState(Boolean(comment.userReaction || comment.isLiked));
  const [likeCount, setLikeCount] = useState(
    (comment._count && typeof comment._count.reactions === "number"
      ? comment._count.reactions
      : comment.reactionCount) ||
      comment.likeCount ||
      0
  );

  const replyForm = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: "" },
  });

  // Like comment mutation (uses reactions endpoint with "like" reactionType)
  const likeMutation = useMutation({
    mutationFn: () => {
      if (isLiked) {
        return apiRequest("DELETE", `/api/social/comments/${comment.id}/reactions`);
      }
      return apiRequest("POST", `/api/social/comments/${comment.id}/reactions`, {
        reactionType: "like",
      });
    },
    onSuccess: () => {
      setIsLiked(!isLiked);
      setLikeCount((prev: number) => (isLiked ? prev - 1 : prev + 1));
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: formatUserFacingErrorMessage(error, "Failed to update like"),
        variant: "destructive",
      });
    },
  });

  // Reply to comment mutation
  const replyMutation = useMutation({
    mutationFn: (data: CommentFormData) =>
      apiRequest("POST", `/api/social/posts/${postId}/comments`, {
        ...data,
        parentCommentId: comment.id,
      }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Reply posted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/social/comments", postId] });
      replyForm.reset();
      setShowReplyForm(false);
      setShowReplies(true);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: formatUserFacingErrorMessage(error, "Failed to post reply"),
        variant: "destructive",
      });
    },
  });

  const handleLike = () => {
    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please login to like comments",
        variant: "destructive",
      });
      return;
    }
    likeMutation.mutate();
  };

  const handleReply = (data: CommentFormData) => {
    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please login to reply to comments",
        variant: "destructive",
      });
      return;
    }
    replyMutation.mutate(data);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const maxNestingLevel = 3;
  const shouldIndent = level < maxNestingLevel;

  const targetUserId = String(comment?.author?.id || comment?.authorId || "").trim();
  const targetUserName = [comment?.author?.firstName, comment?.author?.lastName]
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
      source: "social_comment",
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
      targetRole: String(comment?.author?.role || "Member"),
      suggestedIntent: "collaborate",
      reasonForContact: "I saw your comment in Community and want to connect.",
      riskFlags: [],
      decisionScope: `social_comment:${comment.id}`,
      decisionTitle: "Community connection request",
    });
  };

  return (
    <div className={`space-y-3 ${shouldIndent ? "ml-4 pl-4 border-l-2 border-white/10" : ""}`}>
      {/* Comment */}
      <div className="flex items-start space-x-3">
        <button
          type="button"
          onClick={handleOpenProfile}
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ts-orange/70"
          title="View public profile"
          aria-label={`View ${targetUserName || "member"} profile`}
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={comment.author.profileImageUrl} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {comment.author.firstName?.[0]}
              {comment.author.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
        </button>

        <div className="flex-1 space-y-2">
          {/* Author & Content */}
          <div className="bg-tsCard rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleOpenProfile}
                  className="font-medium text-sm hover:text-ts-orange text-left"
                  title="View public profile"
                >
                  {comment.author.firstName} {comment.author.lastName}
                </button>
                <Badge
                  variant="secondary"
                  className={`text-xs px-1.5 py-0.5 ${
                    comment.author.isVerified ? "text-green-300" : "text-white/70"
                  }`}
                  title={
                    comment.author.isVerified
                      ? "Verified profile"
                      : "Unverified profile. Verified members are more likely to be accepted."
                  }
                >
                  {comment.author.isVerified ? "Verified" : "Unverified"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDate(comment.createdAt)}
                </span>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {targetUserId && (
                    <DropdownMenuItem onClick={handleOpenProfile}>
                      <UserRound className="h-3 w-3 mr-2" />
                      View public profile
                    </DropdownMenuItem>
                  )}
                  {targetUserId && (
                    <DropdownMenuItem onClick={handleOpenDirectConnect}>
                      <Briefcase className="h-3 w-3 mr-2" />
                      Start Direct Connect request
                    </DropdownMenuItem>
                  )}
                  {targetUserId && (
                    <DropdownMenuItem onClick={handleConnectionRequest}>
                      <UserPlus className="h-3 w-3 mr-2" />
                      Send connection request
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem>
                    <Flag className="h-3 w-3 mr-2" />
                    Report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
          </div>

          {/* Comment Actions */}
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className={`flex items-center space-x-1 h-7 px-2 ${
                isLiked ? "text-red-500" : "text-muted-foreground"
              }`}
              disabled={likeMutation.isPending}
            >
              <Heart className={`h-3 w-3 ${isLiked ? "fill-current" : ""}`} />
              {likeCount > 0 && <span className="text-xs">{likeCount}</span>}
            </Button>

            {level < maxNestingLevel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="flex items-center space-x-1 h-7 px-2 text-muted-foreground"
              >
                <Reply className="h-3 w-3" />
                <span className="text-xs">Reply</span>
              </Button>
            )}

            {comment.replies && comment.replies.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReplies(!showReplies)}
                className="flex items-center space-x-1 h-7 px-2 text-muted-foreground"
              >
                <MessageCircle className="h-3 w-3" />
                <span className="text-xs">
                  {showReplies ? "Hide" : "Show"} {comment.replies.length} replies
                </span>
              </Button>
            )}
          </div>

          {/* Reply Form */}
          {showReplyForm && (
            <Form {...replyForm}>
              <form onSubmit={replyForm.handleSubmit(handleReply)} className="space-y-2">
                <FormField
                  control={replyForm.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="flex items-start space-x-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={user?.profileImageUrl} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {user?.firstName?.[0]}
                              {user?.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <Textarea placeholder="Write a reply..." rows={2} {...field} />
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2 ml-8">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowReplyForm(false);
                      replyForm.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={replyMutation.isPending}>
                    {replyMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Send className="h-3 w-3 mr-1" />
                    )}
                    Reply
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      </div>

      {/* Nested Replies */}
      {showReplies && comment.replies && comment.replies.length > 0 && (
        <div className="space-y-3">
          {Array.isArray(comment.replies)
            ? comment.replies.map((reply: any) => (
                <Comment key={reply.id} comment={reply} postId={postId} level={level + 1} />
              ))
            : null}
        </div>
      )}
      {contactOutcome && (
        <ContactOutcomeModal outcome={contactOutcome} onClose={() => setContactOutcome(null)} />
      )}
    </div>
  );
}

export function CommentsSection({ postId }: CommentsSectionProps) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: "" },
  });

  // Fetch comments
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["/api/social/comments", postId],
    queryFn: () => apiRequest("GET", `/api/social/posts/${postId}/comments`),
  });

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: (data: CommentFormData) =>
      apiRequest("POST", `/api/social/posts/${postId}/comments`, data),
    onSuccess: (data: any) => {
      if (data?.pending) {
        toast({
          title: "Contact request sent",
          description: "Your comment will post after the author accepts.",
        });
        form.reset();
        return;
      }
      toast({
        title: "Success",
        description: "Comment posted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/social/comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["/api/social/feed"] });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: formatUserFacingErrorMessage(error, "Failed to post comment"),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CommentFormData) => {
    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please login to post comments",
        variant: "destructive",
      });
      return;
    }
    createCommentMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start space-x-3 animate-pulse">
            <div className="w-8 h-8 bg-secondary rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-secondary rounded w-1/4"></div>
              <div className="h-12 bg-secondary rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Comment Form */}
      {isAuthenticated && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex items-start space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user?.profileImageUrl} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {user?.firstName?.[0]}
                          {user?.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <Textarea placeholder="Write a comment..." rows={3} {...field} />
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end ml-11">
              <Button type="submit" size="sm" disabled={createCommentMutation.isPending}>
                {createCommentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Comment
              </Button>
            </div>
          </form>
        </Form>
      )}

      {/* Comments List */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No comments yet. Be the first to comment!</p>
          </div>
        ) : (
          <>
            <div className="text-sm font-medium text-muted-foreground">
              {comments.length} comment{comments.length !== 1 ? "s" : ""}
            </div>
            {Array.isArray(comments)
              ? comments.map((comment: any) => (
                  <Comment key={comment.id} comment={comment} postId={postId} level={0} />
                ))
              : null}
          </>
        )}
      </div>
    </div>
  );
}
