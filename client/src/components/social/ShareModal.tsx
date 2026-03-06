import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { useToast } from "@/hooks/use-toast";
import { share, shareToPlatform } from "@/utils/share";
import {
  Copy,
  Facebook,
  Twitter,
  Mail,
  MessageSquare,
  Share,
  ExternalLink,
  Check,
} from "lucide-react";

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: any;
}

export function ShareModal({ open, onOpenChange, post }: ShareModalProps) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [shareMessage, setShareMessage] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  // Generate share URL
  const postUrl = `${window.location.origin}/community/post/${post.id}`;

  // Share mutation
  const shareMutation = useMutation({
    mutationFn: (data: { message?: string; shareType: string }) =>
      apiRequest("POST", `/api/social/posts/${post.id}/share`, data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Post shared successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/social/feed"] });
      onOpenChange(false);
      setShareMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: formatUserFacingErrorMessage(error, "Failed to share post"),
        variant: "destructive",
      });
    },
  });

  const handleCopyLink = async () => {
    await share({
      url: postUrl,
      title: post.title || "TradeScout community post",
      text: shareMessage || post.content.substring(0, 100),
      contextLabel: "Post link",
    });
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    // Track share
    shareMutation.mutate({ shareType: "copy_link" });
  };

  const handleSocialShare = (platform: string) => {
    const text = post.title
      ? `${post.title} - ${post.content.substring(0, 100)}...`
      : post.content.substring(0, 100);
    shareToPlatform({
      platform: platform as "facebook" | "twitter" | "email",
      url: postUrl,
      title: post.title || "Check out this post",
      text,
    });
    // Track share
    shareMutation.mutate({ shareType: platform });
  };

  const handleInternalShare = () => {
    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please login to share posts",
        variant: "destructive",
      });
      return;
    }
    shareMutation.mutate({
      message: shareMessage,
      shareType: "internal",
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share Post</DialogTitle>
          <DialogDescription>Share this post with your network or copy the link</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Post Preview */}
          <Card className="border-dashed">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={post.author.profileImageUrl} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {post.author.firstName?.[0]}
                    {post.author.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {post.author.firstName} {post.author.lastName}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {post.postType.replace("_", " ")}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(post.createdAt)}
                    </span>
                  </div>
                  {post.title && <h4 className="font-semibold text-sm">{post.title}</h4>}
                  <p className="text-sm text-muted-foreground line-clamp-3">{post.content}</p>
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {post.tags.slice(0, 3).map((tag: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          #{tag}
                        </Badge>
                      ))}
                      {post.tags.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{post.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Copy Link */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Share Link</label>
            <div className="flex space-x-2">
              <Input value={postUrl} readOnly className="flex-1" />
              <Button
                onClick={handleCopyLink}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2"
              >
                {isCopied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span>{isCopied ? "Copied" : "Copy"}</span>
              </Button>
            </div>
          </div>

          {/* Social Sharing */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Share on Social Media</label>
            <div className="flex space-x-3">
              <Button
                onClick={() => handleSocialShare("facebook")}
                variant="outline"
                size="sm"
                className="flex-1 flex items-center space-x-2"
              >
                <Facebook className="h-4 w-4 text-blue-600" />
                <span>Facebook</span>
              </Button>
              <Button
                onClick={() => handleSocialShare("twitter")}
                variant="outline"
                size="sm"
                className="flex-1 flex items-center space-x-2"
              >
                <Twitter className="h-4 w-4 text-blue-400" />
                <span>Twitter</span>
              </Button>
              <Button
                onClick={() => handleSocialShare("email")}
                variant="outline"
                size="sm"
                className="flex-1 flex items-center space-x-2"
              >
                <Mail className="h-4 w-4 text-white/60" />
                <span>Email</span>
              </Button>
            </div>
          </div>

          {/* Internal Share */}
          {isAuthenticated && (
            <div className="space-y-3">
              <label className="text-sm font-medium">Share to Your Feed</label>
              <div className="space-y-3">
                <Textarea
                  placeholder="Add a comment about this post (optional)..."
                  value={shareMessage}
                  onChange={(e) => setShareMessage(e.target.value)}
                  rows={3}
                />
                <Button
                  onClick={handleInternalShare}
                  disabled={shareMutation.isPending}
                  className="w-full flex items-center space-x-2"
                >
                  <Share className="h-4 w-4" />
                  <span>{shareMutation.isPending ? "Sharing..." : "Share to Your Feed"}</span>
                </Button>
              </div>
            </div>
          )}

          {/* Share Stats */}
          {post.shareCount > 0 && (
            <div className="text-xs text-muted-foreground text-center">
              This post has been shared {post.shareCount} time{post.shareCount !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
