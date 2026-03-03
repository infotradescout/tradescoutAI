import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ModerationButtons } from "@/components/moderation/ModerationButtons";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Share2, MapPin, Clock, Plus, Filter, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatContextTag } from "@/utils/formatContextTag";

interface CommunityPost {
  id: string;
  authorId: string;
  content: string;
  postType: string;
  privacyLevel: string;
  location?: string;
  county?: string;
  state?: string;
  tags: string[];
  images?: string[];
  viewCount: number;
  shareCount: number;
  createdAt: string;
  author: {
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
    profileImageUrl?: string;
  };
  _count: {
    comments: number;
    reactions: number;
  };
}

export default function CommunityFeed() {
  const { isAuthenticated, user } = useAuth();
  const { unreadCount } = useNotifications();
  const { toast } = useToast();
  const [newPostContent, setNewPostContent] = useState("");
  const [showNewPostForm, setShowNewPostForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Sample community posts - in a real app this would come from the API
  const samplePosts: CommunityPost[] = [
    {
      id: "post1",
      authorId: "user1",
      content:
        "Just moved to the neighborhood! Looking for recommendations for a good local mechanic. Anyone know someone reliable?",
      postType: "question",
      privacyLevel: "neighborhood",
      location: "Downtown",
      county: "Los Angeles County",
      state: "CA",
      tags: ["mechanic", "recommendations"],
      viewCount: 24,
      shareCount: 3,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      author: {
        id: "user1",
        username: "sarah_m",
        firstName: "Sarah",
        lastName: "Miller",
        profileImageUrl:
          "https://images.unsplash.com/photo-1494790108755-2616b612b35c?w=100&h=100&fit=crop&crop=face",
      },
      _count: {
        comments: 8,
        reactions: 15,
      },
    },
    {
      id: "post2",
      authorId: "user2",
      content:
        "Community garden cleanup this Saturday at 9am! Bring gloves and we'll provide tools. Let's make our neighborhood beautiful together! 🌱",
      postType: "event",
      privacyLevel: "neighborhood",
      location: "Riverside Park",
      county: "Los Angeles County",
      state: "CA",
      tags: ["community", "volunteering", "garden"],
      viewCount: 67,
      shareCount: 12,
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      author: {
        id: "user2",
        username: "mike_gardener",
        firstName: "Mike",
        lastName: "Johnson",
        profileImageUrl:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
      },
      _count: {
        comments: 23,
        reactions: 45,
      },
    },
    {
      id: "post3",
      authorId: "user3",
      content:
        "WARNING: Suspicious person going door-to-door claiming to be from the utility company. They're not wearing proper ID. Called non-emergency line to report.",
      postType: "safety",
      privacyLevel: "neighborhood",
      location: "Oak Street Area",
      county: "Los Angeles County",
      state: "CA",
      tags: ["safety", "alert", "scam"],
      viewCount: 156,
      shareCount: 34,
      createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      author: {
        id: "user3",
        username: "jenny_safety",
        firstName: "Jenny",
        lastName: "Williams",
        profileImageUrl:
          "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
      },
      _count: {
        comments: 12,
        reactions: 89,
      },
    },
  ];

  const getPostTypeColor = (postType: string) => {
    switch (postType) {
      case "question":
        return "bg-blue-100 text-blue-800";
      case "event":
        return "bg-green-100 text-green-800";
      case "safety":
        return "bg-red-100 text-red-800";
      case "general":
        return "bg-white/5 text-white/70";
      default:
        return "bg-white/5 text-white/70";
    }
  };

  const filteredPosts = (samplePosts || []).filter((post) => {
    if (!post) return false;
    if (filter !== "all" && post.postType !== filter) return false;
    if (searchQuery && !post.content.toLowerCase().includes(searchQuery.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="">
      <div className="max-w-4xl mx-auto ts-surface px-4 py-6 md:px-10 md:py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-ts-orange mb-2">Community Feed</h1>
          <p className="text-white/60 dark:text-white/70">
            Connect with your neighbors and stay informed about local happenings
          </p>
        </div>

        {/* Search and Filter Bar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 h-4 w-4" />
            <Input
              placeholder="Search community posts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
              className="h-10"
            >
              All
            </Button>
            <Button
              variant={filter === "question" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("question")}
              className="h-10"
            >
              Questions
            </Button>
            <Button
              variant={filter === "event" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("event")}
              className="h-10"
            >
              Events
            </Button>
            <Button
              variant={filter === "safety" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("safety")}
              className="h-10"
            >
              Safety
            </Button>
          </div>
        </div>

        {/* New Post Button */}
        {isAuthenticated && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              {!showNewPostForm ? (
                <Button
                  onClick={() => setShowNewPostForm(true)}
                  className="w-full justify-start text-left"
                  variant="outline"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Share something with your community...
                </Button>
              ) : (
                <div className="space-y-4">
                  <Textarea
                    placeholder="What's happening in your neighborhood?"
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    className="min-h-[100px]"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowNewPostForm(false);
                        setNewPostContent("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        toast({
                          title: "Post created!",
                          description: "Your post has been shared with the community.",
                        });
                        setShowNewPostForm(false);
                        setNewPostContent("");
                      }}
                      disabled={!newPostContent.trim()}
                    >
                      Post
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Community Posts */}
        <div className="space-y-6">
          {(filteredPosts || []).map((post) => (
            <Card key={post.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={post.author.profileImageUrl} />
                      <AvatarFallback>
                        {post.author.firstName?.[0]}
                        {post.author.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold text-sm">
                        {post.author.firstName} {post.author.lastName}
                      </div>
                      <div className="text-xs text-white/60 flex items-center gap-2">
                        <span>@{post.author.username}</span>
                        <Clock className="h-3 w-3" />
                        <span>{formatDistanceToNow(new Date(post.createdAt))} ago</span>
                        {post.location && (
                          <>
                            <MapPin className="h-3 w-3" />
                            <span>{post.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge className={getPostTypeColor(post.postType)}>{post.postType}</Badge>
                </div>
              </CardHeader>

              <CardContent>
                <div className="prose dark:prose-invert max-w-none mb-4">
                  <p className="text-sm leading-relaxed">{post.content}</p>
                </div>

                {(post.tags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {(post.tags || [])
                      .map((tag) => formatContextTag(tag))
                      .filter(Boolean)
                      .slice(0, 8)
                      .map((tag, idx) => (
                        <Badge key={`${tag}-${idx}`} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                  </div>
                )}

                {/* Community Moderation Buttons */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <ModerationButtons targetType="post" targetId={post.id} />

                    <div className="flex items-center gap-4 text-sm text-white/60">
                      <button className="flex items-center gap-1 hover:text-blue-600 transition-colors">
                        <MessageSquare className="h-4 w-4" />
                        <span>{post._count.comments}</span>
                      </button>
                      <button className="flex items-center gap-1 hover:text-green-600 transition-colors">
                        <Share2 className="h-4 w-4" />
                        <span>{post.shareCount}</span>
                      </button>
                      <span className="flex items-center gap-1">
                        <span>{post.viewCount} views</span>
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* No Posts Message */}
        {filteredPosts.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-white/60 dark:text-white/60 mb-4">
                {searchQuery || filter !== "all"
                  ? "No posts match your current filters."
                  : "No community posts yet."}
              </p>
              {isAuthenticated && (
                <Button onClick={() => setShowNewPostForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create the first post
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
