import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Sparkles, TrendingUp, Clock, MapPin, DollarSign, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface TradeDeal {
  id: string;
  brand: string;
  title: string;
  description: string;
  discount: string;
  originalPrice?: string;
  discountedPrice?: string;
  category: string;
  location: string;
  expiresIn: string;
  featured: boolean;
  rating: number;
  claimed: number;
  totalAvailable: number;
  scratched: boolean;
  revealed: boolean;
}

const MOCK_DEALS: TradeDeal[] = [
  {
    id: "1",
    brand: "Premium Roofing Supply",
    title: "20% Off Shingles",
    description: "Premium architectural shingles for active roof projects",
    discount: "20% OFF",
    originalPrice: "$240",
    discountedPrice: "$192",
    category: "Roofing",
    location: "County-wide",
    expiresIn: "3 days",
    featured: true,
    rating: 4.8,
    claimed: 23,
    totalAvailable: 50,
    scratched: false,
    revealed: false,
  },
  {
    id: "2",
    brand: "Regional Plumbing Warehouse",
    title: "Fixture Bundle Deal",
    description: "Complete bathroom fixture package - exclusive pricing",
    discount: "30% OFF",
    originalPrice: "$899",
    discountedPrice: "$629",
    category: "Plumbing",
    location: "Service Area",
    expiresIn: "5 days",
    featured: true,
    rating: 4.9,
    claimed: 17,
    totalAvailable: 30,
    scratched: false,
    revealed: false,
  },
  {
    id: "3",
    brand: "Local Lumber & Yard",
    title: "Framing Lumber Special",
    description: "Community-backed pricing for local builds",
    discount: "15% OFF",
    originalPrice: "$450",
    discountedPrice: "$382",
    category: "Materials",
    location: "Local only",
    expiresIn: "7 days",
    featured: false,
    rating: 4.6,
    claimed: 41,
    totalAvailable: 100,
    scratched: false,
    revealed: false,
  },
  {
    id: "4",
    brand: "Elite HVAC Solutions",
    title: "AC Unit Upgrade",
    description: "High-efficiency AC replacement with installation",
    discount: "$500 OFF",
    originalPrice: "$4,500",
    discountedPrice: "$4,000",
    category: "HVAC",
    location: "Metro Area",
    expiresIn: "10 days",
    featured: false,
    rating: 4.7,
    claimed: 8,
    totalAvailable: 20,
    scratched: false,
    revealed: false,
  },
  {
    id: "5",
    brand: "Professional Paint Co",
    title: "Premium Paint Package",
    description: "Top-tier interior paint + primer combo",
    discount: "25% OFF",
    originalPrice: "$320",
    discountedPrice: "$240",
    category: "Painting",
    location: "State-wide",
    expiresIn: "2 days",
    featured: true,
    rating: 4.5,
    claimed: 56,
    totalAvailable: 75,
    scratched: false,
    revealed: false,
  },
  {
    id: "6",
    brand: "Quality Flooring Depot",
    title: "Hardwood Flooring Deal",
    description: "Premium oak flooring - limited stock",
    discount: "18% OFF",
    originalPrice: "$6.50/sqft",
    discountedPrice: "$5.33/sqft",
    category: "Flooring",
    location: "Regional",
    expiresIn: "4 days",
    featured: false,
    rating: 4.8,
    claimed: 12,
    totalAvailable: 40,
    scratched: false,
    revealed: false,
  },
];

