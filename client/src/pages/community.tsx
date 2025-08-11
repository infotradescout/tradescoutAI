import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MessageSquare, Heart, Users, MapPin, Plus, TrendingUp } from "lucide-react";
import type { CommunityPost } from "@shared/schema";

const createPostSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  content: z.string().min(1, "Content is required").max(2000, "Content must be less than 2000 characters"),
  category: z.string().min(1, "Category is required"),
  scope: z.enum(["county", "state", "regional"]),
  stateCode: z.string().optional(),
  countyFips: z.string().optional(),
});

const postCategories = [
  { value: "general", label: "General Discussion" },
  { value: "recommendations", label: "Contractor Recommendations" },
  { value: "project_showcase", label: "Project Showcase" },
  { value: "questions", label: "Questions & Help" },
  { value: "local_news", label: "Local News" },
  { value: "safety_tips", label: "Safety Tips" },
  { value: "deals_discounts", label: "Deals & Discounts" },
];

const scopes = [
  { value: "county", label: "County Level" },
  { value: "state", label: "State Level" },
  { value: "regional", label: "Regional Level" },
];

export default function CommunityPage() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [selectedScope, setSelectedScope] = useState<string>("county");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Fetch community posts
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["/api/community/posts", selectedScope, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams({
        scope: selectedScope,
        ...(selectedCategory && { category: selectedCategory }),
      });
      return await apiRequest(`/api/community/posts?${params}`);
    },
  });

  // Create post form
  const form = useForm({
    resolver: zodResolver(createPostSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "",
      scope: "county" as const,
      stateCode: "",
      countyFips: "",
    },
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
      form.reset();
      setShowCreateDialog(false);
    },
  });

  // Like post mutation
  const likePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      return await apiRequest(`/api/community/posts/${postId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
    },
  });

  const onSubmit = (data: z.infer<typeof createPostSchema>) => {
    createPostMutation.mutate(data);
  };

  const handleLikePost = (postId: string) => {
    if (!isAuthenticated) return;
    likePostMutation.mutate(postId);
  };

  const formatTimeAgo = (date: string | null) => {
    if (!date) return "Unknown";
    const now = new Date();
    const postDate = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - postDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  const getCategoryLabel = (category: string | null) => {
    if (!category) return "General";
    return postCategories.find(cat => cat.value === category)?.label || category;
  };

  const getScopeIcon = (scope: string | null) => {
    if (!scope) return <MapPin className="w-4 h-4" />;
    switch (scope) {
      case "county": return <MapPin className="w-4 h-4" />;
      case "state": return <Users className="w-4 h-4" />;
      case "regional": return <TrendingUp className="w-4 h-4" />;
      default: return <MapPin className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Community Feed</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Connect with your local community and share experiences
            </p>
          </div>
          
          {isAuthenticated && (
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="bg-orange-600 hover:bg-orange-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Post
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Post</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input placeholder="What's on your mind?" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="content"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Content</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Share your thoughts, experiences, or questions..."
                              rows={4}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {postCategories.map((category) => (
                                  <SelectItem key={category.value} value={category.value}>
                                    {category.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="scope"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Scope</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select scope" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {scopes.map((scope) => (
                                  <SelectItem key={scope.value} value={scope.value}>
                                    {scope.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end space-x-4">
                      <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createPostMutation.isPending}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        {createPostMutation.isPending ? "Creating..." : "Create Post"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <Select value={selectedScope} onValueChange={setSelectedScope}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scopes.map((scope) => (
                <SelectItem key={scope.value} value={scope.value}>
                  {scope.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Categories</SelectItem>
              {postCategories.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Posts Feed */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-400 mt-4">Loading posts...</p>
            </div>
          ) : posts.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No posts yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Be the first to start a conversation in your community!
                </p>
                {isAuthenticated && (
                  <Button 
                    onClick={() => setShowCreateDialog(true)}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    Create First Post
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            posts.map((post: CommunityPost) => (
              <Card key={post.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback className="bg-orange-100 text-orange-600">
                          {post.authorId.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          User {post.authorId.slice(0, 8)}
                        </p>
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <span>{formatTimeAgo(post.createdAt)}</span>
                          <span>•</span>
                          <div className="flex items-center space-x-1">
                            {getScopeIcon(post.scope)}
                            <span className="capitalize">{post.scope}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                      {getCategoryLabel(post.category)}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <CardTitle className="text-xl mb-3 text-gray-900 dark:text-white">
                    {post.title}
                  </CardTitle>
                  <p className="text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap">
                    {post.content}
                  </p>
                  
                  {/* Images would go here if implemented in schema */}

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center space-x-6">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleLikePost(post.id)}
                        className="text-gray-600 hover:text-red-600 hover:bg-red-50"
                        disabled={!isAuthenticated}
                      >
                        <Heart className="w-4 h-4 mr-1" />
                        {post.likeCount || 0}
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        {post.commentCount || 0}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}