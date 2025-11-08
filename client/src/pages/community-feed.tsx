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
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Post {
  id: string;
  authorId: string;
  title?: string;
  content: string;
  images?: string[];
  postType: string;
  countyFips?: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
}

const CommunityFeed = memo(function CommunityFeed() {
  const [activeTab, setActiveTab] = useState("feed");
  const [newPostContent, setNewPostContent] = useState("");
  const [showNewPostForm, setShowNewPostForm] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch posts from the API
  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['/api/community/posts'],
    queryFn: async () => {
      const response = await fetch('/api/community/posts');
      if (!response.ok) throw new Error('Failed to fetch posts');
      return response.json();
    }
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async (postData: { content: string; title?: string }) => {
      return apiRequest('/api/community/posts', {
        method: 'POST',
        body: JSON.stringify({
          content: postData.content,
          title: postData.title,
          postType: 'discussion',
          visibility: 'public'
        })
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
      return apiRequest(`/api/community/posts/${postId}/like`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/posts'] });
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
    <div className="min-h-screen gradient-bg text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Users2 className="h-8 w-8 text-orange-400" />
            <h1 className="text-4xl font-bold text-white">Community Feed</h1>
          </div>
          <p className="text-gray-300 text-lg">
            Connect, share, and discover with your local trade community
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
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

            {/* Quick Actions */}
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button
                    className="w-full bg-orange-600 hover:bg-orange-700 justify-start"
                    onClick={() => setShowNewPostForm(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Post
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-orange-600 text-orange-400 hover:bg-orange-600/20 justify-start"
                    onClick={() => window.location.pathname = '/event-management'}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Local Events
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-orange-600 text-orange-400 hover:bg-orange-600/20 justify-start"
                    onClick={() => window.location.pathname = '/find-contractors'}
                  >
                    <Users2 className="h-4 w-4 mr-2" />
                    Find Contractors
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Feed */}
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-navy-800/50 backdrop-blur-sm mb-6">
                <TabsTrigger value="feed" className="data-[state=active]:bg-orange-600">Latest</TabsTrigger>
                <TabsTrigger value="popular" className="data-[state=active]:bg-orange-600">Popular</TabsTrigger>
                <TabsTrigger value="local" className="data-[state=active]:bg-orange-600">Local</TabsTrigger>
                <TabsTrigger value="following" className="data-[state=active]:bg-orange-600">Following</TabsTrigger>
              </TabsList>

              {/* New Post Creator */}
              {showNewPostForm && (
                <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm mb-6">
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
                            className="bg-orange-600 hover:bg-orange-700"
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

              <TabsContent value="feed" className="mt-0">
                <div className="space-y-6">
                  {postsLoading ? (
                    <div className="text-center py-12">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                      <p className="text-gray-400 mt-4">Loading posts...</p>
                    </div>
                  ) : posts.length === 0 ? (
                    <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
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
                    <Card key={post.id} className="bg-navy-800/50 border-navy-600 backdrop-blur-sm" data-testid={`card-post-${post.id}`}>
                      <CardContent className="p-6">
                        {/* Post Header */}
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex gap-3">
                            <Avatar className="w-12 h-12">
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

                              <div className="flex items-center gap-2 text-sm text-gray-400">
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

                          <div className="flex items-center gap-2">
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
                        <div className="mb-4">
                          {post.title && (
                            <h4 className="text-lg font-semibold text-white mb-2">{post.title}</h4>
                          )}
                          <p className="text-gray-300 mb-3">{post.content}</p>

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
                        <div className="flex items-center justify-between pt-3 border-t border-navy-600">
                          <div className="flex items-center gap-6">
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="popular" className="mt-0">
                <div className="text-center py-12">
                  <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-white text-xl mb-2">Popular Posts</h3>
                  <p className="text-gray-400">Most liked and shared posts this week</p>
                </div>
              </TabsContent>

              <TabsContent value="local" className="mt-0">
                <div className="text-center py-12">
                  <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-white text-xl mb-2">Local Community</h3>
                  <p className="text-gray-400">Posts from your county and surrounding areas</p>
                </div>
              </TabsContent>

              <TabsContent value="following" className="mt-0">
                <div className="text-center py-12">
                  <Users2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-white text-xl mb-2">Following</h3>
                  <p className="text-gray-400">Posts from contractors and community members you follow</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
});

export default CommunityFeed;