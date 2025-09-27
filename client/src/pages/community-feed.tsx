import { memo, useState } from 'react';
import { MessageSquare, Zap, TrendingUp, MoreHorizontal, Image, Video, Calendar, Compass, Users2, Crown, Award, Flag, Plus, SlidersHorizontal, Trophy, BarChart3, Share, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const CommunityFeed = memo(function CommunityFeed() {
  const [activeTab, setActiveTab] = useState("feed");
  const [newPostContent, setNewPostContent] = useState("");
  const [showNewPostForm, setShowNewPostForm] = useState(false); // State to control the visibility of the new post form
  const [selectedCounty, setSelectedCounty] = useState(''); // Placeholder for county selection
  const user = { id: 'user123' }; // Placeholder for logged-in user

  // Placeholder for fetching posts and setting state
  const fetchPosts = async () => {
    // In a real app, this would fetch posts from an API
    console.log('Fetching posts...');
  };

  const handleCreatePost = async (postData: {
    title: string;
    content: string;
    type: 'discussion' | 'poll' | 'announcement';
    pollOptions?: string[];
  }) => {
    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...postData,
          countyId: selectedCounty,
          userId: user?.id
        })
      });
      if (response.ok) {
        fetchPosts(); // Refresh feed
        setShowNewPostForm(false); // Close the form after successful creation
        setNewPostContent(''); // Clear the input
      } else {
        console.error('Failed to create post:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to create post:', error);
    }
  };

  // Placeholder for handling post likes/votes
  const handleLikePost = async (postId: number) => {
    console.log(`Liking post ${postId}`);
    // In a real app, this would send a request to the API to like a post
  };

  const posts = [
    {
      id: 1,
      author: {
        name: "Mike Johnson",
        role: "Contractor",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face",
        verified: true,
        location: "Los Angeles County"
      },
      content: "Just finished a major kitchen renovation in Beverly Hills! The homeowners were thrilled with the custom cabinets and marble countertops. Before and after photos below - what do you think?",
      images: [
        "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=500&h=300&fit=crop",
        "https://images.unsplash.com/photo-1556909220-4c3de6e5e0d6?w=500&h=300&fit=crop"
      ],
      timestamp: "2 hours ago",
      likes: 47,
      comments: 12,
      shares: 8,
      liked: false,
      tags: ["kitchen", "renovation", "before-after"],
      type: "project_showcase"
    },
    {
      id: 2,
      author: {
        name: "Sarah Martinez",
        role: "Homeowner",
        avatar: "https://images.unsplash.com/photo-1494790108755-2616b169eece?w=40&h=40&fit=crop&crop=face",
        verified: false,
        location: "Orange County"
      },
      content: "Looking for recommendations for a reliable plumber in the Irvine area. Need someone who can handle a bathroom remodel with new fixtures and tile work. Any suggestions?",
      timestamp: "4 hours ago",
      likes: 23,
      comments: 18,
      shares: 3,
      liked: true,
      tags: ["plumber", "bathroom", "recommendation"],
      type: "recommendation_request"
    },
    {
      id: 3,
      author: {
        name: "Elite Landscaping Co.",
        role: "Service Provider",
        avatar: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=40&h=40&fit=crop",
        verified: true,
        location: "Riverside County"
      },
      content: "🌟 Special Spring Promotion! 20% off all landscape design consultations through April. Perfect time to plan your summer outdoor space. Book now through our TradeScout profile!",
      timestamp: "6 hours ago",
      likes: 34,
      comments: 7,
      shares: 15,
      liked: false,
      tags: ["landscaping", "promotion", "spring"],
      type: "promotion",
      isPinned: true
    },
    {
      id: 4,
      author: {
        name: "TradeScout Community",
        role: "Official",
        avatar: "/logo-small.png",
        verified: true,
        location: "Platform Wide"
      },
      content: "🏆 Congratulations to this month's top-rated contractors! Mike Johnson (Electrical), Sarah's Plumbing Solutions (Plumbing), and Elite Landscaping (Landscaping) have earned our Diamond badges for exceptional customer service.",
      timestamp: "1 day ago",
      likes: 156,
      comments: 43,
      shares: 28,
      liked: true,
      tags: ["awards", "recognition", "community"],
      type: "community_highlight",
      isPinned: true
    },
    {
      id: 5,
      author: {
        name: "David Chen",
        role: "Helper",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face",
        verified: false,
        location: "San Diego County"
      },
      content: "Available for weekend moving help and furniture assembly in San Diego area. Just completed my 50th job on TradeScout with 5-star ratings! DM me for quick responses.",
      timestamp: "1 day ago",
      likes: 19,
      comments: 5,
      shares: 2,
      liked: false,
      tags: ["helper", "moving", "furniture"],
      type: "service_available"
    }
  ];

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
                  {trendingTopics.map((topic, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-orange-400 hover:text-orange-300 cursor-pointer">
                        {topic.tag}
                      </span>
                      <span className="text-gray-400 text-sm">{topic.posts}</span>
                    </div>
                  ))}
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
                            onClick={() => handleCreatePost({
                              title: 'New Post', // Placeholder title
                              content: newPostContent,
                              type: 'discussion', // Default type, could be dynamic
                              // pollOptions: [] // Add poll options if type is 'poll'
                            })}
                            disabled={!newPostContent.trim()}
                          >
                            Post
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <TabsContent value="feed" className="mt-0">
                <div className="space-y-6">
                  {posts.map((post) => (
                    <Card key={post.id} className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                      <CardContent className="p-6">
                        {/* Post Header */}
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex gap-3">
                            <Avatar className="w-12 h-12">
                              <AvatarImage src={post.author.avatar} />
                              <AvatarFallback>{post.author.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                            </Avatar>

                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-white font-semibold">{post.author.name}</h3>
                                {post.author.verified && (
                                  <Badge className="bg-blue-600 hover:bg-blue-700 text-xs">
                                    Verified
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {post.author.role}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-2 text-sm text-gray-400">
                                <span>{post.timestamp}</span>
                                <span>•</span>
                                <div className="flex items-center gap-1">
                                  <Compass className="h-3 w-3" />
                                  {post.author.location}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              {getPostTypeIcon(post.type)}
                              <span className="text-xs text-gray-400">{getPostTypeLabel(post.type)}</span>
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
                          <p className="text-gray-300 mb-3">{post.content}</p>

                          {post.tags && post.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {post.tags.map((tag, index) => (
                                <span key={index} className="text-orange-400 text-sm hover:text-orange-300 cursor-pointer">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {post.images && post.images.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              {post.images.map((image, index) => (
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
                            >
                              <Zap className={`h-4 w-4 mr-1 ${post.liked ? 'fill-current' : ''}`} />
                              {post.likes}
                            </Button>

                            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-blue-400">
                              <MessageSquare className="h-4 w-4 mr-1" />
                              {post.comments}
                            </Button>

                            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-green-400">
                              <Share className="h-4 w-4 mr-1" />
                              {post.shares}
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