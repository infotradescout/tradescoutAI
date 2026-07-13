/**
 * EnhancedAdSystem - Advanced advertising system for revenue generation
 * Supports multiple ad formats while maintaining excellent user experience
 */

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ExternalLink, Heart, MapPin, Clock } from "lucide-react";

interface AdContent {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  ctaText: string;
  targetUrl: string;
  advertiser: string;
  category: "contractor" | "tool" | "material" | "service" | "insurance";
  location?: {
    state?: string;
    county?: string;
  };
  targeting: {
    projectTypes: string[];
    userTypes: ("homeowner" | "contractor")[];
    demographics?: string[];
  };
  format: "banner" | "card" | "native" | "video" | "carousel";
  priority: "low" | "medium" | "high" | "premium";
  isSponsored: boolean;
  pricing: {
    model: "cpm" | "cpc" | "cpa";
    rate: number;
  };
}

interface EnhancedAdSystemProps {
  placement: "header" | "sidebar" | "footer" | "inline" | "modal" | "banner";
  context?: {
    projectType?: string;
    location?: { state?: string; county?: string };
    userType?: "homeowner" | "contractor";
    pageType?: string;
  };
  maxAds?: number;
  allowDismiss?: boolean;
}

export function EnhancedAdSystem({
  placement,
  context,
  maxAds = 1,
  allowDismiss = true,
}: EnhancedAdSystemProps) {
  const [ads, setAds] = useState<AdContent[]>([]);
  const [dismissedAds, setDismissedAds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTargetedAds();
  }, [placement, context]);

  const fetchTargetedAds = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/ads/targeted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placement,
          context,
          maxAds,
          excludeIds: dismissedAds,
        }),
      });

      if (response.ok) {
        const adData = await response.json();
        setAds(Array.isArray(adData) ? adData : []);
      }
    } catch (error) {
      console.error("Error fetching ads:", error);
      // Fallback to contextual ads
      setAds(getContextualAds(placement, context, maxAds));
    } finally {
      setLoading(false);
    }
  };

  const handleAdClick = (ad: AdContent) => {
    // Track ad interaction for revenue attribution
    trackAdClick(ad.id, placement);
    window.open(ad.targetUrl, "_blank", "noopener,noreferrer");
  };

  const handleAdDismiss = (adId: string) => {
    setDismissedAds((prev) => [...prev, adId]);
    setAds((prev) => prev.filter((ad) => ad.id !== adId));

    // Track dismissal for optimization
    trackAdDismiss(adId, placement);
  };

  const trackAdClick = (adId: string, placement: string) => {
    fetch("/api/analytics/ad-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adId, placement, timestamp: Date.now() }),
    }).catch(console.error);
  };

  const trackAdDismiss = (adId: string, placement: string) => {
    fetch("/api/analytics/ad-dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adId, placement, timestamp: Date.now() }),
    }).catch(console.error);
  };

  if (loading || ads.length === 0) {
    return null;
  }

  const renderAd = (ad: AdContent) => {
    switch (ad.format) {
      case "banner":
        return (
          <BannerAd
            ad={ad}
            onDismiss={allowDismiss ? () => handleAdDismiss(ad.id) : undefined}
            onClick={() => handleAdClick(ad)}
          />
        );
      case "card":
        return (
          <CardAd
            ad={ad}
            onDismiss={allowDismiss ? () => handleAdDismiss(ad.id) : undefined}
            onClick={() => handleAdClick(ad)}
          />
        );
      case "native":
        return (
          <NativeAd
            ad={ad}
            onDismiss={allowDismiss ? () => handleAdDismiss(ad.id) : undefined}
            onClick={() => handleAdClick(ad)}
          />
        );
      default:
        return (
          <CardAd
            ad={ad}
            onDismiss={allowDismiss ? () => handleAdDismiss(ad.id) : undefined}
            onClick={() => handleAdClick(ad)}
          />
        );
    }
  };

  return (
    <div className="ad-container" data-placement={placement}>
      {Array.isArray(ads) ? ads.map(renderAd) : null}
    </div>
  );
}

