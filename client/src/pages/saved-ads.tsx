import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bookmark, ExternalLink, X, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
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
        window.location.href = "/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Fetch saved ads
  const { data: savedAds, isLoading, error } = useQuery<SavedAdvertisement[]>({
    queryKey: ["/api/saved-ads"],
    enabled: isAuthenticated,
  });

  // Remove saved ad mutation
  const removeMutation = useMutation({
    mutationFn: async (adId: string) => {
      const response = await fetch(`/api/ads/save/${adId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to remove ad');
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
    }
  });

  const handleAdClick = (ad: SavedAdvertisement) => {
    if (ad.linkUrl) {
      // Track click from Saved Ads surface
      fetch('/api/ads/track-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId: ad.id, source: 'saved' }),
      }).catch(() => undefined);

      window.open(ad.linkUrl, '_blank');
    }
  };

  const handleRemove = (adId: string) => {
    removeMutation.mutate(adId);
  };

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-navy-600 rounded w-48"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-navy-600 rounded"></div>
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
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-300">Loading your saved ads...</p>
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
            <p className="text-gray-300">There was an error loading your saved advertisements. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
          <Bookmark className="h-8 w-8 mr-3 text-orange-500" />
          Saved Ads
        </h1>
        <p className="text-gray-300">
          Your collection of saved advertisements and offers
        </p>
      </div>

      {!savedAds || savedAds.length === 0 ? (
        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-12 text-center">
            <Bookmark className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">No Saved Ads Yet</h2>
            <p className="text-gray-300 mb-6">
              When you see an interesting ad, click "Save for Later" to add it here.
            </p>
            <Link href="/">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                Browse TradeScout
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {savedAds.map((ad) => (
            <Card key={ad.id} className="bg-navy-700 border-navy-600">
              <CardContent className="p-6 relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-4 right-4 h-8 w-8 p-0 text-gray-400 hover:text-red-400"
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
                    <h3 className="text-xl font-semibold text-white">
                      {ad.title}
                    </h3>
                    {ad.isAffiliate && (
                      <Badge variant="outline" className="text-blue-400 border-blue-400">
                        Sponsored
                      </Badge>
                    )}
                  </div>

                  <p className="text-gray-300 mb-4">
                    {ad.content}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm text-gray-400">
                      <Calendar className="h-4 w-4 mr-1" />
                      Saved {new Date(ad.createdAt).toLocaleDateString()}
                    </div>

                    {ad.linkUrl && (
                      <Button 
                        onClick={() => handleAdClick(ad)}
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                        size="sm"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Visit Link
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="text-center pt-6">
            <p className="text-gray-400 text-sm">
              {savedAds.length} saved ad{savedAds.length !== 1 ? 's' : ''} total
            </p>
          </div>
        </div>
      )}
    </div>
  );
}