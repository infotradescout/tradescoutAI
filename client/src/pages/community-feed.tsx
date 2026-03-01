import { memo, useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Zap,
  TrendingUp,
  MoreHorizontal,
  Image,
  Video,
  Calendar,
  Compass,
  Crown,
  Award,
  Flag,
  Plus,
  SlidersHorizontal,
  Trophy,
  BarChart3,
  Share,
  Heart,
  Bookmark,
  Send,
  Tag,
  MapPin,
  HelpCircle,
  Wrench,
  Lightbulb,
  AlertTriangle,
  DollarSign,
  Globe,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/hooks/use-toast";
import { share } from "@/utils/share";
import { apiRequest } from "@/lib/queryClient";
import { uploadObject } from "@/lib/objectUpload";
import { recordActivity } from "@/agent/activity";
import { TradeScoutIcon } from "@/components/TradeScoutIcons";
import { useLocationContext, hasCountyContext } from "@/hooks/useLocationContext";
import { CountyRequiredGate } from "@/components/CountyRequiredGate";
import { useLocation } from "wouter";
import { OutcomeConfirmationCard } from "@/components/OutcomeConfirmationCard";
import { CommunityTopNav } from "@/components/community/CommunityTopNav";
import { CommunitySnapshotRail } from "@/components/community/CommunitySnapshotRail";
import { ScoutContinueBanner } from "@/components/scout/ScoutContinueBanner";

interface Post {
  id: string;
  title?: string;
  content: string;
  author: {
    id: string;
    name: string;
    username?: string | null;
    avatar?: string | null;
    profileImageUrl?: string | null;
    email?: string | null;
    role?: string | null;
    verified: boolean;
  };
  category: string;
  location: string;
  createdAt: string;
  tags: string[];
  upvotes: number;
  downvotes: number;
  comments: number;
  pinned: boolean;
  trending: boolean;
  liked?: boolean;
  saved?: boolean;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  imageUrls?: string[];
}

interface DailyDealSnapshot {
  id: string;
  title: string;
  description: string;
  dealType?: string;
  countyFips?: string;
  discountPrice?: string;
  discountPercentage?: number;
  tags?: string[];
  providerId?: string;
  providerType?: string;
}

interface CommunityComment {
  id: string;
  content: string;
  author?: {
    id: string;
    name?: string | null;
    avatar?: string | null;
    verified?: boolean;
  };
  createdAt: string;
}

function CommunityComments({ postId, readOnly }: { postId: string; readOnly?: boolean }) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");

  const { data: comments = [], isLoading } = useQuery<CommunityComment[]>({
    queryKey: ["/api/community/posts", postId, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/community/posts/${postId}/comments`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Failed to load comments (${res.status})`);
      }
      return (await res.json()) as CommunityComment[];
    },
  });

  const createComment = useMutation({
    mutationFn: async () => {
      const trimmed = content.trim();
      if (!trimmed) {
        throw new Error("Comment cannot be empty.");
      }
      const res = await fetch(`/api/community/posts/${postId}/comments`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ content: trimmed }),
      });
      if (res.status === 202) {
        return res.json();
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to post comment (${res.status})`);
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      setContent("");
      if (data?.pending) {
        toast({
          title: "Contact request sent",
          description: "Your comment will post after the author accepts.",
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts", postId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not post comment",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) {
      toast({
        title: "Read-only view",
        description: "Switch back to Local to comment on posts.",
        variant: "destructive",
      });
      return;
    }
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to comment on community posts.",
        variant: "destructive",
      });
      return;
    }
    createComment.mutate();
  };

  return (
    <div className="mt-3 space-y-3">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex items-start gap-2">
          <Avatar className="w-8 h-8">
            <AvatarImage src={user?.avatar as string | undefined} />
            <AvatarFallback>
              {(user?.username || user?.email || "U").substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 flex flex-col gap-2">
            <Textarea
              placeholder="Add a comment to this post..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={2}
              className="text-xs md:text-sm"
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                className="h-7 px-3 text-xs"
                disabled={createComment.isPending}
              >
                {createComment.isPending ? (
                  <>
                    <Send className="h-3 w-3 mr-1 animate-pulse" />
                    Posting
                  </>
                ) : (
                  <>
                    <Send className="h-3 w-3 mr-1" />
                    Post Comment
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </form>

      <div className="space-y-2">
        {isLoading ? (
          <p className="text-[11px] text-white/60">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-[11px] text-white/60">No comments yet. Be the first to reply.</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-2 text-xs md:text-sm">
              <Avatar className="w-7 h-7">
                <AvatarImage src={comment.author?.avatar || undefined} />
                <AvatarFallback>
                  {(comment.author?.name || "U").substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-3 py-2">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-white mb-0.5 text-[11px] md:text-xs">
                    {comment.author?.name || "Neighbor"}
                  </p>
                  {comment.author?.verified !== undefined && (
                    <Badge
                      variant="secondary"
                      className={`text-[10px] px-1.5 py-0.5 ${
                        comment.author?.verified ? "text-green-300" : "text-white/70"
                      }`}
                      title={
                        comment.author?.verified
                          ? "Verified profile"
                          : "Unverified profile. Verified members are more likely to be accepted."
                      }
                    >
                      {comment.author?.verified ? "Verified" : "Unverified"}
                    </Badge>
                  )}
                </div>
                <p className="text-white/70 text-[11px] md:text-xs whitespace-pre-line">
                  {comment.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type CommunityStats = {
  totalMembers: number;
  activeToday: number;
  postsToday: number;
  countiesActive: number;
  helpRequests7d?: number;
  recommendations7d?: number;
  verifiedPros?: number;
  medianFirstReplyMinutes7d?: number | null;
};

type TrendingTopic = {
  tag: string;
  posts?: number;
  source?: "community" | "news";
};

const CommunityFeed = memo(function CommunityFeed() {
  type FeedTab = "forYou" | "recent" | "nearby" | "vault";
  const [activeTab, setActiveTab] = useState<FeedTab>("forYou");
  const [newPostContent, setNewPostContent] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [openCommentsForPostId, setOpenCommentsForPostId] = useState<string | null>(null);
  const [lastCreatedPostId, setLastCreatedPostId] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("general");
  const [searchState, setSearchState] = useState<string>(() =>
    typeof window !== "undefined" ? window.location.search : ""
  );
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const [route, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { unreadCount } = useNotifications();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocationContext();

  const stateCode = location.stateCode as string | undefined;
  const countyFips = location.countyFips as string | undefined;
  const countyCommitted = hasCountyContext(location);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onLocationChange = () => setSearchState(window.location.search || "");
    window.addEventListener("popstate", onLocationChange);
    window.addEventListener("pushstate", onLocationChange as EventListener);
    window.addEventListener("replacestate", onLocationChange as EventListener);
    return () => {
      window.removeEventListener("popstate", onLocationChange);
      window.removeEventListener("pushstate", onLocationChange as EventListener);
      window.removeEventListener("replacestate", onLocationChange as EventListener);
    };
  }, []);

  const queryParams = useMemo(() => {
    if (typeof window !== "undefined" && searchState) {
      return new URLSearchParams(searchState);
    }
    if (!route) return new URLSearchParams();
    const idx = route.indexOf("?");
    const search = idx >= 0 ? route.slice(idx + 1) : "";
    return new URLSearchParams(search);
  }, [route, searchState]);

  const rawScopeParam = queryParams.get("scope");
  const rawGeoParam = queryParams.get("geo");
  const rawFeedParam = queryParams.get("feed");

  const normalizeFeed = (value?: string | null): FeedTab | null => {
    if (!value) return null;
    switch (value) {
      case "forYou":
      case "for_you":
        return "forYou";
      case "recent":
        return "recent";
      case "nearby":
        return "nearby";
      case "vault":
        return "vault";
      default:
        return null;
    }
  };

  const feedFromRoute = normalizeFeed(rawFeedParam) ?? normalizeFeed(rawScopeParam);
  const normalizeGeoScope = (value?: string | null): "local" | "global" | null => {
    if (!value) return null;
    if (value === "global" || value === "all" || value === "everywhere") return "global";
    if (value === "local" || value === "county") return "local";
    return null;
  };
  // Prefer explicit geo param; fall back to legacy scope param.
  const geoScopeFromRoute = normalizeGeoScope(rawGeoParam) ?? normalizeGeoScope(rawScopeParam);

  // Phase 1: Global community toggle (default: local/county)
  const effectiveGeoScope = geoScopeFromRoute || "local";
  const isGlobalView = effectiveGeoScope === "global";
  const previousScopeRef = useRef<string>("local");

  useEffect(() => {
    if (!feedFromRoute) return;
    if (feedFromRoute !== activeTab) {
      setActiveTab(feedFromRoute);
    }
  }, [feedFromRoute, activeTab]);

  const currentPath =
    typeof window !== "undefined" ? window.location.pathname : route.split("?")[0];
  const handleScopeToggle = (newScope: "local" | "global") => {
    const nextParams = new URLSearchParams(queryParams);
    nextParams.set("geo", newScope);
    // Remove ambiguous legacy key to prevent feed/scope collisions.
    if (nextParams.get("scope") === "local" || nextParams.get("scope") === "global") {
      nextParams.delete("scope");
    }
    const nextSearch = `?${nextParams.toString()}`;
    setSearchState(nextSearch);
    navigate(`${currentPath}${nextSearch}`);
  };

  const handleTabChange = (nextTab: FeedTab) => {
    setActiveTab(nextTab);
    const nextParams = new URLSearchParams(queryParams);
    nextParams.set("feed", nextTab);
    nextParams.set("geo", isGlobalView ? "global" : "local");
    if (nextParams.get("scope") === "local" || nextParams.get("scope") === "global") {
      nextParams.delete("scope");
    }
    const nextSearch = `?${nextParams.toString()}`;
    setSearchState(nextSearch);
    navigate(`${currentPath}${nextSearch}`);
  };

  // Telemetry: Track when community feed defaults to local scope.
  useEffect(() => {
    if (effectiveGeoScope === "local" && countyCommitted) {
      try {
        recordActivity({
          type: "community.county_default",
          ts: new Date().toISOString(),
          path: typeof window !== "undefined" ? window.location.pathname : "",
          meta: {
            surface: "community",
            scope: "local",
            countyFips: countyFips || undefined,
            stateCode: stateCode || undefined,
            source: new URLSearchParams(window.location.search).has("scope")
              ? "manual_change"
              : "nav",
            sessionId: sessionStorage.getItem("sessionId") || crypto.randomUUID(),
            asOf: new Date().toISOString(),
          },
        });
      } catch {
        // fire-and-forget: ignore telemetry failures
      }
    }
  }, [effectiveGeoScope, countyCommitted, countyFips, stateCode, user]);

  // Telemetry: Track when user changes geo scope (local <-> global).
  useEffect(() => {
    if (effectiveGeoScope !== previousScopeRef.current) {
      const previousScope = previousScopeRef.current;
      previousScopeRef.current = effectiveGeoScope;
      try {
        recordActivity({
          type: "community.scope_override",
          ts: new Date().toISOString(),
          path: typeof window !== "undefined" ? window.location.pathname : "",
          meta: {
            surface: "community",
            scope: effectiveGeoScope,
            countyFips: effectiveGeoScope === "local" ? countyFips : undefined,
            stateCode: effectiveGeoScope === "local" ? stateCode : undefined,
            source: "manual_change",
            sessionId: sessionStorage.getItem("sessionId") || crypto.randomUUID(),
            asOf: new Date().toISOString(),
            previousScope,
          },
        });
      } catch {
        // fire-and-forget: ignore telemetry failures
      }
    }
  }, [effectiveGeoScope, countyFips, stateCode, user]);

  const serverScopeForFeed = useMemo(() => {
    if (activeTab === "vault") return "saved";
    if (isGlobalView) return "global";
    switch (activeTab) {
      case "recent":
        return "recent";
      case "nearby":
        return "nearby";
      default:
        return "county";
    }
  }, [activeTab, isGlobalView]);

  // Fetch posts from the API scoped to the user's county and nav scope
  const { data: postsData, isLoading: postsLoading } = useQuery<Post[]>({
    queryKey: ["/api/community/posts", stateCode, countyFips, serverScopeForFeed],
    // Phase 1: Global view doesn't require county commitment
    enabled: isGlobalView || countyCommitted,
    queryFn: async () => {
      const params = new URLSearchParams({
        scope: serverScopeForFeed,
        limit: "20",
        offset: "0",
      });

      // Only include geo params for local scope
      if (!isGlobalView && stateCode && countyFips) {
        params.set("stateCode", stateCode);
        params.set("countyFips", countyFips);
      }

      const response = await fetch(`/api/community/posts?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch posts");
      const json = await response.json();

      // Telemetry: log a single success event when a county-scoped
      // community feed query runs successfully with a committed
      // county. This does not affect behavior or UI.
      if (countyCommitted) {
        try {
          const { recordActivity } = await import("../agent/activity");
          recordActivity({
            type: "county_gated_query_success",
            ts: new Date().toISOString(),
            path: typeof window !== "undefined" ? window.location.pathname : "",
            meta: { surface: "community", queryKey: "community_feed" },
          });
        } catch {
          // ignore telemetry failures
        }
      }

      return json;
    },
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async (postData: {
      content: string;
      title?: string;
      images?: string[];
      category?: string;
    }) => {
      return apiRequest("POST", "/api/community/posts", {
        content: postData.content,
        title: postData.title,
        category: postData.category || "general",
        images: postData.images,
      });
    },
    onSuccess: (created: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
      setNewPostContent("");
      setUploadedImages([]);
      setSelectedCategory("general");
      setLastCreatedPostId(created?.id ?? null);
      toast({
        title: "Post Created",
        description: "Your post has been shared with the community!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create post. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Like post mutation
  const likePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      return apiRequest("POST", `/api/community/posts/${postId}/like`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
    },
  });

  const savePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      return apiRequest("POST", `/api/community/posts/${postId}/save`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
    },
  });

  const handleCreatePost = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to create posts.",
        variant: "destructive",
      });
      return;
    }
    if (isGlobalView) {
      toast({
        title: "Read-only view",
        description: "Switch back to Local to create a post.",
        variant: "destructive",
      });
      return;
    }

    if (newPostContent.trim()) {
      createPostMutation.mutate({
        content: newPostContent,
        images: uploadedImages.length > 0 ? uploadedImages : undefined,
        category: selectedCategory,
      });
    }
  };

  const handleLikePost = (postId: string) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to react to community posts.",
        variant: "destructive",
      });
      return;
    }
    if (isGlobalView) {
      toast({
        title: "Read-only view",
        description: "Switch back to Local to like or comment on posts.",
        variant: "destructive",
      });
      return;
    }
    likePostMutation.mutate(postId);
  };

  const handleToggleSavePost = (postId: string) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to save posts.",
        variant: "destructive",
      });
      return;
    }
    if (isGlobalView) {
      toast({
        title: "Read-only view",
        description: "Switch back to Local to save posts.",
        variant: "destructive",
      });
      return;
    }
    savePostMutation.mutate(postId);
  };

  // Use real posts from API, with sample posts as fallback
  const activePostsSource = postsData;
  const posts = activePostsSource || [];

  const { data: communityStatsData } = useQuery<CommunityStats>({
    queryKey: ["/api/community/stats", stateCode, countyFips, isGlobalView],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (!isGlobalView && countyFips) {
        params.set("countyFips", countyFips);
        if (stateCode) params.set("stateCode", stateCode);
      }
      const response = await fetch(`/api/community/stats?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch community stats");
      return response.json();
    },
  });

  const { data: trendingTopicsData } = useQuery<TrendingTopic[]>({
    queryKey: ["/api/community/trending", stateCode, countyFips],
    enabled: countyCommitted,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (stateCode) params.set("stateCode", stateCode);
      if (countyFips) params.set("countyFips", countyFips);
      params.set("limit", "10");

      const response = await fetch(`/api/community/trending?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch trending topics");
      return response.json();
    },
  });

  const communityStats: CommunityStats = communityStatsData ?? {
    totalMembers: 0,
    activeToday: 0,
    postsToday: 0,
    countiesActive: 0,
    helpRequests7d: 0,
    recommendations7d: 0,
    verifiedPros: 0,
    medianFirstReplyMinutes7d: null,
  };

  const trendingTopics: TrendingTopic[] = Array.isArray(trendingTopicsData)
    ? trendingTopicsData
    : [];

  function getAuthorName(post: any) {
    return (
      post.author?.name ||
      [post.author?.firstName, post.author?.lastName].filter(Boolean).join(" ") ||
      post.author?.username ||
      "Community Member"
    );
  }

  function getAuthorAvatar(post: any) {
    return (
      post.author?.avatar || post.author?.profileImageUrl || post.author?.photoUrl || undefined
    );
  }

  function getAuthorInitials(post: any) {
    const name = String(getAuthorName(post)).trim();
    if (!name) return "CM";
    const parts = name.split(/\s+/).filter(Boolean);
    return parts.length > 1
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }

  const activeNeighbors = useMemo(() => {
    const seen = new Set<string>();
    const neighbors: Array<{ id: string; name: string; avatar?: string }> = [];
    (posts || []).forEach((post: any) => {
      const id = String(post?.author?.id || "");
      if (!id || seen.has(id)) return;
      seen.add(id);
      neighbors.push({
        id,
        name: getAuthorName(post),
        avatar: getAuthorAvatar(post),
      });
    });
    return neighbors.slice(0, 6);
  }, [posts]);

  // Allow Scout to prefill the composer via /community?compose=1&prefill=...
  useEffect(() => {
    if (!route) return;

    const queryIndex = route.indexOf("?");
    if (queryIndex === -1) return;

    const search = route.slice(queryIndex + 1);
    const params = new URLSearchParams(search);
    const compose = params.get("compose");
    const prefill = params.get("prefill");

    if (compose === "1" && prefill) {
      setNewPostContent(prefill);
      if (composerRef.current) {
        composerRef.current.focus();
      }
    }
  }, [route]);

  const seededPrompts: string[] = [
    "Who is a reliable electrician nearby?",
    "Looking for a fence repair recommendation.",
    "Any trusted HVAC pros in this area?",
    "Best local supplier for deck materials?",
    "Who has done great work for a bathroom refresh?",
  ];

  const hasUserPosts = Array.isArray(posts) && posts.length > 0;
  const displayPosts: any[] = posts;
  const tabSortedPosts = useMemo(() => {
    const list = [...displayPosts];
    if (activeTab === "recent" || activeTab === "nearby") {
      return list.sort((a, b) => {
        const aTs = new Date(a.createdAt || a.timestamp || 0).getTime();
        const bTs = new Date(b.createdAt || b.timestamp || 0).getTime();
        return bTs - aTs;
      });
    }

    return list;
  }, [displayPosts, activeTab]);

  const renderFeedList = () => (
    <div className="space-y-3 md:space-y-5">
      {postsLoading ? (
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-ts-orange/30"></div>
          <p className="mt-3 text-sm text-[color:var(--text-secondary)]">Loading posts...</p>
        </div>
      ) : tabSortedPosts.length === 0 ? (
        <Card className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
          <CardContent className="p-6 md:p-8 text-center">
            <h3 className="text-lg md:text-xl font-semibold text-white">Community feed is live</h3>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
              No posts yet for this view. Start with a question, recommendation, or local update.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {tabSortedPosts.map((post: any) => {
            const isSystemPost = post.category === "system";
            const locationLabel = post.location || post.author?.location;

            return (
              <Card
                key={post.id}
                className={`rounded-xl border border-[color:var(--border-subtle)] hover:border-[color:var(--border-active)] transition-colors ${
                  isSystemPost
                    ? "bg-[color:var(--surface-intermediate)]"
                    : "bg-[color:var(--surface-card)]"
                }`}
                data-testid={`card-post-${post.id}`}
              >
                <CardContent className="p-3 md:p-4">
                  {/* Post Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex gap-3">
                      {isSystemPost ? (
                        <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-ts-orange/20 border border-ts-orange/30 flex items-center justify-center">
                          <TradeScoutIcon size="sm" variant="gradient" className="text-black" />
                        </div>
                      ) : (
                        <Avatar className="w-10 h-10 md:w-11 md:h-11 ring-1 ring-ts-orange/70">
                          <AvatarImage className="object-cover" src={getAuthorAvatar(post)} />
                          <AvatarFallback>{getAuthorInitials(post)}</AvatarFallback>
                        </Avatar>
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-semibold text-sm md:text-base">
                            {isSystemPost ? "Scout" : getAuthorName(post)}
                          </h3>
                          {!isSystemPost && post.author?.verified !== undefined && (
                            <Badge
                              variant="outline"
                              className={`h-5 px-1.5 text-[10px] ${
                                post.author?.verified
                                  ? "border-emerald-500/50 text-emerald-300"
                                  : "border-white/15 text-white/70"
                              }`}
                              title={
                                post.author?.verified
                                  ? "Verified profile"
                                  : "Unverified profile. Verified members are more likely to be accepted."
                              }
                            >
                              {post.author?.verified ? "Verified" : "Unverified"}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs md:text-sm text-white/60 mt-1">
                          <span>
                            {post.timestamp || new Date(post.createdAt).toLocaleDateString()}
                          </span>
                          {locationLabel && (
                            <>
                              <span>-</span>
                              <div className="flex items-center gap-1">
                                <Compass className="h-3 w-3" />
                                {locationLabel}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs md:text-sm">
                      <div className="flex items-center gap-1">
                        {getPostTypeIcon(post.type || post.postType)}
                        <span className="text-xs text-[color:var(--text-secondary)]">
                          {getPostTypeLabel(post.type || post.postType)}
                        </span>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem>
                            <Flag className="h-4 w-4 mr-2" />
                            Report
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSharePost(post)}>
                            <Share className="h-4 w-4 mr-2" />
                            Share
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Post Content */}
                  <div className="mb-3 md:mb-4">
                    {post.title && (
                      <h4 className="text-base md:text-lg font-semibold text-white mb-2">
                        {post.title}
                      </h4>
                    )}
                    <p className="text-white/70 text-sm md:text-[15px] mb-3 leading-relaxed whitespace-pre-line">
                      {post.content}
                    </p>

                    {Array.isArray(post.tags) && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {post.tags.map((tag: string, index: number) => (
                          <span
                            key={index}
                            className="text-ts-orange text-sm hover:text-ts-orange cursor-pointer"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {Array.isArray(post.imageUrls) && post.imageUrls.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {post.imageUrls.map((image: string, index: number) => (
                          <img
                            key={index}
                            src={image}
                            alt={`Post image ${index + 1}`}
                            className="rounded-lg w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Post Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-[color:var(--border-subtle)] text-xs md:text-sm">
                    <div className="flex items-center gap-4 md:gap-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isGlobalView}
                        className={`text-[color:var(--text-secondary)] hover:text-red-400 disabled:opacity-50 disabled:pointer-events-none ${post.liked ? "text-red-400" : ""}`}
                        onClick={() => handleLikePost(post.id)}
                        data-testid={`button-like-${post.id}`}
                      >
                        <Heart className={`h-4 w-4 mr-1 ${post.liked ? "fill-current" : ""}`} />
                        <span className="mr-1">Agree</span>
                        {post.likeCount || post.likes || 0}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isGlobalView}
                        className="text-[color:var(--text-secondary)] hover:text-ts-orange disabled:opacity-50 disabled:pointer-events-none"
                        data-testid={`button-comment-${post.id}`}
                        onClick={() => {
                          if (!isAuthenticated) {
                            toast({
                              title: "Sign In Required",
                              description: "Please sign in to discuss community posts.",
                              variant: "destructive",
                            });
                            return;
                          }
                          if (isGlobalView) {
                            toast({
                              title: "Read-only view",
                              description: "Switch back to Local to comment on posts.",
                              variant: "destructive",
                            });
                            return;
                          }
                          setOpenCommentsForPostId((current) =>
                            current === post.id ? null : post.id
                          );
                        }}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        <span className="mr-1">Discuss</span>
                        {post.commentCount || post.comments || 0}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[color:var(--text-secondary)] hover:text-green-400"
                        onClick={() => handleSharePost(post)}
                        data-testid={`button-share-${post.id}`}
                      >
                        <Share className="h-4 w-4 mr-1" />
                        <span className="mr-1">Share</span>
                        {post.shareCount || post.shares || 0}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isGlobalView}
                        className={`text-[color:var(--text-secondary)] hover:text-ts-orange disabled:opacity-50 disabled:pointer-events-none ${post.saved ? "text-ts-orange" : ""}`}
                        onClick={() => handleToggleSavePost(post.id)}
                        data-testid={`button-save-${post.id}`}
                      >
                        <Bookmark className={`h-4 w-4 mr-1 ${post.saved ? "fill-current" : ""}`} />
                        <span className="mr-1">{post.saved ? "Saved" : "Save"}</span>
                      </Button>
                    </div>

                    {post.type === "recommendation_request" && (
                      <Button size="sm" className="bg-ts-orange-dark hover:bg-ts-orange-dark">
                        Recommend Someone
                      </Button>
                    )}

                    {post.type === "promotion" && (
                      <Button size="sm" className="bg-green-600 hover:bg-green-700">
                        View TradeDeal
                      </Button>
                    )}
                  </div>

                  {/* Lightweight social proof */}
                  {(() => {
                    const agreeCount = post.likeCount || post.likes || 0;
                    const commentCount = post.commentCount || post.comments || 0;
                    const shareCount = post.shareCount || post.shares || 0;

                    if (!agreeCount && !commentCount && !shareCount) return null;

                    const parts: string[] = [];
                    if (agreeCount) {
                      parts.push(
                        `${agreeCount} ${agreeCount === 1 ? "neighbor agrees" : "neighbors agree"}`
                      );
                    }
                    if (commentCount) {
                      parts.push(`${commentCount} ${commentCount === 1 ? "reply" : "replies"}`);
                    }

                    return (
                      <div className="mt-2 text-[11px] text-white/60">{parts.join(" | ")}</div>
                    );
                  })()}

                  {/* Comment teaser row */}
                  <div className="mt-3 flex items-center gap-2">
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={user?.avatar as string | undefined} />
                      <AvatarFallback>
                        {(user?.username || user?.email || "U").substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      type="button"
                      className="flex-1 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-input)] px-3 py-2 text-left text-xs md:text-sm text-[color:var(--text-secondary)] hover:border-[color:var(--border-active)] hover:bg-[color:var(--surface-intermediate)]"
                      onClick={() => {
                        if (!isAuthenticated) {
                          toast({
                            title: "Sign In Required",
                            description: "Please sign in to comment on community posts.",
                            variant: "destructive",
                          });
                          return;
                        }
                        setOpenCommentsForPostId((current) =>
                          current === post.id ? null : post.id
                        );
                      }}
                    >
                      Add a comment...
                    </button>
                  </div>

                  {openCommentsForPostId === post.id && (
                    <CommunityComments postId={post.id} readOnly={isGlobalView} />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );

  const handlePromptClick = (prompt: string) => {
    setNewPostContent(prompt);
    if (composerRef.current) {
      composerRef.current.focus();
    }
  };

  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case "project_showcase":
        return <Crown className="h-4 w-4 text-yellow-400" />;
      case "recommendation_request":
        return <MessageSquare className="h-4 w-4 text-ts-orange" />;
      case "promotion":
        return <TrendingUp className="h-4 w-4 text-green-400" />;
      case "community_highlight":
        return <Trophy className="h-4 w-4 text-ts-orange" />;
      case "discussion":
        return <MessageSquare className="h-4 w-4 text-ts-orange" />;
      case "poll":
        return <BarChart3 className="h-4 w-4 text-purple-400" />;
      case "announcement":
        return <Flag className="h-4 w-4 text-red-400" />;
      default:
        return <MessageSquare className="h-4 w-4 text-white/60" />;
    }
  };

  const getPostTypeLabel = (type: string) => {
    switch (type) {
      case "project_showcase":
        return "Project Showcase";
      case "recommendation_request":
        return "Looking for Help";
      case "promotion":
        return "Exclusive TradeDeal";
      case "community_highlight":
        return "Community Highlight";
      case "service_available":
        return "Available for Work";
      case "discussion":
        return "Discussion";
      case "poll":
        return "Poll";
      case "announcement":
        return "Announcement";
      default:
        return "Community Post";
    }
  };

  const handleSharePost = async (post: any) => {
    try {
      await share({
        path: `/community?post=${encodeURIComponent(post.id)}`,
        title: post.title || "TradeScout community post",
        text: (post.content || "").toString(),
        contextLabel: "Post link",
      });
    } catch (err) {
      console.error("Failed to share community post", err);
      toast({
        title: "Share failed",
        description: "Unable to share this post right now.",
        variant: "destructive",
      });
    }
  };

  const handlePhotoClick = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to upload photos.",
        variant: "destructive",
      });
      return;
    }
    fileInputRef.current?.click();
  };

  const handleImagesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, 8 - uploadedImages.length);

    for (const file of files) {
      try {
        const { publicUrl } = await uploadObject(file);
        setUploadedImages((prev) => [...prev, publicUrl].slice(0, 8));
      } catch (error) {
        console.error("Failed to upload image", error);
        toast({
          title: "Upload Failed",
          description: "Failed to upload image. Please try again.",
          variant: "destructive",
        });
      }
    }

    event.target.value = "";
  };

  const handleRemoveImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVideoClick = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to upload videos.",
        variant: "destructive",
      });
      return;
    }
    videoInputRef.current?.click();
  };

  const handleVideoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Check file size (max 100MB for video)
    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Video must be under 100MB",
        variant: "destructive",
      });
      return;
    }

    if (!file.type.startsWith("video/")) {
      toast({
        title: "Invalid File",
        description: "Please select a video file",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Uploading Video",
      description: "This may take a moment...",
    });

    try {
      const { publicUrl } = await uploadObject(file);
      setUploadedImages((prev) => [...prev, publicUrl]); // Videos stored with images for now
      toast({
        title: "Upload Complete",
        description: "Video attached to your post",
      });
    } catch (error) {
      console.error("Failed to upload video", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload video. Please try again.",
        variant: "destructive",
      });
    }

    event.target.value = "";
  };

  const handlePollClick = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to create polls.",
        variant: "destructive",
      });
      return;
    }

    // Add poll template to post content
    const pollTemplate = newPostContent ? newPostContent + "\n\n" : "";
    setNewPostContent(pollTemplate + "Poll:\n- Option 1\n- Option 2\n- Option 3");
    composerRef.current?.focus();
  };

  const formatMinutesCompact = (minutes: number | null | undefined) => {
    const value = typeof minutes === "number" ? minutes : NaN;
    if (!Number.isFinite(value) || value < 0) return "--";
    if (value < 60) return `${Math.round(value)}m`;
    if (value < 60 * 24) return `${Math.round(value / 60)}h`;
    return `${Math.round(value / (60 * 24))}d`;
  };

  return (
    <div className="community-feed-page">
      <CountyRequiredGate locationOverride={location} allowBypass={isGlobalView}>
        <div className="mx-auto w-full max-w-[1024px] px-2.5 py-2 md:px-3 md:py-3 overflow-x-hidden">
          <CommunityTopNav />
          <ScoutContinueBanner className="mb-3" />
          <Card className="mb-3 border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-ts-orange">
                    Community
                  </p>
                  <h1 className="mt-1 text-base md:text-lg font-semibold text-white">
                    Useful local conversation
                  </h1>
                  <p className="mt-1 text-[11px] md:text-xs text-[color:var(--text-secondary)]">
                    Ask, recommend, and coordinate with people in your area.
                  </p>
                  <p className="mt-1 text-[11px] md:text-xs text-white/60">
                    Active today: {communityStats.activeToday} | Posts today:{" "}
                    {communityStats.postsToday}
                  </p>
                </div>
              </div>

              <div className="mt-3 -mx-3 px-3 overflow-x-auto overflow-y-hidden">
                <div className="flex gap-2 min-w-max pb-1 snap-x snap-mandatory scroll-pl-3">
                  <div className="snap-start shrink-0 w-[132px] rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-white/60">Members</p>
                    <p className="text-sm font-semibold text-white">
                      {communityStats.totalMembers}
                    </p>
                  </div>
                  <div className="snap-start shrink-0 w-[132px] rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-white/60">
                      Verified pros
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {communityStats.verifiedPros ?? 0}
                    </p>
                  </div>
                  <div className="snap-start shrink-0 w-[132px] rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-white/60">Recs (7d)</p>
                    <p className="text-sm font-semibold text-white">
                      {communityStats.recommendations7d ?? 0}
                    </p>
                  </div>
                  <div className="snap-start shrink-0 w-[132px] rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-white/60">Help (7d)</p>
                    <p className="text-sm font-semibold text-white">
                      {communityStats.helpRequests7d ?? 0}
                    </p>
                  </div>
                  <div className="snap-start shrink-0 w-[148px] rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-white/60">
                      Median reply (7d)
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {formatMinutesCompact(communityStats.medianFirstReplyMinutes7d)}
                    </p>
                  </div>
                </div>
              </div>

              {activeNeighbors.length > 0 && (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-white/60">
                    Active now
                  </div>
                  <div className="text-[11px] text-white/60">{activeNeighbors.length}</div>
                </div>
              )}
              {activeNeighbors.length > 0 && (
                <div className="mt-2 -mx-3 px-3 overflow-x-auto overflow-y-hidden">
                  <div className="flex items-center gap-2 min-w-max pb-1">
                    {activeNeighbors.slice(0, 12).map((neighbor) => {
                      const stableId = String(neighbor.id || "")
                        .replace(/[^a-z0-9]/gi, "")
                        .slice(0, 2)
                        .toUpperCase();
                      const fallback =
                        stableId ||
                        String(neighbor.name || "")
                          .trim()
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((p) => p[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase() ||
                        "U";

                      return (
                        <div
                          key={neighbor.id}
                          className="shrink-0 flex flex-col items-center gap-1 w-[54px]"
                          title={neighbor.name}
                        >
                          <Avatar className="h-11 w-11 ring-1 ring-ts-orange/70">
                            <AvatarImage src={neighbor.avatar} />
                            <AvatarFallback className="bg-[color:var(--surface-intermediate)] text-white text-xs font-semibold">
                              {fallback}
                            </AvatarFallback>
                          </Avatar>
                          <div className="w-full text-[10px] text-white/60 text-center truncate">
                            {String(neighbor.name || "Neighbor")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          {/* Phase 1: Global Community Toggle (read-only visibility) */}
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-[color:var(--surface-card)] border border-[color:var(--border-subtle)] rounded-lg p-1">
              <button
                onClick={() => handleScopeToggle("local")}
                aria-pressed={!isGlobalView}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  !isGlobalView
                    ? "bg-ts-orange text-white"
                    : "text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
                }`}
              >
                <MapPin className="inline h-4 w-4 mr-1" />
                Local
              </button>
              <button
                onClick={() => handleScopeToggle("global")}
                aria-pressed={isGlobalView}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isGlobalView
                    ? "bg-ts-orange text-white"
                    : "text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
                }`}
              >
                <Globe className="inline h-4 w-4 mr-1" />
                Everywhere
              </button>
            </div>
            {isGlobalView && (
              <span className="text-[11px] md:text-xs text-[color:var(--text-secondary)]">
                Read-only
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
            {/* Main Feed */}
            <div className="lg:col-span-2 space-y-3 md:space-y-4">
              <Tabs
                value={activeTab}
                onValueChange={(value) => handleTabChange(value as FeedTab)}
                className="w-full"
              >
                <div className="mb-3 md:mb-4 flex flex-wrap items-center gap-2">
                  <TabsList className="flex items-center gap-1.5 bg-transparent border-0 p-0 overflow-x-auto">
                    <TabsTrigger
                      value="forYou"
                      className="rounded-md px-3 py-1.5 text-xs font-semibold"
                    >
                      For You
                    </TabsTrigger>
                    <TabsTrigger
                      value="recent"
                      className="rounded-md px-3 py-1.5 text-xs font-semibold"
                    >
                      Recent
                    </TabsTrigger>
                    <TabsTrigger
                      value="nearby"
                      className="rounded-md px-3 py-1.5 text-xs font-semibold"
                    >
                      Nearby
                    </TabsTrigger>
                    <TabsTrigger
                      value="vault"
                      className="rounded-md px-3 py-1.5 text-xs font-semibold"
                    >
                      Saved
                    </TabsTrigger>
                  </TabsList>
                </div>
                {/* Inline composer (local-only; global view is read-only) */}
                {!isGlobalView ? (
                  <Card className="bg-[color:var(--surface-card)] border border-[color:var(--border-subtle)] mb-3 md:mb-5 md:sticky md:top-16">
                    <CardContent className="p-3 md:p-5">
                      <div className="flex gap-4">
                        <Avatar className="w-10 h-10 md:w-11 md:h-11">
                          <AvatarImage src={user?.avatar as string | undefined} />
                          <AvatarFallback>
                            {(user?.username || user?.email || "U").substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-3">
                          <Textarea
                            ref={composerRef}
                            placeholder={
                              selectedCategory === "request"
                                ? "What do you need help with? (e.g., 'Need someone to fix my fence')"
                                : selectedCategory === "question"
                                  ? "What do you want to know? Scout or your neighbors can help..."
                                  : selectedCategory === "forsale"
                                    ? "What are you selling? Include price and condition..."
                                    : selectedCategory === "alert"
                                      ? "What should everyone know about right now?"
                                      : selectedCategory === "event"
                                        ? "What's happening? When and where?"
                                        : "What's happening in your community today?"
                            }
                            value={newPostContent}
                            onChange={(e) => setNewPostContent(e.target.value)}
                            rows={3}
                          />

                          {/* Hidden file inputs */}
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImagesSelected}
                            className="hidden"
                          />
                          <input
                            ref={videoInputRef}
                            type="file"
                            accept="video/*"
                            onChange={handleVideoSelected}
                            className="hidden"
                          />

                          {/* Category selection - Maps human intent to system routing
                          PHILOSOPHY: Users think in outcomes, not systems
                          - "I need help" -> Scout + Direct Connect (invisible)
                          - "What's for sale?" -> Marketplace integration (transparent)
                          - "What's happening?" -> Community feed (default)
                          Categories route information WITHOUT exposing internal system names
                        */}
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              {
                                key: "general",
                                label: "General",
                                icon: MessageSquare,
                                intent: "Share with neighbors",
                              },
                              {
                                key: "question",
                                label: "Question",
                                icon: HelpCircle,
                                intent: "Get help from Scout or locals",
                              },
                              {
                                key: "recommendation",
                                label: "Recommend",
                                icon: Award,
                                intent: "Recommend someone you trust",
                              },
                              {
                                key: "event",
                                label: "Event",
                                icon: Calendar,
                                intent: "Let people know about an event",
                              },
                              {
                                key: "tip",
                                label: "Tip",
                                icon: Lightbulb,
                                intent: "Share something useful",
                              },
                              {
                                key: "request",
                                label: "Need Help",
                                icon: Wrench,
                                intent: "Find someone to do work",
                              },
                              {
                                key: "alert",
                                label: "Alert",
                                icon: AlertTriangle,
                                intent: "Important: everyone should see this",
                              },
                              {
                                key: "forsale",
                                label: "For Sale",
                                icon: DollarSign,
                                intent: "Sell something locally",
                              },
                            ].map(({ key, label, icon: Icon, intent }) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => setSelectedCategory(key)}
                                title={intent}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                  selectedCategory === key
                                    ? "bg-ts-orange text-white"
                                    : "bg-[color:var(--surface-intermediate)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-card)] border border-[color:var(--border-subtle)]"
                                }`}
                              >
                                <Icon className="h-3 w-3" />
                                {label}
                              </button>
                            ))}
                          </div>

                          {/* Image preview grid */}
                          {uploadedImages.length > 0 && (
                            <div className="grid grid-cols-4 gap-2">
                              {uploadedImages.map((url, index) => (
                                <div key={url} className="relative group">
                                  <img
                                    src={url}
                                    alt={`Upload ${index + 1}`}
                                    className="w-full h-20 object-cover rounded border border-[color:var(--border-subtle)]"
                                  />
                                  <button
                                    onClick={() => handleRemoveImage(index)}
                                    className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <span className="text-xs">x</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {!hasUserPosts && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-xs text-white/60 uppercase tracking-wide">
                                <MessageSquare className="h-3 w-3" />
                                <span>Ask your neighbors</span>
                              </div>
                              <div className="grid gap-2">
                                {seededPrompts.map((prompt) => (
                                  <button
                                    key={prompt}
                                    type="button"
                                    onClick={() => handlePromptClick(prompt)}
                                    className="w-full rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-3 py-2 text-left text-xs md:text-sm text-[color:var(--text-secondary)] hover:border-[color:var(--border-active)] hover:bg-[color:var(--surface-intermediate)] transition-colors"
                                  >
                                    {prompt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center pt-1">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handlePhotoClick}
                                className="border-[color:var(--border-subtle)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-intermediate)] hover:text-[color:var(--text-primary)]"
                              >
                                <Image className="h-4 w-4 mr-1" />
                                Photo
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleVideoClick}
                                className="border-[color:var(--border-subtle)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-intermediate)] hover:text-[color:var(--text-primary)]"
                              >
                                <Video className="h-4 w-4 mr-1" />
                                Video
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handlePollClick}
                                className="border-[color:var(--border-subtle)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-intermediate)] hover:text-[color:var(--text-primary)]"
                              >
                                <BarChart3 className="h-4 w-4 mr-1" />
                                Poll
                              </Button>
                            </div>

                            <Button
                              className="bg-ts-orange hover:bg-ts-orange-dark w-full sm:w-auto"
                              onClick={handleCreatePost}
                              disabled={!newPostContent.trim() || createPostMutation.isPending}
                              data-testid="button-submit-post"
                            >
                              {createPostMutation.isPending ? "Posting..." : "Post"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {lastCreatedPostId && (
                  <OutcomeConfirmationCard
                    actionType="community_notice"
                    artifactId={lastCreatedPostId}
                    stateCode={stateCode}
                    countyFips={countyFips}
                    initiatedBy="direct"
                  />
                )}

                <TabsContent value="forYou" className="mt-0">
                  {renderFeedList()}
                </TabsContent>

                <TabsContent value="recent" className="mt-0">
                  {renderFeedList()}
                </TabsContent>

                <TabsContent value="nearby" className="mt-0">
                  {renderFeedList()}
                </TabsContent>

                <TabsContent value="vault" className="mt-0">
                  {renderFeedList()}
                </TabsContent>
              </Tabs>
            </div>

            {/* Right column: community snapshot + signals */}
            <div className="lg:col-span-1 space-y-4">
              {countyFips ? (
                <CommunitySnapshotRail
                  countyFips={countyFips}
                  communityStats={communityStats}
                  className="sticky top-20"
                />
              ) : null}
              {trendingTopics.length > 0 && (
                <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-white">Trending Topics</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {trendingTopics.slice(0, 8).map((topic) => (
                      <span
                        key={topic.tag}
                        className="inline-flex items-center rounded-full border border-ts-orange/30 bg-ts-orange/10 px-2.5 py-1 text-[11px] text-ts-orange"
                      >
                        #{topic.tag}
                      </span>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </CountyRequiredGate>
    </div>
  );
});

export default CommunityFeed;
