import { useLocation } from "wouter";
import { useEffect, useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PostType } from "@/components/community/CommunityComposerInline";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, ThumbsUp, Plus, Users, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CommunityPageShell } from "@/shells/CommunityPageShell";
import { useLocationContext, hasCountyContext } from "@/hooks/useLocationContext";
import { CountyRequiredGate } from "@/components/CountyRequiredGate";
import { CommunityPostCard } from "@/components/community/CommunityPostCard";
import { CommunityComposerInline } from "@/components/community/CommunityComposerInline";
import { CommunityEmptyState } from "@/components/community/CommunityEmptyState";
import { SEOHelmet, createBreadcrumbStructuredData } from "@/components/SEOHelmet";
import { getDeviceType, trackShellEvent } from "@/lib/analytics";

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
    cvsScore?: number | string | null;
    verificationStatus?: string;
    badges?: string[];
  };
  category: string;
  location: string;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  comments: number;
  tags: string[];
  userVote?: "up" | "down" | null;
  pinned: boolean;
  trending: boolean;
  imageUrls?: string[];
  hasWorkRequest?: boolean;
  workRequestId?: string | null;
}

const POST_CATEGORIES = [
  { id: "general", name: "General", icon: MessageSquare },
  { id: "recommendations", name: "Recommendations", icon: ThumbsUp },
  { id: "projects", name: "Projects", icon: Plus },
  { id: "events", name: "Events", icon: Calendar },
  { id: "safety", name: "Safety", icon: Users },
];

