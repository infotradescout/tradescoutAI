import { memo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Plus, TrendingUp, Users2, Award, Heart, Send, Image as ImageIcon, MapPin, Star, Clock, Share2, Bookmark, Home as HomeIcon, Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Link } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';

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

const SimpleHome = memo(function SimpleHome() {
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
      return apiRequest('POST', '/api/community/posts', {
        content: postData.content,
        title: postData.title,
        postType: 'discussion',
        visibility: 'public'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/posts'] });
      setShowNewPostForm(false);
      setNewPostContent('');
      toast({
        title: "Posted!",
        description: "Your post is now live in the community.",
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

  const posts = postsData || [];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 pb-16 lg:pb-0">
      {/* Main Content - Facebook/Nextdoor Style Layout */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4">
        <div className="grid lg:grid-cols-12 gap-4">
          
          {/* Left Sidebar - Quick Navigation (Nextdoor Style) */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-16 space-y-2">
              {/* User Profile Card */}
              <Link href="/profile">
                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.profileImageUrl} />
                    <AvatarFallback className="bg-orange-500 text-white text-sm">
                      {user?.firstName?.[0] || user?.email?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-sm text-slate-900 dark:text-white">
                    {user?.firstName && user?.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user?.email?.split('@')[0] || 'My Profile'}
                  </span>
                </div>
              </Link>

              {/* Quick Links */}
              <nav className="space-y-1">
                <Link href="/find-contractors">
                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                    <Wrench className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                    <span className="text-sm font-medium text-slate-900 dark:text-white">Find Contractors</span>
                  </div>
                </Link>
                
                <Link href="/marketplace">
                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                    <Star className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                    <span className="text-sm font-medium text-slate-900 dark:text-white">Marketplace</span>
                  </div>
                </Link>

                <Link href="/county-hub">
                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                    <MapPin className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                    <span className="text-sm font-medium text-slate-900 dark:text-white">My County</span>
                  </div>
                </Link>

                {/* Community Section with Groups */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 mt-2">
                  <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Community
                  </div>
                  <Link href="/groups">
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                      <Users2 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                      <span className="text-sm font-medium text-slate-900 dark:text-white">My Groups</span>
                    </div>
                  </Link>
                  
                  {/* Show HOA link if user is HOA member */}
                  {(user?.role === 'hoa_board' || user?.role === 'hoa_manager') && (
                    <Link href="/hoa-dashboard">
                      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                        <HomeIcon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                        <span className="text-sm font-medium text-slate-900 dark:text-white">HOA Management</span>
                      </div>
                    </Link>
                  )}
                </div>
              </nav>
            </div>
          </aside>

          {/* Center Feed - Main Content (Facebook/Nextdoor Style) */}
          <main className="lg:col-span-6 space-y-3">
            {/* User Snapshot Dashboard */}
            <Card className="bg-gradient-to-br from-orange-500 to-orange-600 border-0 shadow-md text-white">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold mb-1">
                      Welcome back, {user?.firstName || user?.email?.split('@')[0] || 'there'}! 👋
                    </h2>
                    <p className="text-orange-100 text-sm">
                      Here's what's happening in your TradeScout community
                    </p>
                  </div>
                  <Avatar className="h-16 w-16 border-4 border-white/20">
                    <AvatarImage src={user?.profileImageUrl} />
                    <AvatarFallback className="bg-orange-700 text-white text-xl">
                      {user?.firstName?.[0] || user?.email?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold mb-1">0</div>
                    <div className="text-xs text-orange-100">Saved Contractors</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold mb-1">{posts.length}</div>
                    <div className="text-xs text-orange-100">Community Posts</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold mb-1">0</div>
                    <div className="text-xs text-orange-100">Active Projects</div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2">
                  <Link href="/find-contractors">
                    <Button size="sm" variant="secondary" className="bg-white text-orange-600 hover:bg-orange-50">
                      <Wrench className="h-4 w-4 mr-1.5" />
                      Find Contractors
                    </Button>
                  </Link>
                  <Link href="/marketplace">
                    <Button size="sm" variant="secondary" className="bg-white text-orange-600 hover:bg-orange-50">
                      <Star className="h-4 w-4 mr-1.5" />
                      Browse Marketplace
                    </Button>
                  </Link>
                  <Link href="/groups">
                    <Button size="sm" variant="secondary" className="bg-white text-orange-600 hover:bg-orange-50">
                      <Users2 className="h-4 w-4 mr-1.5" />
                      Join Groups
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Create Post Card - Facebook Style */}
            <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.profileImageUrl} />
                    <AvatarFallback className="bg-orange-500 text-white">
                      {user?.firstName?.[0] || user?.email?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  {!showNewPostForm ? (
                    <button
                      onClick={() => setShowNewPostForm(true)}
                      className="flex-1 text-left px-4 py-2.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm"
                      data-testid="button-create-post"
                    >
                      What's on your mind?
                    </button>
                  ) : (
                    <div className="flex-1 space-y-3">
                      <Textarea
                        placeholder="Share an update, ask for recommendations, or post a project..."
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        className="min-h-[100px] border-slate-200 dark:border-slate-600 resize-none"
                        data-testid="input-post-content"
                        autoFocus
                      />
                      <div className="flex items-center justify-between">
                        <Button variant="ghost" size="sm" className="text-slate-600 dark:text-slate-400">
                          <ImageIcon className="h-4 w-4 mr-1.5" />
                          Photo
                        </Button>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setShowNewPostForm(false);
                              setNewPostContent('');
                            }}
                          >
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleCreatePost}
                            disabled={!newPostContent.trim() || createPostMutation.isPending}
                            size="sm"
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                            data-testid="button-submit-post"
                          >
                            {createPostMutation.isPending ? 'Posting...' : 'Post'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Feed Posts */}
            {postsLoading ? (
              <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm">
                <CardContent className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
                  <p className="text-slate-500 dark:text-slate-400 mt-4 text-sm">Loading feed...</p>
                </CardContent>
              </Card>
            ) : posts.length === 0 ? (
              <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm">
                <CardContent className="p-12 text-center">
                  <Users2 className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-white">Welcome to your neighborhood!</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Be the first to share something with your community.</p>
                </CardContent>
              </Card>
            ) : (
              posts.map((post: Post) => (
                <Card key={post.id} className="bg-white dark:bg-slate-800 border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    {/* Post Header */}
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-blue-500 text-white text-sm">
                          {post.authorId?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                            Neighbor
                          </h4>
                          {post.postType === 'promotion' && (
                            <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 text-xs">
                              Contractor
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>

                    {/* Post Content */}
                    {post.title && (
                      <h3 className="text-base font-semibold mb-2 text-slate-900 dark:text-white">{post.title}</h3>
                    )}
                    <p className="text-sm text-slate-700 dark:text-slate-300 mb-3 whitespace-pre-wrap">{post.content}</p>

                    {/* Post Stats */}
                    {(post.likeCount > 0 || post.commentCount > 0) && (
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mb-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                        {post.likeCount > 0 && <span>{post.likeCount} {post.likeCount === 1 ? 'like' : 'likes'}</span>}
                        {post.commentCount > 0 && <span>{post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}</span>}
                      </div>
                    )}

                    {/* Post Actions - Facebook Style */}
                    <div className="flex items-center justify-around gap-1">
                      <button
                        onClick={() => handleLikePost(post.id)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        data-testid={`button-like-${post.id}`}
                      >
                        <Heart className="h-4 w-4" />
                        <span className="text-sm font-medium">Like</span>
                      </button>
                      <button className="flex-1 flex items-center justify-center gap-2 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        <MessageSquare className="h-4 w-4" />
                        <span className="text-sm font-medium">Comment</span>
                      </button>
                      <button className="flex-1 flex items-center justify-center gap-2 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        <Share2 className="h-4 w-4" />
                        <span className="text-sm font-medium">Share</span>
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </main>

          {/* Right Sidebar - Suggestions (Facebook/Nextdoor Style) */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-16 space-y-4">
              {/* Trending Topics */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4">
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white mb-3">
                  Trending in your area
                </h3>
                <div className="space-y-2">
                  <a href="#" className="block text-sm text-orange-600 dark:text-orange-500 hover:underline">
                    #SpringRenovations
                  </a>
                  <a href="#" className="block text-sm text-orange-600 dark:text-orange-500 hover:underline">
                    #KitchenRemodel
                  </a>
                  <a href="#" className="block text-sm text-orange-600 dark:text-orange-500 hover:underline">
                    #LandscapingTips
                  </a>
                  <a href="#" className="block text-sm text-orange-600 dark:text-orange-500 hover:underline">
                    #HomeImprovement
                  </a>
                </div>
              </div>

              {/* Top Rated Contractors */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                    Top Contractors
                  </h3>
                  <Link href="/leaderboard" className="text-xs text-orange-600 hover:underline">
                    See all
                  </Link>
                </div>
                <div className="space-y-3">
                  {[
                    { name: "Mike's Plumbing", rating: 4.9, reviews: 247 },
                    { name: "Elite Electrical", rating: 4.8, reviews: 189 },
                    { name: "Pro Landscaping", rating: 4.7, reviews: 312 }
                  ].map((contractor, idx) => (
                    <Link 
                      key={idx} 
                      href="/find-contractors" 
                      className="flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg p-2 -mx-2 transition-colors cursor-pointer"
                      data-testid={`contractor-link-${idx}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm text-slate-900 dark:text-white">{contractor.name}</p>
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-[10px] px-1.5 py-0">
                            ✓
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Star className="h-3 w-3 fill-orange-400 text-orange-400" />
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            {contractor.rating} · {contractor.reviews} reviews
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Footer Links */}
              <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 px-2">
                <div className="flex flex-wrap gap-x-2 gap-y-1">
                  <a href="/privacy" className="hover:underline">Privacy</a>
                  <span>·</span>
                  <a href="/terms" className="hover:underline">Terms</a>
                  <span>·</span>
                  <a href="/help" className="hover:underline">Help</a>
                </div>
                <p className="text-slate-400 dark:text-slate-500">TradeScout © 2025</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
});

export default SimpleHome;
