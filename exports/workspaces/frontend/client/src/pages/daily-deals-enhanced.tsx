import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HelpBubble, GuidedTour } from "@/components/ui/help-bubble";
import { useHelpSystem } from "@/hooks/useHelpSystem";
import { 
  Clock, 
  MapPin, 
  Star, 
  Heart, 
  Share2, 
  Tag, 
  TrendingUp,
  Sparkles,
  Target,
  Gift
} from "lucide-react";

interface DailyDeal {
  id: string;
  title: string;
  description: string;
  dealType: string;
  originalPrice: string;
  discountPrice: string;
  discountPercentage: number;
  countyFips: string;
  serviceArea: string[];
  startDate: string;
  endDate: string;
  isActive: boolean;
  maxRedemptions: number;
  currentRedemptions: number;
  views: number;
  clicks: number;
  saves: number;
  featured: boolean;
  tags: string[];
  providerId: string;
  providerType: string;
  priority: number;
}

export default function DailyDealsEnhanced() {
  const [savedDeals, setSavedDeals] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const { 
    activeTour, 
    startTour, 
    markTourCompleted, 
    skipTour, 
    tours, 
    shouldShowTour 
  } = useHelpSystem();

  // Auto-start tour for new users
  useEffect(() => {
    if (shouldShowTour('daily-deals')) {
      const timer = setTimeout(() => {
        startTour('daily-deals');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [shouldShowTour, startTour]);

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['/api/daily-deals'],
    queryFn: async () => {
      const response = await fetch('/api/daily-deals');
      if (!response.ok) throw new Error('Failed to fetch deals');
      return response.json();
    },
  });

  const handleSaveDeal = (dealId: string) => {
    setSavedDeals(prev => 
      prev.includes(dealId) 
        ? prev.filter(id => id !== dealId)
        : [...prev, dealId]
    );
  };

  const getTimeRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} days left`;
    return `${hours} hours left`;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="daily-deals-page">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <Sparkles className="w-8 h-8 text-yellow-500" />
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">TradeDeals</h1>
            <HelpBubble
              id="daily-deals-overview"
              title="TradeDeals & LuckyBucks System"
              content="Discover exclusive deals from local contractors and suppliers. Every purchase earns you LuckyBucks that can be used for future discounts!"
              illustration="lightbulb"
              variant="tip"
              trigger="hover"
              position="bottom"
            />
          </div>
          <p className="text-xl text-muted-foreground mb-6 max-w-3xl mx-auto">
            Exclusive TradeDeals on home improvement services and materials. Limited-time, vetted offers from verified local professionals.
          </p>
          
          {/* Stats */}
          <div className="flex justify-center space-x-6 mb-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-500">{deals.length}</div>
              <div className="text-sm text-muted-foreground">Active Deals</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">50%</div>
              <div className="text-sm text-muted-foreground">Avg Savings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">2.4k</div>
              <div className="text-sm text-muted-foreground">Happy Customers</div>
            </div>
          </div>
        </div>

        {/* LuckyBucks Banner */}
        <Card className="bg-card border-border mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-1">Earn LuckyBucks with Every Purchase!</h3>
                  <p className="text-muted-foreground">Get 5% back in LuckyBucks on all deal purchases. Use them for future discounts!</p>
                </div>
              </div>
              <HelpBubble
                id="luckybucks-system"
                title="LuckyBucks Rewards"
                content="LuckyBucks are our loyalty points system. Earn 5% back on every purchase and use them like cash for future deals. They never expire!"
                illustration="star"
                variant="success"
                trigger="hover"
                position="left"
              />
            </div>
          </CardContent>
        </Card>

        {/* Category Filter */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Browse by Category</h2>
            <HelpBubble
              id="category-filter"
              title="Deal Categories"
              content="Filter deals by type: service discounts offer reduced rates on contractor work, while product sales feature discounted materials and supplies."
              illustration="target"
              variant="info"
              trigger="hover"
              position="bottom"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            {['all', 'service_discount', 'product_sale', 'featured'].map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(category)}
                className={selectedCategory === category ? 'bg-primary hover:bg-primary/90' : ''}
              >
                {category === 'all' ? 'All Deals' : 
                 category === 'service_discount' ? 'Service Discounts' :
                 category === 'product_sale' ? 'Product Sales' : 'Featured Deals'}
              </Button>
            ))}
          </div>
        </div>

        {/* Deals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12 daily-deals-grid">
          {deals
            .filter((deal: DailyDeal) => selectedCategory === 'all' || deal.dealType === selectedCategory || (selectedCategory === 'featured' && deal.featured))
            .map((deal: DailyDeal) => (
            <Card
              key={deal.id}
              className="bg-card border-border hover:border-primary/50 transition-all duration-300 deal-card"
              data-testid={`deal-${deal.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between mb-2">
                  <Badge 
                    className={deal.featured ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'}
                  >
                    {deal.featured ? (
                      <>
                        <Star className="w-3 h-3 mr-1" />
                        Featured
                      </>
                    ) : (
                      deal.dealType === 'service_discount' ? 'Service Deal' : 'Product Sale'
                    )}
                  </Badge>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSaveDeal(deal.id)}
                      className="h-8 w-8 p-0 hover:bg-muted"
                    >
                      <Heart className={`w-4 h-4 ${savedDeals.includes(deal.id) ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted">
                      <Share2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-foreground text-lg leading-tight">{deal.title}</CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm leading-relaxed">{deal.description}</p>
                
                {/* Pricing */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl font-bold text-green-600 dark:text-green-400">${deal.discountPrice}</span>
                      <span className="text-lg text-muted-foreground line-through">${deal.originalPrice}</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      {deal.discountPercentage}% OFF
                    </Badge>
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-400">
                    You save ${(parseFloat(deal.originalPrice) - parseFloat(deal.discountPrice)).toFixed(2)}
                  </div>
                </div>

                {/* Location & Time */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-muted-foreground">
                    <MapPin className="w-4 h-4 mr-2" />
                    <span>{deal.serviceArea.join(', ')}</span>
                  </div>
                  <div className="flex items-center text-muted-foreground">
                    <Clock className="w-4 h-4 mr-2" />
                    <span className="text-ts-orange dark:text-ts-orange">{getTimeRemaining(deal.endDate)}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Claimed</span>
                    <span className="text-muted-foreground">{deal.currentRedemptions}/{deal.maxRedemptions}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(deal.currentRedemptions / deal.maxRedemptions) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Action Button */}
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  data-testid={`claim-deal-${deal.id}`}
                >
                  <Gift className="w-4 h-4 mr-2" />
                  Claim Deal
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Call to Action */}
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <Target className="w-12 h-12 text-blue-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-4">Want to run a TradeDeal?</h2>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Join TradeScout as a contractor or supplier and reach people with exclusive TradeDeals tied to real projects.
            </p>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3">
              Become a Deal Provider
            </Button>
          </CardContent>
        </Card>

        {/* Guided Tour */}
        <GuidedTour
          steps={tours['daily-deals'] || []}
          isActive={activeTour === 'daily-deals'}
          onComplete={() => markTourCompleted('daily-deals')}
          onSkip={() => skipTour('daily-deals')}
        />
      </div>
    </div>
  );
}