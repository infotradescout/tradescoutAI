import { memo, useState } from 'react';
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
import { useLocationContext } from '@/hooks/useLocationContext';
import { useLocation } from 'wouter';

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

const CommunityFeed = memo(function CommunityFeed() {
  const [activeTab, setActiveTab] = useState("forYou");
  const [newPostContent, setNewPostContent] = useState("");
  const [showNewPostForm, setShowNewPostForm] = useState(false);
  const [, navigate] = useLocation();
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
    enabled: Boolean(stateCode && countyFips),
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
    mutationFn: async (postData: { content: string; title?: string }) => {
      return apiRequest('POST', '/api/community/posts', {
        content: postData.content,
        title: postData.title,
        category: 'general',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/posts'] });
      setShowNewPostForm(false);
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

  const trendingTopics = [
    { tag: "#SpringRenovations", posts: 234 },
    { tag: "#KitchenRemodel", posts: 156 },
    { tag: "#LandscapingTips", posts: 89 },
    { tag: "#HomeImprovement", posts: 412 },
    { tag: "#BathroomDesign", posts: 67 }
  ];

  const communityStats = {
    totalMembers: 87420,
    activeToday: 3245,
    postsToday: 156,
    countiesActive: 2847
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
    <CommunityShell sectionLabel="Community" notificationsCount={unreadCount}>
      <div className="mx-auto w-full max-w-5xl px-0 py-4 md:px-2 md:py-6">
        {/* Header */}
        <div className="mb-4 md:mb-6 px-4 md:px-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <Users2 className="h-5 w-5 text-slate-950" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">TradeScout Community</h1>
                <p className="text-xs md:text-sm text-slate-400">A live feed for recommendations, projects, and trusted local pros.</p>
              </div>
            </div>
          </div>
        </div>

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

              {/* New Post Creator - sticky on desktop */}
              {showNewPostForm && (
                <Card className="bg-slate-950/80 border border-slate-800 shadow-sm mb-4 md:mb-5 md:sticky md:top-16">
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face" />
                        <AvatarFallback>{user?.id.substring(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <Textarea
                          placeholder="Share your project, ask a question, or offer your services..."
                          value={newPostContent}
                          onChange={(e) => setNewPostContent(e.target.value)}
                          className="bg-navy-700 border-navy-600 text-white mb-3"
                          rows={3}
                        />

                        <div className="flex justify-between items-center">
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
              )}

              <TabsContent value="forYou" className="mt-0">
                <div className="space-y-4 md:space-y-5">
                  {postsLoading ? (
                    <div className="text-center py-12">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                      <p className="text-gray-400 mt-4">Loading posts...</p>
                    </div>
                  ) : posts.length === 0 ? (
                    <Card className="bg-slate-950/80 border border-slate-800/80 rounded-2xl">
                      <CardContent className="p-12 text-center">
                        <Users2 className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-white mb-2">No posts yet</h3>
                        <p className="text-gray-400 mb-6">Be the first to share something with the community!</p>
                        <Button
                          onClick={() => setShowNewPostForm(true)}
                          className="bg-orange-600 hover:bg-orange-700"
                          data-testid="button-create-first-post"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create First Post
                        </Button>
                      </CardContent>
                    </Card>
                  ) : posts.map((post: any) => (
                    <Card
                      key={post.id}
                      className="bg-slate-950/90 border border-slate-800/80 rounded-2xl hover:border-slate-700 transition-colors shadow-sm hover:shadow-md hover:shadow-black/40"
                      data-testid={`card-post-${post.id}`}
                    >
                      <CardContent className="p-4 md:p-5">
                        {/* Post Header */}
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex gap-3">
                            <Avatar className="w-10 h-10 md:w-11 md:h-11">
                              <AvatarImage src={post.author?.avatar} />
                              <AvatarFallback>{(post.author?.name || user?.username || 'U').substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>

                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-white font-semibold">{post.author?.name || user?.username || 'Community Member'}</h3>
                                {post.author?.verified && (
                                  <Badge className="bg-blue-600 hover:bg-blue-700 text-xs">
                                    Verified
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {post.author?.role || post.postType || 'Member'}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-2 text-xs md:text-sm text-slate-400">
                                <span>{post.timestamp || new Date(post.createdAt).toLocaleDateString()}</span>
                                {post.author?.location && (
                                  <>
                                    <span>•</span>
                                    <div className="flex items-center gap-1">
                                      <Compass className="h-3 w-3" />
                                      {post.author.location}
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
                              {post.likeCount || post.likes || 0}
                            </Button>

                            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-blue-400" data-testid={`button-comment-${post.id}`}>
                              <MessageSquare className="h-4 w-4 mr-1" />
                              {post.commentCount || post.comments || 0}
                            </Button>

                            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-green-400" data-testid={`button-share-${post.id}`}>
                              <Share className="h-4 w-4 mr-1" />
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
                  ))}
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

          {/* Right column: community context (global tools live in RightToolsPanel) */}
          <div className="lg:col-span-1 space-y-6">
            {/* Community Stats */}
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white text-lg">Community Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-400">{communityStats.totalMembers.toLocaleString()}</div>
                    <div className="text-gray-400 text-sm">Total Members</div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-sm">
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
              </CardContent>
            </Card>

            {/* Trending Topics */}
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Trending Topics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.isArray(trendingTopics) ? trendingTopics.map((topic, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-orange-400 hover:text-orange-300 cursor-pointer">
                        {topic.tag}
                      </span>
                      <span className="text-gray-400 text-sm">{topic.posts}</span>
                    </div>
                  )) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </CommunityShell>
  );
});

export default CommunityFeed;