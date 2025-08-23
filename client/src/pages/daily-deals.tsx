import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { Clock, MapPin, Star, Eye, Heart, Percent } from "lucide-react";
import { useState } from "react";

interface DailyDeal {
  id: string;
  title: string;
  description: string;
  dealType: string;
  originalPrice?: number;
  discountPrice: number;
  discountPercentage?: number;
  countyFips: string;
  startDate: string;
  endDate: string;
  maxRedemptions?: number;
  currentRedemptions: number;
  views: number;
  clicks: number;
  saves: number;
  featured: boolean;
  tags: string[];
  providerType: string;
}

export default function DailyDeals() {
  const { user } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState('all');

  const { data: deals, isLoading } = useQuery({
    queryKey: ['/api/daily-deals'],
  });

  const { data: userAffiliate } = useQuery({
    queryKey: ['/api/user/affiliate'],
  });

  const handleDealClick = async (dealId: string) => {
    // Track engagement
    await fetch('/api/deal-engagements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealId,
        engagementType: 'click',
        affiliateCode: userAffiliate?.affiliateCode
      })
    });
  };

  const handleSaveDeal = async (dealId: string) => {
    await fetch('/api/deal-engagements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealId,
        engagementType: 'save',
        affiliateCode: userAffiliate?.affiliateCode
      })
    });
  };

  const getDealTypeColor = (type: string) => {
    switch (type) {
      case 'service_discount': return 'bg-blue-100 text-blue-800';
      case 'product_sale': return 'bg-green-100 text-green-800';
      case 'material_deal': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const isExpired = (endDate: string) => {
    return new Date(endDate) < new Date();
  };

  const isAlmostFull = (current: number, max?: number) => {
    if (!max) return false;
    return (current / max) > 0.8;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const filteredDeals = deals?.filter((deal: DailyDeal) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'featured') return deal.featured;
    if (selectedFilter === 'services') return deal.dealType === 'service_discount';
    if (selectedFilter === 'products') return deal.dealType === 'product_sale';
    if (selectedFilter === 'materials') return deal.dealType === 'material_deal';
    return true;
  }) || [];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Daily Deals</h1>
        <p className="text-gray-600">
          Discover amazing deals from local contractors and service providers in your area
        </p>
        
        {userAffiliate && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900">Your Affiliate Status</h3>
            <p className="text-blue-700 text-sm">
              Share deals with your code: <code className="bg-blue-200 px-2 py-1 rounded">{userAffiliate.affiliateCode}</code>
            </p>
            <p className="text-blue-700 text-sm">
              Total earnings: {formatPrice(userAffiliate.totalEarnings)} | 
              Commission rate: {userAffiliate.commissionRate}%
            </p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'All Deals' },
          { key: 'featured', label: 'Featured' },
          { key: 'services', label: 'Services' },
          { key: 'products', label: 'Products' },
          { key: 'materials', label: 'Materials' }
        ].map(filter => (
          <Button
            key={filter.key}
            variant={selectedFilter === filter.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedFilter(filter.key)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {/* Deals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDeals.map((deal: DailyDeal) => (
          <Card 
            key={deal.id} 
            className={`transition-all hover:shadow-lg ${deal.featured ? 'ring-2 ring-orange-400' : ''} ${isExpired(deal.endDate) ? 'opacity-60' : ''}`}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-2 line-clamp-2">
                    {deal.title}
                    {deal.featured && (
                      <Star className="inline-block w-4 h-4 ml-2 text-orange-400 fill-current" />
                    )}
                  </CardTitle>
                  <Badge className={getDealTypeColor(deal.dealType)}>
                    {deal.dealType.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSaveDeal(deal.id)}
                  className="p-2"
                >
                  <Heart className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 line-clamp-3">
                {deal.description}
              </p>

              {/* Pricing */}
              <div className="flex items-center justify-between">
                <div>
                  {deal.originalPrice && (
                    <span className="text-sm text-gray-500 line-through mr-2">
                      {formatPrice(deal.originalPrice)}
                    </span>
                  )}
                  <span className="text-xl font-bold text-green-600">
                    {formatPrice(deal.discountPrice)}
                  </span>
                </div>
                {deal.discountPercentage && (
                  <Badge className="bg-red-100 text-red-800">
                    <Percent className="w-3 h-3 mr-1" />
                    {deal.discountPercentage}% OFF
                  </Badge>
                )}
              </div>

              {/* Timing and availability */}
              <div className="space-y-2 text-xs text-gray-500">
                <div className="flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  Expires {new Date(deal.endDate).toLocaleDateString()}
                </div>
                
                {deal.maxRedemptions && (
                  <div className={`flex items-center ${isAlmostFull(deal.currentRedemptions, deal.maxRedemptions) ? 'text-red-600' : ''}`}>
                    <MapPin className="w-3 h-3 mr-1" />
                    {deal.currentRedemptions}/{deal.maxRedemptions} claimed
                  </div>
                )}
              </div>

              {/* Engagement stats */}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <div className="flex items-center space-x-3">
                  <span className="flex items-center">
                    <Eye className="w-3 h-3 mr-1" />
                    {deal.views}
                  </span>
                  <span className="flex items-center">
                    <Heart className="w-3 h-3 mr-1" />
                    {deal.saves}
                  </span>
                </div>
              </div>

              {/* Tags */}
              {deal.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {deal.tags.slice(0, 3).map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <Separator />

              {/* Action buttons */}
              <div className="flex space-x-2">
                <Button 
                  className="flex-1"
                  onClick={() => handleDealClick(deal.id)}
                  disabled={isExpired(deal.endDate) || (deal.maxRedemptions && deal.currentRedemptions >= deal.maxRedemptions)}
                >
                  {isExpired(deal.endDate) ? 'Expired' : 'View Deal'}
                </Button>
                
                {userAffiliate && (
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/deals/${deal.id}?ref=${userAffiliate.affiliateCode}`;
                      navigator.clipboard.writeText(shareUrl);
                    }}
                  >
                    Share
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredDeals.length === 0 && (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No deals found</h3>
          <p className="text-gray-500">Check back later for new deals in your area.</p>
        </div>
      )}
    </div>
  );
}