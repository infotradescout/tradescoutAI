import { memo, useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Zap, TrendingUp, MoreHorizontal, Image, Video, Calendar, Compass, Users2, Crown, Award, Flag, Plus, SlidersHorizontal, Trophy, BarChart3, Share, Target, Heart, Send } from 'lucide-react';
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
import { apiRequest } from '@/lib/queryClient';
import { CommunityShell } from '@/components/layout/CommunityShell';
import { TradeScoutIcon } from '@/components/TradeScoutIcons';
import { useLocationContext } from '@/hooks/useLocationContext';
import { useLocation } from 'wouter';
import { COMMUNITY_TONE } from '../../../shared/communityLanguage';

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
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const [route, navigate] = useLocation();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocationContext();

  const stateCode = location.stateCode as string | undefined;
  const countyFips = location.countyFips as string | undefined;

  // Fetch posts from the API scoped to the user's county
  const { data: postsData, isLoading: postsLoading } = useQuery<Post[]>({
    queryKey: [
      '/api/community/posts',
      stateCode,
      countyFips,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: '20',
        offset: '0',
      });

      // When we know the user’s county/state from location context,
      // explicitly scope to that county. Otherwise, let the server
      // infer the best scope from the authenticated user.
      if (stateCode && countyFips) {
        params.set('scope', 'county');
        params.set('stateCode', stateCode);
        params.set('countyFips', countyFips);
      }

      const response = await fetch(`/api/community/posts?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch posts');
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/posts'] });
      setNewPostContent('');
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
  const posts = postsData || [];

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
        return <MessageSquare className="h-4 w-4 text-blue-400" />;
      case 'promotion':
        return <TrendingUp className="h-4 w-4 text-green-400" />;
      case 'community_highlight':
        return <Trophy className="h-4 w-4 text-orange-400" />;
      case 'discussion':
        return <MessageSquare className="h-4 w-4 text-blue-400" />;
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
        return 'Special Offer';
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

  return (
    <CommunityShell
      sectionLabel="CommunityOS · A live feed for recommendations, projects, and trusted local pros."
      notificationsCount={unreadCount}
    >
      <div className="mx-auto w-full max-w-5xl px-0 py-4 md:px-2 md:py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 px-0 md:px-0">
          {/* Main Feed */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="inline-flex w-full justify-between rounded-full bg-slate-900/80 border border-slate-800 backdrop-blur mb-4 md:mb-5 px-1 py-1">
                <TabsTrigger value="forYou" className="flex-1 rounded-full data-[state=active]:bg-orange-500 data-[state=active]:text-slate-950 data-[state=inactive]:text-slate-300 text-xs md:text-sm">For you</TabsTrigger>
                <TabsTrigger value="recent" className="flex-1 rounded-full data-[state=active]:bg-orange-500 data-[state=active]:text-slate-950 data-[state=inactive]:text-slate-300 text-xs md:text-sm">Recent</TabsTrigger>
                <TabsTrigger value="nearby" className="flex-1 rounded-full data-[state=active]:bg-orange-500 data-[state=active]:text-slate-950 data-[state=inactive]:text-slate-300 text-xs md:text-sm">Nearby</TabsTrigger>
                <TabsTrigger value="trending" className="flex-1 rounded-full data-[state=active]:bg-orange-500 data-[state=active]:text-slate-950 data-[state=inactive]:text-slate-300 text-xs md:text-sm">Trending</TabsTrigger>
              </TabsList>
              {/* Inline composer always visible at top of feed */}
              <Card className="bg-slate-950/80 border border-slate-800 shadow-sm mb-4 md:mb-5 md:sticky md:top-16">
                <CardContent className="p-4 md:p-6">
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
                        className="bg-navy-700 border-navy-600 text-white"
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
                                className="w-full rounded-full border border-slate-700 bg-slate-900/60 px-3 py-2 text-left text-xs md:text-sm text-slate-200 hover:border-orange-500 hover:bg-slate-900/90 transition-colors"
                              >
                                {prompt}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-1">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="border-navy-600 text-gray-400 hover:bg-navy-600/50">
                            <Image className="h-4 w-4 mr-1" />
                            Photo
                          </Button>
                          <Button size="sm" variant="outline" className="border-navy-600 text-gray-400 hover:bg-navy-600/50">
                            <Video className="h-4 w-4 mr-1" />
                            Video
                          </Button>
                          <Button size="sm" variant="outline" className="border-navy-600 text-gray-400 hover:bg-navy-600/50">
                            <BarChart3 className="h-4 w-4 mr-1" />
                            Poll
                          </Button>
                        </div>

                        <Button
                          className="bg-orange-500 hover:bg-orange-600 shadow-md shadow-orange-500/25"
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

              <TabsContent value="forYou" className="mt-0">
                <div className="space-y-4 md:space-y-5">
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
                            className={`rounded-2xl hover:border-slate-700 transition-colors shadow-sm hover:shadow-md hover:shadow-black/40 ${
                              isSystemPost
                                ? 'bg-slate-900/90 border-slate-800/80'
                                : 'bg-slate-950/90 border-slate-800/80'
                            }`}
                            data-testid={`card-post-${post.id}`}
                          >
                            <CardContent className="p-4 md:p-5">
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
                                      <DropdownMenuItem>
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
                              <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs md:text-sm">
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
                                    className="text-gray-400 hover:text-blue-400"
                                    data-testid={`button-comment-${post.id}`}
                                  >
                                    <MessageSquare className="h-4 w-4 mr-1" />
                                    <span className="mr-1">Discuss</span>
                                    {post.commentCount || post.comments || 0}
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-gray-400 hover:text-green-400"
                                    data-testid={`button-share-${post.id}`}
                                  >
                                    <Share className="h-4 w-4 mr-1" />
                                    <span className="mr-1">Send</span>
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
                                    View Offer
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
                                  className="flex-1 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-2 text-left text-xs md:text-sm text-slate-400 hover:border-slate-700 hover:bg-slate-900/80"
                                >
                                  Add a comment...
                                </button>
                              </div>
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
            </Tabs>
          </div>

          {/* Right column: collapsed community context so feed dominates */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="bg-navy-800/40 border-navy-700 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Users2 className="h-4 w-4 text-orange-400" />
                  Community context
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-slate-300 hover:text-white px-2 py-1 h-7"
                  onClick={() => setShowSidebar(!showSidebar)}
                >
                  {showSidebar ? 'Hide' : 'Show'}
                </Button>
              </CardHeader>
              {showSidebar && (
                <CardContent className="pt-0 pb-3">
                  <div className="space-y-4 text-sm">
                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-wide text-slate-400">Community stats</div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-400">{communityStats.totalMembers.toLocaleString()}</div>
                        <div className="text-gray-400 text-xs">Total members</div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Active today</span>
                          <span className="text-green-400">{communityStats.activeToday.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Posts today</span>
                          <span className="text-blue-400">{communityStats.postsToday}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Active counties</span>
                          <span className="text-purple-400">{communityStats.countiesActive.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {Array.isArray(trendingTopics) && trendingTopics.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-wide text-slate-400 flex items-center gap-2">
                          <TrendingUp className="h-3 w-3" />
                          <span>Trending topics</span>
                        </div>
                        <div className="space-y-2">
                          {trendingTopics.map((topic, index) => (
                            <div key={index} className="flex justify-between items-center">
                              <span className="text-orange-400 hover:text-orange-300 cursor-pointer text-xs">
                                {topic.tag}
                              </span>
                              <span className="text-gray-400 text-[11px]">
                                {topic.source === 'news' ? 'News' : (typeof topic.posts === 'number' ? topic.posts : 0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </div>
      </div>
    </CommunityShell>
  );
});

export default CommunityFeed;