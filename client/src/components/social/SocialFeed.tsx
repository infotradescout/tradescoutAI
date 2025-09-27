import { useState } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PostCard } from "./PostCard";
import { CreatePostModal } from "./CreatePostModal";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Search,
  TrendingUp,
  Users,
  MapPin,
  Filter,
  Globe
} from "lucide-react";

interface SocialFeedProps {
  className?: string;
}

export function SocialFeed({ className }: SocialFeedProps) {
  const { user, isAuthenticated } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [postType, setPostType] = useState('all');
  const [location, setLocation] = useState('neighborhood');
  const [sortBy, setSortBy] = useState('recent');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch social feed
  const {
    data: posts,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['/api/social/feed', { postType, location, sortBy, search: searchQuery }],
    queryFn: () => apiRequest('GET', '/api/social/feed', { 
      postType, 
      location, 
      sortBy, 
      search: searchQuery 
    }),
    enabled: isAuthenticated,
  });

  // Fetch trending topics
  const { data: trending } = useQuery({
    queryKey: ['/api/social/trending'],
    queryFn: () => apiRequest('GET', '/api/social/trending'),
  });

  // Fetch neighborhood stats
  const { data: neighborhoodStats } = useQuery({
    queryKey: ['/api/social/neighborhood-stats'],
    queryFn: () => apiRequest('GET', '/api/social/neighborhood-stats'),
    enabled: isAuthenticated,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    refetch();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Join Your Community</h1>
              <p className="text-muted-foreground">
                Connect with neighbors, contractors, and local professionals
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Share projects and recommendations</p>
              <p>• Get help from local experts</p>
              <p>• Stay updated on neighborhood news</p>
            </div>
            <Button className="w-full" size="lg">
              Sign In to Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Community Stats */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-4">
              {/* Neighborhood Stats */}
              {neighborhoodStats && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Your Neighborhood</h3>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Posts today</span>
                      <span className="font-medium">{neighborhoodStats.postsToday}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Active members</span>
                      <span className="font-medium">{neighborhoodStats.activeMembers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">New members</span>
                      <span className="font-medium">{neighborhoodStats.newMembers}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Trending Topics */}
              {trending && Array.isArray(trending) && trending.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Trending</h3>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {trending.slice(0, 8).map((tag: any, index: number) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                          onClick={() => {
                            setSearchQuery(tag.tag);
                            refetch();
                          }}
                        >
                          #{tag.tag} ({tag.count})
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Main Feed */}
          <div className="lg:col-span-3">
            <div className="space-y-6">
              {/* Header & Controls */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h1 className="text-3xl font-bold">Community Feed</h1>
                    <p className="text-muted-foreground">
                      Connect with your neighborhood and local professionals
                    </p>
                  </div>
                  
                  <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2"
                    size="lg"
                  >
                    <Plus className="h-5 w-5" />
                    Create Post
                  </Button>
                </div>

                {/* Filters & Search */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                      {/* Search */}
                      <form onSubmit={handleSearch} className="flex-1">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search posts, people, or topics..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </form>

                      {/* Filters */}
                      <div className="flex gap-2">
                        <Select value={postType} onValueChange={setPostType}>
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Posts</SelectItem>
                            <SelectItem value="general">General</SelectItem>
                            <SelectItem value="projects">Projects</SelectItem>
                            <SelectItem value="recommendations">Recommendations</SelectItem>
                            <SelectItem value="questions">Questions</SelectItem>
                            <SelectItem value="marketplace">Marketplace</SelectItem>
                            <SelectItem value="events">Events</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select value={location} onValueChange={setLocation}>
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="neighborhood">Neighborhood</SelectItem>
                            <SelectItem value="county">County</SelectItem>
                            <SelectItem value="state">State</SelectItem>
                            <SelectItem value="national">National</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="recent">Recent</SelectItem>
                            <SelectItem value="popular">Popular</SelectItem>
                            <SelectItem value="trending">Trending</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Posts Feed */}
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-6">
                        <div className="flex items-start space-x-3">
                          <div className="w-10 h-10 bg-secondary rounded-full"></div>
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-secondary rounded w-1/4"></div>
                            <div className="h-4 bg-secondary rounded w-full"></div>
                            <div className="h-4 bg-secondary rounded w-3/4"></div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : error ? (
                <Card className="border-destructive">
                  <CardContent className="p-6 text-center">
                    <p className="text-destructive">Failed to load community feed</p>
                    <Button
                      variant="outline"
                      onClick={() => refetch()}
                      className="mt-2"
                    >
                      Try Again
                    </Button>
                  </CardContent>
                </Card>
              ) : posts && Array.isArray(posts) && posts.length > 0 ? (
                <div className="space-y-4">
                  {posts.map((post: any) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <div className="space-y-4">
                      <Globe className="h-12 w-12 mx-auto text-muted-foreground" />
                      <div>
                        <h3 className="text-lg font-semibold">No posts found</h3>
                        <p className="text-muted-foreground">
                          {searchQuery
                            ? "Try adjusting your search or filters"
                            : "Be the first to share something with your community"}
                        </p>
                      </div>
                      {!searchQuery && (
                        <Button
                          onClick={() => setIsCreateModalOpen(true)}
                          className="mx-auto"
                        >
                          Create First Post
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Post Modal */}
      <CreatePostModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />
    </div>
  );
}