function BannerAd({
  ad,
  onDismiss,
  onClick,
}: {
  ad: AdContent;
  onDismiss?: () => void;
  onClick: () => void;
}) {
  return (
    <div
      className="relative bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg p-4 mb-4 cursor-pointer hover:from-blue-700 hover:to-blue-600 transition-all"
      onClick={onClick}
    >
      {onDismiss && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 text-white hover:bg-white/20"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="text-xs">
              Sponsored
            </Badge>
            <span className="text-sm opacity-90">{ad.advertiser}</span>
          </div>
          <h4 className="font-semibold text-lg mb-1">{ad.title}</h4>
          <p className="text-sm opacity-90 mb-3">{ad.description}</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{ad.ctaText}</span>
            <ExternalLink className="h-4 w-4" />
          </div>
        </div>

        {ad.imageUrl && (
          <div className="ml-4 w-20 h-20 bg-white/10 rounded-lg flex-shrink-0 overflow-hidden">
            <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
          </div>
        )}
      </div>
    </div>
  );
}

function CardAd({
  ad,
  onDismiss,
  onClick,
}: {
  ad: AdContent;
  onDismiss?: () => void;
  onClick: () => void;
}) {
  return (
    <Card
      className="bg-tsCard border-white/10 hover:border-ts-orange/30 transition-all cursor-pointer mb-4"
      onClick={onClick}
    >
      <CardContent className="p-4 relative">
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 text-white/60 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        <div className="flex items-start gap-3">
          {ad.imageUrl && (
            <div className="w-16 h-16 bg-white/10 rounded-lg flex-shrink-0 overflow-hidden">
              <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs border-ts-orange/30 text-ts-orange">
                {ad.isSponsored ? "Sponsored" : "Partner"}
              </Badge>
              <span className="text-white/60 text-sm">{ad.advertiser}</span>
            </div>

            <h4 className="text-white font-medium mb-2">{ad.title}</h4>
            <p className="text-white/70 text-sm mb-3 line-clamp-2">{ad.description}</p>

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange hover:text-white"
              >
                {ad.ctaText}
              </Button>
              {ad.location && (
                <div className="flex items-center text-white/60 text-xs">
                  <MapPin className="h-3 w-3 mr-1" />
                  {ad.location.county}, {ad.location.state}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NativeAd({
  ad,
  onDismiss,
  onClick,
}: {
  ad: AdContent;
  onDismiss?: () => void;
  onClick: () => void;
}) {
  return (
    <div
      className="bg-tsCard rounded-lg p-4 mb-4 hover:bg-white/10 transition-colors cursor-pointer relative"
      onClick={onClick}
    >
      {onDismiss && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 text-white/60 hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-ts-orange rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
          {ad.advertiser.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-medium">{ad.advertiser}</span>
            <Badge variant="secondary" className="text-xs">
              Ad
            </Badge>
          </div>

          <p className="text-white/70 text-sm mb-2">{ad.description}</p>

          <div className="flex items-center gap-4">
            <Button variant="link" className="text-ts-orange hover:text-ts-orange p-0">
              {ad.ctaText}
            </Button>
            <div className="flex items-center text-white/60 text-xs gap-3">
              <div className="flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                Quick Response
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Fallback contextual ads when API is unavailable
function getContextualAds(placement: string, context: any, maxAds: number): AdContent[] {
  const fallbackAds: AdContent[] = [
    {
      id: "contractor-insurance",
      title: "Protect Your Business",
      description: "Get comprehensive contractor insurance coverage starting at $49/month",
      ctaText: "Get Quote",
      targetUrl: "/insurance-partner",
      advertiser: "InsurePro",
      category: "insurance",
      targeting: {
        projectTypes: ["all"],
        userTypes: ["contractor"],
      },
      format: "card",
      priority: "high",
      isSponsored: true,
      pricing: { model: "cpc", rate: 2.5 },
    },
    {
      id: "home-depot-tools",
      title: "Professional Tools & Materials",
      description: "Everything you need for your next project. Free delivery on orders over $45.",
      ctaText: "Shop Now",
      targetUrl: "/affiliate/home-depot",
      advertiser: "The Home Depot",
      category: "material",
      targeting: {
        projectTypes: ["all"],
        userTypes: ["homeowner", "contractor"],
      },
      format: "banner",
      priority: "medium",
      isSponsored: true,
      pricing: { model: "cpm", rate: 5.0 },
    },
  ];

  return fallbackAds.slice(0, maxAds);
}
