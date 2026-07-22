import { memo, useState, ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings as SettingsIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Heart, Share2, Image as ImageIcon } from "lucide-react";
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
  CommunityBuilderImpactWidget,
} from "@/components/dashboard/DashboardWidgets";
import { LocalImpactCard } from "@/components/dashboard/LocalImpactCard";
import { HoaLeadershipBadge } from "@/components/dashboard/HoaLeadershipBadge";
import { uploadObject } from "@/lib/objectUpload";
import { share } from "@/utils/share";
import { Page, Section } from "@/components/layout/PagePrimitives";
import { buildCommunityPostPath } from "@shared/communityPostShare";

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
  const { user } = useAuth();
  const isCommunityFirst = Boolean((user as any)?.communityFirst);

  // Workspace resolution fallback
  // NOTE: This still gates the personalized dashboard experience,
  // but community-first users get a softer empty state.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyGlobal: any =
    typeof (globalThis as any).workspace !== "undefined"
      ? (globalThis as any).workspace
      : undefined;
  const workspaceId =
    anyGlobal?.id || (user as any)?.workspaceId || (user as any)?.businessId || null;
  const isAuthenticated = Boolean(user);
  const canLoadDashboard =
    isAuthenticated &&
    Boolean((user as any)?.location?.state || (user as any)?.location?.county) &&
    Boolean(workspaceId);
  const [newPostContent, setNewPostContent] = useState("");
  const [showNewPostForm, setShowNewPostForm] = useState(false);
  const [newPostImages, setNewPostImages] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading: preferencesLoading } = useQuery({
    queryKey: ["/api/users/preferences"],
    enabled: canLoadDashboard,
  });

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ["/api/community/posts"],
    enabled: canLoadDashboard,
  });

  const handleImagesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const remainingSlots = Math.max(0, 8 - newPostImages.length);
    const files = Array.from(event.target.files || []).slice(0, remainingSlots);

    const uploaded: string[] = [];
    for (const file of files) {
      try {
        const { publicUrl } = await uploadObject(file);
        uploaded.push(publicUrl);
      } catch (error) {
        console.error("Failed to upload dashboard post image", error);
      }
    }

    if (uploaded.length) {
      setNewPostImages((prev) => [...prev, ...uploaded].slice(0, 8));
    }

    event.target.value = "";
  };

  const createPostMutation = useMutation({
    mutationFn: async (postData: { content: string; title?: string; images?: string[] }) => {
      const response = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: postData.content,
          title: postData.title,
          images: postData.images,
          postType: "discussion",
          visibility: "public",
        }),
      });
      if (!response.ok) throw new Error("Failed to create post");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
      setShowNewPostForm(false);
      setNewPostContent("");
      setNewPostImages([]);
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
    },
  });

  const likePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await fetch(`/api/community/posts/${postId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to like post");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
    },
  });

  const handleCreatePost = () => {
    if (!newPostContent.trim()) return;
    createPostMutation.mutate({
      content: newPostContent,
      images: newPostImages.length ? newPostImages : undefined,
    });
  };

  const handleLikePost = (postId: string) => {
    likePostMutation.mutate(postId);
  };

  const posts = postsData || [];

  type DashboardWidgetId = (typeof AVAILABLE_WIDGETS)[number]["id"];

  const defaultEnabledWidgets: DashboardWidgetId[] = AVAILABLE_WIDGETS.filter(
    (w) => w.defaultEnabled
  ).map((w) => w.id);

  const dashboardPrefs = (preferences && (preferences as any).dashboard) || {};

  const enabledWidgets: DashboardWidgetId[] = Array.isArray(dashboardPrefs.enabledWidgets)
    ? (dashboardPrefs.enabledWidgets.filter((id: string): id is DashboardWidgetId =>
        AVAILABLE_WIDGETS.some((w) => w.id === id)
      ) as DashboardWidgetId[])
    : defaultEnabledWidgets;

  const defaultWidgetOrder: DashboardWidgetId[] = AVAILABLE_WIDGETS.map((w) => w.id);

  let widgetOrder: DashboardWidgetId[] =
    Array.isArray(dashboardPrefs.widgetOrder) && dashboardPrefs.widgetOrder.length
      ? (dashboardPrefs.widgetOrder.filter((id: string): id is DashboardWidgetId =>
          AVAILABLE_WIDGETS.some((w) => w.id === id)
        ) as DashboardWidgetId[])
      : defaultWidgetOrder;

  // Ensure the widget order stays in sync with AVAILABLE_WIDGETS
  const availableIdSet = new Set<DashboardWidgetId>(defaultWidgetOrder);
  widgetOrder = widgetOrder.filter((id) => availableIdSet.has(id));
  defaultWidgetOrder.forEach((id) => {
    if (!widgetOrder.includes(id)) {
      widgetOrder.push(id);
    }
  });

  const orderedEnabledWidgets = widgetOrder.filter((id) => enabledWidgets.includes(id));

  const widgetComponents: Record<string, React.ComponentType<{ className?: string }>> = {
    "activity-stats": ActivityStatsWidget,
    "quick-actions": QuickActionsWidget,
    "recent-projects": RecentProjectsWidget,
    "saved-contractors": SavedContractorsWidget,
    "messages-preview": MessagesPreviewWidget,
    notifications: NotificationsWidget,
    "community-feed": CommunityFeedWidget,
    "affiliate-stats": AffiliateStatsWidget,
    "community-builder-impact": CommunityBuilderImpactWidget,
  };

  if (!canLoadDashboard) {
    if (isCommunityFirst) {
      return (
        <div className="h-full flex items-center justify-center text-center text-muted-foreground bg-background">
          <div className="max-w-md px-6 space-y-3">
            <h1 className="text-lg font-semibold text-foreground">
              Your tools live here when you need them
            </h1>
            <p className="text-sm text-muted-foreground">
              Use this dashboard to keep track of your Direct Connect requests, saved pros, and
              activity as your community life grows.
            </p>
            <p className="text-sm text-muted-foreground">
              For now, see what&apos;s happening in your community and come back here whenever you
              want to organize things.
            </p>
            <div className="mt-4">
              <Link href="/community-feed">
                <Button className="w-full">Open community feed</Button>
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="h-full flex items-center justify-center text-center text-muted-foreground">
        Finish setup to unlock your dashboard.
      </div>
    );
  }
  if (preferencesLoading) {
    return (
      <div className="h-full bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Page className="max-w-6xl pb-16 lg:pb-0">
      <Section
        title={`Welcome back, ${user?.firstName || "Friend"}!`}
        subtitle="Here's what's happening in your community"
        actions={
          <Link href="/dashboard-settings">
            <Button variant="outline" size="sm" data-testid="button-customize-dashboard">
              <SettingsIcon className="h-4 w-4 mr-2" />
              Customize
            </Button>
          </Link>
        }
      >
        {/* Local Impact (always visible) */}
        <LocalImpactCard className="mb-0" />

        {/* HOA Leadership / Membership (if applicable) */}
        <HoaLeadershipBadge className="bg-tsBg dark:bg-white/5 border-0 shadow-sm" />

        {/* Snapshot Grid + Live Activity Feed */}
        <div className="space-y-6">
          {/* Live Activity Feed */}
          <div className="space-y-4">
            {/* New Post Composer */}
            <Card className="bg-tsCard dark:bg-white/5 border border-white/10 shadow-sm rounded-xl">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.profileImageUrl} />
                    <AvatarFallback className="bg-ts-orange text-white">
                      {user?.firstName?.[0] || user?.email?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                  {!showNewPostForm ? (
                    <button
                      onClick={() => setShowNewPostForm(true)}
                      className="flex-1 text-left px-4 py-2.5 rounded-full bg-white/5 dark:bg-white/10 text-white/60 dark:text-white/60 hover:bg-white/10 dark:hover:bg-white/10 transition-colors text-sm"
                      data-testid="button-create-post"
                    >
                      What's on your mind?
                    </button>
                  ) : (
                    <div className="flex-1 space-y-3">
                      <Textarea
                        placeholder="Share an update, ask for trusted local signals, or post a project..."
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        className="min-h-[100px] border-white/10 dark:border-white/15 resize-none"
                        data-testid="input-post-content"
                      />
                      {newPostImages.length > 0 && (
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {newPostImages.map((url, index) => (
                            <div
                              key={url + index}
                              className="relative w-full overflow-hidden rounded-md border border-white/10 dark:border-white/15 bg-black/40"
                              style={{ paddingBottom: "70%" }}
                            >
                              <img
                                src={url}
                                alt="Post image"
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                              <button
                                type="button"
                                className="absolute top-1 right-1 bg-black/70 rounded-full px-1 text-[10px] leading-none text-white"
                                onClick={() =>
                                  setNewPostImages((prev) => prev.filter((_, i) => i !== index))
                                }
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <label className="inline-flex items-center gap-2 text-xs text-white/60 dark:text-white/60 cursor-pointer hover:text-white/70 dark:hover:text-white/70">
                          <ImageIcon className="h-4 w-4" />
                          <span>Add photos</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleImagesSelected}
                          />
                        </label>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowNewPostForm(false);
                              setNewPostContent("");
                              setNewPostImages([]);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleCreatePost}
                            disabled={!newPostContent.trim() || createPostMutation.isPending}
                            size="sm"
                            className="bg-ts-orange-dark hover:bg-ts-orange-dark text-white"
                            data-testid="button-submit-post"
                          >
                            {createPostMutation.isPending ? "Posting..." : "Post"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Community Posts Feed */}
            {postsLoading ? (
              <Card className="bg-tsBg dark:bg-white/5 border-0 shadow-sm">
                <CardContent className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ts-orange/30 mx-auto"></div>
                  <p className="text-white/60 dark:text-white/60 mt-4 text-sm">Loading feed...</p>
                </CardContent>
              </Card>
            ) : !Array.isArray(posts) || posts.length === 0 ? (
              <Card className="bg-tsBg dark:bg-white/5 border-0 shadow-sm">
                <CardContent className="p-12 text-center">
                  <h3 className="text-lg font-semibold mb-2 text-ts-orange">
                    Welcome to your neighborhood!
                  </h3>
                  <p className="text-sm text-white/60 dark:text-white/60">
                    Be the first to share something with your community.
                  </p>
                </CardContent>
              </Card>
            ) : (
              Array.isArray(posts) &&
              posts.map((post: Post) => (
                <Card
                  key={post.id}
                  className="bg-tsBg dark:bg-white/5 border-0 shadow-sm hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-blue-500 text-white text-sm">
                          {post.authorId?.charAt(0)?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="font-semibold text-sm text-ts-orange">Neighbor</h4>
                          {post.postType === "promotion" && (
                            <Badge className="bg-ts-orange/10 text-ts-orange dark:bg-ts-orange/10 dark:text-ts-orange text-xs">
                              Contractor
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-white/60 dark:text-white/60">
                          {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>

                    {post.title && (
                      <h3 className="text-base font-semibold mb-2 text-ts-orange">{post.title}</h3>
                    )}
                    <p className="text-sm text-white/70 dark:text-white/70 mb-2 whitespace-pre-wrap">
                      {post.content}
                    </p>

                    {(() => {
                      const images =
                        (post as any).imageUrls && Array.isArray((post as any).imageUrls)
                          ? ((post as any).imageUrls as string[])
                          : Array.isArray(post.images)
                            ? post.images
                            : [];
                      return images.length > 0 ? (
                        <div className="mb-3 grid grid-cols-2 gap-2">
                          {images.slice(0, 4).map((url, index) => (
                            <div
                              key={url + index}
                              className="relative w-full overflow-hidden rounded-md border border-white/10 dark:border-white/10 bg-black/40"
                              style={{ paddingBottom: "70%" }}
                            >
                              <img
                                src={url}
                                alt="Post image"
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      ) : null;
                    })()}

                    {(post.likeCount > 0 || post.commentCount > 0) && (
                      <div className="flex items-center gap-4 text-xs text-white/60 dark:text-white/60 mb-2 pb-2 border-b border-white/10 dark:border-white/10">
                        {post.likeCount > 0 && (
                          <span>
                            {post.likeCount} {post.likeCount === 1 ? "like" : "likes"}
                          </span>
                        )}
                        {post.commentCount > 0 && (
                          <span>
                            {post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-around gap-1">
                      <button
                        onClick={() => handleLikePost(post.id)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 text-white/60 dark:text-white/60 hover:bg-white/5 dark:hover:bg-white/10 rounded-lg transition-colors"
                        data-testid={`button-like-${post.id}`}
                      >
                        <Heart className="h-4 w-4" />
                        <span className="text-sm font-medium">Like</span>
                      </button>
                      <Link
                        href={buildCommunityPostPath(post.id)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 text-white/60 dark:text-white/60 hover:bg-white/5 dark:hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span className="text-sm font-medium">Comment</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          void share({
                            path: buildCommunityPostPath(post.id),
                            title: post.title || "TradeScout community post",
                            text: post.content,
                            contextLabel: "Post link",
                            kind: "community_post",
                            imageUrl:
                              Array.isArray((post as any).imageUrls) &&
                              (post as any).imageUrls.length
                                ? (post as any).imageUrls[0]
                                : Array.isArray(post.images)
                                  ? post.images[0]
                                  : undefined,
                          })
                        }
                        className="flex-1 flex items-center justify-center gap-2 py-2 text-white/60 dark:text-white/60 hover:bg-white/5 dark:hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <Share2 className="h-4 w-4" />
                        <span className="text-sm font-medium">Share</span>
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          {/* Snapshot Grid (role-aware via preferences) */}
          <div>
            <div className="grid lg:grid-cols-3 gap-4">
              {Array.isArray(orderedEnabledWidgets) &&
                orderedEnabledWidgets.map((widgetId: string) => {
                  const WidgetComponent = widgetComponents[widgetId];
                  return WidgetComponent ? <WidgetComponent key={widgetId} /> : null;
                })}

              {(!Array.isArray(orderedEnabledWidgets) || orderedEnabledWidgets.length === 0) && (
                <Card className="bg-tsBg dark:bg-white/5 border-0 shadow-sm lg:col-span-3">
                  <CardContent className="p-6 text-center">
                    <p className="text-sm text-white/60 dark:text-white/60 mb-4">
                      No widgets enabled. Customize your snapshot grid to add cards.
                    </p>
                    <Link href="/dashboard-settings">
                      <Button size="sm" className="bg-ts-orange-dark hover:bg-ts-orange-dark">
                        Add Snapshot Cards
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </Section>
    </Page>
  );
});

export default Dashboard;
