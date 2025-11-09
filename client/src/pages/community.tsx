import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { 
  Search, 
  MapPin, 
  MessageSquare, 
  ThumbsUp, 
  Share2,
  Plus,
  TrendingUp,
  Users,
  Calendar,
  Image as ImageIcon,
  Video,
  Smile,
  MoreHorizontal,
  Heart,
  Send
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CommunityPost {
  id: string;
  title: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
    role: string;
    verified: boolean;
  };
  category: string;
  location: string;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  comments: number;
  tags: string[];
  userVote?: 'up' | 'down' | null;
  pinned: boolean;
  trending: boolean;
}

interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  time: string;
  organizer: string;
  attendees: number;
  category: string;
}

const POST_CATEGORIES = [
  { id: 'general', name: 'General', icon: MessageSquare },
  { id: 'recommendations', name: 'Recommendations', icon: ThumbsUp },
  { id: 'projects', name: 'Projects', icon: Plus },
  { id: 'events', name: 'Events', icon: Calendar },
  { id: 'safety', name: 'Safety', icon: Users },
];

export default function Community() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("feed");
  const [searchQuery, setSearchQuery] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [showPostComposer, setShowPostComposer] = useState(false);

  // Fetch community posts
  const { data: posts, isLoading: postsLoading } = useQuery<CommunityPost[]>({
    queryKey: ['/api/community/posts'],
    queryFn: async () => {
      const response = await fetch('/api/community/posts');
      if (!response.ok) throw new Error('Failed to fetch posts');
      return response.json();
    },
  });

  // Fetch community events
  const { data: events, isLoading: eventsLoading } = useQuery<CommunityEvent[]>({
    queryKey: ['/api/community/events'],
    queryFn: async () => {
      const response = await fetch('/api/community/events');
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
    enabled: activeTab === "events",
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest('POST', '/api/community/posts', {
        content,
        postType: 'discussion',
        visibility: 'public'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/posts'] });
      setNewPostContent('');
      setShowPostComposer(false);
      toast({
        title: "Posted!",
        description: "Your post is now live in the community.",
      });
    },
  });

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: async (postId: string) => {
      return apiRequest('POST', `/api/community/posts/${postId}/like`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/posts'] });
    },
  });

  const handleCreatePost = () => {
    if (!newPostContent.trim()) return;
    createPostMutation.mutate(newPostContent);
  };

  const handleLike = (postId: string) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to like posts.",
        variant: "destructive",
      });
      return;
    }
    likeMutation.mutate(postId);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredPosts = posts || [];

  return (
    <div className="min-h-screen bg-[#0f1419] pb-16 lg:pb-0">
      <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4">
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-orange-500 mb-1">Community</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Connect with neighbors and local contractors</p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-4">
          <div className="flex gap-1 bg-[#1a2332] rounded-lg p-1 shadow-sm border border-[#2d3748]">
            <button
              onClick={() => setActiveTab("feed")}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "feed"
                  ? "bg-orange-500 text-white"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              data-testid="tab-feed"
            >
              Feed
            </button>
            <button
              onClick={() => setActiveTab("events")}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "events"
                  ? "bg-orange-500 text-white"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              data-testid="tab-events"
            >
              Events
            </button>
            <button
              onClick={() => setActiveTab("trending")}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "trending"
                  ? "bg-orange-500 text-white"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              data-testid="tab-trending"
            >
              <TrendingUp className="w-4 h-4 inline mr-1" />
              Trending
            </button>
          </div>
        </div>

        {/* Feed Tab */}
        {activeTab === "feed" && (
          <div className="space-y-4">
            
            {/* Post Composer */}
            <Card className="bg-[#1a2332] shadow-sm border-[#2d3748]">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.profileImageUrl} />
                    <AvatarFallback className="bg-orange-500 text-white">
                      {user?.firstName?.[0] || user?.email?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  {!showPostComposer ? (
                    <button
                      onClick={() => setShowPostComposer(true)}
                      className="flex-1 text-left px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 transition-colors"
                      data-testid="button-open-composer"
                    >
                      What's on your mind?
                    </button>
                  ) : (
                    <div className="flex-1 space-y-3">
                      <Textarea
                        placeholder="What's on your mind?"
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        className="min-h-[100px] resize-none border-0 focus-visible:ring-0 px-0 text-orange-500"
                        data-testid="textarea-new-post"
                      />
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="text-slate-600 dark:text-slate-400">
                            <ImageIcon className="w-4 h-4 mr-2" />
                            Photo
                          </Button>
                          <Button variant="ghost" size="sm" className="text-slate-600 dark:text-slate-400">
                            <Video className="w-4 h-4 mr-2" />
                            Video
                          </Button>
                          <Button variant="ghost" size="sm" className="text-slate-600 dark:text-slate-400">
                            <Smile className="w-4 h-4 mr-2" />
                            Feeling
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowPostComposer(false);
                              setNewPostContent('');
                            }}
                            data-testid="button-cancel-post"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleCreatePost}
                            disabled={!newPostContent.trim() || createPostMutation.isPending}
                            className="bg-orange-500 hover:bg-orange-600 text-white"
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

            {/* Category Filters */}
            <Card className="bg-[#1a2332] shadow-sm border-[#2d3748]">
              <CardContent className="p-3">
                <div className="flex gap-2 overflow-x-auto">
                  {POST_CATEGORIES.map((category) => {
                    const Icon = category.icon;
                    return (
                      <button
                        key={category.id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap transition-colors"
                        data-testid={`filter-${category.id}`}
                      >
                        <Icon className="w-4 h-4" />
                        {category.name}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Posts Feed */}
            {postsLoading ? (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent"></div>
                <p className="mt-2 text-slate-600 dark:text-slate-400">Loading posts...</p>
              </div>
            ) : filteredPosts.length === 0 ? (
              <Card className="bg-[#1a2332] shadow-sm border-[#2d3748]">
                <CardContent className="py-16 text-center">
                  <MessageSquare className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-700 mb-4" />
                  <h3 className="text-lg font-semibold text-orange-500 mb-2">
                    No posts yet
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-4">
                    Be the first to share something with your community!
                  </p>
                  <Button
                    onClick={() => setShowPostComposer(true)}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                    data-testid="button-create-first-post"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Post
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredPosts.map((post) => (
                  <Card key={post.id} className="bg-[#1a2332] shadow-sm hover:shadow-md transition-shadow border-[#2d3748]">
                    <CardContent className="p-4">
                      {/* Post Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={post.author?.avatar} />
                            <AvatarFallback className="bg-orange-500 text-white">
                              {post.author?.name?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-orange-500">
                                {post.author?.name || 'Anonymous'}
                              </span>
                              {post.author?.verified && (
                                <Badge className="bg-blue-500 text-white text-xs px-1.5 py-0">
                                  ✓
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <span>{formatTimeAgo(post.createdAt)}</span>
                              {post.location && (
                                <>
                                  <span>•</span>
                                  <MapPin className="w-3 h-3" />
                                  <span>{post.location}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Post Content */}
                      <div className="mb-3">
                        {post.title && (
                          <h3 className="font-semibold text-orange-500 mb-2">
                            {post.title}
                          </h3>
                        )}
                        <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                          {post.content}
                        </p>
                        {post.tags && post.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {post.tags.map((tag, idx) => (
                              <Badge
                                key={idx}
                                variant="secondary"
                                className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              >
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <Separator className="mb-3" />

                      {/* Post Stats */}
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                        <span>{post.upvotes || 0} likes</span>
                        <span>{post.comments || 0} comments</span>
                      </div>

                      <Separator className="mb-2" />

                      {/* Action Buttons */}
                      <div className="flex items-center justify-around">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleLike(post.id)}
                          className="flex-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                          data-testid={`button-like-${post.id}`}
                        >
                          <Heart className="w-4 h-4 mr-2" />
                          Like
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                          data-testid={`button-comment-${post.id}`}
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Comment
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                          data-testid={`button-share-${post.id}`}
                        >
                          <Share2 className="w-4 h-4 mr-2" />
                          Share
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Events Tab */}
        {activeTab === "events" && (
          <div className="space-y-4">
            <Card className="bg-[#1a2332] shadow-sm border-[#2d3748]">
              <CardContent className="py-16 text-center">
                <Calendar className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-700 mb-4" />
                <h3 className="text-lg font-semibold text-orange-500 mb-2">
                  No upcoming events
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  Check back soon for community events in your area
                </p>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Event
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Trending Tab */}
        {activeTab === "trending" && (
          <div className="space-y-4">
            <Card className="bg-[#1a2332] shadow-sm border-[#2d3748]">
              <CardContent className="py-16 text-center">
                <TrendingUp className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-700 mb-4" />
                <h3 className="text-lg font-semibold text-orange-500 mb-2">
                  Nothing trending yet
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Popular posts will appear here
                </p>
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}
