import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import {
  Users,
  MessageSquare,
  Plus,
  Heart,
  MessageCircle,
  Share2,
  ArrowLeft,
  Camera,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link, useParams } from "wouter";

interface GroupPost {
  id: string;
  groupId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  images: string[];
  likes: number;
  comments: number;
  isSticky: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export default function GroupDetail() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const params = useParams();
  const groupId = params?.groupId || "group-1";

  const [newPost, setNewPost] = useState("");
  const [showCreatePost, setShowCreatePost] = useState(false);

  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ["/api/groups", groupId],
    queryFn: () => fetch(`/api/groups/${groupId}`).then((res) => res.json()),
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["/api/groups", groupId, "posts"],
    queryFn: () => fetch(`/api/groups/${groupId}/posts`).then((res) => res.json()),
  });

  const createPostMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch(`/api/groups/${groupId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, images: [], tags: [] }),
      });
      if (!response.ok) throw new Error("Failed to create post");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Post Created",
        description: "Your post has been shared with the group.",
      });
      setNewPost("");
      setShowCreatePost(false);
      queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "posts"] });
    },
    onError: () => {
      toast({
        title: "Post Failed",
        description: "Unable to create post. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreatePost = () => {
    if (newPost.trim()) {
      createPostMutation.mutate(newPost);
    }
  };

  if (groupLoading || postsLoading) {
    return (
      <div className="gradient-bg p-6 py-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ts-orange/30 mx-auto"></div>
            <p className="mt-2 text-white/60">Loading group...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="gradient-bg p-6 py-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Group Not Found</h1>
          <Link href="/groups">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Groups
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="gradient-bg p-6 py-8" data-testid="group-detail-page">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/groups">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Groups
            </Button>
          </Link>
          <Button variant="outline" size="sm">
            <Share2 className="w-4 h-4 mr-2" />
            Share Group
          </Button>
        </div>

        {/* Group Info */}
        <Card className="border-white/10" style={{ backgroundColor: "var(--surface-card)" }}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <CardTitle className="text-white text-2xl">{group.name}</CardTitle>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                    {group.type.replace("_", " ")}
                  </Badge>
                  <span className="text-white/60 flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {group.memberCount} members
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-white/70 mb-4">{group.description}</p>
            {group.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {group.tags.map((tag: string, index: number) => (
                  <Badge key={index} variant="outline" className="border-white/15 text-white/60">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Post */}
        <Card className="border-white/10" style={{ backgroundColor: "var(--surface-card)" }}>
          <CardContent className="p-4">
            {!showCreatePost ? (
              <Button
                onClick={() => setShowCreatePost(true)}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600"
                data-testid="create-post-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Share with the community
              </Button>
            ) : (
              <div className="space-y-4">
                <Textarea
                  placeholder="What's on your mind? Share your project updates, ask questions, or offer advice..."
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  className="bg-white/10 border-white/15 text-white min-h-24"
                  data-testid="post-content-input"
                />
                <div className="flex justify-between items-center">
                  <Button variant="outline" size="sm">
                    <Camera className="w-4 h-4 mr-2" />
                    Add Photos
                  </Button>
                  <div className="space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCreatePost(false);
                        setNewPost("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreatePost}
                      disabled={createPostMutation.isPending || !newPost.trim()}
                      className="bg-gradient-to-r from-blue-500 to-purple-600"
                      data-testid="submit-post-button"
                    >
                      {createPostMutation.isPending ? "Posting..." : "Post"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Posts Feed */}
        <div className="space-y-6">
          {posts.length === 0 ? (
            <Card className="border-white/10" style={{ backgroundColor: "var(--surface-card)" }}>
              <CardContent className="p-12 text-center">
                <MessageSquare className="w-16 h-16 text-white/60 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No posts yet</h3>
                <p className="text-white/60 mb-6">
                  Be the first to share something with the group!
                </p>
                <Button
                  onClick={() => setShowCreatePost(true)}
                  className="bg-gradient-to-r from-blue-500 to-purple-600"
                >
                  Create First Post
                </Button>
              </CardContent>
            </Card>
          ) : (
            posts.map((post: GroupPost) => (
              <Card
                key={post.id}
                className="border-white/10"
                style={{ backgroundColor: "var(--surface-card)" }}
                data-testid={`post-${post.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                          {post.authorName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                      </div>
                      <div>
                        <div className="font-semibold text-white">{post.authorName}</div>
                        <div className="text-sm text-white/60">
                          {post.authorRole} • {new Date(post.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    {post.isSticky && (
                      <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">
                        Pinned
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-white/70 leading-relaxed">{post.content}</p>

                  {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {post.tags.map((tag: string, index: number) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="text-xs border-white/15 text-white/60"
                        >
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <div className="flex items-center space-x-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-white/60 hover:text-pink-400"
                      >
                        <Heart className="w-4 h-4 mr-1" />
                        {post.likes}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-white/60 hover:text-blue-400"
                      >
                        <MessageCircle className="w-4 h-4 mr-1" />
                        {post.comments}
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white/60 hover:text-green-400"
                    >
                      <Share2 className="w-4 h-4 mr-1" />
                      Share
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