export default function TradeDealsLuckyPage() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [deals, setDeals] = useState<TradeDeal[]>(MOCK_DEALS);
  const [selectedDeal, setSelectedDeal] = useState<TradeDeal | null>(null);

  const handleScratch = (dealId: string) => {
    if (!isAuthenticated) {
      toast({
        title: 'Sign In Required',
        description: 'Please sign in to reveal TradeDeals.',
        variant: 'destructive',
      });
      return;
    }

    setDeals(prevDeals =>
      prevDeals.map(deal =>
        deal.id === dealId ? { ...deal, scratched: true, revealed: true } : deal
      )
    );
  };

  const handleClaimDeal = (deal: TradeDeal) => {
    if (!isAuthenticated) {
      toast({
        title: 'Sign In Required',
        description: 'Please sign in to claim TradeDeals.',
        variant: 'destructive',
      });
      return;
    }

    setDeals(prevDeals =>
      prevDeals.map(d =>
        d.id === deal.id ? { ...d, claimed: d.claimed + 1 } : d
      )
    );

    toast({
      title: 'Deal Claimed!',
      description: `You've claimed ${deal.brand} - ${deal.title}`,
    });

    setSelectedDeal(null);
  };

  const handleRateDeal = (dealId: string, rating: number) => {
    setDeals(prevDeals =>
      prevDeals.map(deal =>
        deal.id === dealId ? { ...deal, rating } : deal
      )
    );

    toast({
      title: 'Thanks for rating!',
      description: 'Your feedback helps the community.',
    });
  };

  const featuredDeals = deals.filter(d => d.featured);
  const regularDeals = deals.filter(d => !d.featured);

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: 'var(--surface-base)' }}>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border" style={{ backgroundColor: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <Sparkles className="h-4 w-4" style={{ color: 'var(--theme-accent-primary)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--theme-accent-primary)' }}>Lucky Bucks TradeDeals</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Scratch, Reveal & Save
          </h1>
          <p className="text-sm md:text-base max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Exclusive deals from trusted partners. Scratch to reveal your discount, claim what you need, and rate your experience.
          </p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4">
          <Card style={{ backgroundColor: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: 'var(--theme-accent-primary)' }}>{deals.length}</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Active Deals</div>
            </CardContent>
          </Card>
          <Card style={{ backgroundColor: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: 'var(--theme-accent-primary)' }}>
                {deals.reduce((sum, d) => sum + d.claimed, 0)}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Times Claimed</div>
            </CardContent>
          </Card>
          <Card style={{ backgroundColor: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: 'var(--theme-accent-primary)' }}>
                ${deals.reduce((sum, d) => {
                  const savings = parseFloat(d.originalPrice?.replace(/[^0-9.]/g, '') || '0') -
                                parseFloat(d.discountedPrice?.replace(/[^0-9.]/g, '') || '0');
                  return sum + (savings * d.claimed);
                }, 0).toFixed(0)}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total Saved</div>
            </CardContent>
          </Card>
        </div>

        {/* Featured Deals */}
        {featuredDeals.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" style={{ color: 'var(--theme-accent-primary)' }} />
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Featured Deals</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredDeals.map(deal => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  onScratch={handleScratch}
                  onClaim={handleClaimDeal}
                  onRate={handleRateDeal}
                  onSelect={setSelectedDeal}
                />
              ))}
            </div>
          </div>
        )}

        {/* Regular Deals */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>All Deals</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regularDeals.map(deal => (
              <DealCard
                key={deal.id}
                deal={deal}
                onScratch={handleScratch}
                onClaim={handleClaimDeal}
                onRate={handleRateDeal}
                onSelect={setSelectedDeal}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Deal Detail Modal */}
      {selectedDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }} onClick={() => setSelectedDeal(null)}>
          <Card className="max-w-lg w-full" style={{ backgroundColor: 'var(--surface-card)', borderColor: 'var(--border-active)' }} onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{selectedDeal.title}</h3>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selectedDeal.brand}</p>
                </div>
                <Badge className="text-lg font-bold px-3 py-1" style={{ backgroundColor: 'var(--theme-accent-primary)', color: 'var(--text-primary)' }}>
                  {selectedDeal.discount}
                </Badge>
              </div>

              <p style={{ color: 'var(--text-secondary)' }}>{selectedDeal.description}</p>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div style={{ color: 'var(--text-secondary)' }}>Original Price</div>
                  <div className="text-lg font-semibold line-through" style={{ color: 'var(--text-tertiary)' }}>{selectedDeal.originalPrice}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)' }}>Deal Price</div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--theme-accent-primary)' }}>{selectedDeal.discountedPrice}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{selectedDeal.location}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Expires in {selectedDeal.expiresIn}</span>
                </div>
              </div>

              <div className="pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => handleClaimDeal(selectedDeal)}
                  style={{ backgroundColor: 'var(--theme-accent-primary)', color: 'var(--text-primary)' }}
                >
                  Claim This Deal
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

