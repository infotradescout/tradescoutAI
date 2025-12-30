import { memo, useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Zap, TrendingUp, MoreHorizontal, Image, Video, Calendar, Compass, Users2, Crown, Award, Flag, Plus, SlidersHorizontal, Trophy, BarChart3, Share, Target, Heart, Send, Tag, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';
import { share } from "@/utils/share";
import { apiRequest } from '@/lib/queryClient';
import { TradeScoutIcon } from '@/components/TradeScoutIcons';
import { useLocationContext, hasCountyContext } from '@/hooks/useLocationContext';
import { CountyRequiredGate } from '@/components/CountyRequiredGate';
import { useLocation } from 'wouter';
import { COMMUNITY_TONE } from '../../../shared/communityLanguage';
import { OutcomeConfirmationCard } from '@/components/OutcomeConfirmationCard';
import { CommunityTopNav } from '@/components/community/CommunityTopNav';
import { CommunitySnapshotRail } from '@/components/community/CommunitySnapshotRail';

interface Post {
  id: string;
  title?: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string | null;
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
  };
  createdAt: string;
}

function CommunityComments({ postId }: { postId: string }) {
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
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to post comment (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      setContent("");
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
          <p className="text-[11px] text-slate-500">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-[11px] text-slate-500">No comments yet. Be the first to reply.</p>
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
                <p className="font-medium text-slate-100 mb-0.5 text-[11px] md:text-xs">
                  {comment.author?.name || "Neighbor"}
                </p>
                <p className="text-slate-200 text-[11px] md:text-xs whitespace-pre-line">
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
};

type TrendingTopic = {
  tag: string;
  posts?: number;
  source?: 'community' | 'news';
};

const CommunityFeed = memo(function CommunityFeed() {
  const [activeTab, setActiveTab] = useState("forYou");
  const [newPostContent, setNewPostContent] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [openCommentsForPostId, setOpenCommentsForPostId] = useState<string | null>(null);
  const [lastCreatedPostId, setLastCreatedPostId] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const [route, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { unreadCount } = useNotifications();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocationContext();

  const stateCode = location.stateCode as string | undefined;
  const countyFips = location.countyFips as string | undefined;
  const countyCommitted = hasCountyContext(location);

  // Read scope from query params (driven by CommunityTopNav)
  const scopeFromRoute = useMemo(() => {
    if (!route) return null;
    const idx = route.indexOf("?");
    if (idx === -1) return null;
    const search = route.slice(idx + 1);
    const params = new URLSearchParams(search);
    return params.get("scope");
  }, [route]);

  const effectiveScope = (scopeFromRoute as string | null) || "county";

  // Fetch posts from the API scoped to the user's county and nav scope
  const { data: postsData, isLoading: postsLoading } = useQuery<Post[]>({
    queryKey: [
      '/api/community/posts',
      stateCode,
      countyFips,
      effectiveScope,
    ],
    enabled: countyCommitted,
    queryFn: async () => {
      const params = new URLSearchParams({
        scope: effectiveScope,
        stateCode: stateCode!,
        countyFips: countyFips!,
        limit: '20',
        offset: '0',
      });

      const response = await fetch(`/api/community/posts?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch posts');
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

  const isSuperAdmin = Boolean((user as any)?.isSuperAdmin);

  const { data: globalPostsData, isLoading: globalPostsLoading } = useQuery<Post[]>({
    queryKey: [
      "/api/community/posts",
      "global",
    ],
    enabled: isSuperAdmin && activeTab === "all",
    queryFn: async () => {
      const params = new URLSearchParams({
        scope: "all",
        limit: "50",
        offset: "0",
      });

      const response = await fetch(`/api/community/posts?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch posts");
      return response.json();
    },
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async (postData: { content: string; title?: string }) => {
      return apiRequest('POST', '/api/community/posts', {
        content: postData.content,
        title: postData.title,
        category: 'general',
      });
    },
    onSuccess: (created: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/posts'] });
      setNewPostContent('');
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
    }
  });

  // Like post mutation
  const likePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      return apiRequest('POST', `/api/community/posts/${postId}/like`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/posts', stateCode, countyFips] });
    }
  });

  const handleCreatePost = () => {
    if (!newPostContent.trim()) return;
    createPostMutation.mutate({ content: newPostContent });
  };

  const handleLikePost = (postId: string) => {
    likePostMutation.mutate(postId);
  };

  // Use real posts from API, with sample posts as fallback
  const activePostsSource = isSuperAdmin && activeTab === "all" ? globalPostsData : postsData;
  const posts = activePostsSource || [];

  const { data: communityStatsData } = useQuery<CommunityStats>({
    queryKey: ['/api/community/stats'],
    queryFn: async () => {
      const response = await fetch('/api/community/stats');
      if (!response.ok) throw new Error('Failed to fetch community stats');
      return response.json();
    },
  });

  const { data: trendingTopicsData } = useQuery<TrendingTopic[]>({
    queryKey: ['/api/community/trending', stateCode, countyFips],
    enabled: countyCommitted,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (stateCode) params.set('stateCode', stateCode);
      if (countyFips) params.set('countyFips', countyFips);
      params.set('limit', '10');

      const response = await fetch(`/api/community/trending?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch trending topics');
      return response.json();
    },
  });

  const communityStats: CommunityStats = communityStatsData ?? {
    totalMembers: 0,
    activeToday: 0,
    postsToday: 0,
    countiesActive: 0,
  };

  const trendingTopics: TrendingTopic[] = Array.isArray(trendingTopicsData) ? trendingTopicsData : [];

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
    "Who's the best electrician in the county?",
    "Any contractors to avoid right now?",
    "Has anyone used TradeScout invoices yet?",
    "What's the biggest issue in our HOA right now?",
    "Who would you recommend for a small remodel?",
  ];

  const systemPosts: Post[] = [
    {
      id: 'system-question-model',
      title: 'Who do you actually trust?',
      content:
        "Who do you actually trust to do good work around here?\n\n" +
        "Not the biggest company. Not the loudest ad.\n" +
        "The people your neighbors would recommend without being asked.\n\n" +
        "Ask real questions here. Share real experiences.\n" +
        "This feed works because it reflects what’s actually happening in your community — not paid placements.",
      author: {
        id: 'system-scout',
        name: 'Scout',
        avatar: undefined,
        email: null,
        role: 'System',
        verified: false,
      },
      category: 'system',
      location: 'Your county',
      createdAt: new Date().toISOString(),
      tags: ['system-update', 'question-model'],
      upvotes: 0,
      downvotes: 0,
      comments: 0,
      pinned: true,
      trending: false,
      imageUrls: [],
    },
    {
      id: 'system-recommendation-model',
      title: 'How recommendations work here',
      content:
        "Recommendations here aren’t stars — they’re accountability.\n\n" +
        `When someone is recommended on TradeScout, that endorsement is ${COMMUNITY_TONE.accountability}, and attached to real people in your community.\n\n` +
        "Good work gets repeated. Bad work doesn’t hide.\n" +
        "That’s how communities used to work — we just made it transparent again.",
      author: {
        id: 'system-scout',
        name: 'Scout',
        avatar: undefined,
        email: null,
        role: 'System',
        verified: false,
      },
      category: 'system',
      location: 'Your county',
      createdAt: new Date().toISOString(),
      tags: ['system-update', 'recommendation-model'],
      upvotes: 0,
      downvotes: 0,
      comments: 0,
      pinned: false,
      trending: false,
      imageUrls: [],
    },
    {
      id: 'system-project-model',
      title: 'How projects stay local',
      content:
        "Every project here stays local by default.\n\n" +
        "Whether it’s a repair, a remodel, or a service request, TradeScout routes opportunity through your community first — contractors, suppliers, and partners who already operate here.\n\n" +
        "Fewer middlemen. Less leakage.\n" +
        "More money circulating where the work actually happens.",
      author: {
        id: 'system-scout',
        name: 'Scout',
        avatar: undefined,
        email: null,
        role: 'System',
        verified: false,
      },
      category: 'system',
      location: 'Your county',
      createdAt: new Date().toISOString(),
      tags: ['system-update', 'project-model'],
      upvotes: 0,
      downvotes: 0,
      comments: 0,
      pinned: false,
      trending: false,
      imageUrls: [],
    },
    {
      id: 'system-governance-model',
      title: 'What transparency makes possible',
      content:
        "Some things shouldn’t happen behind closed doors.\n\n" +
        "TradeScout gives neighborhoods real tools to manage projects, shared spaces, funds, and decisions — with visibility for everyone involved.\n\n" +
        "That transparency applies whether it’s a neighborhood group, a community builder, or a local initiative.\n\n" +
        "When everyone can see what’s happening, trust becomes the default.",
      author: {
        id: 'system-scout',
        name: 'Scout',
        avatar: undefined,
        email: null,
        role: 'System',
        verified: false,
      },
      category: 'system',
      location: 'Your county',
      createdAt: new Date().toISOString(),
      tags: ['system-update', 'governance-model'],
      upvotes: 0,
      downvotes: 0,
      comments: 0,
      pinned: false,
      trending: false,
      imageUrls: [],
    },
  ];

  const hasUserPosts = Array.isArray(posts) && posts.length > 0;
  const displayPosts: any[] = hasUserPosts ? posts : systemPosts;

  const handlePromptClick = (prompt: string) => {
    setNewPostContent(prompt);
    if (composerRef.current) {
      composerRef.current.focus();
    }
  };

  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case 'project_showcase':
        return <Crown className="h-4 w-4 text-yellow-400" />;
      case 'recommendation_request':
        return <MessageSquare className="h-4 w-4 text-orange-400" />;
      case 'promotion':
        return <TrendingUp className="h-4 w-4 text-green-400" />;
      case 'community_highlight':
        return <Trophy className="h-4 w-4 text-orange-400" />;
      case 'discussion':
        return <MessageSquare className="h-4 w-4 text-orange-400" />;
      case 'poll':
        return <BarChart3 className="h-4 w-4 text-purple-400" />;
      case 'announcement':
        return <Flag className="h-4 w-4 text-red-400" />;
      default:
        return <MessageSquare className="h-4 w-4 text-gray-400" />;
    }
  };

  const getPostTypeLabel = (type: string) => {
    switch (type) {
      case 'project_showcase':
        return 'Project Showcase';
      case 'recommendation_request':
        return 'Looking for Help';
      case 'promotion':
        return 'Exclusive TradeDeal';
      case 'community_highlight':
        return 'Community Highlight';
      case 'service_available':
        return 'Available for Work';
      case 'discussion':
        return 'Discussion';
      case 'poll':
        return 'Poll';
      case 'announcement':
        return 'Announcement';
      default:
        return 'Community Post';
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

  const snapshotProps = useMemo(() => ({
    membersCount: communityStats.totalMembers,
    activeToday: communityStats.activeToday,
    postsToday: communityStats.postsToday,
    countiesActive: communityStats.countiesActive,
    trendingTags: trendingTopics.map((t) => t.tag).slice(0, 3),
  }), [communityStats, trendingTopics]);

  return (
    <div className="w-full max-w-full overflow-x-hidden bg-slate-950">
      <CountyRequiredGate locationOverride={location}>
      <div className="mx-auto w-full max-w-5xl px-3 py-3 md:px-4 md:py-4 overflow-x-hidden">
        <CommunityTopNav />
        {/* 
          CommunitySnapshotRail owns populated + empty states.
          Do not add fallback Snapshot UI elsewhere.
          This is the single authority for Community Snapshot—data, layout, and CTAs.
        */}
        {countyFips && (
          <CommunitySnapshotRail
            countyFips={countyFips}
            limit={10}
            communityStats={communityStats}
            activeFilter={activeTab}
            onFilterChange={setActiveTab}
          />
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
          {/* Main Feed */}
          <div className="lg:col-span-2 space-y-3 md:space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* Inline composer always visible at top of feed */}
              <Card className="bg-[color:var(--surface-card)] border border-[color:var(--border-subtle)] shadow-sm mb-3 md:mb-5 md:sticky md:top-16">
                <CardContent className="p-3 md:p-5">
                  <div className="flex gap-4">
                    <Avatar className="w-10 h-10 md:w-11 md:h-11">
                      <AvatarImage src={user?.avatar as string | undefined} />
                      <AvatarFallback>
                        {(user?.username || user?.email || 'U').substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-3">
                      <Textarea
                        ref={composerRef}
                        placeholder="What's happening in your community today? Ask a question or share a project..."
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        rows={3}
                      />

                      {!hasUserPosts && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide">
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
                          <Button size="sm" variant="outline" className="border-[color:var(--border-subtle)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-intermediate)] hover:text-[color:var(--text-primary)]">
                            <Image className="h-4 w-4 mr-1" />
                            Photo
                          </Button>
                          <Button size="sm" variant="outline" className="border-[color:var(--border-subtle)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-intermediate)] hover:text-[color:var(--text-primary)]">
                            <Video className="h-4 w-4 mr-1" />
                            Video
                          </Button>
                          <Button size="sm" variant="outline" className="border-[color:var(--border-subtle)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-intermediate)] hover:text-[color:var(--text-primary)]">
                            <BarChart3 className="h-4 w-4 mr-1" />
                            Poll
                          </Button>
                        </div>

                        <Button
                          className="bg-orange-500 hover:bg-orange-600 shadow-md shadow-orange-500/25 w-full sm:w-auto"
                          onClick={handleCreatePost}
                          disabled={!newPostContent.trim() || createPostMutation.isPending}
                          data-testid="button-submit-post"
                        >
                          {createPostMutation.isPending ? 'Posting...' : 'Post'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

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
                <div className="space-y-3 md:space-y-5">
                  {postsLoading ? (
                    <div className="text-center py-12">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                      <p className="text-gray-400 mt-4">Loading posts...</p>
                    </div>
                  ) : (
                    <>
                      {displayPosts.map((post: any) => {
                        const isSystemPost = post.category === 'system';
                        const locationLabel = post.location || post.author?.location;

                        return (
                          <Card
                            key={post.id}
                            className={`rounded-2xl border border-[color:var(--border-subtle)] hover:border-[color:var(--border-active)] transition-colors shadow-sm hover:shadow-md hover:shadow-black/40 ${
                              isSystemPost
                                ? 'bg-[color:var(--surface-intermediate)]'
                                : 'bg-[color:var(--surface-card)]'
                            }`}
                            data-testid={`card-post-${post.id}`}
                          >
                            <CardContent className="p-3 md:p-5">
                              {/* Post Header */}
                              <div className="flex justify-between items-start mb-4">
                                <div className="flex gap-3">
                                  {isSystemPost ? (
                                    <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
                                      <TradeScoutIcon size="sm" variant="gradient" className="text-slate-950" />
                                    </div>
                                  ) : (
                                    <Avatar className="w-10 h-10 md:w-11 md:h-11">
                                      <AvatarImage src={post.author?.avatar} />
                                      <AvatarFallback>{(post.author?.name || user?.username || 'U').substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                  )}

                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h3 className="text-white font-semibold">
                                        {isSystemPost ? 'Scout' : post.author?.name || user?.username || 'Community Member'}
                                      </h3>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs md:text-sm text-slate-400 mt-1">
                                      <span>{post.timestamp || new Date(post.createdAt).toLocaleDateString()}</span>
                                      {locationLabel && (
                                        <>
                                          <span>•</span>
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
                                    <span className="text-xs text-gray-400">{getPostTypeLabel(post.type || post.postType)}</span>
                                  </div>

                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
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
                                  <h4 className="text-lg font-semibold text-white mb-2">{post.title}</h4>
                                )}
                                <p className="text-slate-200 mb-3 leading-relaxed whitespace-pre-line">{post.content}</p>

                                {Array.isArray(post.tags) && post.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-3">
                                    {post.tags.map((tag: string, index: number) => (
                                      <span key={index} className="text-orange-400 text-sm hover:text-orange-300 cursor-pointer">
                                        #{tag}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {Array.isArray(post.images) && post.images.length > 0 && (
                                  <div className="grid grid-cols-2 gap-2 mb-3">
                                    {post.images.map((image: string, index: number) => (
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
                                    className={`text-gray-400 hover:text-red-400 ${post.liked ? 'text-red-400' : ''}`}
                                    onClick={() => handleLikePost(post.id)}
                                    data-testid={`button-like-${post.id}`}
                                  >
                                    <Heart className={`h-4 w-4 mr-1 ${post.liked ? 'fill-current' : ''}`} />
                                    <span className="mr-1">Agree</span>
                                    {post.likeCount || post.likes || 0}
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-gray-400 hover:text-orange-400"
                                    data-testid={`button-comment-${post.id}`}
                                    onClick={() => {
                                      if (!isAuthenticated) {
                                        toast({
                                          title: 'Sign In Required',
                                          description: 'Please sign in to discuss community posts.',
                                          variant: 'destructive',
                                        });
                                        return;
                                      }
                                      setOpenCommentsForPostId((current) =>
                                        current === post.id ? null : post.id,
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
                                    className="text-gray-400 hover:text-green-400"
                                    onClick={() => handleSharePost(post)}
                                    data-testid={`button-share-${post.id}`}
                                  >
                                    <Share className="h-4 w-4 mr-1" />
                                    <span className="mr-1">Share</span>
                                    {post.shareCount || post.shares || 0}
                                  </Button>
                                </div>

                                {post.type === 'recommendation_request' && (
                                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                                    Recommend Someone
                                  </Button>
                                )}

                                {post.type === 'promotion' && (
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
                                  parts.push(`${agreeCount} ${agreeCount === 1 ? 'neighbor agrees' : 'neighbors agree'}`);
                                }
                                if (commentCount) {
                                  parts.push(`${commentCount} ${commentCount === 1 ? 'reply' : 'replies'}`);
                                }

                                return (
                                  <div className="mt-2 text-[11px] text-slate-400">
                                    {parts.join(' · ')}
                                  </div>
                                );
                              })()}

                              {/* Comment teaser row */}
                              <div className="mt-3 flex items-center gap-2">
                                <Avatar className="w-7 h-7">
                                  <AvatarImage src={user?.avatar as string | undefined} />
                                  <AvatarFallback>
                                    {(user?.username || user?.email || 'U').substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <button
                                  type="button"
                                  className="flex-1 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-input)] px-3 py-2 text-left text-xs md:text-sm text-[color:var(--text-secondary)] hover:border-[color:var(--border-active)] hover:bg-[color:var(--surface-intermediate)]"
                                  onClick={() => {
                                    if (!isAuthenticated) {
                                      toast({
                                        title: 'Sign In Required',
                                        description: 'Please sign in to comment on community posts.',
                                        variant: 'destructive',
                                      });
                                      return;
                                    }
                                    setOpenCommentsForPostId((current) =>
                                      current === post.id ? null : post.id,
                                    );
                                  }}
                                >
                                  Add a comment...
                                </button>
                              </div>

                              {openCommentsForPostId === post.id && (
                                <CommunityComments postId={post.id} />
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="recent" className="mt-0">
                <div className="text-center py-12">
                  <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-white text-xl mb-2">Recent activity</h3>
                  <p className="text-gray-400">Newest posts from your community</p>
                </div>
              </TabsContent>

              <TabsContent value="nearby" className="mt-0">
                <div className="text-center py-12">
                  <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-white text-xl mb-2">Nearby</h3>
                  <p className="text-gray-400">Posts from neighborhoods close to you</p>
                </div>
              </TabsContent>

              <TabsContent value="trending" className="mt-0">
                <div className="text-center py-12">
                  <Users2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-white text-xl mb-2">Trending</h3>
                  <p className="text-gray-400">Posts getting the most engagement right now</p>
                </div>
              </TabsContent>

              <TabsContent value="recs" className="mt-0">
                <div className="text-center py-12">
                  <Eye className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-white text-xl mb-2">Recommendations</h3>
                  <p className="text-gray-400">Trusted endorsements from your community</p>
                </div>
              </TabsContent>

              <TabsContent value="vault" className="mt-0">
                <div className="text-center py-12">
                  <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-white text-xl mb-2">Your Vault</h3>
                  <p className="text-gray-400">Saved posts and bookmarked content</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right column intentionally kept light so feed dominates */}
          <div className="lg:col-span-1 space-y-4" />
        </div>
      </div>
      </CountyRequiredGate>
    </div>
  );
});

export default CommunityFeed;