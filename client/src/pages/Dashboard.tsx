import { memo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Heart, Share2 } from 'lucide-react';
import {
  AVAILABLE_WIDGETS,
  ActivityStatsWidget,
  RecentProjectsWidget,
  SavedContractorsWidget,
  MessagesPreviewWidget,
  QuickActionsWidget,
  NotificationsWidget,
  CommunityFeedWidget,
  AffiliateStatsWidget,
} from '@/components/dashboard/DashboardWidgets';

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

const Dashboard = memo(function Dashboard() {
  const [newPostContent, setNewPostContent] = useState("");
  const [showNewPostForm, setShowNewPostForm] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading: preferencesLoading } = useQuery({
    queryKey: ['/api/users/preferences'],
  });

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['/api/community/posts'],
  });

  const createPostMutation = useMutation({
    mutationFn: async (postData: { content: string; title?: string }) => {
      const response = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: postData.content,
          title: postData.title,
          postType: 'discussion',
          visibility: 'public'
        }),
      });
      if (!response.ok) throw new Error('Failed to create post');
      return response.json();
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

  const likePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await fetch(`/api/community/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to like post');
      return response.json();
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

  const defaultEnabledWidgets = AVAILABLE_WIDGETS
    .filter(w => w.defaultEnabled)
    .map(w => w.id);

  const enabledWidgets = (preferences && (preferences as any).dashboard?.enabledWidgets) || defaultEnabledWidgets;

  const widgetComponents: Record<string, React.ComponentType<{ className?: string }>> = {
    'activity-stats': ActivityStatsWidget,
    'quick-actions': QuickActionsWidget,
    'recent-projects': RecentProjectsWidget,
    'saved-contractors': SavedContractorsWidget,
    'messages-preview': MessagesPreviewWidget,
    'notifications': NotificationsWidget,
    'community-feed': CommunityFeedWidget,
    'affiliate-stats': AffiliateStatsWidget,
  };

  if (preferencesLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-16 lg:pb-0">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Welcome back, {user?.firstName || 'Friend'}!
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Here's what's happening in your community
            </p>
          </div>
          <Link href="/dashboard-settings">
            <Button variant="outline" size="sm" data-testid="button-customize-dashboard">
              <SettingsIcon className="h-4 w-4 mr-2" />
              Customize
            </Button>
          </Link>
        </div>

        {/* Dashboard Grid */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Community Feed Widget - Always at the top */}
            <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-4">
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
                      <div className="flex justify-end gap-2">
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
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Community Posts Feed */}
            {postsLoading ? (
              <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm">
                <CardContent className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
                  <p className="text-slate-500 dark:text-slate-400 mt-4 text-sm">Loading feed...</p>
                </CardContent>
              </Card>
            ) : (!Array.isArray(posts) || posts.length === 0) ? (
              <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm">
                <CardContent className="p-12 text-center">
                  <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-white">Welcome to your neighborhood!</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Be the first to share something with your community.</p>
                </CardContent>
              </Card>
            ) : (
              Array.isArray(posts) && posts.map((post: Post) => (
                <Card key={post.id} className="bg-white dark:bg-slate-800 border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
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

                    {post.title && (
                      <h3 className="text-base font-semibold mb-2 text-slate-900 dark:text-white">{post.title}</h3>
                    )}
                    <p className="text-sm text-slate-700 dark:text-slate-300 mb-3 whitespace-pre-wrap">{post.content}</p>

                    {(post.likeCount > 0 || post.commentCount > 0) && (
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mb-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                        {post.likeCount > 0 && <span>{post.likeCount} {post.likeCount === 1 ? 'like' : 'likes'}</span>}
                        {post.commentCount > 0 && <span>{post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}</span>}
                      </div>
                    )}

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
          </div>

          {/* Sidebar Widgets */}
          <div className="lg:col-span-1 space-y-4">
            {Array.isArray(enabledWidgets) && enabledWidgets.map((widgetId: string) => {
              const WidgetComponent = widgetComponents[widgetId];
              return WidgetComponent ? <WidgetComponent key={widgetId} /> : null;
            })}
            
            {(!Array.isArray(enabledWidgets) || enabledWidgets.length === 0) && (
              <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm">
                <CardContent className="p-6 text-center">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    No widgets enabled. Customize your dashboard to add widgets.
                  </p>
                  <Link href="/dashboard-settings">
                    <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                      Add Widgets
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default Dashboard;
