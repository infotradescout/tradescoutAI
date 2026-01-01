import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Bookmark, ExternalLink, ThumbsUp, ThumbsDown, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdDisplayProps {
  className?: string;
  userLocation?: {
    state?: string;
    county?: string;
    fips?: string;
  };
}

interface Advertisement {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  linkUrl?: string;
  isAffiliate: boolean;
}

export function AdDisplay({ className = "", userLocation }: AdDisplayProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dismissedAds, setDismissedAds] = useState<string[]>([]);
  const [currentAd, setCurrentAd] = useState<Advertisement | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Determine user type for ad targeting
  const userType = user?.role && ['contractor_user', 'accelerator_member'].includes(user.role) 
    ? 'contractors' 
    : 'homeowners';

  // Fetch targeted ad for this site visit
  const { data: ad, isLoading } = useQuery<Advertisement>({
    queryKey: ["/api/ads/site-visit", userType, userLocation?.state, userLocation?.county],
    enabled: dismissedAds.length === 0, // Only fetch if no ad dismissed yet
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: Infinity, // Don't refetch during this session
  });

  useEffect(() => {
    if (ad && !dismissedAds.includes(ad.id) && !currentAd) {
      setCurrentAd(ad);
      // Track impression
      fetch('/api/ads/track-impression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId: ad.id, source: 'site_visit' })
      }).catch(console.error);
    }
  }, [ad, dismissedAds, currentAd]);

  const handleAdClick = () => {
    if (currentAd?.linkUrl) {
      // Track click
      fetch('/api/ads/track-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId: currentAd.id, source: 'site_visit' })
      }).catch(console.error);

      setHasInteracted(true);
      
      window.open(currentAd.linkUrl, '_blank');
    }
  };

  // Save ad for later functionality
  const saveAdMutation = useMutation({
    mutationFn: async (adId: string) => {
      const response = await fetch('/api/ads/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId })
      });
      if (!response.ok) throw new Error('Failed to save ad');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Ad Saved",
        description: "This ad has been saved to your profile for later viewing.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/saved-ads"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save ad. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSaveForLater = () => {
    if (currentAd) {
      if (user) {
        saveAdMutation.mutate(currentAd.id);
        setDismissedAds(prev => [...prev, currentAd.id]);
        setCurrentAd(null);
      } else {
        toast({
          title: "Login Required",
          description: "Please log in to save ads for later viewing.",
          variant: "destructive",
        });
      }
    }
  };

  const handleDismiss = () => {
    if (currentAd) {
      setDismissedAds(prev => [...prev, currentAd.id]);
      setCurrentAd(null);
      setHasInteracted(true);
    }
  };

  const sendFeedback = async (rating: "helpful" | "not_relevant" | "spam") => {
    if (!currentAd || !user) return;
    try {
      await fetch("/api/ads/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId: currentAd.id, rating, source: "site_visit" }),
      });
    } catch {
      // silent fail; feedback is best-effort
    }
  };

  if (isLoading || !currentAd || dismissedAds.includes(currentAd.id)) {
    return null;
  }

  return (
    <Card className={`${className} bg-gradient-to-r from-orange-50 to-blue-50 dark:from-orange-900/20 dark:to-blue-900/20 border-orange-200 dark:border-orange-800`}>
      <CardContent className="p-4 relative">
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
        
        <div className="pr-8">
          {currentAd.imageUrl && (
            <div className="mb-3">
              <img 
                src={currentAd.imageUrl} 
                alt={currentAd.title}
                className="w-full h-32 object-cover rounded-lg"
              />
            </div>
          )}
          
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {currentAd.title}
          </h3>
          
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            {currentAd.content}
          </p>
          
          <div className="flex flex-wrap gap-2">
            {currentAd.linkUrl && (
              <Button 
                onClick={handleAdClick}
                className="bg-orange-500 hover:bg-orange-600 text-white text-sm"
                size="sm"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Learn More
              </Button>
            )}
            
            <Button 
              onClick={handleSaveForLater}
              variant="outline"
              size="sm"
              className="text-sm border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              disabled={saveAdMutation.isPending}
            >
              <Bookmark className="h-3 w-3 mr-1" />
              {saveAdMutation.isPending ? 'Saving...' : 'Save for Later'}
            </Button>
          </div>

          {hasInteracted && user && (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
              <span className="mr-2">Was this helpful?</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-green-600 hover:text-green-700"
                onClick={() => sendFeedback("helpful")}
                title="Helpful"
              >
                <ThumbsUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-yellow-600 hover:text-yellow-700"
                onClick={() => sendFeedback("not_relevant")}
                title="Not relevant"
              >
                <ThumbsDown className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-600 hover:text-red-700"
                onClick={() => sendFeedback("spam")}
                title="Spam or misleading"
              >
                <Ban className="h-3 w-3" />
              </Button>
            </div>
          )}
          
          {currentAd.isAffiliate && (
            <div className="mt-2">
              <span className="text-xs text-gray-400">Sponsored</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Hook to get user's location for ad targeting
export function useUserLocation() {
  const [location, setLocation] = useState<{
    state?: string;
    county?: string;
    fips?: string;
  }>({});

  useEffect(() => {
    // Location is currently unknown in production; callers must
    // treat missing state/county/fips as "no geo targeting available".
    // When a real location pipeline is added (geolocation/IP/profile),
    // this hook should be updated to use it instead of a hard-coded value.
  }, []);

  return location;
}