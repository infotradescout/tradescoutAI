import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

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
  const [dismissedAds, setDismissedAds] = useState<string[]>([]);
  const [currentAd, setCurrentAd] = useState<Advertisement | null>(null);

  // Determine user type for ad targeting
  const userType = user?.role && ['contractor_user', 'accelerator_member'].includes(user.role) 
    ? 'contractors' 
    : 'homeowners';

  // Fetch targeted ad for this site visit
  const { data: ad, isLoading } = useQuery({
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
        body: JSON.stringify({ adId: ad.id })
      }).catch(console.error);
    }
  }, [ad, dismissedAds, currentAd]);

  const handleAdClick = () => {
    if (currentAd?.linkUrl) {
      // Track click
      fetch('/api/ads/track-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId: currentAd.id })
      }).catch(console.error);
      
      window.open(currentAd.linkUrl, '_blank');
    }
  };

  const handleDismiss = () => {
    if (currentAd) {
      setDismissedAds(prev => [...prev, currentAd.id]);
      setCurrentAd(null);
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
          
          {currentAd.linkUrl && (
            <Button 
              onClick={handleAdClick}
              className="bg-orange-500 hover:bg-orange-600 text-white text-sm"
              size="sm"
            >
              Learn More
            </Button>
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
    // Try to get location from user's browser or IP
    // For now, we'll use a placeholder - in production this could use:
    // - Browser geolocation API
    // - IP-based location service
    // - User's profile location if available
    
    // Mock location for demo (you would replace with actual location detection)
    setLocation({
      state: "CA",
      county: "Los Angeles County", 
      fips: "06037"
    });
  }, []);

  return location;
}