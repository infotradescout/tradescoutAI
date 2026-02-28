/**
 * AffiliateIntegration - Component for managing affiliate deals and partnerships
 * Supports the ad-based revenue model with strategic affiliate placements
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Star, Percent, ShoppingCart, Truck } from 'lucide-react';

interface AffiliateProduct {
  id: string;
  name: string;
  category: 'tools' | 'materials' | 'equipment' | 'supplies';
  price: number;
  originalPrice?: number;
  discount?: number;
  rating: number;
  recommendationCount: number;
  affiliateUrl: string;
  imageUrl: string;
  description: string;
  vendor: string;
  isSponsored?: boolean;
  relevantTrades: string[];
}

interface AffiliateIntegrationProps {
  projectType?: string;
  materialList?: string[];
  containerType?: 'sidebar' | 'inline' | 'footer';
  maxItems?: number;
}

export function AffiliateIntegration({ 
  projectType, 
  materialList = [], 
  containerType = 'sidebar',
  maxItems = 4 
}: AffiliateIntegrationProps) {
  const [affiliateProducts, setAffiliateProducts] = useState<AffiliateProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRelevantProducts();
  }, [projectType, materialList]);

  const fetchRelevantProducts = async () => {
    setLoading(true);
    try {
      // In real implementation, this would call your affiliate API
      // For now, we'll use contextual product suggestions
      const products = getContextualProducts(projectType, materialList);
      setAffiliateProducts(products.slice(0, maxItems));
    } catch (error) {
      console.error('Error fetching affiliate products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAffiliateClick = (product: AffiliateProduct) => {
    // Track affiliate click for revenue attribution
    trackAffiliateClick(product.id, product.vendor);
    window.open(product.affiliateUrl, '_blank', 'noopener,noreferrer');
  };

  const trackAffiliateClick = (productId: string, vendor: string) => {
    // Analytics tracking for affiliate revenue
    fetch('/api/analytics/affiliate-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, vendor, timestamp: Date.now() })
    }).catch(console.error);
  };

  if (loading || affiliateProducts.length === 0) {
    return null;
  }

  const containerClass = {
    sidebar: 'w-full max-w-sm',
    inline: 'w-full max-w-4xl mx-auto',
    footer: 'w-full'
  }[containerType];

  return (
    <div className={containerClass}>
      <Card className="bg-tsCard border-white/10">
        <CardHeader className="pb-4">
          <CardTitle className="text-white flex items-center gap-2 text-lg">
            <ShoppingCart className="h-5 w-5 text-ts-orange" />
            Recommended Products
            <Badge variant="secondary" className="ml-auto text-xs">
              Partner Deals
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {affiliateProducts.map((product) => (
            <div
              key={product.id}
              className="bg-tsCard rounded-lg p-4 hover:bg-white/10 transition-colors cursor-pointer"
              onClick={() => handleAffiliateClick(product)}
            >
              <div className="flex gap-3">
                <div className="w-16 h-16 bg-white/10 rounded-lg flex-shrink-0 overflow-hidden">
                  <img 
                    src={product.imageUrl} 
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder-product.png';
                    }}
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="text-white font-medium text-sm truncate pr-2">
                      {product.name}
                    </h4>
                    {product.isSponsored && (
                      <Badge variant="outline" className="text-xs border-ts-orange/30 text-ts-orange">
                        Ad
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex text-yellow-400">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star 
                          key={star} 
                          className={`h-3 w-3 ${star <= product.rating ? 'fill-current' : ''}`}
                        />
                      ))}
                    </div>
                    <span className="text-white/60 text-xs">({product.recommendationCount})</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-ts-orange font-semibold">
                        ${product.price.toFixed(2)}
                      </span>
                      {product.originalPrice && (
                        <span className="text-white/60 text-sm line-through">
                          ${product.originalPrice.toFixed(2)}
                        </span>
                      )}
                      {product.discount && (
                        <Badge className="bg-green-600 text-xs">
                          -{product.discount}%
                        </Badge>
                      )}
                    </div>
                    <ExternalLink className="h-4 w-4 text-white/60" />
                  </div>
                  
                  <p className="text-white/70 text-xs mt-1 line-clamp-2">
                    {product.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
          
          <Button 
            variant="outline" 
            className="w-full border-ts-orange/30 text-ts-orange hover:bg-ts-orange hover:text-white"
            onClick={() => window.open('/affiliate-store', '_blank')}
          >
            <Truck className="h-4 w-4 mr-2" />
            View All Deals
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Contextual product suggestions based on project type
function getContextualProducts(projectType?: string, materialList: string[] = []): AffiliateProduct[] {
  const baseProducts: AffiliateProduct[] = [
    {
      id: 'dewalt-drill',
      name: 'DEWALT 20V MAX Cordless Drill',
      category: 'tools',
      price: 129.99,
      originalPrice: 159.99,
      discount: 19,
      rating: 5,
      recommendationCount: 1250,
      affiliateUrl: 'https://amazon.com/dp/example1?tag=tradescout-20',
      imageUrl: '/products/dewalt-drill.jpg',
      description: 'Professional grade cordless drill with 2 batteries and charger',
      vendor: 'Amazon',
      isSponsored: true,
      relevantTrades: ['general', 'electrical', 'plumbing', 'carpentry']
    },
    {
      id: 'milwaukee-saw',
      name: 'Milwaukee M18 Circular Saw',
      category: 'tools',
      price: 179.99,
      rating: 5,
      recommendationCount: 890,
      affiliateUrl: 'https://homedepot.com/p/example2?ref=tradescout',
      imageUrl: '/products/milwaukee-saw.jpg',
      description: 'Powerful 18V circular saw for precision cuts',
      vendor: 'Home Depot',
      relevantTrades: ['carpentry', 'flooring', 'roofing']
    },
    {
      id: 'safety-gear',
      name: '3M Safety Glasses & Hard Hat Kit',
      category: 'supplies',
      price: 49.99,
      originalPrice: 64.99,
      discount: 23,
      rating: 4,
      recommendationCount: 445,
      affiliateUrl: 'https://lowes.com/pd/example3?affiliate=tradescout',
      imageUrl: '/products/safety-kit.jpg',
      description: 'Essential safety equipment for construction work',
      vendor: 'Lowes',
      relevantTrades: ['all']
    },
    {
      id: 'ryobi-level',
      name: 'RYOBI 4ft Digital Level',
      category: 'tools',
      price: 89.99,
      rating: 4,
      recommendationCount: 332,
      affiliateUrl: 'https://ryobitools.com/level?ref=tradescout',
      imageUrl: '/products/ryobi-level.jpg',
      description: 'Digital level with audio and visual indicators',
      vendor: 'Ryobi Direct',
      relevantTrades: ['carpentry', 'flooring', 'general']
    }
  ];

  // Filter products based on project context
  let relevantProducts = baseProducts;
  
  if (projectType) {
    const projectTrades = getTradesForProject(projectType);
    relevantProducts = baseProducts.filter(product => 
      product.relevantTrades.includes('all') || 
      product.relevantTrades.some(trade => projectTrades.includes(trade))
    );
  }

  return relevantProducts;
}

function getTradesForProject(projectType: string): string[] {
  const tradeMap: Record<string, string[]> = {
    'roof-replacement': ['roofing', 'general'],
    'kitchen-remodel': ['carpentry', 'electrical', 'plumbing'],
    'bathroom-renovation': ['plumbing', 'electrical', 'flooring'],
    'flooring-installation': ['flooring', 'carpentry'],
    'electrical-work': ['electrical'],
    'plumbing': ['plumbing']
  };
  
  return tradeMap[projectType] || ['general'];
}

/**
 * Affiliate Store Banner - Prominent placement for affiliate partnerships
 */
export function AffiliateStoreBanner() {
  return (
    <Card className="bg-gradient-to-r from-orange-600 to-orange-500 border-none text-white mb-8">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold mb-2">TradeScout Store</h3>
            <p className="opacity-90">Professional tools and materials at contractor prices</p>
            <div className="flex items-center gap-4 mt-3">
              <Badge className="bg-white text-ts-orange">Free Shipping</Badge>
              <Badge className="bg-white text-ts-orange">Price Match</Badge>
              <Badge className="bg-white text-ts-orange">Pro Discounts</Badge>
            </div>
          </div>
          <Button 
            size="lg"
            className="bg-white text-ts-orange hover:bg-white/5"
            onClick={() => window.open('/affiliate-store', '_blank')}
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            Shop Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}