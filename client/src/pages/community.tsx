import { useLocation } from "wouter";
import { useEffect, useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PostType } from "@/components/community/CommunityComposerInline";
import { Card, CardContent } from "@/components/ui/card";
import {
  MessageSquare,
  ThumbsUp,
  Plus,
  Users,
  Calendar,
  TrendingUp,
  Clock,
  Star,
  MapPin,
  Filter,
  Search,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CommunityPageShell } from "@/shells/CommunityPageShell";
import { useLocationContext, hasCountyContext } from "@/hooks/useLocationContext";
import { CountyRequiredGate } from "@/components/CountyRequiredGate";
import { CommunityPostCard } from "@/components/community/CommunityPostCard";
import { CommunityComposerInline } from "@/components/community/CommunityComposerInline";
import { CommunityEmptyState } from "@/components/community/CommunityEmptyState";
import { CommunityShell } from "@/components/layout/CommunityShell";
import { SEOHelmet } from "@/components/SEOHelmet";
import { getDeviceType, trackShellEvent } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
    cvsScore?: number | string | null;
    verificationStatus?: string;
    badges?: string[];
  };
  category: string;
  location: string;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  comments: number;
  tags: string[];
  userVote?: "up" | "down" | null;
  pinned: boolean;
  trending: boolean;
  imageUrls?: string[];
  hasWorkRequest?: boolean;
  workRequestId?: string | null;
}

const TABS = [
  { id: "for-you", label: "For You", icon: Star },
  { id: "trending", label: "Trending", icon: TrendingUp },
  { id: "recent", label: "Recent", icon: Clock },
  { id: "nearby", label: "Nearby", icon: MapPin },
];

export default function Community() {
  const { user, isAuthenticated } = useAuth();
  const location = useLocationContext();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("for-you");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostImages, setNewPostImages] = useState<string[]>([]);
  const [fromScoutDraft, setFromScoutDraft] = useState(false);
  const draftStartedAtRef = useRef<number | null>(null);
  const lastPostTypeRef = useRef<PostType>("discussion");

  const stateCode = location.stateCode as string | undefined;
  const countyFips = location.countyFips as string | undefined;
  const countyCommitted = hasCountyContext(location);

  // Fetch community posts scoped to the user's county
  const { data: posts, isLoading: postsLoading } = useQuery<CommunityPost[]>({
    queryKey: ["/api/community/posts", stateCode, countyFips],
    enabled: countyCommitted,
    queryFn: async () => {
      if (!stateCode || !countyFips) return [];
      const params = new URLSearchParams({
        scope: "county",
        stateCode,
        countyFips,
        limit: "20",
        offset: "0",
      });

      const response = await fetch(`/api/community/posts?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch posts");
      return response.json();
    },
  });

  const createPostMutation = useMutation({
    mutationFn: async (postData: { content: string; images?: string[]; category: string }) => {
      return apiRequest("POST", "/api/community/posts", {
        content: postData.content,
        images: postData.images,
        category: postData.category,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts", stateCode, countyFips] });
      setNewPostContent("");
      setNewPostImages([]);
      toast({ title: "Posted!", description: "Your post is now live in the community." });
    },
  });

  const handleCreatePost = () => {
    if (!isAuthenticated) {
      toast({ title: "Sign in required", description: "Sign in to post.", variant: "destructive" });
      return;
    }
    if (!newPostContent.trim()) return;

    const categoryMap: Record<PostType, string> = {
      alert: "announcements",
      project: "projects",
      recommendation: "recommendations",
      admin_notice: "announcements",
      discussion: "general",
    };

    createPostMutation.mutate({
      content: newPostContent,
      images: newPostImages.length ? newPostImages : undefined,
      category: categoryMap[lastPostTypeRef.current] || "general",
    });
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  const visiblePosts = useMemo(() => {
    if (!posts) return [];
    let filtered = [...posts];
    if (activeTab === "trending") filtered = filtered.filter((p) => p.trending || p.upvotes > 5);
    if (activeTab === "recent")
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return filtered;
  }, [posts, activeTab]);

  return (
    <CommunityShell sectionLabel="Community Feed" showSnapshot={true}>
      <SEOHelmet
        title="Community | TradeScout"
        description="Connect with your local trade community."
      />

      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar: Navigation & Filters */}
          <aside className="hidden lg:block lg:col-span-3 space-y-6">
            <div className="bg-[#141414] rounded-2xl border border-white/5 p-2">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                      isActive
                        ? "bg-ts-orange/10 text-ts-orange"
                        : "text-white/40 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Icon
                      className={cn("w-5 h-5", isActive ? "text-ts-orange" : "text-white/40")}
                    />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="bg-[#141414] rounded-2xl border border-white/5 p-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/30 px-2">
                Popular Tags
              </h4>
              <div className="flex flex-wrap gap-2 px-2">
                {["plumbing", "roofing", "hvac", "electrical", "remodeling"].map((tag) => (
                  <button
                    key={tag}
                    className="text-xs font-medium text-white/60 hover:text-ts-orange transition-colors"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Main Feed */}
          <main className="lg:col-span-6 space-y-6">
            {/* Mobile Tabs */}
            <div className="lg:hidden flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
              {TABS.map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "rounded-full h-9 px-4 text-xs font-bold border-white/10",
                    activeTab === tab.id ? "bg-ts-orange text-black" : "bg-white/5 text-white/60"
                  )}
                >
                  {tab.label}
                </Button>
              ))}
            </div>

            {/* Composer */}
            <CommunityComposerInline
              isAuthenticated={isAuthenticated}
              userInitial={user?.name?.charAt(0)}
              userAvatarUrl={user?.avatar}
              value={newPostContent}
              onChange={setNewPostContent}
              onSubmit={handleCreatePost}
              onSubmitWithMeta={(meta) => {
                lastPostTypeRef.current = meta.postType;
              }}
              isSubmitting={createPostMutation.isPending}
              images={newPostImages}
              onImagesChange={setNewPostImages}
            />

            {/* Feed Content */}
            <div className="space-y-4">
              {postsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-64 bg-white/5 rounded-2xl animate-pulse border border-white/5"
                  />
                ))
              ) : visiblePosts.length > 0 ? (
                visiblePosts.map((post) => (
                  <CommunityPostCard key={post.id} post={post} formatTimeAgo={formatTimeAgo} />
                ))
              ) : (
                <CommunityEmptyState />
              )}
            </div>
          </main>

          {/* Right Sidebar: Community Stats & Suggestions */}
          <aside className="hidden lg:block lg:col-span-3 space-y-6">
            <div className="bg-gradient-to-br from-ts-orange/20 to-transparent rounded-2xl border border-ts-orange/20 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-ts-orange rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h4 className="font-bold text-white">Community Pulse</h4>
                  <p className="text-xs text-white/60">Active in {location.countyName}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-white">1.2k</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                    Members
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-white">48</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                    Posts Today
                  </p>
                </div>
              </div>
              <Button className="w-full bg-white/10 hover:bg-white/20 text-white border-none text-xs font-bold h-10 rounded-xl">
                View Analytics
              </Button>
            </div>

            <div className="bg-[#141414] rounded-2xl border border-white/5 p-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/30 px-2">
                Top Contributors
              </h4>
              <div className="space-y-4 px-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white/10 rounded-full" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">User {i}</span>
                        <span className="text-[10px] text-white/40">Pro Member</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 text-[10px] font-bold text-ts-orange hover:bg-ts-orange/10"
                    >
                      Follow
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </CommunityShell>
  );
}
