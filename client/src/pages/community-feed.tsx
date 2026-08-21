import { memo, useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { SEOHelmet, createBreadcrumbStructuredData } from "@/components/SEOHelmet";
import {
  MessageSquare,
  Image,
  Video,
  Calendar,
  Award,
  BarChart3,
  Send,
  MapPin,
  HelpCircle,
  Wrench,
  Lightbulb,
  AlertTriangle,
  DollarSign,
  Globe,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { share } from "@/utils/share";
import { formatContextTag, toContextTagKey } from "@/utils/formatContextTag";
import { apiRequest } from "@/lib/queryClient";
import { uploadObject } from "@/lib/objectUpload";
import { recordActivity } from "@/agent/activity";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";
import { useLocationContext, hasCountyContext } from "@/hooks/useLocationContext";
import { CountyRequiredGate } from "@/components/CountyRequiredGate";
import { useLocation } from "wouter";
import { OutcomeConfirmationCard } from "@/components/OutcomeConfirmationCard";
import { CommunityPostCard } from "@/components/community/CommunityPostCard";
import { toCommunityPostCardData } from "@/components/community/communityPostCardAdapter";
import { buildCommunityRoutedDestination } from "@/components/community/communityRouting";
import { stripCountySuffix } from "@/lib/userFacingCopy";
import {
  ContactOutcomeModal,
  type ContactOutcome,
} from "@/components/community/ContactOutcomeModal";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { buildCommunityPostPath, normalizeCommunityPostId } from "@shared/communityPostShare";

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
        description: "Switch back to Near me to comment on posts.",
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
      {!readOnly ? (
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
      ) : null}

      <div className="space-y-2">
        {isLoading ? (
          <p className="text-[11px] text-white/60">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-[11px] text-white/60">
            {readOnly ? "No comments yet." : "No comments yet. Be the first to reply."}
          </p>
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

type CommunityStats = {
  totalMembers: number;
  activeToday: number;
  postsToday: number;
  countiesActive: number;
  helpRequests7d: number;
  recommendations7d: number;
  verifiedPros: number;
  medianFirstReplyMinutes7d: number | null;
};

const CommunityFeed = memo(function CommunityFeed() {
  type FeedTab = "forYou" | "recent" | "vault";
  const [activeTab, setActiveTab] = useState<FeedTab>("forYou");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
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
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocationContext();

  const stateCode = location.stateCode as string | undefined;
  const countyFips = location.countyFips as string | undefined;
  const countyCommitted = hasCountyContext(location);
  const areaName = stripCountySuffix(location.countyName) || "Near you";

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
  const legacySharedPostId = normalizeCommunityPostId(queryParams.get("post"));
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

  useEffect(() => {
    const postPath = buildCommunityPostPath(legacySharedPostId);
    if (postPath) navigate(postPath, { replace: true });
  }, [legacySharedPostId, navigate]);

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
  const handleCommunityView = (newScope: "local" | "global", nextFeed: FeedTab) => {
    setActiveTab(nextFeed);
    const nextParams = new URLSearchParams(queryParams);
    nextParams.set("geo", newScope);
    nextParams.set("feed", nextFeed);
    // Remove ambiguous legacy key to prevent feed/scope collisions.
    if (nextParams.get("scope") === "local" || nextParams.get("scope") === "global") {
      nextParams.delete("scope");
    }
    const nextSearch = `?${nextParams.toString()}`;
    setSearchState(nextSearch);
    navigate(`${currentPath}${nextSearch}`);
  };

  const startCommunityRoute = (category: string) => {
    const nextParams = new URLSearchParams(queryParams);
    nextParams.set("geo", "local");
    nextParams.set("feed", "forYou");
    nextParams.set("compose", "1");
    nextParams.set("category", category);
    nextParams.delete("scope");
    const destination = `${currentPath}?${nextParams.toString()}`;

    if (!isAuthenticated) {
      navigate(`/login?next=${encodeURIComponent(destination)}`);
      return;
    }

    if (isGlobalView) {
      navigate(destination);
      return;
    }

    setSelectedCategory(category);
    setIsComposerOpen(true);
    window.setTimeout(() => composerRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated && activeTab === "vault") {
      handleCommunityView("local", "forYou");
    }
  }, [activeTab, authLoading, isAuthenticated]);

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
  const {
    data: postsData,
    isLoading: postsLoading,
    isError: postsError,
    refetch: refetchPosts,
  } = useQuery<Post[]>({
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
    onSuccess: (created: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
      setNewPostContent("");
      setUploadedImages([]);
      setSelectedCategory("general");
      setIsComposerOpen(false);
      setLastCreatedPostId(created?.id ?? null);

      const routedDestination = buildCommunityRoutedDestination({
        category: variables.category,
        postId: String(created?.id || ""),
        content: variables.content,
        countyFips,
        countyName: location.countyName,
      });
      if (variables.category === "request" && routedDestination) {
        toast({
          title: "Posted",
          description: "Add a few details so TradeScout can help you find the right people.",
        });
        navigate(routedDestination);
        return;
      }

      if (variables.category === "forsale" && routedDestination) {
        toast({
          title: "Posted",
          description: "Add the listing details so interested buyers know what to expect.",
        });
        navigate(routedDestination);
        return;
      }

      toast({
        title: "Posted",
        description: "Your post is now visible to people near you.",
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
        description: "Switch back to Near me to create a post.",
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
        description: "Switch back to Near me to like or comment on posts.",
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
        description: "Switch back to Near me to save posts.",
        variant: "destructive",
      });
      return;
    }
    savePostMutation.mutate(postId);
  };

  // Use real posts from API, with sample posts as fallback
  const activePostsSource = postsData;
  const posts = activePostsSource || [];

  const { data: trendingTopicsData } = useQuery<TrendingTopic[]>({
    queryKey: [
      "/api/community/trending",
      isGlobalView ? "global" : "county",
      stateCode,
      countyFips,
    ],
    enabled: countyCommitted,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (!isGlobalView && stateCode) params.set("stateCode", stateCode);
      if (!isGlobalView && countyFips) params.set("countyFips", countyFips);
      params.set("limit", "10");

      const response = await fetch(`/api/community/trending?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch trending topics");
      return response.json();
    },
  });

  const trendingTopics: TrendingTopic[] = Array.isArray(trendingTopicsData)
    ? trendingTopicsData
    : [];

  const { data: communityStats } = useQuery<CommunityStats>({
    queryKey: ["/api/community/stats", isGlobalView ? "global" : "county", stateCode, countyFips],
    enabled: isGlobalView || countyCommitted,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (!isGlobalView && stateCode) params.set("stateCode", stateCode);
      if (!isGlobalView && countyFips) params.set("countyFips", countyFips);
      const response = await fetch(`/api/community/stats?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch community stats");
      return response.json();
    },
    staleTime: 60_000,
  });

  function getAuthorName(post: any) {
    const welcomeTitleName = /^welcome\s+(.+)$/i.exec(String(post.title || "").trim())?.[1];
    return (
      post.author?.name ||
      [post.author?.firstName, post.author?.lastName].filter(Boolean).join(" ") ||
      post.author?.username ||
      welcomeTitleName ||
      "Community Member"
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
    const category = params.get("category");

    if (compose === "1") {
      setIsComposerOpen(true);
      if (prefill) setNewPostContent(prefill);
      if (
        category &&
        [
          "general",
          "question",
          "recommendation",
          "event",
          "tip",
          "request",
          "alert",
          "forsale",
        ].includes(category)
      ) {
        setSelectedCategory(category);
      }
      window.setTimeout(() => composerRef.current?.focus(), 0);
    }
  }, [route]);

  const seededPrompts: string[] = [
    "Can anyone recommend a reliable electrician?",
    "I'm looking for someone to repair a fence.",
    "Has anyone used an HVAC company they would recommend?",
    "Where do you buy quality deck materials nearby?",
    "Who has done good bathroom remodeling work?",
  ];

  const welcomePosts = useMemo(
    () => posts.filter((post: any) => post.feedKind === "onboarding_welcome"),
    [posts]
  );
  const displayPosts: any[] = useMemo(
    () => posts.filter((post: any) => post.feedKind !== "onboarding_welcome"),
    [posts]
  );
  const openCommunityNeeds = useMemo(
    () =>
      displayPosts
        .filter((post: any) => {
          const category = String(post?.category || "").toLowerCase();
          const tags = Array.isArray(post?.tags)
            ? post.tags.map((tag: unknown) => String(tag).toLowerCase())
            : [];
          return (
            ["request", "question", "questions", "project", "projects"].includes(category) ||
            tags.includes("request") ||
            tags.includes("question")
          );
        })
        .slice(0, 4),
    [displayPosts]
  );
  const hasUserPosts = displayPosts.length > 0;
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

  const formatCommunityPostTime = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleDateString();
  };

  const handleTogglePostComments = (postId: string) => {
    if (isGlobalView) {
      setOpenCommentsForPostId((current) => (current === postId ? null : postId));
      return;
    }
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to discuss community posts.",
        variant: "destructive",
      });
      return;
    }
    setOpenCommentsForPostId((current) => (current === postId ? null : postId));
  };

  const renderFeedList = () => (
    <div className="ts-community-stream space-y-3 md:space-y-5" data-testid="community-feed-stream">
      {postsLoading ? (
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-ts-orange/30"></div>
          <p className="mt-3 text-sm text-[color:var(--text-secondary)]">
            Checking what&apos;s new nearby...
          </p>
        </div>
      ) : postsError ? (
        <Card className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
          <CardContent className="p-6 text-center md:p-8">
            <h3 className="text-lg font-semibold text-white md:text-xl">That didn&apos;t load</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--text-secondary)]">
              Your community is still here. Let&apos;s try loading it again.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => void refetchPosts()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : tabSortedPosts.length === 0 ? (
        <Card className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
          <CardContent className="p-6 md:p-8 text-center">
            <h3 className="text-lg md:text-xl font-semibold text-white">
              {isGlobalView ? "No useful public posts yet" : "You're here early"}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--text-secondary)]">
              {isGlobalView
                ? "Questions, recommendations, events, and useful updates from other communities will appear here."
                : "People near you are just getting started. Ask the first question, share a recommendation, or post something useful."}
            </p>
            {!isGlobalView ? (
              <Button
                className="mt-4"
                onClick={() => {
                  setIsComposerOpen(true);
                  window.setTimeout(() => {
                    composerRef.current?.focus();
                    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }, 0);
                }}
              >
                Start the conversation
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <>
          {tabSortedPosts.map((post: any) => {
            const authorId = String(post.author?.id || "").trim();
            const canonicalProfileUrl = authorId
              ? String(connectionByUserId.get(authorId)?.canonicalProfileUrl || "").trim() ||
                undefined
              : undefined;
            const cardPost = toCommunityPostCardData(post, { canonicalProfileUrl });

            return (
              <CommunityPostCard
                key={cardPost.id}
                post={cardPost}
                readOnly={isGlobalView}
                formatTimeAgo={formatCommunityPostTime}
                onLike={handleLikePost}
                onSave={handleToggleSavePost}
                onComment={handleTogglePostComments}
                onShare={handleSharePost}
                onTagSelect={setActiveTopic}
                onStartRequest={(selected) =>
                  handleOpenDirectConnectForCommunityMember(
                    selected.author?.id,
                    selected.author?.name
                  )
                }
                onRequestConnection={handleRequestCommunityMemberConnection}
                commentsOpen={openCommentsForPostId === cardPost.id}
                commentsSlot={<CommunityComments postId={cardPost.id} readOnly={isGlobalView} />}
              />
            );
          })}
          {!isGlobalView && tabSortedPosts.length < 3 ? (
            <section className="ts-community-endcap rounded-xl border border-dashed border-white/[0.09] px-5 py-6 text-center">
              <p className="text-sm font-semibold text-white/78">
                That&apos;s everything near {areaName}.
              </p>
              <button
                type="button"
                onClick={() => handleCommunityView("global", "forYou")}
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-ts-orange"
              >
                <Globe className="h-4 w-4" />
                Browse all communities
              </button>
            </section>
          ) : null}
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

  const handleSharePost = async (post: any) => {
    try {
      await share({
        path: buildCommunityPostPath(post.id),
        title: post.title || "TradeScout community post",
        text: (post.content || "").toString(),
        contextLabel: "Post link",
        kind: "community_post",
        imageUrl: Array.isArray(post.imageUrls)
          ? post.imageUrls[0]
          : Array.isArray(post.images)
            ? post.images[0]
            : undefined,
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

  const structuredData = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollectionPage",
          name: "TradeScout Community",
          description:
            "Community posts, recommendations, project updates, and events from people nearby.",
          url: "https://www.thetradescout.com/community-feed",
        },
        createBreadcrumbStructuredData([
          { name: "TradeScout", url: "/" },
          { name: "Community", url: "/community-feed" },
        ]),
      ],
    }),
    []
  );

  return (
    <>
      <SEOHelmet
        title="TradeScout Community | Questions, Recommendations, and Nearby Activity"
        description="Ask questions, share updates, recommend people you trust, and keep up with what is happening nearby on TradeScout Community."
        keywords="tradescout community, nearby community feed, neighborhood activity, ask neighbors online, community updates"
        canonical="https://www.thetradescout.com/community-feed"
        structuredData={structuredData}
      />
      <div className="community-feed-page ts-community-workshop">
        <CountyRequiredGate locationOverride={location} allowBypass={isGlobalView}>
          <div className="ts-community-workshop__inner mx-auto w-full max-w-[1180px] overflow-x-hidden px-3 pb-5 pt-2 sm:px-4 md:px-6 md:pb-8 md:pt-5">
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
                        Showing posts about this topic in the area you are viewing.
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
                      <div className="space-y-1 text-sm text-white/60">
                        <p className="font-medium text-white">You&apos;re early to this topic</p>
                        <p>No one has posted about it yet. You can start the conversation.</p>
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

            <header
              className="ts-community-heading mb-3 flex items-center justify-between gap-3 border-b border-white/[0.08] px-1 pb-3 pt-1 md:mb-4 md:pb-4"
              data-testid="community-feed-heading"
            >
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-[-0.025em] text-white md:text-3xl">
                  Community
                </h1>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-white/45">
                  {isGlobalView ? (
                    <Globe className="h-3 w-3 text-ts-orange" />
                  ) : (
                    <MapPin className="h-3 w-3 text-ts-orange" />
                  )}
                  {isGlobalView
                    ? "Explore · Browse only"
                    : activeTab === "vault"
                      ? "Saved posts"
                      : activeTab === "recent"
                        ? `Newest near ${areaName}`
                        : areaName}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!isGlobalView ? (
                  <Button
                    type="button"
                    size="sm"
                    className="ts-community-create-action min-h-11 bg-ts-orange font-semibold text-black hover:bg-ts-orange-dark"
                    onClick={() => {
                      if (!isAuthenticated) {
                        const next = `${currentPath}?compose=1`;
                        navigate(`/login?next=${encodeURIComponent(next)}`);
                        return;
                      }
                      setIsComposerOpen(true);
                      window.setTimeout(() => composerRef.current?.focus(), 0);
                    }}
                  >
                    {isAuthenticated ? "Create post" : "Sign in to post"}
                  </Button>
                ) : null}
              </div>
            </header>
            <nav
              className="ts-community-viewbar mb-3 flex flex-nowrap items-center gap-1.5 overflow-x-auto border-b border-white/[0.07] pb-2"
              aria-label="Community feed views"
              data-testid="community-feed-view-controls"
            >
              <button
                type="button"
                onClick={() => handleCommunityView("local", "forYou")}
                aria-pressed={!isGlobalView}
                className="ts-community-viewbar__item"
              >
                <MapPin className="h-3.5 w-3.5" />
                Near me
              </button>
              <button
                type="button"
                onClick={() => handleCommunityView("global", "forYou")}
                aria-pressed={isGlobalView}
                className="ts-community-viewbar__item"
              >
                <Globe className="h-3.5 w-3.5" />
                Explore
              </button>
              <span className="ts-community-viewbar__divider mx-1 hidden h-5 w-px shrink-0 bg-white/[0.08] sm:block" />
              <button
                type="button"
                onClick={() => handleCommunityView(isGlobalView ? "global" : "local", "forYou")}
                aria-pressed={activeTab === "forYou"}
                className="ts-community-viewbar__item"
              >
                For you
              </button>
              <button
                type="button"
                onClick={() => handleCommunityView(isGlobalView ? "global" : "local", "recent")}
                aria-pressed={activeTab === "recent"}
                className="ts-community-viewbar__item"
              >
                Newest
              </button>
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => handleCommunityView("local", "vault")}
                  aria-pressed={activeTab === "vault"}
                  className="ts-community-viewbar__item"
                >
                  Saved
                </button>
              ) : null}
            </nav>

            <details
              className="ts-community-start-actions group mb-3 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]"
              data-testid="community-start-actions"
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-left [&::-webkit-details-marker]:hidden sm:px-4">
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-white">More ways to start</span>
                  <span className="mt-0.5 block text-[10px] text-white/42">
                    Find help, ask, recommend, alert people, or sell something.
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-ts-orange transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-white/[0.06] px-2 py-2 sm:px-3">
                <div className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {[
                    {
                      key: "request",
                      label: "Find help",
                      detail: "Turn a need into action",
                      icon: Wrench,
                    },
                    {
                      key: "question",
                      label: "Ask a question",
                      detail: "Get useful answers",
                      icon: HelpCircle,
                    },
                    {
                      key: "recommendation",
                      label: "Recommend",
                      detail: "Share who delivered",
                      icon: Award,
                    },
                    {
                      key: "alert",
                      label: "Share an alert",
                      detail: "Help people prepare",
                      icon: AlertTriangle,
                    },
                    {
                      key: "forsale",
                      label: "Sell something",
                      detail: "Reach interested buyers",
                      icon: DollarSign,
                    },
                  ].map(({ key, label, detail, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => startCommunityRoute(key)}
                      className="group flex min-w-0 items-center gap-2.5 rounded-lg border border-transparent bg-transparent px-2.5 py-2 text-left transition hover:border-ts-orange/30 hover:bg-ts-orange/[0.07]"
                      data-testid={`community-route-${key}`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.055] text-ts-orange transition group-hover:bg-ts-orange/15">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-white">{label}</span>
                        <span className="mt-0.5 block text-[10px] leading-4 text-white/38">
                          {detail}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-2 border-t border-white/[0.06] px-1 pt-2 text-[10px] text-white/38">
                  Your contact details stay private until you choose to connect.
                </div>
              </div>
            </details>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-8">
              {/* Main Feed */}
              <div className="min-w-0 space-y-3 md:space-y-4" data-testid="community-feed-column">
                <div className="flex items-end justify-between gap-3 px-1">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/38">
                      {isGlobalView ? "Across TradeScout" : "Near you"}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-white">
                      {activeTab === "recent" ? "Newest posts" : "What people are sharing"}
                    </h2>
                  </div>
                </div>
                {!isGlobalView && isComposerOpen ? (
                  <Card className="ts-community-composer mb-5 overflow-hidden border border-white/[0.09] bg-white/[0.035] shadow-none md:sticky md:top-16">
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
                                {selectedCategory === "request"
                                  ? "Describe what you need"
                                  : selectedCategory === "forsale"
                                    ? "Start a listing"
                                    : "Share with your community"}
                              </div>
                              <div className="ts-community-composer__hint text-xs text-white/55">
                                {selectedCategory === "request"
                                  ? "Share the need, then add a few details so TradeScout can help you find the right people."
                                  : selectedCategory === "forsale"
                                    ? "Share it, then add price, condition, and pickup details."
                                    : "Share something useful with people near you."}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsComposerOpen(false)}
                              className="shrink-0 text-xs font-medium text-white/48 transition hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                          <Textarea
                            ref={composerRef}
                            placeholder={
                              selectedCategory === "request"
                                ? "What needs to be done? Include where, when, and any useful details."
                                : selectedCategory === "question"
                                  ? "What would you like to ask your neighbors?"
                                  : selectedCategory === "forsale"
                                    ? "What are you selling? Add the price, condition, and pickup area."
                                    : selectedCategory === "alert"
                                      ? "What happened, and where?"
                                      : selectedCategory === "event"
                                        ? "What is the event, and when and where is it?"
                                        : "Share an update with your neighbors."
                            }
                            value={newPostContent}
                            onChange={(e) => setNewPostContent(e.target.value)}
                            rows={3}
                            className="ts-community-composer__input min-h-[104px] rounded-xl border-white/[0.08] bg-black/25 text-sm text-white placeholder:text-white/42 focus-visible:ring-ts-orange/45"
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
                          <div className="ts-community-composer__types -mx-0.5 flex gap-1.5 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
                            {[
                              {
                                key: "general",
                                label: "Update",
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
                                label: "Recommendation",
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
                                label: "Find help",
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
                                intent: "Sell something",
                              },
                            ].map(({ key, label, icon: Icon, intent }) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => setSelectedCategory(key)}
                                title={intent}
                                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-xs font-medium transition-all md:rounded-md md:px-2.5 md:py-1 ${
                                  selectedCategory === key
                                    ? "border border-white/18 bg-white/12 text-white"
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
                                <span>Not sure what to write?</span>
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

                          <div className="ts-community-composer__actions flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center pt-1">
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
                              className="ts-community-submit-action min-h-11 w-full rounded-xl bg-ts-orange text-sm font-bold text-black hover:bg-ts-orange-dark sm:w-auto md:min-h-0"
                              onClick={handleCreatePost}
                              disabled={!newPostContent.trim() || createPostMutation.isPending}
                              data-testid="button-submit-post"
                            >
                              {createPostMutation.isPending
                                ? "Posting..."
                                : selectedCategory === "request"
                                  ? "Continue"
                                  : selectedCategory === "forsale"
                                    ? "Continue"
                                    : "Post"}
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

                {renderFeedList()}
              </div>

              <aside className="ts-community-rail space-y-4">
                <section className="ts-community-context-card rounded-xl border border-white/[0.07]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ts-orange">
                    {isGlobalView ? "Explore" : "Around you"}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-white">
                    {isGlobalView ? "See what people are sharing" : areaName}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-white/55">
                    {isGlobalView
                      ? "Read useful posts from other communities. Come back to Near me when you want to join in."
                      : "See what people need, who they recommend, and what is happening nearby."}
                  </p>
                  {isGlobalView ? (
                    <button
                      type="button"
                      onClick={() => handleCommunityView("local", "forYou")}
                      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ts-orange"
                    >
                      <MapPin className="h-4 w-4" />
                      Back to Near me
                    </button>
                  ) : !isAuthenticated ? (
                    <button
                      type="button"
                      onClick={() => {
                        const next = `${currentPath}?compose=1`;
                        navigate(`/login?next=${encodeURIComponent(next)}`);
                      }}
                      className="mt-4 text-sm font-semibold text-ts-orange"
                    >
                      Sign in to join the conversation
                    </button>
                  ) : null}
                </section>

                {!isGlobalView && communityStats ? (
                  <section
                    className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"
                    data-testid="community-county-pulse"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/42">
                          This week
                        </p>
                        <h3 className="mt-1 text-sm font-semibold text-white">At a glance</h3>
                      </div>
                      <span className="rounded-full border border-ts-orange/25 bg-ts-orange/10 px-2 py-1 text-[10px] text-ts-orange">
                        Live data
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.06]">
                      {[
                        ["Help wanted", communityStats.helpRequests7d],
                        ["Recommendations", communityStats.recommendations7d],
                        ["Verified businesses", communityStats.verifiedPros],
                        [
                          "Typical first reply",
                          communityStats.medianFirstReplyMinutes7d == null
                            ? "No replies yet"
                            : communityStats.medianFirstReplyMinutes7d < 60
                              ? `${Math.round(communityStats.medianFirstReplyMinutes7d)} min`
                              : `${Math.round(communityStats.medianFirstReplyMinutes7d / 60)} hr`,
                        ],
                      ].map(([label, value]) => (
                        <div
                          key={String(label)}
                          className="bg-[color:var(--surface-app-bg)] px-3 py-2.5"
                        >
                          <dt className="text-[10px] leading-4 text-white/38">{label}</dt>
                          <dd className="mt-0.5 text-sm font-semibold text-white/82">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ) : null}

                {openCommunityNeeds.length > 0 ? (
                  <section className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/48">
                        People need help with
                      </h3>
                      <span className="text-xs font-semibold text-ts-orange">
                        {openCommunityNeeds.length}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {openCommunityNeeds.map((post: any) => (
                        <button
                          key={`need-${post.id}`}
                          type="button"
                          onClick={() => {
                            const element = document.querySelector(
                              `[data-post-id="${CSS.escape(String(post.id))}"]`
                            ) as HTMLElement | null;
                            element?.scrollIntoView({ behavior: "smooth", block: "center" });
                          }}
                          className="block w-full rounded-lg border border-white/[0.06] bg-black/15 px-3 py-2.5 text-left transition hover:border-ts-orange/35 hover:bg-ts-orange/[0.06]"
                        >
                          <span className="block line-clamp-2 text-xs font-medium leading-5 text-white/75">
                            {String(post.title || post.content || "Help wanted").slice(0, 110)}
                          </span>
                          <span className="mt-1 block text-[10px] text-white/35">
                            {getAuthorName(post)} · {formatCommunityPostTime(post.createdAt)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                {welcomePosts.length > 0 ? (
                  <section className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/48">
                      New neighbors
                    </h3>
                    <div className="mt-3 space-y-2.5">
                      {welcomePosts.slice(0, 5).map((post: any) => (
                        <div
                          key={post.id}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="truncate font-medium text-white/78">
                            {getAuthorName(post)}
                          </span>
                          <span className="shrink-0 text-xs text-white/38">
                            {formatCommunityPostTime(post.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {!isGlobalView && activeConnections.length > 0 ? (
                  <section className="border-b border-white/[0.07] pb-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
                        Your active connections
                      </h2>
                      <span className="text-xs text-white/38">
                        {connectionActivityData?.activeNowCount ?? activeConnections.length}
                      </span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-1 xl:flex-wrap xl:overflow-visible">
                      {activeConnections.slice(0, 8).map((neighbor) => {
                        const name =
                          [neighbor.firstName, neighbor.lastName].filter(Boolean).join(" ") ||
                          "Connection";

                        return (
                          <DropdownMenu key={neighbor.id}>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="group flex w-12 shrink-0 flex-col items-center gap-1.5"
                                title={`${name} actions`}
                                aria-label={`Open actions for ${name}`}
                              >
                                <div className="relative">
                                  <Avatar className="h-10 w-10 ring-1 ring-white/10 transition group-hover:ring-ts-orange/70">
                                    <AvatarImage src={neighbor.profileImageUrl ?? undefined} />
                                    <AvatarFallback className="bg-[color:var(--surface-intermediate)]">
                                      <TradeScoutLogo
                                        size="sm"
                                        className="h-7 w-7 bg-transparent ring-0"
                                      />
                                    </AvatarFallback>
                                  </Avatar>
                                  {neighbor.isActiveNow ? (
                                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[color:var(--ts-bg)]" />
                                  ) : null}
                                </div>
                                <span className="w-full truncate text-center text-[10px] text-white/48 group-hover:text-white/75">
                                  {String(neighbor.firstName || name).split(" ")[0]}
                                </span>
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
                  </section>
                ) : null}
                {trendingTopics.length > 0 && (
                  <Card className="border border-white/[0.07] bg-transparent shadow-none">
                    <CardHeader className="pb-1.5">
                      <CardTitle className="text-sm text-white">Topics</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {trendingTopics.slice(0, 6).map((topic) => (
                        <button
                          key={topic.tag}
                          type="button"
                          onClick={() => setActiveTopic(topic.tag)}
                          className="inline-flex items-center rounded-full border border-ts-orange/30 bg-ts-orange/10 px-2.5 py-1 text-[11px] text-ts-orange"
                        >
                          #{topic.tag}
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </aside>
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
