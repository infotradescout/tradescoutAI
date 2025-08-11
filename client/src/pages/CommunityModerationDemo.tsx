import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ModerationButtons } from "@/components/moderation/ModerationButtons";
import { useAuth } from "@/hooks/useAuth";
import { 
  Users, 
  TrendingUp, 
  Shield, 
  MessageSquare, 
  ChevronUp, 
  ChevronDown,
  Flag,
  EyeOff,
  Clock,
  MapPin
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DemoPost {
  id: string;
  authorId: string;
  content: string;
  postType: string;
  location: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
  };
  votes: {
    upvotes: number;
    downvotes: number;
    flags: number;
    score: number;
  };
}

export default function CommunityModerationDemo() {
  const { isAuthenticated } = useAuth();

  const [demoPosts, setDemoPosts] = useState<DemoPost[]>([
    {
      id: "demo-1",
      authorId: "user1",
      content: "Great local plumber found! Mike's Plumbing fixed our kitchen sink leak in 30 minutes and charged a fair price. Highly recommend for anyone in the downtown area!",
      postType: "recommendation",
      location: "Downtown LA",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      author: {
        id: "user1",
        username: "sarah_homes",
        firstName: "Sarah",
        lastName: "Johnson",
        profileImageUrl: "https://images.unsplash.com/photo-1494790108755-2616b612b35c?w=100&h=100&fit=crop&crop=face"
      },
      votes: { upvotes: 12, downvotes: 1, flags: 0, score: 11 }
    },
    {
      id: "demo-2",
      authorId: "user2", 
      content: "Community cleanup this Saturday at Riverside Park! Bring gloves and water bottles. Let's make our neighborhood shine! 🌟",
      postType: "event",
      location: "Riverside Park",
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      author: {
        id: "user2",
        username: "mike_community",
        firstName: "Mike",
        lastName: "Davis",
        profileImageUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
      },
      votes: { upvotes: 24, downvotes: 0, flags: 0, score: 24 }
    },
    {
      id: "demo-3",
      authorId: "user3",
      content: "WARNING: Fake contractor going door-to-door asking for upfront payment. Claims to be 'Johnson Construction' but has no license. Called them out and they left quickly.",
      postType: "safety",
      location: "Oak Street Area", 
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      author: {
        id: "user3",
        username: "jenny_watchful",
        firstName: "Jenny",
        lastName: "Martinez",
        profileImageUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face"
      },
      votes: { upvotes: 45, downvotes: 2, flags: 0, score: 43 }
    },
    {
      id: "demo-4",
      authorId: "user4",
      content: "Does anyone else think these new traffic lights on Main St are unnecessary? They're making traffic worse and costing taxpayers money we don't have.",
      postType: "discussion",
      location: "Main Street",
      createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      author: {
        id: "user4", 
        username: "alex_concerned",
        firstName: "Alex",
        lastName: "Thompson",
        profileImageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face"
      },
      votes: { upvotes: 8, downvotes: 15, flags: 1, score: -7 }
    },
    {
      id: "demo-5",
      authorId: "user5",
      content: "SCAM ALERT: Someone calling about 'car warranty' but asking for social security numbers. Hang up immediately! They're targeting seniors in our area.",
      postType: "safety",
      location: "Senior Housing District",
      createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
      author: {
        id: "user5",
        username: "maria_protector", 
        firstName: "Maria",
        lastName: "Rodriguez",
        profileImageUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face"
      },
      votes: { upvotes: 67, downvotes: 0, flags: 0, score: 67 }
    }
  ]);

  const getPostTypeColor = (postType: string) => {
    switch (postType) {
      case "recommendation": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "event": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "safety": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "discussion": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 20) return "text-green-600 dark:text-green-400";
    if (score >= 5) return "text-blue-600 dark:text-blue-400";
    if (score >= 0) return "text-gray-600 dark:text-gray-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Community Moderation System
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
            Neighborhood-controlled content with upvote/downvote democracy
          </p>
          
          {/* System Overview */}
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <ChevronUp className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-semibold">Community Voting</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Upvote/downvote system
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="font-semibold">Self-Moderating</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Automatic content filtering
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-purple-600" />
                  <div>
                    <div className="font-semibold">Local Focus</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Neighborhood-specific
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-orange-600" />
                  <div>
                    <div className="font-semibold">Democratic</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Community-driven decisions
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Moderation Info */}
        <Card className="mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
              <Shield className="h-5 w-5" />
              How Community Moderation Works
            </CardTitle>
          </CardHeader>
          <CardContent className="text-blue-800 dark:text-blue-200">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Voting System:</h4>
                <ul className="space-y-1 text-sm">
                  <li>• <strong>Upvote</strong> helpful, accurate, or valuable content</li>
                  <li>• <strong>Downvote</strong> low-quality or inappropriate posts</li>
                  <li>• <strong>Flag</strong> content that violates community guidelines</li>
                  <li>• <strong>Hide</strong> content that should be removed (trusted users)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Automatic Actions:</h4>
                <ul className="space-y-1 text-sm">
                  <li>• Posts with score below -10 are automatically hidden</li>
                  <li>• High-scored content gets promoted visibility</li>
                  <li>• Multiple flags trigger community review</li>
                  <li>• Local users' votes carry more weight</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Demo Posts */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Live Community Posts
            </h2>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              ✨ Interactive Demo
            </Badge>
          </div>

          {demoPosts
            .sort((a, b) => b.votes.score - a.votes.score)
            .map((post) => (
            <Card 
              key={post.id} 
              className={`hover:shadow-md transition-shadow ${
                post.votes.score < -5 ? 'opacity-50 border-red-200 dark:border-red-800' : ''
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={post.author.profileImageUrl} />
                      <AvatarFallback>
                        {post.author.firstName[0]}{post.author.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold text-sm">
                        {post.author.firstName} {post.author.lastName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <span>@{post.author.username}</span>
                        <Clock className="h-3 w-3" />
                        <span>{formatDistanceToNow(new Date(post.createdAt))} ago</span>
                        <MapPin className="h-3 w-3" />
                        <span>{post.location}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getPostTypeColor(post.postType)}>
                      {post.postType}
                    </Badge>
                    <div className={`text-lg font-bold ${getScoreColor(post.votes.score)}`}>
                      {post.votes.score > 0 ? `+${post.votes.score}` : post.votes.score}
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="prose dark:prose-invert max-w-none mb-4">
                  <p className="text-sm leading-relaxed">{post.content}</p>
                </div>

                {/* Status Indicators */}
                {post.votes.score < -5 && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                      <EyeOff className="h-4 w-4" />
                      <span className="text-sm font-medium">Content hidden by community votes</span>
                    </div>
                  </div>
                )}

                {post.votes.flags > 0 && (
                  <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                      <Flag className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {post.votes.flags} community flag{post.votes.flags !== 1 ? 's' : ''} - Under review
                      </span>
                    </div>
                  </div>
                )}

                {/* Live Moderation Buttons */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <ModerationButtons 
                      targetType="post" 
                      targetId={post.id}
                    />
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <ChevronUp className="h-3 w-3 text-green-500" />
                        <span>{post.votes.upvotes}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ChevronDown className="h-3 w-3 text-red-500" />
                        <span>{post.votes.downvotes}</span>
                      </div>
                      {post.votes.flags > 0 && (
                        <div className="flex items-center gap-1">
                          <Flag className="h-3 w-3 text-yellow-500" />
                          <span>{post.votes.flags}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" />
                        <span>12 comments</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {!isAuthenticated && (
          <Card className="mt-8 bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
            <CardContent className="text-center py-8">
              <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-2">
                Join the Community
              </h3>
              <p className="text-orange-700 dark:text-orange-300 mb-4">
                Create an account to vote on posts and help moderate your neighborhood community!
              </p>
              <div className="space-x-4">
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => window.location.href = '/register'}
                >
                  Create Account
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = '/login'}
                  className="border-orange-300 text-orange-700 hover:bg-orange-100"
                >
                  Login
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}