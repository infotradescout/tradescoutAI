import { useLocation } from "wouter";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Star,
  Sparkles,
  TrendingUp,
  Clock,
  MapPin,
  DollarSign,
  ChevronRight,
  PackageX,
  Rocket,
} from "lucide-react";
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

// Empty array - no deals available yet. In production this page does not
// fabricate deals; if no live feed is wired, it simply shows no cards.
const MOCK_DEALS: TradeDeal[] = [];

export default function TradeDealsLuckyPage() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [deals, setDeals] = useState<TradeDeal[]>(MOCK_DEALS);
  const [selectedDeal, setSelectedDeal] = useState<TradeDeal | null>(null);

  const handleScratch = (dealId: string) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to reveal TradeDeals.",
        variant: "destructive",
      });
      return;
    }

    setDeals((prevDeals) =>
      prevDeals.map((deal) =>
        deal.id === dealId ? { ...deal, scratched: true, revealed: true } : deal
      )
    );
  };

  const handleClaimDeal = (deal: TradeDeal) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to claim TradeDeals.",
        variant: "destructive",
      });
      return;
    }

    setDeals((prevDeals) =>
      prevDeals.map((d) => (d.id === deal.id ? { ...d, claimed: d.claimed + 1 } : d))
    );

    toast({
      title: "Deal Claimed!",
      description: `You've claimed ${deal.brand} - ${deal.title}`,
    });

    setSelectedDeal(null);
  };

  const handleRateDeal = (dealId: string, rating: number) => {
    setDeals((prevDeals) =>
      prevDeals.map((deal) => (deal.id === dealId ? { ...deal, rating } : deal))
    );

    toast({
      title: "Thanks for rating!",
      description: "Your feedback helps the community.",
    });
  };

  const featuredDeals = deals.filter((d) => d.featured);
  const regularDeals = deals.filter((d) => !d.featured);

  // Show empty state when no deals are available
  if (deals.length === 0) {
    return (
      <div className="pb-24 py-12" style={{ backgroundColor: "var(--surface-base)" }}>
        <div className="max-w-4xl mx-auto px-4 space-y-8">
          {/* Header */}
          <div className="text-center space-y-3">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border"
              style={{
                backgroundColor: "var(--surface-card)",
                borderColor: "var(--border-subtle)",
              }}
            >
              <Sparkles className="h-4 w-4" style={{ color: "var(--theme-accent-primary)" }} />
              <span
                className="text-sm font-medium"
                style={{ color: "var(--theme-accent-primary)" }}
              >
                TradeDeals Feed
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold" style={{ color: "var(--text-primary)" }}>
              No active TradeDeals in this county
            </h1>
            <p
              className="text-sm md:text-base max-w-2xl mx-auto"
              style={{ color: "var(--text-secondary)" }}
            >
              Use Scout and Direct Connect to request supplier offers for active projects and notify
              your county network.
            </p>
          </div>

          {/* Empty State Illustration */}
          <Card
            className="border-2 border-dashed"
            style={{ backgroundColor: "var(--surface-card)", borderColor: "var(--border-subtle)" }}
          >
            <CardContent className="p-12 text-center space-y-6">
              <div className="flex justify-center">
                <div className="relative">
                  <PackageX className="h-24 w-24" style={{ color: "var(--text-tertiary)" }} />
                  <Rocket
                    className="h-8 w-8 absolute -top-2 -right-2"
                    style={{ color: "var(--theme-accent-primary)" }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                  No TradeDeals Available Yet
                </h3>
                <p className="text-sm max-w-md mx-auto" style={{ color: "var(--text-secondary)" }}>
                  We're building partnerships with quality suppliers and manufacturers. TradeDeals
                  will start appearing here as our partner network grows.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* What to Expect */}
          <div className="space-y-4">
            <h2
              className="text-xl font-semibold text-center"
              style={{ color: "var(--text-primary)" }}
            >
              What to expect from TradeDeals
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              <Card
                style={{
                  backgroundColor: "var(--surface-card)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                <CardContent className="p-6 space-y-3">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor:
                        "color-mix(in oklab, var(--theme-accent-primary) 20%, transparent)",
                    }}
                  >
                    <Sparkles
                      className="h-5 w-5"
                      style={{ color: "var(--theme-accent-primary)" }}
                    />
                  </div>
                  <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    Exclusive Offers
                  </h3>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    Deals available only through TradeScout - not found anywhere else online or in
                    stores.
                  </p>
                </CardContent>
              </Card>

              <Card
                style={{
                  backgroundColor: "var(--surface-card)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                <CardContent className="p-6 space-y-3">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor:
                        "color-mix(in oklab, var(--theme-accent-primary) 20%, transparent)",
                    }}
                  >
                    <Star className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />
                  </div>
                  <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    Verified Partners
                  </h3>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    Every deal comes from vetted suppliers, manufacturers, and trusted local
                    businesses.
                  </p>
                </CardContent>
              </Card>

              <Card
                style={{
                  backgroundColor: "var(--surface-card)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                <CardContent className="p-6 space-y-3">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor:
                        "color-mix(in oklab, var(--theme-accent-primary) 20%, transparent)",
                    }}
                  >
                    <DollarSign
                      className="h-5 w-5"
                      style={{ color: "var(--theme-accent-primary)" }}
                    />
                  </div>
                  <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    Project-Based
                  </h3>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    Deals matched to your active projects - materials and services when you actually
                    need them.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* How It Works */}
          <Card
            style={{ backgroundColor: "var(--surface-card)", borderColor: "var(--border-subtle)" }}
          >
            <CardContent className="p-6 space-y-4">
              <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                How TradeDeals will work
              </h3>
              <div className="space-y-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                <div className="flex gap-3">
                  <div
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{
                      backgroundColor: "var(--theme-accent-primary)",
                      color: "var(--text-primary)",
                    }}
                  >
                    1
                  </div>
                  <div>
                    <strong style={{ color: "var(--text-primary)" }}>Scratch to reveal</strong> -
                    Each deal appears as a scratcher card. Scratch it to see the discount and
                    details.
                  </div>
                </div>
                <div className="flex gap-3">
                  <div
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{
                      backgroundColor: "var(--theme-accent-primary)",
                      color: "var(--text-primary)",
                    }}
                  >
                    2
                  </div>
                  <div>
                    <strong style={{ color: "var(--text-primary)" }}>Claim what you need</strong> -
                    When you find a deal for your project, claim it to lock in the pricing.
                  </div>
                </div>
                <div className="flex gap-3">
                  <div
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{
                      backgroundColor: "var(--theme-accent-primary)",
                      color: "var(--text-primary)",
                    }}
                  >
                    3
                  </div>
                  <div>
                    <strong style={{ color: "var(--text-primary)" }}>Rate your experience</strong> -
                    Help the community by rating deals after you use them.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="text-center space-y-4 pt-4">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              In the meantime, use{" "}
              <strong style={{ color: "var(--text-primary)" }}>Direct Connect</strong> to start your
              project and <strong style={{ color: "var(--text-primary)" }}>Community</strong> to get
              contractor recommendations.
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => navigate("/direct-connect")}
                style={{
                  backgroundColor: "var(--theme-accent-primary)",
                  color: "var(--text-primary)",
                }}
              >
                Start a Project
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/community")}
                style={{ borderColor: "var(--border-active)", color: "var(--text-primary)" }}
              >
                Browse Community
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 py-6" style={{ backgroundColor: "var(--surface-base)" }}>
      <div className="max-w-7xl mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border"
            style={{ backgroundColor: "var(--surface-card)", borderColor: "var(--border-subtle)" }}
          >
            <Sparkles className="h-4 w-4" style={{ color: "var(--theme-accent-primary)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--theme-accent-primary)" }}>
              Lucky Bucks TradeDeals
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold" style={{ color: "var(--text-primary)" }}>
            Scratch, Reveal & Save
          </h1>
          <p
            className="text-sm md:text-base max-w-2xl mx-auto"
            style={{ color: "var(--text-secondary)" }}
          >
            Exclusive deals from trusted partners. Scratch to reveal your discount, claim what you
            need, and rate your experience.
          </p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4">
          <Card
            style={{ backgroundColor: "var(--surface-card)", borderColor: "var(--border-subtle)" }}
          >
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: "var(--theme-accent-primary)" }}>
                {deals.length}
              </div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Active Deals
              </div>
            </CardContent>
          </Card>
          <Card
            style={{ backgroundColor: "var(--surface-card)", borderColor: "var(--border-subtle)" }}
          >
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: "var(--theme-accent-primary)" }}>
                {deals.reduce((sum, d) => sum + d.claimed, 0)}
              </div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Times Claimed
              </div>
            </CardContent>
          </Card>
          <Card
            style={{ backgroundColor: "var(--surface-card)", borderColor: "var(--border-subtle)" }}
          >
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: "var(--theme-accent-primary)" }}>
                $
                {deals
                  .reduce((sum, d) => {
                    const savings =
                      parseFloat(d.originalPrice?.replace(/[^0-9.]/g, "") || "0") -
                      parseFloat(d.discountedPrice?.replace(/[^0-9.]/g, "") || "0");
                    return sum + savings * d.claimed;
                  }, 0)
                  .toFixed(0)}
              </div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Total Saved
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Featured Deals */}
        {featuredDeals.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" style={{ color: "var(--theme-accent-primary)" }} />
              <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                Featured Deals
              </h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredDeals.map((deal) => (
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
            <Sparkles className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
            <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              All Deals
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regularDeals.map((deal) => (
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }}
          onClick={() => setSelectedDeal(null)}
        >
          <Card
            className="max-w-lg w-full"
            style={{ backgroundColor: "var(--surface-card)", borderColor: "var(--border-active)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                    {selectedDeal.title}
                  </h3>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {selectedDeal.brand}
                  </p>
                </div>
                <Badge
                  className="text-lg font-bold px-3 py-1"
                  style={{
                    backgroundColor: "var(--theme-accent-primary)",
                    color: "var(--text-primary)",
                  }}
                >
                  {selectedDeal.discount}
                </Badge>
              </div>

              <p style={{ color: "var(--text-secondary)" }}>{selectedDeal.description}</p>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div style={{ color: "var(--text-secondary)" }}>Original Price</div>
                  <div
                    className="text-lg font-semibold line-through"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {selectedDeal.originalPrice}
                  </div>
                </div>
                <div>
                  <div style={{ color: "var(--text-secondary)" }}>Deal Price</div>
                  <div
                    className="text-lg font-semibold"
                    style={{ color: "var(--theme-accent-primary)" }}
                  >
                    {selectedDeal.discountedPrice}
                  </div>
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

              <div className="pt-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => handleClaimDeal(selectedDeal)}
                  style={{
                    backgroundColor: "var(--theme-accent-primary)",
                    color: "var(--text-primary)",
                  }}
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
        backgroundColor: "var(--surface-card)",
        borderColor: deal.featured ? "var(--theme-accent-primary)" : "var(--border-subtle)",
        transform: isHovered ? "translateY(-4px)" : "translateY(0)",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(deal)}
    >
      {deal.featured && (
        <div
          className="px-3 py-1 text-xs font-semibold text-center"
          style={{ backgroundColor: "var(--theme-accent-primary)", color: "var(--text-primary)" }}
        >
          ⭐ FEATURED DEAL
        </div>
      )}

      <CardContent className="p-4 space-y-3">
        {!deal.revealed ? (
          <div
            className="relative h-32 rounded-lg flex items-center justify-center cursor-pointer"
            style={{
              background:
                "linear-gradient(135deg, rgba(234, 88, 12, 0.2) 0%, rgba(249, 115, 22, 0.3) 100%)",
              border: "2px dashed var(--theme-accent-primary)",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onScratch(deal.id);
            }}
          >
            <div className="text-center space-y-2">
              <Sparkles
                className="h-8 w-8 mx-auto"
                style={{ color: "var(--theme-accent-primary)" }}
              />
              <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Scratch to Reveal
              </div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {deal.brand}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-2">
                <h3
                  className="font-semibold text-sm line-clamp-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  {deal.title}
                </h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                  {deal.brand}
                </p>
              </div>
              <Badge
                className="shrink-0 font-bold"
                style={{
                  backgroundColor: "var(--theme-accent-primary)",
                  color: "var(--text-primary)",
                }}
              >
                {deal.discount}
              </Badge>
            </div>

            <p className="text-xs line-clamp-2" style={{ color: "var(--text-secondary)" }}>
              {deal.description}
            </p>

            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="line-through" style={{ color: "var(--text-tertiary)" }}>
                  {deal.originalPrice}
                </span>
                <span
                  className="ml-2 font-semibold"
                  style={{ color: "var(--theme-accent-primary)" }}
                >
                  {deal.discountedPrice}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <Badge
              variant="outline"
              className="text-xs"
              style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
            >
              {deal.category}
            </Badge>
            <div className="flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
              <Clock className="h-3 w-3" />
              <span>{deal.expiresIn}</span>
            </div>
          </div>

          {deal.revealed && (
            <>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: "var(--text-secondary)" }}>
                    {deal.claimed} / {deal.totalAvailable} claimed
                  </span>
                  <span
                    style={{
                      color:
                        remainingPercentage < 20 ? "var(--status-error)" : "var(--text-secondary)",
                    }}
                  >
                    {remainingPercentage.toFixed(0)}% left
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: "var(--surface-intermediate)" }}
                >
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${(deal.claimed / deal.totalAvailable) * 100}%`,
                      backgroundColor: "var(--theme-accent-primary)",
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
                  style={{
                    backgroundColor: "var(--theme-accent-primary)",
                    color: "var(--text-primary)",
                  }}
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
                        fill={
                          star <= Math.round(deal.rating) ? "var(--theme-accent-primary)" : "none"
                        }
                        style={{
                          color:
                            star <= Math.round(deal.rating)
                              ? "var(--theme-accent-primary)"
                              : "var(--text-tertiary)",
                        }}
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
