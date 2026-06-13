import { memo, useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { SEOHelmet } from "@/components/SEOHelmet";
import {
  MessageSquare,
  Zap,
  TrendingUp,
  MoreHorizontal,
  Image,
  Video,
  Calendar,
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
  Search,
  ShieldCheck,
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
import { formatContextTag, toContextTagKey } from "@/utils/formatContextTag";
import { apiRequest } from "@/lib/queryClient";
import { uploadObject } from "@/lib/objectUpload";
import { recordActivity } from "@/agent/activity";
import { TradeScoutIcon, TradeScoutLogo } from "@/components/TradeScoutIcons";
import { useLocationContext, hasCountyContext } from "@/hooks/useLocationContext";
import { CountyRequiredGate } from "@/components/CountyRequiredGate";
import { useLocation } from "wouter";
import { OutcomeConfirmationCard } from "@/components/OutcomeConfirmationCard";
import { CommunityTopNav } from "@/components/community/CommunityTopNav";
import { CommunitySnapshotRail } from "@/components/community/CommunitySnapshotRail";
import {
  ContactOutcomeModal,
  type ContactOutcome,
} from "@/components/community/ContactOutcomeModal";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const UPLOAD_ID_PATH_PATTERN = /\/uploads\/[0-9a-f-]{36}$/i;
const UPLOAD_FALLBACK_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"] as const;

function handleCommunityImageError(image: HTMLImageElement) {
  const currentSrc = image.currentSrc || image.src || "";
  const attempt = Number.parseInt(image.dataset.fallbackAttempt || "0", 10) || 0;
  if (attempt < UPLOAD_FALLBACK_EXTENSIONS.length && UPLOAD_ID_PATH_PATTERN.test(currentSrc)) {
    const base = currentSrc.replace(/([?#].*)$/, "");
    const suffix = currentSrc.slice(base.length);
    image.dataset.fallbackAttempt = String(attempt + 1);
    image.src = `${base}${UPLOAD_FALLBACK_EXTENSIONS[attempt]}${suffix}`;
    return;
  }

  image.style.display = "none";
}

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
        description: formatUserFacingErrorMessage(error, "Please try again."),
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
            <AvatarFallback className="bg-[color:var(--surface-intermediate)]">
              <TradeScoutLogo size="sm" className="h-6 w-6 bg-transparent ring-0" />
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
                <AvatarFallback className="bg-[color:var(--surface-intermediate)]">
                  <TradeScoutLogo size="sm" className="h-5 w-5 bg-transparent ring-0" />
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

type ConnectionActivitySummary = {
  totalConnections: number;
  activeTodayCount: number;
  activeNowCount: number;
  windowMinutes: number;
  activeToday: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    lastSeenAt: string | null;
    isActiveNow: boolean;
  }>;
};

type ContactConnection = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  city: string | null;
  state: string | null;
  roles: string[] | null;
  role: string | null;
  canonicalProfileUrl: string | null;
  connectedAt: string | null;
  intent: string | null;
  authorityGate: string | null;
  decisionScope: string | null;
  countyFips: string | null;
  threadId: string | null;
};

type TrendingTopic = {
  tag: string;
  posts?: number;
  source?: "community" | "news";
};

const CommunityFeed = memo(function CommunityFeed() {
  type FeedTab = "forYou" | "recent" | "vault";
  const [activeTab, setActiveTab] = useState<FeedTab>("forYou");
  const [newPostContent, setNewPostContent] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [activeContactOutcome, setActiveContactOutcome] = useState<ContactOutcome | null>(null);
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
  const rawTagParam = queryParams.get("tag");
  const topicTagKey = toContextTagKey(rawTagParam);
  const topicTagLabel = topicTagKey ? formatContextTag(topicTagKey) : "";

  const normalizeFeed = (value?: string | null): FeedTab | null => {
    if (!value) return null;
    switch (value) {
      case "forYou":
      case "for_you":
        return "forYou";
      case "recent":
        return "recent";
      case "nearby":
        return "forYou";
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

  const setActiveTopic = (topicKey: string) => {
    const normalized = toContextTagKey(topicKey);
    const nextParams = new URLSearchParams(queryParams);
    if (normalized) nextParams.set("tag", normalized);
    else nextParams.delete("tag");
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

  const topicScopeForThread =
    serverScopeForFeed === "saved" ? (isGlobalView ? "global" : "county") : serverScopeForFeed;

  const { data: topicPostsData, isLoading: topicPostsLoading } = useQuery<Post[]>({
    queryKey: [
      "/api/community/posts",
      stateCode,
      countyFips,
      topicScopeForThread,
      topicTagKey,
      "topic",
    ],
    enabled: Boolean(topicTagKey) && (isGlobalView || countyCommitted),
    queryFn: async () => {
      const params = new URLSearchParams({
        scope: topicScopeForThread,
        limit: "50",
        offset: "0",
        tag: topicTagKey,
      });

      if (!isGlobalView && stateCode && countyFips) {
        params.set("stateCode", stateCode);
        params.set("countyFips", countyFips);
      }

      const response = await fetch(`/api/community/posts?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch topic posts");
      return (await response.json()) as Post[];
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

  const { data: connectionActivityData } = useQuery<ConnectionActivitySummary>({
    queryKey: ["/api/social/contact-connections/activity"],
    enabled: Boolean(isAuthenticated),
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: "12",
        windowMinutes: "5",
      });
      const response = await fetch(
        `/api/social/contact-connections/activity?${params.toString()}`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) throw new Error("Failed to fetch connection activity");
      return response.json();
    },
    staleTime: 60_000,
  });

  const activeConnections = useMemo(() => {
    const list = Array.isArray(connectionActivityData?.activeToday)
      ? connectionActivityData!.activeToday
      : [];
    return list.slice(0, 12);
  }, [connectionActivityData]);

  const { data: contactConnectionsData = [] } = useQuery<ContactConnection[]>({
    queryKey: ["/api/social/contact-connections"],
    enabled: Boolean(isAuthenticated),
    queryFn: async () => {
      const response = await fetch("/api/social/contact-connections", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch contact connections");
      return response.json();
    },
    staleTime: 60_000,
  });

  const connectionByUserId = useMemo(() => {
    const byId = new Map<string, ContactConnection>();
    for (const connection of contactConnectionsData) {
      if (connection?.id) {
        byId.set(connection.id, connection);
      }
    }
    return byId;
  }, [contactConnectionsData]);

  const handleOpenActiveUserProfile = (neighborId: string) => {
    const connection = connectionByUserId.get(neighborId);
    const canonical = String(connection?.canonicalProfileUrl || "").trim();
    if (canonical) {
      navigate(canonical);
      return;
    }
    navigate(`/community/u/${encodeURIComponent(neighborId)}`);
  };

  const handleOpenDirectConnectForActiveUser = (neighborId: string, neighborName: string) => {
    const params = new URLSearchParams({
      source: "community_active_now",
      target: neighborId,
    });
    const trimmedName = String(neighborName || "").trim();
    if (trimmedName) {
      params.set("targetName", trimmedName);
    }
    if (countyFips) {
      params.set("county", countyFips);
    }
    navigate(`/direct-connect?${params.toString()}`);
  };

  const handleCreateConnectionRequest = (
    neighbor: ConnectionActivitySummary["activeToday"][number]
  ) => {
    const targetUserId = String(neighbor.id || "").trim();
    if (!targetUserId) return;

    const fullName = [neighbor.firstName, neighbor.lastName].filter(Boolean).join(" ").trim();
    const targetUserName = fullName || "Community member";
    const connection = connectionByUserId.get(targetUserId);
    const roleCandidate =
      String(connection?.role || "").trim() ||
      (Array.isArray(connection?.roles) &&
      connection?.roles.length > 0 &&
      typeof connection.roles[0] === "string"
        ? String(connection.roles[0]).trim()
        : "");
    const targetRole = roleCandidate || "Member";
    const city = String(connection?.city || "").trim();
    const state = String(connection?.state || "").trim();
    const targetLocation = [city, state].filter(Boolean).join(", ") || undefined;

    setActiveContactOutcome({
      targetUserId,
      targetUserName,
      targetRole,
      targetLocation,
      suggestedIntent: "collaborate",
      reasonForContact:
        "I saw you active in Community and want to connect so we can coordinate directly.",
      riskFlags: [],
      decisionScope: `community_active_now:${targetUserId}`,
      decisionTitle: "Community connection request",
    });
  };

  const handleOpenCommunityMemberProfile = (userId?: string | null) => {
    const targetUserId = String(userId || "").trim();
    if (!targetUserId) return;
    const connection = connectionByUserId.get(targetUserId);
    const canonical = String(connection?.canonicalProfileUrl || "").trim();
    if (canonical) {
      navigate(canonical);
      return;
    }
    navigate(`/community/u/${encodeURIComponent(targetUserId)}`);
  };

  const handleOpenDirectConnectForCommunityMember = (
    userId?: string | null,
    displayName?: string | null
  ) => {
    const targetUserId = String(userId || "").trim();
    if (!targetUserId) return;
    const params = new URLSearchParams({
      source: "community_feed",
      target: targetUserId,
    });
    const name = String(displayName || "").trim();
    if (name) {
      params.set("targetName", name);
    }
    if (countyFips) {
      params.set("county", countyFips);
    }
    navigate(`/direct-connect?${params.toString()}`);
  };

  const handleRequestCommunityMemberConnection = (post: any) => {
    const targetUserId = String(post?.author?.id || "").trim();
    if (!targetUserId) return;

    const name = String(getAuthorName(post) || "").trim() || "Community member";
    const location = String(post?.location || post?.author?.location || "").trim() || undefined;
    const role = String(post?.author?.role || "Member").trim() || "Member";

    setActiveContactOutcome({
      targetUserId,
      targetUserName: name,
      targetRole: role,
      targetLocation: location,
      suggestedIntent: "collaborate",
      reasonForContact:
        "I saw your activity in Community and want to connect so we can coordinate directly.",
      riskFlags: [],
      decisionScope: `community_feed:${targetUserId}`,
      decisionTitle: "Community connection request",
    });
  };

  // Allow Scout to prefill the composer via /community-feed?compose=1&prefill=...
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
    if (activeTab === "recent") {
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
            <h3 className="text-lg md:text-xl font-semibold text-white">No posts here yet</h3>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
              Start with a question, a recommendation, or a local update.
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
                data-post-id={post.id}
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
                        <button
                          type="button"
                          onClick={() => handleOpenCommunityMemberProfile(post.author?.id)}
                          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ts-orange/70"
                          title="View public profile"
                          aria-label={`View ${getAuthorName(post)} profile`}
                        >
                          <Avatar className="w-10 h-10 md:w-11 md:h-11 ring-1 ring-ts-orange/70">
                            <AvatarImage className="object-cover" src={getAuthorAvatar(post)} />
                            <AvatarFallback className="bg-[color:var(--surface-intermediate)]">
                              <TradeScoutLogo size="sm" className="h-8 w-8 bg-transparent ring-0" />
                            </AvatarFallback>
                          </Avatar>
                        </button>
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          {isSystemPost ? (
                            <h3 className="text-white font-semibold text-sm md:text-base">
                              TradeScout
                            </h3>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenCommunityMemberProfile(post.author?.id)}
                              className="text-white font-semibold text-sm md:text-base hover:text-ts-orange text-left"
                              title="View public profile"
                            >
                              {getAuthorName(post)}
                            </button>
                          )}
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
                              <span>•</span>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {locationLabel}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs md:text-sm">
                      <div className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-subtle)] px-2 py-0.5">
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
                          {!isSystemPost && post.author?.id && (
                            <DropdownMenuItem
                              onClick={() => handleOpenCommunityMemberProfile(post.author?.id)}
                            >
                              View public profile
                            </DropdownMenuItem>
                          )}
                          {!isSystemPost && post.author?.id && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleOpenDirectConnectForCommunityMember(
                                  post.author?.id,
                                  getAuthorName(post)
                                )
                              }
                            >
                              Start a Request
                            </DropdownMenuItem>
                          )}
                          {!isSystemPost && post.author?.id && (
                            <DropdownMenuItem
                              onClick={() => handleRequestCommunityMemberConnection(post)}
                            >
                              Send Connection Request
                            </DropdownMenuItem>
                          )}
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
                        {post.tags
                          .map((raw: string) => ({
                            key: toContextTagKey(raw),
                            label: formatContextTag(raw),
                          }))
                          .filter((t: { key: string; label: string }) => t.key && t.label)
                          .slice(0, 12)
                          .map((tag: { key: string; label: string }, index: number) => (
                            <button
                              key={`${tag.key}-${index}`}
                              type="button"
                              onClick={() => setActiveTopic(tag.key)}
                              className="text-ts-orange text-sm hover:text-ts-orange cursor-pointer underline-offset-4 hover:underline"
                              aria-label={`View topic ${tag.label}`}
                              title={`View topic: ${tag.label}`}
                            >
                              {tag.label}
                            </button>
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
                            onError={(event) => handleCommunityImageError(event.currentTarget)}
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
                        <span className="mr-1">Like</span>
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
                        <span className="mr-1">Comment</span>
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
                      <AvatarFallback className="bg-[color:var(--surface-intermediate)]">
                        <TradeScoutLogo size="sm" className="h-5 w-5 bg-transparent ring-0" />
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
                      Write a comment...
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
        path: `/community-feed?post=${encodeURIComponent(post.id)}`,
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
    <>
      <SEOHelmet
        title="TradeScout Community | Local Updates, Questions, and Neighborhood Activity"
        description="Stay connected to local activity on TradeScout Community. Ask questions, share updates, follow neighborhood conversations, and keep up with what is happening nearby."
        keywords="tradescout community, local community feed, neighborhood activity, ask neighbors online, local updates"
        canonical="https://www.thetradescout.com/community-feed"
      />
      <div className="community-feed-page">
        <CountyRequiredGate locationOverride={location} allowBypass={isGlobalView}>
          <div className="mx-auto w-full max-w-[1024px] px-2.5 py-2 md:px-3 md:py-3 overflow-x-hidden">
            <CommunityTopNav />

            <Dialog
              open={Boolean(topicTagKey)}
              onOpenChange={(open) => {
                if (!open) setActiveTopic("");
              }}
            >
              <DialogContent className="left-0 top-0 z-[1000] h-[100vh] w-[100vw] max-w-none translate-x-0 translate-y-0 rounded-none border border-white/10 bg-[color:var(--surface-app-bg)] p-0">
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[color:var(--surface-intermediate)] px-4 py-3">
                    <div className="min-w-0">
                      <DialogTitle className="text-base md:text-lg">
                        Topic: {topicTagLabel || topicTagKey}
                      </DialogTitle>
                      <div className="mt-0.5 text-xs text-white/60">
                        Showing posts that mention this topic in your current scope.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTopic("")}
                      className="inline-flex items-center justify-center rounded-full border border-ts-orange/30 bg-ts-orange px-3 py-1 text-[0.7rem] font-semibold text-black hover:bg-ts-orange-dark"
                    >
                      Close
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-2.5 py-3 md:px-3">
                    {topicPostsLoading ? (
                      <div className="text-sm text-white/60">Loading topic…</div>
                    ) : (topicPostsData || []).length === 0 ? (
                      <div className="text-sm text-white/60">
                        No posts found for this topic yet.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(topicPostsData || []).map((post) => (
                          <Card
                            key={`topic-${post.id}`}
                            className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]"
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-xs text-white/60">
                                    {post.author?.name || "Member"} •{" "}
                                    {post.createdAt
                                      ? new Date(post.createdAt).toLocaleString()
                                      : ""}
                                  </div>
                                  {post.title ? (
                                    <div className="mt-1 text-sm font-semibold text-white">
                                      {post.title}
                                    </div>
                                  ) : null}
                                  <div className="mt-1 text-sm text-white/70 whitespace-pre-line">
                                    {String(post.content || "").slice(0, 300)}
                                    {String(post.content || "").length > 300 ? "…" : ""}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTopic("");
                                    setOpenCommentsForPostId(post.id);
                                    try {
                                      window.setTimeout(() => {
                                        const el = document.querySelector(
                                          `[data-post-id="${CSS.escape(post.id)}"]`
                                        ) as HTMLElement | null;
                                        el?.scrollIntoView({ behavior: "smooth", block: "start" });
                                      }, 50);
                                    } catch {
                                      // ignore
                                    }
                                  }}
                                  className="shrink-0 text-xs text-ts-orange hover:underline underline-offset-4"
                                >
                                  Open
                                </button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Card className="mb-3 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.035))] shadow-[0_18px_44px_rgba(0,0,0,0.24)] md:rounded-xl md:bg-[color:var(--surface-card)] md:shadow-none">
              <CardContent className="p-4 md:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-ts-orange/25 bg-ts-orange/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ts-orange">
                        Community
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-white/70">
                        <ShieldCheck className="h-3 w-3 text-emerald-300" />
                        Local hub
                      </span>
                    </div>
                    <h1 className="mt-3 text-2xl font-semibold leading-tight text-white md:mt-1 md:text-lg">
                      Local activity
                    </h1>
                    <p className="mt-1.5 max-w-[28rem] text-sm leading-5 text-white/72 md:text-xs md:text-[color:var(--text-secondary)]">
                      See what neighbors and local businesses are sharing, then start a request when
                      you need work done.
                    </p>
                    <p className="mt-2 hidden text-[11px] text-white/60 md:block md:text-xs">
                      {`${
                        isAuthenticated && connectionActivityData
                          ? `Connections active today: ${connectionActivityData.activeTodayCount}`
                          : `Active today: ${communityStats.activeToday}`
                      } | Posts today: ${communityStats.postsToday}`}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-[1fr_auto] gap-2 md:hidden">
                  <button
                    type="button"
                    onClick={() => navigate("/scout")}
                    className="flex min-h-12 items-center gap-2 rounded-2xl border border-white/10 bg-black/18 px-3 text-left text-sm text-white/72"
                    aria-label="Search local context"
                  >
                    <Search className="h-4 w-4 shrink-0 text-white/55" />
                    <span className="truncate">Search local context</span>
                  </button>
                  <Button
                    type="button"
                    onClick={() => navigate("/direct-connect")}
                    className="min-h-12 rounded-2xl bg-ts-orange px-4 text-sm font-semibold text-white hover:bg-ts-orange-dark"
                  >
                    Start request
                  </Button>
                </div>

                <div className="mt-3 -mx-3 hidden px-3 overflow-x-auto overflow-y-hidden md:block">
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

                {activeConnections.length > 0 && (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/60">
                      Active now
                    </div>
                    <div className="text-[11px] text-white/60">
                      {connectionActivityData?.activeNowCount ?? activeConnections.length}
                    </div>
                  </div>
                )}
                {activeConnections.length > 0 && (
                  <div className="mt-2 -mx-3 hidden px-3 overflow-x-auto overflow-y-hidden md:block">
                    <div className="flex items-center gap-2 min-w-max pb-1">
                      {activeConnections.slice(0, 12).map((neighbor) => {
                        const name =
                          [neighbor.firstName, neighbor.lastName].filter(Boolean).join(" ") ||
                          "Connection";

                        return (
                          <DropdownMenu key={neighbor.id}>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="shrink-0 flex flex-col items-center gap-1 w-[54px] group"
                                title={`${name} actions`}
                                aria-label={`Open actions for ${name}`}
                              >
                                <div className="relative">
                                  <Avatar className="h-11 w-11 ring-1 ring-ts-orange/70 transition-all group-hover:ring-ts-orange">
                                    <AvatarImage src={neighbor.profileImageUrl ?? undefined} />
                                    <AvatarFallback className="bg-[color:var(--surface-intermediate)]">
                                      <TradeScoutLogo
                                        size="sm"
                                        className="h-8 w-8 bg-transparent ring-0"
                                      />
                                    </AvatarFallback>
                                  </Avatar>
                                  {neighbor.isActiveNow && (
                                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[color:var(--surface-card)]" />
                                  )}
                                </div>
                                <div className="w-full text-[10px] text-white/60 text-center truncate group-hover:text-white/80">
                                  {String(neighbor.firstName || name).split(" ")[0]}
                                </div>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center" className="w-56">
                              <DropdownMenuItem
                                onClick={() => handleOpenActiveUserProfile(neighbor.id)}
                              >
                                View public profile
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleOpenDirectConnectForActiveUser(neighbor.id, name)
                                }
                              >
                                Start a Request
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleCreateConnectionRequest(neighbor)}
                              >
                                Send connection request
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
              {/* Main Feed */}
              <div className="lg:col-span-2 space-y-3 md:space-y-4">
                <Tabs
                  value={activeTab}
                  onValueChange={(value) => handleTabChange(value as FeedTab)}
                  className="w-full"
                >
                  <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.045] p-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.16)] md:mb-4 md:rounded-xl md:border-[color:var(--border-subtle)] md:bg-[color:var(--surface-card)] md:p-3 md:shadow-none">
                    <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex min-h-11 items-center gap-1 rounded-2xl border border-white/10 bg-black/20 p-1 md:min-h-0 md:rounded-lg md:border-[color:var(--border-subtle)] md:bg-[color:var(--surface-intermediate)]">
                          <button
                            onClick={() => handleScopeToggle("local")}
                            aria-pressed={!isGlobalView}
                            className={`rounded-xl px-3 py-2 text-xs font-medium transition-all md:rounded-md md:py-1.5 ${
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
                            className={`rounded-xl px-3 py-2 text-xs font-medium transition-all md:rounded-md md:py-1.5 ${
                              isGlobalView
                                ? "bg-ts-orange text-white"
                                : "text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
                            }`}
                          >
                            <Globe className="inline h-4 w-4 mr-1" />
                            Everywhere
                          </button>
                        </div>
                        {isGlobalView ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white/65">
                            Read-only
                          </span>
                        ) : null}
                      </div>

                      <TabsList className="flex min-h-11 items-center gap-1.5 overflow-x-auto rounded-2xl bg-black/20 p-1 md:min-h-0 md:bg-transparent md:border-0 md:p-0">
                        <TabsTrigger
                          value="forYou"
                          className="rounded-xl px-3 py-2 text-xs font-semibold md:rounded-md md:py-1.5"
                        >
                          Local
                        </TabsTrigger>
                        <TabsTrigger
                          value="recent"
                          className="rounded-xl px-3 py-2 text-xs font-semibold md:rounded-md md:py-1.5"
                        >
                          Recent
                        </TabsTrigger>
                        <TabsTrigger
                          value="vault"
                          className="rounded-xl px-3 py-2 text-xs font-semibold md:rounded-md md:py-1.5"
                        >
                          Saved
                        </TabsTrigger>
                      </TabsList>
                    </div>
                  </div>
                  {/* Inline composer (local-only; global view is read-only) */}
                  {!isGlobalView ? (
                    <Card className="mb-3 rounded-2xl border border-white/10 bg-white/[0.045] shadow-[0_12px_32px_rgba(0,0,0,0.18)] md:mb-5 md:sticky md:top-16 md:rounded-xl md:border-[color:var(--border-subtle)] md:bg-[color:var(--surface-card)] md:shadow-none">
                      <CardContent className="p-3.5 md:p-5">
                        <div className="flex gap-3 md:gap-4">
                          <Avatar className="w-10 h-10 md:w-11 md:h-11">
                            <AvatarImage src={user?.avatar as string | undefined} />
                            <AvatarFallback className="bg-[color:var(--surface-intermediate)]">
                              <TradeScoutLogo
                                size="sm"
                                className="h-7 w-7 md:h-8 md:w-8 bg-transparent ring-0"
                              />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-white">
                                  Share locally
                                </div>
                                <div className="text-xs text-white/55">
                                  Post an update, or start a request for work.
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => navigate("/direct-connect")}
                                className="hidden shrink-0 rounded-full border border-ts-orange/35 bg-ts-orange/10 px-3 py-1.5 text-xs font-semibold text-ts-orange md:inline-flex"
                              >
                                Direct Connect
                              </button>
                            </div>
                            <Textarea
                              ref={composerRef}
                              placeholder={
                                selectedCategory === "request"
                                  ? "What do you need help with? (e.g., 'Need someone to fix my fence')"
                                  : selectedCategory === "question"
                                    ? "What do you want to know? Ask your neighbors..."
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
                              className="min-h-[92px] rounded-2xl border-white/10 bg-black/18 text-sm text-white placeholder:text-white/42 focus-visible:ring-ts-orange/45 md:rounded-md"
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

                            {/* Category selection keeps outcome-first language while preserving routing behavior. */}
                            <div className="-mx-0.5 flex gap-1.5 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
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
                                  intent: "Ask neighbors",
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
                                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-xs font-medium transition-all md:rounded-md md:px-2.5 md:py-1 ${
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
                                  <span>Start a post</span>
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
                                className="min-h-11 rounded-2xl bg-ts-orange hover:bg-ts-orange-dark w-full text-sm font-semibold sm:w-auto md:rounded-md md:min-h-0"
                                onClick={handleCreatePost}
                                disabled={!newPostContent.trim() || createPostMutation.isPending}
                                data-testid="button-submit-post"
                              >
                                {createPostMutation.isPending ? "Posting..." : "Share update"}
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
                    <CardHeader className="pb-1.5">
                      <CardTitle className="text-sm text-white">Topics</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {trendingTopics.slice(0, 6).map((topic) => (
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
      {activeContactOutcome && (
        <ContactOutcomeModal
          outcome={activeContactOutcome}
          onClose={() => setActiveContactOutcome(null)}
        />
      )}
    </>
  );
});

export default CommunityFeed;
