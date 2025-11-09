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
      <div className="max-w-4xl mx-auto px-2 sm:px-4 py-6">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-orange-500 mb-2">Community</h1>
          <p className="text-base text-slate-300">Connect with neighbors and local contractors</p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 bg-[#1a2332] rounded-xl p-1.5 shadow-lg border border-[#2d3748]">
            <button
              onClick={() => setActiveTab("feed")}
              className={`flex-1 px-6 py-3 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "feed"
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/50"
                  : "text-slate-300 hover:bg-[#0f1419] hover:text-white"
              }`}
              data-testid="tab-feed"
            >
              Feed
            </button>
            <button
              onClick={() => setActiveTab("events")}
              className={`flex-1 px-6 py-3 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "events"
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/50"
                  : "text-slate-300 hover:bg-[#0f1419] hover:text-white"
              }`}
              data-testid="tab-events"
            >
              Events
            </button>
            <button
              onClick={() => setActiveTab("trending")}
              className={`flex-1 px-6 py-3 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "trending"
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/50"
                  : "text-slate-300 hover:bg-[#0f1419] hover:text-white"
              }`}
              data-testid="tab-trending"
            >
              <TrendingUp className="w-4 h-4 inline mr-1.5" />
              Trending
            </button>
          </div>
        </div>

        {/* Feed Tab */}
        {activeTab === "feed" && (
          <div className="space-y-4">
            
            {/* Post Composer */}
            <Card className="bg-[#1a2332] shadow-xl border-2 border-[#2d3748] hover:border-orange-500/30 transition-all">
              <CardContent className="p-5">
                <div className="flex gap-4">
                  <Avatar className="h-12 w-12 ring-2 ring-orange-500/50">
                    <AvatarImage src={user?.profileImageUrl} />
                    <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white text-lg font-semibold">
                      {user?.firstName?.[0] || user?.email?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  {!showPostComposer ? (
                    <button
                      onClick={() => setShowPostComposer(true)}
                      className="flex-1 text-left px-5 py-3.5 bg-[#0f1419] hover:bg-[#0a0f14] border border-[#2d3748] hover:border-orange-500/50 rounded-full text-slate-300 transition-all shadow-inner"
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
                        className="min-h-[120px] resize-none border-0 focus-visible:ring-0 px-0 text-white text-lg bg-transparent"
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
            <Card className="bg-[#1a2332] shadow-lg border-2 border-[#2d3748]">
              <CardContent className="p-4">
                <div className="flex gap-2.5 overflow-x-auto pb-1">
                  {POST_CATEGORIES.map((category) => {
                    const Icon = category.icon;
                    return (
                      <button
                        key={category.id}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0f1419] border border-[#2d3748] hover:border-orange-500 hover:bg-orange-500/10 text-sm font-semibold text-slate-200 hover:text-orange-400 whitespace-nowrap transition-all shadow-sm"
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
              <Card className="bg-[#1a2332] shadow-xl border-2 border-[#2d3748]">
                <CardContent className="py-20 text-center">
                  <MessageSquare className="w-20 h-20 mx-auto text-orange-500/30 mb-6" />
                  <h3 className="text-2xl font-bold text-white mb-3">
                    No posts yet
                  </h3>
                  <p className="text-slate-300 text-base mb-6">
                    Be the first to share something with your community!
                  </p>
                  <Button
                    onClick={() => setShowPostComposer(true)}
                    className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/50 px-8 py-6 text-lg"
                    data-testid="button-create-first-post"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Create Post
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-5">
                {filteredPosts.map((post) => (
                  <Card key={post.id} className="bg-[#1a2332] shadow-xl hover:shadow-2xl transition-all border-2 border-[#2d3748] hover:border-orange-500/30">
                    <CardContent className="p-6">
                      {/* Post Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex gap-3">
                          <Avatar className="h-12 w-12 ring-2 ring-orange-500/30">
                            <AvatarImage src={post.author?.avatar} />
                            <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold">
                              {post.author?.name?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-base">
                                {post.author?.name || 'Anonymous'}
                              </span>
                              {post.author?.verified && (
                                <Badge className="bg-blue-500 text-white text-xs px-2 py-0.5 shadow-sm">
                                  ✓ Verified
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                              <span>{formatTimeAgo(post.createdAt)}</span>
                              {post.location && (
                                <>
                                  <span>•</span>
                                  <MapPin className="w-3.5 h-3.5" />
                                  <span>{post.location}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-slate-400 hover:text-white hover:bg-[#0f1419]">
                          <MoreHorizontal className="w-5 h-5" />
                        </Button>
                      </div>

                      {/* Post Content */}
                      <div className="mb-4">
                        {post.title && (
                          <h3 className="font-bold text-orange-400 text-lg mb-3">
                            {post.title}
                          </h3>
                        )}
                        <p className="text-slate-200 text-base leading-relaxed whitespace-pre-wrap">
                          {post.content}
                        </p>
                        {post.tags && post.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-4">
                            {post.tags.map((tag, idx) => (
                              <Badge
                                key={idx}
                                variant="secondary"
                                className="text-xs bg-orange-500/10 border border-orange-500/30 text-orange-400 px-3 py-1"
                              >
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <Separator className="mb-3 bg-[#2d3748]" />

                      {/* Post Stats */}
                      <div className="flex items-center justify-between text-sm text-slate-300 mb-3 font-medium">
                        <span>{post.upvotes || 0} likes</span>
                        <span>{post.comments || 0} comments</span>
                      </div>

                      <Separator className="mb-3 bg-[#2d3748]" />

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleLike(post.id)}
                          className="flex-1 hover:bg-orange-500/10 hover:text-orange-400 text-slate-300 font-semibold py-2.5"
                          data-testid={`button-like-${post.id}`}
                        >
                          <Heart className="w-5 h-5 mr-2" />
                          Like
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 hover:bg-orange-500/10 hover:text-orange-400 text-slate-300 font-semibold py-2.5"
                          data-testid={`button-comment-${post.id}`}
                        >
                          <MessageSquare className="w-5 h-5 mr-2" />
                          Comment
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 hover:bg-orange-500/10 hover:text-orange-400 text-slate-300 font-semibold py-2.5"
                          data-testid={`button-share-${post.id}`}
                        >
                          <Share2 className="w-5 h-5 mr-2" />
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
            <Card className="bg-[#1a2332] shadow-xl border-2 border-[#2d3748]">
              <CardContent className="py-20 text-center">
                <Calendar className="w-20 h-20 mx-auto text-orange-500/30 mb-6" />
                <h3 className="text-2xl font-bold text-white mb-3">
                  No upcoming events
                </h3>
                <p className="text-slate-300 text-base mb-6">
                  Check back soon for community events in your area
                </p>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/50 px-8 py-6 text-lg">
                  <Plus className="w-5 h-5 mr-2" />
                  Create Event
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Trending Tab */}
        {activeTab === "trending" && (
          <div className="space-y-4">
            <Card className="bg-[#1a2332] shadow-xl border-2 border-[#2d3748]">
              <CardContent className="py-20 text-center">
                <TrendingUp className="w-20 h-20 mx-auto text-orange-500/30 mb-6" />
                <h3 className="text-2xl font-bold text-white mb-3">
                  Nothing trending yet
                </h3>
                <p className="text-slate-300 text-base">
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
