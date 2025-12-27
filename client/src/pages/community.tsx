import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PostType } from "@/components/community/CommunityComposerInline";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNotifications } from "@/hooks/useNotifications";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { 
  Search, 
  MapPin, 
  MessageSquare, 
  ThumbsUp, 
  Plus,
  Users,
  Calendar,
  Image as ImageIcon,
  Video,
  Smile,
  Heart
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CommunityShell } from "@/components/layout/CommunityShell";
import { useLocationContext, hasCountyContext } from "@/hooks/useLocationContext";
import { CommunityPostCard } from "@/components/community/CommunityPostCard";
import { CommunityComposerInline } from "@/components/community/CommunityComposerInline";
import { CommunityEmptyState } from "@/components/community/CommunityEmptyState";

interface CommunityPost {
  id: string;
  title: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
    role: string;
    verified: boolean;
    badges?: string[];
  };
  category: string;
  location: string;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  comments: number;
  tags: string[];
  userVote?: 'up' | 'down' | null;
  pinned: boolean;
  trending: boolean;
  imageUrls?: string[];
}

const POST_CATEGORIES = [
  { id: 'general', name: 'General', icon: MessageSquare },
  { id: 'recommendations', name: 'Recommendations', icon: ThumbsUp },
  { id: 'projects', name: 'Projects', icon: Plus },
  { id: 'events', name: 'Events', icon: Calendar },
  { id: 'safety', name: 'Safety', icon: Users },
];