export default function Community() {
  const { user, isAuthenticated } = useAuth();
  const location = useLocationContext();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("for-you");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostImages, setNewPostImages] = useState<string[]>([]);
  const [fromScoutDraft, setFromScoutDraft] = useState(false);
  const draftStartedAtRef = useRef<number | null>(null);

  const stateCode = location.stateCode as string | undefined;
  const countyFips = location.countyFips as string | undefined;
  const countyCommitted = hasCountyContext(location);

  // Fetch community posts scoped to the user's local area
  const { data: posts, isLoading: postsLoading } = useQuery<CommunityPost[]>({
    queryKey: ["/api/community/posts", stateCode, countyFips],
    enabled: countyCommitted,
    queryFn: async () => {
      if (!stateCode || !countyFips) return [];
      const params = new URLSearchParams({
        scope: "county",
        stateCode,
        countyFips,
        limit: "20",
        offset: "0",
      });

      const response = await fetch(`/api/community/posts?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch posts");
      return response.json();
    },
  });

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: async (postId: string) => {
      return apiRequest("POST", `/api/community/posts/${postId}/like`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts", stateCode, countyFips] });
    },
  });

  const createPostMutation = useMutation({
    mutationFn: async (postData: { content: string; images?: string[]; category: string }) => {
      return apiRequest("POST", "/api/community/posts", {
        content: postData.content,
        images: postData.images,
        category: postData.category,
      });
    },
    onSuccess: () => {
      const wasFromScout = fromScoutDraft;
      const startedAt = draftStartedAtRef.current;
      draftStartedAtRef.current = null;

      queryClient.invalidateQueries({ queryKey: ["/api/community/posts", stateCode, countyFips] });
      setNewPostContent("");
      setNewPostImages([]);
      setFromScoutDraft(false);
      try {
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.delete("postDraft");
          url.searchParams.delete("content");
          url.searchParams.delete("postType");
          window.history.replaceState({}, "", url.toString());
        }
      } catch {
        // Ignore history manipulation failures.
      }

      if (wasFromScout) {
        try {
          const path = typeof window !== "undefined" ? window.location.pathname : "/community";
          const ts = new Date().toISOString();
          const deviceType = getDeviceType();
          const timeToPublishMs =
            typeof startedAt === "number" ? Date.now() - startedAt : undefined;
          void trackShellEvent({
            type: "scout_draft_published",
            draftKind: "community",
            path,
            ts,
            deviceType,
            timeToPublishMs,
            stateCode,
            countyFips,
          });
        } catch {
          // Ignore analytics failures.
        }
      }
      const createdCategory = lastPostTypeRef.current;
      const isHelpLikeCategory =
        createdCategory === "project" || createdCategory === "recommendation";

      toast({
        title: "Posted!",
        description: isHelpLikeCategory
          ? "Post published. Open Direct Connect for project help."
          : "Post published.",
        action: (
          <button
            type="button"
            className="ml-auto inline-flex h-8 items-center justify-center rounded-md border border-ts-orange/30 px-3 text-xs font-medium text-ts-orange hover:bg-ts-orange/10"
            onClick={() => {
              try {
                if (typeof window !== "undefined") {
                  navigate("/direct-connect");
                }
              } catch {
                // best-effort navigation
              }
            }}
          >
            Open Direct Connect
          </button>
        ),
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : typeof error === "string" ? error : "";
      toast({
        title: "Error",
        description: message || "Failed to create post",
        variant: "destructive",
      });
    },
  });

  // Map composer PostType to API category enum
  const mapPostTypeToCategory = (t: PostType): string => {
    switch (t) {
      case "alert":
        return "announcements";
      case "project":
        return "projects";
      case "recommendation":
        return "recommendations";
      case "admin_notice":
        return "announcements";
      case "discussion":
      default:
        return "general";
    }
  };

  // Capture last selected type from composer at click time
  const lastPostTypeRef = useRef<PostType>("discussion");

  // Initialize from Scout draft parameters if present in URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("postDraft") === "1") {
        const content = params.get("content") ?? "";
        const postTypeParam = params.get("postType") as PostType | null;

        setNewPostContent(content);

        if (
          postTypeParam &&
          ["alert", "project", "recommendation", "admin_notice", "discussion"].includes(
            postTypeParam
          )
        ) {
          lastPostTypeRef.current = postTypeParam;
        }

        setFromScoutDraft(true);

        draftStartedAtRef.current = Date.now();

        try {
          const path = window.location.pathname;
          const ts = new Date().toISOString();
          const deviceType = getDeviceType();
          void trackShellEvent({
            type: "scout_draft_created",
            draftKind: "community",
            path,
            ts,
            deviceType,
            stateCode,
            countyFips,
          });
          void trackShellEvent({
            type: "scout_draft_viewed",
            draftKind: "community",
            path,
            ts,
            deviceType,
            stateCode,
            countyFips,
          });
        } catch {
          // Ignore analytics failures.
        }
      }
    } catch {
      // Ignore URL parsing errors; composer will simply open empty.
    }
  }, []);

  const handleCreatePost = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Sign in to post.",
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

    if (diffInHours < 1) return "Just now";
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

    const normalizeCategory = (category: string | undefined) => (category || "").toLowerCase();

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

    const trending = posts.filter((post) => !post.pinned && post.trending).sort(byNewest);

    const regular = posts.filter((post) => !post.pinned && !post.trending).sort(byNewest);

    return [...pinned, ...trending, ...regular];
  }, [posts, activeTab]);

  const structuredData = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollectionPage",
          name: "TradeScout Community",
          description:
            "Local-area community feed for local posts, recommendations, project updates, and events.",
          url: "https://www.thetradescout.com/community",
        },
        createBreadcrumbStructuredData([
          { name: "TradeScout", url: "/" },
          { name: "Community", url: "/community" },
        ]),
      ],
    }),
    []
  );

  return (
    <CommunityPageShell>
      <SEOHelmet
        title="TradeScout Community | Local Posts, Recommendations, and Local Updates"
        description="Join your local TradeScout community feed to share updates, ask for recommendations, and discover nearby project conversations."
        canonical="https://www.thetradescout.com/community"
        structuredData={structuredData}
      />
      <CountyRequiredGate locationOverride={location} surface="community">
        <div className="pb-16 lg:pb-0">
          {/* Header */}
          <div className="mb-4">
            <h1 className="text-lg font-semibold text-ts-orange mb-1">Community</h1>
            <p className="text-sm text-white/70">Local updates, questions, and projects.</p>
          </div>

          {/* Navigation Tabs */}
          <div className="mb-3">
            <div className="flex gap-1.5 bg-tsCard rounded-xl p-1 border border-white/10 text-[11px] sm:text-xs">
              <button
                onClick={() => setActiveTab("for-you")}
                className={`flex-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === "for-you"
                    ? "bg-ts-orange text-white shadow-sm"
                    : "text-white/70 hover:bg-tsBg hover:text-white"
                }`}
                data-testid="tab-for-you"
              >
                Local
              </button>
              <button
                onClick={() => setActiveTab("projects")}
                className={`flex-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === "projects"
                    ? "bg-ts-orange text-white shadow-sm"
                    : "text-white/70 hover:bg-tsBg hover:text-white"
                }`}
                data-testid="tab-projects"
              >
                Projects
              </button>
              <button
                onClick={() => setActiveTab("questions")}
                className={`flex-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === "questions"
                    ? "bg-ts-orange text-white shadow-sm"
                    : "text-white/70 hover:bg-tsBg hover:text-white"
                }`}
                data-testid="tab-questions"
              >
                Questions
              </button>
              <button
                onClick={() => setActiveTab("pros")}
                className={`flex-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === "pros"
                    ? "bg-ts-orange text-white shadow-sm"
                    : "text-white/70 hover:bg-tsBg hover:text-white"
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
              <Card className="bg-tsCard border border-white/10 hover:border-ts-orange/30 transition-all">
                <CardContent className="p-5">
                  {fromScoutDraft && newPostContent.trim().length > 0 && (
                    <div className="mb-3 rounded-md border border-dashed border-ts-orange/30 bg-tsBg px-3 py-2 text-xs text-white/70 flex gap-2 items-start">
                      <span
                        className="mt-0.5 h-2 w-2 rounded-full bg-ts-orange"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="font-medium text-sm text-white">Draft ready</p>
                        <p className="text-[11px] text-white/70">
                          Review and publish your community post.
                        </p>
                      </div>
                    </div>
                  )}
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
                          description: "Sign in to post.",
                          variant: "destructive",
                        });
                        return;
                      }
                    }}
                    isSubmitting={createPostMutation.isPending}
                  />
                </CardContent>
              </Card>

              {/* Category Filters */}
              <Card className="bg-tsCard border border-white/10">
                <CardContent className="p-4">
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {POST_CATEGORIES.map((category) => {
                      const Icon = category.icon;
                      return (
                        <button
                          key={category.id}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-tsBg border border-white/10 hover:border-ts-orange/30 hover:bg-ts-orange/10 text-[11px] sm:text-xs font-medium text-white/70 hover:text-ts-orange whitespace-nowrap transition-all shadow-sm"
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
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-ts-orange/30 border-r-transparent"></div>
                  <p className="mt-2 text-white/60 dark:text-white/60">Loading posts...</p>
                </div>
              ) : visiblePosts.length === 0 ? (
                <CommunityEmptyState
                  onCreateFirstPost={() => {
                    try {
                      if (typeof window !== "undefined")
                        window.scrollTo({ top: 0, behavior: "smooth" });
                    } catch {
                      // ignore
                    }
                  }}
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
                          cvsScore: post.author?.cvsScore,
                          verificationStatus: post.author?.verificationStatus,
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
                        hasWorkRequest: post.hasWorkRequest,
                        workRequestId: post.workRequestId ?? undefined,
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
      </CountyRequiredGate>
    </CommunityPageShell>
  );
}
