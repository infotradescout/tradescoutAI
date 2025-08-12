import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Search, 
  MapPin, 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown,
  Share2,
  Flag,
  Plus,
  TrendingUp,
  Users,
  Calendar,
  Bell,
  Filter,
  Hash
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
  { id: 'general', name: 'General Discussion', icon: MessageSquare },
  { id: 'recommendations', name: 'Contractor Recommendations', icon: ThumbsUp },
  { id: 'projects', name: 'Project Showcase', icon: Plus },
  { id: 'events', name: 'Local Events', icon: Calendar },
  { id: 'marketplace', name: 'Buy/Sell/Trade', icon: Share2 },
  { id: 'safety', name: 'Safety & Alerts', icon: Flag },
  { id: 'qa', name: 'Questions & Answers', icon: MessageSquare },
];

export default function Community() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("feed");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sortBy, setSortBy] = useState("trending");
  const [showCreatePost, setShowCreatePost] = useState(false);

  // Fetch community posts
  const { data: posts, isLoading: postsLoading } = useQuery<CommunityPost[]>({
    queryKey: ['/api/community/posts', selectedCategory, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (sortBy) params.append('sort', sortBy);
      
      const response = await fetch(`/api/community/posts?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch posts');
      return response.json();
    },
    enabled: activeTab === "feed",
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

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async ({ postId, voteType }: { postId: string; voteType: 'up' | 'down' }) => {
      return apiRequest('POST', `/api/community/posts/${postId}/vote`, { voteType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/posts'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to submit vote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleVote = (postId: string, voteType: 'up' | 'down') => {
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to vote on posts.",
        variant: "destructive",
      });
      return;
    }
    voteMutation.mutate({ postId, voteType });
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

  const getCategoryIcon = (categoryId: string) => {
    const category = POST_CATEGORIES.find(cat => cat.id === categoryId);
    return category ? category.icon : MessageSquare;
  };

  const filteredPosts = posts?.filter(post => 
    !searchQuery || 
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Community</h1>
        <p className="text-gray-300">Connect with neighbors and local contractors</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6 bg-slate-800 border-slate-700">
          <TabsTrigger value="feed" className="text-slate-300 data-[state=active]:text-white data-[state=active]:bg-slate-700">
            Community Feed
          </TabsTrigger>
          <TabsTrigger value="events" className="text-slate-300 data-[state=active]:text-white data-[state=active]:bg-slate-700">
            Local Events
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="text-slate-300 data-[state=active]:text-white data-[state=active]:bg-slate-700">
            Leaderboard
          </TabsTrigger>
          <TabsTrigger value="create" className="text-slate-300 data-[state=active]:text-white data-[state=active]:bg-slate-700">
            Create Post
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="space-y-6">
          {/* Search and Filters */}
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search posts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="all">All Categories</SelectItem>
                    {POST_CATEGORIES.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="trending">Trending</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="popular">Most Popular</SelectItem>
                    <SelectItem value="discussed">Most Discussed</SelectItem>
                  </SelectContent>
                </Select>

                <Button className="bg-orange-500 hover:bg-orange-600">
                  <Plus className="h-4 w-4 mr-2" />
                  New Post
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Posts Feed */}
          <div className="space-y-4">
            {postsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="bg-slate-800 border-slate-700 animate-pulse">
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <div className="w-10 h-10 bg-slate-600 rounded-full mr-3"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-slate-600 rounded mb-1"></div>
                        <div className="h-3 bg-slate-600 rounded w-1/2"></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 bg-slate-600 rounded"></div>
                      <div className="h-4 bg-slate-600 rounded w-3/4"></div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : filteredPosts.length > 0 ? (
              filteredPosts.map((post) => {
                const IconComponent = getCategoryIcon(post.category);
                return (
                  <Card key={post.id} className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors">
                    <CardContent className="p-6">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center">
                          <Avatar className="h-10 w-10 mr-3">
                            <AvatarImage src={post.author.avatar} />
                            <AvatarFallback className="bg-slate-600">
                              {post.author.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center">
                              <span className="font-medium text-white">{post.author.name}</span>
                              {post.author.verified && (
                                <Badge className="ml-2 bg-blue-500 text-xs">Verified</Badge>
                              )}
                              {post.pinned && (
                                <Badge className="ml-2 bg-green-500 text-xs">Pinned</Badge>
                              )}
                              {post.trending && (
                                <Badge className="ml-2 bg-orange-500 text-xs">
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                  Trending
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center text-sm text-gray-400">
                              <IconComponent className="h-3 w-3 mr-1" />
                              <span className="mr-2">{POST_CATEGORIES.find(c => c.id === post.category)?.name}</span>
                              <MapPin className="h-3 w-3 mr-1" />
                              <span className="mr-2">{post.location}</span>
                              <span>{formatTimeAgo(post.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="mb-4">
                        <h3 className="text-xl font-semibold text-white mb-2">{post.title}</h3>
                        <p className="text-gray-300 leading-relaxed">{post.content}</p>
                      </div>

                      {/* Tags */}
                      {post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-4">
                          {post.tags.map((tag, index) => (
                            <Badge key={index} variant="outline" className="border-slate-600 text-slate-400 text-xs">
                              <Hash className="h-3 w-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                        <div className="flex items-center space-x-6">
                          <button
                            onClick={() => handleVote(post.id, 'up')}
                            className={`flex items-center space-x-1 transition-colors ${
                              post.userVote === 'up' 
                                ? 'text-green-400' 
                                : 'text-gray-400 hover:text-green-400'
                            }`}
                          >
                            <ThumbsUp className="h-4 w-4" />
                            <span className="text-sm">{post.upvotes}</span>
                          </button>

                          <button
                            onClick={() => handleVote(post.id, 'down')}
                            className={`flex items-center space-x-1 transition-colors ${
                              post.userVote === 'down' 
                                ? 'text-red-400' 
                                : 'text-gray-400 hover:text-red-400'
                            }`}
                          >
                            <ThumbsDown className="h-4 w-4" />
                            <span className="text-sm">{post.downvotes}</span>
                          </button>

                          <button className="flex items-center space-x-1 text-gray-400 hover:text-blue-400 transition-colors">
                            <MessageSquare className="h-4 w-4" />
                            <span className="text-sm">{post.comments}</span>
                          </button>

                          <button className="flex items-center space-x-1 text-gray-400 hover:text-purple-400 transition-colors">
                            <Share2 className="h-4 w-4" />
                            <span className="text-sm">Share</span>
                          </button>
                        </div>

                        <button className="text-gray-400 hover:text-red-400 transition-colors">
                          <Flag className="h-4 w-4" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-12 text-center">
                  <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400 mb-4">No posts found matching your criteria.</p>
                  <Button className="bg-orange-500 hover:bg-orange-600">
                    <Plus className="h-4 w-4 mr-2" />
                    Be the first to post!
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {eventsLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="bg-slate-800 border-slate-700 animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-6 bg-slate-600 rounded mb-4"></div>
                    <div className="h-4 bg-slate-600 rounded mb-2"></div>
                    <div className="h-4 bg-slate-600 rounded w-3/4"></div>
                  </CardContent>
                </Card>
              ))
            ) : events?.length > 0 ? (
              events.map((event) => (
                <Card key={event.id} className="bg-slate-800 border-slate-700 hover:border-orange-500/50 transition-colors">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-white mb-2">{event.title}</h3>
                    <p className="text-gray-300 text-sm mb-4 line-clamp-2">{event.description}</p>
                    
                    <div className="space-y-2 text-sm text-gray-400 mb-4">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2" />
                        {event.date} at {event.time}
                      </div>
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-2" />
                        {event.location}
                      </div>
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2" />
                        {event.attendees} attending
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="border-orange-500/50 text-orange-400">
                        {event.category}
                      </Badge>
                      <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
                        Join Event
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-3 text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">No upcoming events in your area.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Community Leaderboard</CardTitle>
              <p className="text-gray-400">Top contributors this month</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Placeholder leaderboard */}
                <p className="text-center text-gray-400 py-8">
                  Leaderboard feature coming soon!
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create" className="space-y-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Create New Post</CardTitle>
              <p className="text-gray-400">Share with your community</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Title</label>
                    <Input 
                      placeholder="Enter post title" 
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Category</label>
                    <Select>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {POST_CATEGORIES.map(category => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Tags</label>
                    <Input 
                      placeholder="Enter tags separated by commas" 
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Content</label>
                    <Textarea 
                      placeholder="Write your post content..."
                      className="bg-slate-700 border-slate-600 text-white min-h-32"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Location</label>
                    <Input 
                      placeholder="City, State" 
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                  Save Draft
                </Button>
                <Button className="bg-orange-500 hover:bg-orange-600">
                  Publish Post
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}