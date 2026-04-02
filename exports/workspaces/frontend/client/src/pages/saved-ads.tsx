import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bookmark, ExternalLink, X, Calendar, ThumbsUp, ThumbsDown, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { useEffect } from "react";

interface SavedAdvertisement {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  linkUrl?: string;
  isAffiliate: boolean;
  createdAt: string;
}

export default function SavedAds() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please log in to view your saved ads.",
        variant: "destructive",
      });
      setTimeout(() => {
        navigate("/pre-scout-setup?mode=signin");
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Fetch saved ads
  const {
    data: savedAds,
    isLoading,
    error,
  } = useQuery<SavedAdvertisement[]>({
    queryKey: ["/api/saved-ads"],
    enabled: isAuthenticated,
  });

  // Remove saved ad mutation
  const removeMutation = useMutation({
    mutationFn: async (adId: string) => {
      const response = await fetch(`/api/ads/save/${adId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to remove ad");
    },
    onSuccess: () => {
      toast({
        title: "Ad Removed",
        description: "The ad has been removed from your saved list.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/saved-ads"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove ad. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAdClick = (ad: SavedAdvertisement) => {
    if (ad.linkUrl) {
      // Track click from Saved Ads surface
      fetch("/api/ads/track-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId: ad.id, source: "saved" }),
      }).catch(() => undefined);

      window.open(ad.linkUrl, "_blank");
    }
  };

  const handleRemove = (adId: string) => {
    removeMutation.mutate(adId);
  };

  const sendFeedback = async (adId: string, rating: "helpful" | "not_relevant" | "spam") => {
    try {
      await fetch("/api/ads/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId, rating, source: "saved" }),
      });
    } catch {
      // best-effort only
    }
  };

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-tsCard rounded w-48"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-tsCard rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-ts-orange/30 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white/70">Loading your saved ads...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-red-900/20 border-red-500/50">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold text-red-400 mb-2">Error Loading Saved Ads</h2>
            <p className="text-white/70">
              There was an error loading your saved advertisements. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
          <Bookmark className="h-8 w-8 mr-3 text-ts-orange" />
          Saved Ads
        </h1>
        <p className="text-white/70">Your collection of saved sponsor messages and TradeDeals</p>
      </div>

      {!savedAds || savedAds.length === 0 ? (
        <Card className="bg-tsCard border-white/10">
          <CardContent className="p-12 text-center">
            <Bookmark className="h-16 w-16 text-white/60 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">No Saved Ads Yet</h2>
            <p className="text-white/70 mb-6">
              When you see an interesting ad, click "Save for Later" to add it here.
            </p>
            <Link href="/">
              <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
                Browse TradeScout
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {savedAds.map((ad) => (
            <Card key={ad.id} className="bg-tsCard border-white/10">
              <CardContent className="p-6 relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-4 right-4 h-8 w-8 p-0 text-white/60 hover:text-red-400"
                  onClick={() => handleRemove(ad.id)}
                  disabled={removeMutation.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>

                <div className="pr-12">
                  {ad.imageUrl && (
                    <div className="mb-4">
                      <img
                        src={ad.imageUrl}
                        alt={ad.title}
                        className="w-full h-48 object-cover rounded-lg"
                      />
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-xl font-semibold text-white">{ad.title}</h3>
                    {ad.isAffiliate && (
                      <Badge variant="outline" className="text-blue-400 border-blue-400">
                        Sponsored
                      </Badge>
                    )}
                  </div>

                  <p className="text-white/70 mb-4">{ad.content}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm text-white/60">
                      <Calendar className="h-4 w-4 mr-1" />
                      Saved {new Date(ad.createdAt).toLocaleDateString()}
                    </div>

                    <div className="flex items-center gap-3">
                      {ad.linkUrl && (
                        <Button
                          onClick={() => handleAdClick(ad)}
                          className="bg-ts-orange hover:bg-ts-orange-dark text-white"
                          size="sm"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Visit Link
                        </Button>
                      )}

                      <div className="flex items-center gap-1 text-xs text-white/60">
                        <span className="mr-1">Rate</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-green-500 hover:text-green-400"
                          onClick={() => sendFeedback(ad.id, "helpful")}
                          title="Helpful"
                        >
                          <ThumbsUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-yellow-500 hover:text-yellow-400"
                          onClick={() => sendFeedback(ad.id, "not_relevant")}
                          title="Not relevant"
                        >
                          <ThumbsDown className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500 hover:text-red-400"
                          onClick={() => sendFeedback(ad.id, "spam")}
                          title="Spam or misleading"
                        >
                          <Ban className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="text-center pt-6">
            <p className="text-white/60 text-sm">
              {savedAds.length} saved ad{savedAds.length !== 1 ? "s" : ""} total
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
