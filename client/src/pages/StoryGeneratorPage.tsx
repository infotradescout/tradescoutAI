import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StoryGenerator } from "@/components/StoryGenerator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowLeft, FileText, Eye, Share2, Edit, Trash2, Copy, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface GeneratedStory {
  id: string;
  title: string;
  content: string;
  templateId: string;
  isPublic: boolean;
  isPinned: boolean;
  viewCount: number;
  shareCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function StoryGeneratorPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStory, setSelectedStory] = useState<GeneratedStory | null>(null);

  // Fetch user's saved stories
  const { data: savedStories = [], isLoading: isLoadingStories } = useQuery({
    queryKey: ["/api/stories"],
    retry: false,
  });

  // Save story mutation
  const saveStoryMutation = useMutation({
    mutationFn: async (storyData: any) => {
      return await apiRequest("/api/stories", "POST", storyData);
    },
    onSuccess: () => {
      toast({
        title: "Story Saved",
        description: "Your professional story has been saved successfully.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stories"] });
    },
    onError: (error) => {
      console.error("Save story error:", error);
      toast({
        title: "Save Failed",
        description: "Failed to save your story. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete story mutation
  const deleteStoryMutation = useMutation({
    mutationFn: async (storyId: string) => {
      return await apiRequest(`/api/stories/${storyId}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Story Deleted",
        description: "Your story has been removed successfully.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stories"] });
      setSelectedStory(null);
    },
    onError: (error) => {
      console.error("Delete story error:", error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete the story. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStoryGenerated = async (story: any) => {
    // Auto-save generated stories
    await saveStoryMutation.mutateAsync({
      title: story.title,
      content: story.content,
      templateId: story.templateId,
      userInputs: story.userInputs || {},
      isPublic: false,
      isPinned: false,
    });
  };

  const handleCopyStory = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copied!",
      description: "Story content copied to clipboard.",
      variant: "default",
    });
  };

  const handleDeleteStory = (storyId: string) => {
    if (confirm("Are you sure you want to delete this story?")) {
      deleteStoryMutation.mutate(storyId);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (!user) {
    return (
      <div className="bg-gradient-to-br from-navy-900 to-navy-800 flex items-center justify-center py-24">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-gray-600">
              Please log in to access the story generator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-navy-900 to-navy-800 p-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/contractor-dashboard">
              <Button
                variant="outline"
                size="sm"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-4">Professional Story Generator</h1>
            <p className="text-gray-300 text-lg max-w-2xl mx-auto">
              Create compelling professional narratives to enhance your profile and connect with
              potential clients. Choose from different story templates and let AI help craft your
              unique story.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Story Generator */}
          <div className="lg:col-span-2">
            <Card className="bg-navy-700 border-navy-600">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Generate Your Story
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StoryGenerator />
              </CardContent>
            </Card>
          </div>

          {/* Saved Stories */}
          <div>
            <Card className="bg-navy-700 border-navy-600">
              <CardHeader>
                <CardTitle className="text-white">Your Stories</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingStories ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-gray-600 rounded mb-2"></div>
                        <div className="h-3 bg-gray-700 rounded w-3/4"></div>
                      </div>
                    ))}
                  </div>
                ) : (savedStories as GeneratedStory[]).length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400 mb-4">No stories yet</p>
                    <p className="text-gray-500 text-sm">
                      Generate your first professional story using the form
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(savedStories as GeneratedStory[]).map((story: GeneratedStory) => (
                      <div
                        key={story.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedStory?.id === story.id
                            ? "border-blue-500 bg-blue-900/20"
                            : "border-gray-600 hover:border-gray-500"
                        }`}
                        onClick={() => setSelectedStory(story)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-white font-medium text-sm mb-1">{story.title}</h4>
                            <p className="text-gray-400 text-xs mb-2">
                              {formatDate(story.createdAt)}
                            </p>
                            <div className="flex items-center gap-2 text-xs">
                              {story.isPinned && (
                                <Badge
                                  variant="outline"
                                  className="border-yellow-500 text-yellow-500"
                                >
                                  <Star className="h-3 w-3 mr-1" />
                                  Pinned
                                </Badge>
                              )}
                              {story.isPublic && (
                                <Badge
                                  variant="outline"
                                  className="border-green-500 text-green-500"
                                >
                                  Public
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Story Actions */}
            {selectedStory && (
              <Card className="bg-navy-700 border-navy-600 mt-4">
                <CardHeader>
                  <CardTitle className="text-white text-lg">{selectedStory.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-gray-300 text-sm leading-relaxed">
                      {selectedStory.content}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Eye className="h-3 w-3" />
                      {selectedStory.viewCount} views
                      <Share2 className="h-3 w-3 ml-2" />
                      {selectedStory.shareCount} shares
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-gray-600 text-gray-300 hover:bg-gray-700"
                        onClick={() => handleCopyStory(selectedStory.content)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-600 text-red-400 hover:bg-red-900/20"
                        onClick={() => handleDeleteStory(selectedStory.id)}
                        disabled={deleteStoryMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