export default function Community() {
  const { user, isAuthenticated } = useAuth();
  const location = useLocationContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("for-you");
  const [searchQuery, setSearchQuery] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [showPostComposer, setShowPostComposer] = useState(false);
  const [newPostImages, setNewPostImages] = useState<string[]>([]);
  const { unreadCount } = useNotifications();

  const stateCode = location.stateCode as string | undefined;
  const countyFips = location.countyFips as string | undefined;
  const countyCommitted = hasCountyContext(location);

  // Fetch community posts scoped to the user's county
  const { data: posts, isLoading: postsLoading } = useQuery<CommunityPost[]>({
    queryKey: ['/api/community/posts', stateCode, countyFips],
    enabled: countyCommitted,
    queryFn: async () => {
      const params = new URLSearchParams({
        scope: 'county',
        stateCode: stateCode!,
        countyFips: countyFips!,
        limit: '20',
        offset: '0',
      });

      const response = await fetch(`/api/community/posts?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch posts');
      return response.json();
    },
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async (payload: { content: string; images?: string[]; category: string }) => {
      return apiRequest('POST', '/api/community/posts', {
        content: payload.content,
        category: payload.category,
        images: payload.images,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/posts'] });
      setNewPostContent('');
       setNewPostImages([]);
      setShowPostComposer(false);
      toast({
        title: "Posted!",
        description: "Your post is now live in the community.",
      });
    },
  });

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: async (postId: string) => {
      return apiRequest('POST', `/api/community/posts/${postId}/like`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/posts', stateCode, countyFips] });
    },
  });

  // Map composer PostType to API category enum
  const mapPostTypeToCategory = (t: PostType): string => {
    switch (t) {
      case 'alert':
        return 'announcements';
      case 'project':
        return 'projects';
      case 'recommendation':
        return 'recommendations';
      case 'admin_notice':
        return 'announcements';
      case 'discussion':
      default:
        return 'general';
    }
  };

  // Capture last selected type from composer at click time
  const lastPostTypeRef = useRef<PostType>('discussion');

  const handleCreatePost = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "You can browse the community without an account. Sign in to post.",
        variant: "destructive",
      });
      return;
    }
    if (!newPostContent.trim()) return;
    const category = mapPostTypeToCategory(lastPostTypeRef.current);
    createPostMutation.mutate({
      content: newPostContent,
      images: newPostImages.length ? newPostImages : undefined,
      category,
    });
  };

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

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  const visiblePosts = useMemo(() => {
    if (!posts) return [] as CommunityPost[];

    const byNewest = (a: CommunityPost, b: CommunityPost) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    };

    const normalizeCategory = (category: string | undefined) =>
      (category || "").toLowerCase();

    if (activeTab === "projects") {
      return [...posts]
        .filter((post) => {
          const c = normalizeCategory(post.category);
          return c === "projects" || c === "project";
        })
        .sort(byNewest);
    }

    if (activeTab === "questions") {
      return [...posts]
        .filter((post) => {
          const c = normalizeCategory(post.category);
          return c === "question" || c === "questions";
        })
        .sort(byNewest);
    }

    if (activeTab === "pros") {
      return [...posts]
        .filter((post) => {
          const role = (post.author?.role || "").toLowerCase();
          const isContractor = role === "contractor";
          const isVerified = Boolean(post.author?.verified);
          return isContractor || isVerified;
        })
        .sort(byNewest);
    }

    // For You: pinned first, then trending, then newest
    const pinned = posts
      .filter((post) => post.pinned)
      .sort(byNewest)
      .slice(0, 2);

    const trending = posts
      .filter((post) => !post.pinned && post.trending)
      .sort(byNewest);

    const regular = posts
      .filter((post) => !post.pinned && !post.trending)
      .sort(byNewest);

    return [...pinned, ...trending, ...regular];
  }, [posts, activeTab]);

  if (!countyCommitted) {
    const areaLabel = location.label || "your area";

    return (
      <CommunityShell sectionLabel="Community" notificationsCount={unreadCount}>
        <div className="max-w-2xl mx-auto py-12">
          <Card className="bg-slate-950/70 border-slate-800">
            <CardContent className="p-6 space-y-4">
              <div>
                <h1 className="text-xl font-semibold text-white mb-2">Choose your county to see whats happening nearby</h1>
                <p className="text-sm text-slate-300">
                  Community only shows posts from your local area. Set your county so we can load a real feed for you instead of a global default.
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-400">
                  Current location context: <span className="font-medium text-slate-100">{areaLabel}</span>
                </p>
                <Button
                  type="button"
                  className="bg-orange-500 hover:bg-orange-600 text-black text-xs font-semibold px-3 py-2 rounded-md"
                  asChild
                >
                  <a href="/settings">Open location settings</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </CommunityShell>
    );
  }

  return (
    <CommunityShell sectionLabel="Community" notificationsCount={0}>
      <div className="pb-16 lg:pb-0">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-orange-500 mb-1">Community</h1>
          <p className="text-sm text-slate-300">Connect with neighbors and local contractors</p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-4">
          <div className="flex gap-1.5 bg-tsCard rounded-xl p-1 shadow-sm border border-tsBorder text-[11px] sm:text-xs">
            <button
              onClick={() => setActiveTab("for-you")}
              className={`flex-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === "for-you"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-300 hover:bg-tsBg hover:text-white"
              }`}
              data-testid="tab-for-you"
            >
              For You
            </button>
            <button
              onClick={() => setActiveTab("projects")}
              className={`flex-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === "projects"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-300 hover:bg-tsBg hover:text-white"
              }`}
              data-testid="tab-projects"
            >
              Projects
            </button>
            <button
              onClick={() => setActiveTab("questions")}
              className={`flex-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === "questions"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-300 hover:bg-tsBg hover:text-white"
              }`}
              data-testid="tab-questions"
            >
              Questions
            </button>
            <button
              onClick={() => setActiveTab("pros")}
              className={`flex-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === "pros"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-300 hover:bg-tsBg hover:text-white"
              }`}
              data-testid="tab-pros"
            >
              Pros
            </button>
          </div>
        </div>

        {/* Feed Tab (all intent-based filters share this surface) */}
        <div className="space-y-4">
          <div className="space-y-4">

            {/* Post Composer */}
            <Card className="bg-tsCard shadow-xl border-2 border-tsBorder hover:border-orange-500/30 transition-all">
              <CardContent className="p-5">
                <CommunityComposerInline
                  isAuthenticated={isAuthenticated}
                  userInitial={user?.firstName?.[0] || user?.email?.[0]}
                  userAvatarUrl={user?.profileImageUrl}
                  value={newPostContent}
                  onChange={setNewPostContent}
                  onSubmit={handleCreatePost}
                  onSubmitWithMeta={({ postType }) => {
                    lastPostTypeRef.current = postType;
                  }}
                  images={newPostImages}
                  onImagesChange={setNewPostImages}
                  maxImages={8}
                  onOpenRequest={() => {
                    if (!isAuthenticated) {
                      toast({
                        title: "Sign in required",
                        description: "You can browse the community without an account. Sign in to post.",
                        variant: "destructive",
                      });
                      return;
                    }
                    setShowPostComposer(true);
                  }}
                  isSubmitting={createPostMutation.isPending}
                />
              </CardContent>
            </Card>

            {/* Category Filters */}
            <Card className="bg-tsCard shadow-lg border-2 border-tsBorder">
              <CardContent className="p-4">
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {POST_CATEGORIES.map((category) => {
                    const Icon = category.icon;
                    return (
                        <button
                        key={category.id}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-tsBg border border-tsBorder hover:border-orange-500 hover:bg-orange-500/10 text-[11px] sm:text-xs font-medium text-slate-200 hover:text-orange-400 whitespace-nowrap transition-all shadow-sm"
                        data-testid={`filter-${category.id}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {category.name}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Posts Feed */}
            {postsLoading ? (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent"></div>
                <p className="mt-2 text-slate-600 dark:text-slate-400">Loading posts...</p>
              </div>
            ) : visiblePosts.length === 0 ? (
              <CommunityEmptyState
                onCreateFirstPost={() => setShowPostComposer(true)}
              />
            ) : (
              <div className="space-y-5">
                {visiblePosts.map((post) => (
                  <CommunityPostCard
                    key={post.id}
                    post={{
                      id: post.id,
                      title: post.title,
                      content: post.content,
                      author: {
                        id: post.author?.id,
                        name: post.author?.name,
                        avatar: post.author?.avatar,
                        role: post.author?.role,
                        verified: post.author?.verified,
                        badges: post.author?.badges,
                      },
                      category: post.category,
                      pinned: post.pinned,
                      trending: post.trending,
                      location: post.location,
                      createdAt: post.createdAt,
                      upvotes: post.upvotes,
                      comments: post.comments,
                      tags: post.tags,
                      imageUrls: post.imageUrls,
                    }}
                    onLike={handleLike}
                    formatTimeAgo={formatTimeAgo}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </CommunityShell>
  );
}
