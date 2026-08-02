import { useMemo } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CommunityPostCard } from "@/components/community/CommunityPostCard";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Page } from "@/components/layout/PagePrimitives";
import TradeScoutProfileHandoff from "@/pages/profile-sites/TradeScoutProfileHandoff";

interface CommunityPostAuthor {
  id: string;
  name: string;
  avatar?: string;
  role?: string | null;
  verified?: boolean;
}

interface CommunityPost {
  id: string;
  title?: string;
  content: string;
  author?: CommunityPostAuthor;
  category?: string;
  location?: string;
  createdAt: string;
  upvotes?: number;
  comments?: number;
  tags?: string[];
  pinned: boolean;
  trending: boolean;
}

interface PublicProfileLinkPayload {
  canonicalProfileUrl?: string | null;
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

  if (diffInHours < 1) return "Just now";
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  return date.toLocaleDateString();
}

export default function CommunityProfile() {
  const [, params] = useRoute("/community/u/:userId");
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const userId = params?.userId || "";

  const { data: posts, isLoading } = useQuery<CommunityPost[]>({
    queryKey: ["/api/community/posts", "author", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const search = new URLSearchParams({
        authorId: userId,
        limit: "50",
        offset: "0",
      });
      const res = await fetch(`/api/community/posts?${search.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch community posts");
      return res.json();
    },
  });

  const { data: publicProfileLink } = useQuery<PublicProfileLinkPayload | null>({
    queryKey: ["/api/users/public-link", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}/public`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (postId: string) => {
      return apiRequest("POST", `/api/community/posts/${postId}/like`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts", "author", userId] });
    },
  });

  const handleLike = (postId: string) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to like posts.",
        variant: "destructive",
      });
      return;
    }
    likeMutation.mutate(postId);
  };

  const author = useMemo<CommunityPostAuthor | null>(() => {
    if (!posts || posts.length === 0) return null;
    return posts[0].author || null;
  }, [posts]);

  const wallPosts = useMemo(() => {
    if (!posts) return [] as CommunityPost[];
    return [...posts].sort((a, b) => {
      const at = new Date(a.createdAt).getTime();
      const bt = new Date(b.createdAt).getTime();
      return bt - at;
    });
  }, [posts]);

  const publicProfileHref =
    typeof publicProfileLink?.canonicalProfileUrl === "string" &&
    publicProfileLink.canonicalProfileUrl.trim().length > 0
      ? publicProfileLink.canonicalProfileUrl.trim()
      : `/profile/${encodeURIComponent(userId)}`;

  return (
    <Page className="max-w-4xl">
      {/* Header */}
      <Card
        className="border"
        style={{
          backgroundColor: "var(--surface-card)",
          borderColor: "var(--surface-frame-border)",
        }}
      >
        <CardHeader className="flex flex-row items-start gap-4">
          <Avatar className="h-14 w-14 ring-2 ring-ts-orange/70">
            <AvatarImage src={author?.avatar || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold">
              {author?.name?.[0] || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1">
            <CardTitle className="text-xl text-white">
              {author?.name || "TradeScout community member"}
            </CardTitle>
            {author?.role && (
              <p className="text-xs uppercase tracking-[0.16em] text-white/60">{author.role}</p>
            )}
            <p className="text-sm text-white/70">
              Local activity, questions, and recommendations shared in the community feed.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              asChild
              variant="outline"
              className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange/10"
            >
              <Link href={publicProfileHref}>View public profile</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex justify-between text-xs text-white/60">
          <span>
            {wallPosts.length > 0
              ? `${wallPosts.length} community post${wallPosts.length === 1 ? "" : "s"}`
              : "No posts yet"}
          </span>
          {user && user.id === userId && (
            <span className="text-white/60">
              This is your community-facing profile. Your professional site lives on your public
              profile.
            </span>
          )}
        </CardContent>
      </Card>

      {/* Wall of posts */}
      <Card
        className="border"
        style={{
          backgroundColor: "var(--surface-card)",
          borderColor: "var(--surface-frame-border)",
        }}
      >
        <CardHeader>
          <CardTitle className="text-base text-white">Community wall</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-white/60">Loading posts…</div>
          ) : wallPosts.length === 0 ? (
            <div className="py-10 text-center text-white/60">No posts from this member yet.</div>
          ) : (
            <div className="space-y-4">
              {wallPosts.map((post) => (
                <CommunityPostCard
                  key={post.id}
                  post={{
                    id: post.id,
                    title: post.title,
                    content: post.content,
                    author: post.author
                      ? {
                          id: post.author.id,
                          name: post.author.name,
                          avatar: post.author.avatar,
                          role: post.author.role || undefined,
                          verified: post.author.verified,
                          badges: (post.author as any).badges,
                        }
                      : undefined,
                    category: post.category,
                    pinned: post.pinned,
                    trending: post.trending,
                    location: post.location,
                    createdAt: post.createdAt,
                    upvotes: post.upvotes,
                    comments: post.comments,
                    tags: post.tags,
                  }}
                  onLike={handleLike}
                  formatTimeAgo={formatTimeAgo}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <TradeScoutProfileHandoff
        profileSlug={userId}
        profileName={author?.name || "TradeScout community member"}
      />
    </Page>
  );
}