interface DealCardProps {
  deal: TradeDeal;
  onScratch: (id: string) => void;
  onClaim: (deal: TradeDeal) => void;
  onRate: (id: string, rating: number) => void;
  onSelect: (deal: TradeDeal) => void;
}

function DealCard({ deal, onScratch, onClaim, onRate, onSelect }: DealCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const remainingPercentage = ((deal.totalAvailable - deal.claimed) / deal.totalAvailable) * 100;

  return (
    <Card
      className="cursor-pointer transition-all duration-200 overflow-hidden"
      style={{
        backgroundColor: 'var(--surface-card)',
        borderColor: deal.featured ? 'var(--theme-accent-primary)' : 'var(--border-subtle)',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(deal)}
    >
      {deal.featured && (
        <div className="px-3 py-1 text-xs font-semibold text-center" style={{ backgroundColor: 'var(--theme-accent-primary)', color: 'var(--text-primary)' }}>
          ⭐ FEATURED DEAL
        </div>
      )}
      
      <CardContent className="p-4 space-y-3">
        {!deal.revealed ? (
          <div
            className="relative h-32 rounded-lg flex items-center justify-center cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.2) 0%, rgba(249, 115, 22, 0.3) 100%)',
              border: '2px dashed var(--theme-accent-primary)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onScratch(deal.id);
            }}
          >
            <div className="text-center space-y-2">
              <Sparkles className="h-8 w-8 mx-auto" style={{ color: 'var(--theme-accent-primary)' }} />
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Scratch to Reveal</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{deal.brand}</div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-2">
                <h3 className="font-semibold text-sm line-clamp-2" style={{ color: 'var(--text-primary)' }}>{deal.title}</h3>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{deal.brand}</p>
              </div>
              <Badge className="shrink-0 font-bold" style={{ backgroundColor: 'var(--theme-accent-primary)', color: 'var(--text-primary)' }}>
                {deal.discount}
              </Badge>
            </div>

            <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{deal.description}</p>

            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="line-through" style={{ color: 'var(--text-tertiary)' }}>{deal.originalPrice}</span>
                <span className="ml-2 font-semibold" style={{ color: 'var(--theme-accent-primary)' }}>{deal.discountedPrice}</span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <Badge variant="outline" className="text-xs" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
              {deal.category}
            </Badge>
            <div className="flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
              <Clock className="h-3 w-3" />
              <span>{deal.expiresIn}</span>
            </div>
          </div>

          {deal.revealed && (
            <>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--text-secondary)' }}>{deal.claimed} / {deal.totalAvailable} claimed</span>
                  <span style={{ color: remainingPercentage < 20 ? '#ef4444' : 'var(--text-secondary)' }}>
                    {remainingPercentage.toFixed(0)}% left
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-intermediate)' }}>
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${(deal.claimed / deal.totalAvailable) * 100}%`,
                      backgroundColor: 'var(--theme-accent-primary)',
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClaim(deal);
                  }}
                  style={{ backgroundColor: 'var(--theme-accent-primary)', color: 'var(--text-primary)' }}
                >
                  Claim Deal
                </Button>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRate(deal.id, star);
                      }}
                      className="p-0.5"
                    >
                      <Star
                        className="h-3 w-3"
                        fill={star <= Math.round(deal.rating) ? 'var(--theme-accent-primary)' : 'none'}
                        style={{ color: star <= Math.round(deal.rating) ? 'var(--theme-accent-primary)' : 'var(--text-tertiary)' }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
