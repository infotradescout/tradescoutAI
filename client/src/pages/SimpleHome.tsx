import { memo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Plus, TrendingUp, Users2, Award, Heart, Send, Image as ImageIcon, MapPin, Star, Clock, Share2, Bookmark } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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

  const posts = postsData || [];

  const trendingTopics = [
    { tag: "#SpringRenovations", posts: 234 },
    { tag: "#KitchenRemodel", posts: 156 },
    { tag: "#LandscapingTips", posts: 89 },
    { tag: "#HomeImprovement", posts: 412 }
  ];

  const featuredContractors = [
    { name: "Mike's Plumbing", rating: 4.9, jobs: 247, verified: true },
    { name: "Elite Electrical", rating: 4.8, jobs: 189, verified: true },
    { name: "Pro Landscaping", rating: 4.7, jobs: 312, verified: true }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Main Content Grid */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-12 gap-6">
          
          {/* Left Sidebar - Quick Links & User Info */}
          <aside className="lg:col-span-3 space-y-4">
            {/* User Quick Card */}
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-orange-500 text-white">
                      {user?.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{user?.name || 'User'}</h3>
                    <p className="text-sm text-slate-500">View Profile</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <a href="/find-contractors" className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-orange-500 transition-colors">
                    <MapPin className="h-4 w-4" />
                    Find Contractors
                  </a>
                  <a href="/marketplace" className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-orange-500 transition-colors">
                    <TrendingUp className="h-4 w-4" />
                    Marketplace
                  </a>
                  <a href="/groups" className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-orange-500 transition-colors">
                    <Users2 className="h-4 w-4" />
                    My Groups
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Trending Topics */}
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-orange-500" />
                  Trending
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {trendingTopics.map((topic, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-orange-500 hover:text-orange-600 cursor-pointer">
                      {topic.tag}
                    </span>
                    <span className="text-xs text-slate-500">{topic.posts} posts</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>

          {/* Center Feed - Main Content */}
          <main className="lg:col-span-6 space-y-4">
            {/* Create Post Card */}
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-orange-500 text-white">
                      {user?.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  {!showNewPostForm ? (
                    <button
                      onClick={() => setShowNewPostForm(true)}
                      className="flex-1 text-left px-4 py-3 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                      data-testid="button-create-post"
                    >
                      What's on your mind? Share with neighbors...
                    </button>
                  ) : (
                    <div className="flex-1 space-y-3">
                      <Textarea
                        placeholder="Share an update, ask for recommendations, or post a project..."
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        className="min-h-[100px] border-slate-300 dark:border-slate-600"
                        data-testid="input-post-content"
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="text-slate-600">
                            <ImageIcon className="h-4 w-4 mr-1" />
                            Photo
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
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
                            className="bg-orange-500 hover:bg-orange-600"
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
              <Card className="bg-white dark:bg-slate-800">
                <CardContent className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
                  <p className="text-slate-500 mt-4">Loading community feed...</p>
                </CardContent>
              </Card>
            ) : posts.length === 0 ? (
              <Card className="bg-white dark:bg-slate-800">
                <CardContent className="p-12 text-center">
                  <Users2 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2 text-slate-900 dark:text-white">Be the first to share!</h3>
                  <p className="text-slate-500">Start the conversation in your community.</p>
                </CardContent>
              </Card>
            ) : (
              posts.map((post: Post) => (
                <Card key={post.id} className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    {/* Post Header */}
                    <div className="flex items-start gap-3 mb-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-blue-500 text-white">
                          {post.authorId?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-slate-900 dark:text-white">Community Member</h4>
                          {post.postType === 'promotion' && (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-600">
                              Contractor
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>

                    {/* Post Content */}
                    {post.title && (
                      <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-white">{post.title}</h3>
                    )}
                    <p className="text-slate-700 dark:text-slate-300 mb-4 whitespace-pre-wrap">{post.content}</p>

                    {/* Post Actions */}
                    <div className="flex items-center gap-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => handleLikePost(post.id)}
                        className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-orange-500 transition-colors"
                        data-testid={`button-like-${post.id}`}
                      >
                        <Heart className="h-5 w-5" />
                        <span className="text-sm font-medium">{post.likeCount || 0}</span>
                      </button>
                      <button className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-500 transition-colors">
                        <MessageSquare className="h-5 w-5" />
                        <span className="text-sm font-medium">{post.commentCount || 0}</span>
                      </button>
                      <button className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-green-500 transition-colors">
                        <Share2 className="h-5 w-5" />
                        <span className="text-sm font-medium">Share</span>
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </main>

          {/* Right Sidebar - Recommendations & Activity */}
          <aside className="lg:col-span-3 space-y-4">
            {/* Featured Contractors */}
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="h-5 w-5 text-orange-500" />
                  Top Contractors
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {featuredContractors.map((contractor, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-1">
                        {contractor.name}
                        {contractor.verified && (
                          <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-600 text-xs">
                            ✓
                          </Badge>
                        )}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span>{contractor.rating}</span>
                        <span>•</span>
                        <span>{contractor.jobs} jobs</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="text-xs">
                      View
                    </Button>
                  </div>
                ))}
                <Button className="w-full bg-orange-500 hover:bg-orange-600" size="sm">
                  <a href="/find-contractors" className="w-full">
                    Browse All Contractors
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* Community Stats */}
            <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Your Neighborhood</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm opacity-90">Active Today</span>
                    <span className="font-bold">3,245</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm opacity-90">Posts This Week</span>
                    <span className="font-bold">1,156</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm opacity-90">Total Members</span>
                    <span className="font-bold">87,420</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
});

export default SimpleHome;
