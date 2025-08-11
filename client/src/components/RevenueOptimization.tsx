/**
 * RevenueOptimization - Strategic components for maximizing ad and affiliate revenue
 * while maintaining free platform access for all users
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Target, 
  Zap, 
  Gift,
  Crown,
  Star,
  ShoppingBag,
  ExternalLink
} from 'lucide-react';

/**
 * Accelerator Program Promotion - Strategic placement throughout the platform
 */
export function AcceleratorPromotion({ placement }: { placement: 'sidebar' | 'inline' | 'modal' }) {
  const benefits = [
    'Priority lead distribution',
    'Advanced analytics dashboard',
    'Premium listing placement',
    'Dedicated account manager',
    'Exclusive contractor network',
    'Marketing tools & templates'
  ];

  if (placement === 'sidebar') {
    return (
      <Card className="bg-gradient-to-br from-amber-600 to-amber-500 text-white border-none">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="h-6 w-6" />
            <h3 className="font-bold text-lg">TradeScout Pro</h3>
          </div>
          <p className="text-sm opacity-90 mb-4">
            Join our elite contractor network and boost your business by 300%
          </p>
          <div className="space-y-2 mb-4">
            {benefits.slice(0, 3).map((benefit, index) => (
              <div key={index} className="flex items-center text-sm">
                <Star className="h-3 w-3 mr-2 fill-current" />
                {benefit}
              </div>
            ))}
          </div>
          <Button className="w-full bg-white text-amber-600 hover:bg-gray-100">
            Learn More
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
      <Crown className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-amber-800 dark:text-amber-200">
        <strong>Ready to grow your business?</strong> Join TradeScout Pro and get 3x more leads.{' '}
        <Button variant="link" className="text-amber-600 p-0 h-auto">
          Learn more →
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Strategic Ad Placements - Optimized for revenue while maintaining UX
 */
export function StrategicAdPlacement({ 
  context,
  revenue 
}: { 
  context: 'quote-result' | 'contractor-list' | 'project-completion' | 'profile-view';
  revenue: 'high' | 'medium' | 'low';
}) {
  const getAdContent = () => {
    switch (context) {
      case 'quote-result':
        return {
          title: 'Get Materials at Contractor Prices',
          description: 'Save 20-40% on building materials with our partner network',
          cta: 'Shop Materials',
          partner: 'BuildPro Supply'
        };
      case 'contractor-list':
        return {
          title: 'Protect Your Purchase',
          description: 'Home warranty coverage for all contractor work',
          cta: 'Get Protected',
          partner: 'HomeGuard Warranty'
        };
      case 'project-completion':
        return {
          title: 'Finance Your Next Project',
          description: 'Low-rate home improvement loans up to $100k',
          cta: 'Check Rates',
          partner: 'LendingTree'
        };
      default:
        return {
          title: 'Professional Tools & Equipment',
          description: 'Rent or buy professional-grade tools',
          cta: 'Browse Tools',
          partner: 'ToolRental Pro'
        };
    }
  };

  const ad = getAdContent();
  const priority = revenue === 'high' ? 'Premium Placement' : 'Sponsored';

  return (
    <Card className="bg-gradient-to-r from-blue-600 to-blue-500 text-white border-none mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="text-xs bg-white/20">
                {priority}
              </Badge>
              <span className="text-sm opacity-90">{ad.partner}</span>
            </div>
            <h4 className="font-semibold mb-1">{ad.title}</h4>
            <p className="text-sm opacity-90 mb-3">{ad.description}</p>
            <Button size="sm" className="bg-white text-blue-600 hover:bg-gray-100">
              {ad.cta}
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </div>
          <div className="w-16 h-16 bg-white/10 rounded-lg ml-4"></div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Affiliate Shopping Integration - Contextual product recommendations
 */
export function AffiliateShoppingWidget({ projectType }: { projectType?: string }) {
  const [products, setProducts] = useState([
    {
      id: 1,
      name: 'Professional Drill Set',
      price: 129.99,
      originalPrice: 159.99,
      rating: 4.8,
      reviews: 1200,
      store: 'Amazon',
      affiliate: true
    },
    {
      id: 2,
      name: 'Safety Equipment Kit',
      price: 49.99,
      originalPrice: 64.99,
      rating: 4.7,
      reviews: 850,
      store: 'Home Depot',
      affiliate: true
    }
  ]);

  return (
    <Card className="bg-navy-700 border-navy-600">
      <CardHeader className="pb-4">
        <CardTitle className="text-white flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-orange-500" />
          Recommended for Your Project
          <Badge variant="secondary" className="ml-auto">Partner Store</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {products.map((product) => (
          <div key={product.id} className="bg-navy-600 rounded-lg p-3 hover:bg-navy-500 transition-colors cursor-pointer">
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-white font-medium text-sm">{product.name}</h4>
              <Badge className="bg-green-600 text-xs">
                -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
              </Badge>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex text-yellow-400">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className={`h-3 w-3 ${star <= product.rating ? 'fill-current' : ''}`} />
                ))}
              </div>
              <span className="text-gray-400 text-xs">({product.reviews})</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-orange-500 font-semibold">${product.price}</span>
                <span className="text-gray-400 text-sm line-through ml-2">${product.originalPrice}</span>
              </div>
              <Button size="sm" variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white">
                Shop Now
              </Button>
            </div>
          </div>
        ))}
        <Button variant="outline" className="w-full border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white">
          View All Products
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Revenue Analytics Dashboard (Admin Only)
 */
export function RevenueAnalytics() {
  const [metrics, setMetrics] = useState({
    adRevenue: { daily: 1250, monthly: 37500, ctr: 2.8 },
    affiliateRevenue: { daily: 890, monthly: 26700, conversion: 3.2 },
    acceleratorRevenue: { daily: 2100, monthly: 63000, members: 150 },
    totalRevenue: { daily: 4240, monthly: 127200 }
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card className="bg-navy-700 border-navy-600">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">Ad Revenue</h3>
            <Target className="h-5 w-5 text-blue-500" />
          </div>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-white">
              ${metrics.adRevenue.monthly.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">
              ${metrics.adRevenue.daily} today • {metrics.adRevenue.ctr}% CTR
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-navy-700 border-navy-600">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">Affiliate Revenue</h3>
            <ShoppingBag className="h-5 w-5 text-green-500" />
          </div>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-white">
              ${metrics.affiliateRevenue.monthly.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">
              ${metrics.affiliateRevenue.daily} today • {metrics.affiliateRevenue.conversion}% conversion
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-navy-700 border-navy-600">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">Accelerator Program</h3>
            <Crown className="h-5 w-5 text-amber-500" />
          </div>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-white">
              ${metrics.acceleratorRevenue.monthly.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">
              {metrics.acceleratorRevenue.members} members • $420 avg/member
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-navy-700 border-navy-600">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">Total Revenue</h3>
            <TrendingUp className="h-5 w-5 text-orange-500" />
          </div>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-white">
              ${metrics.totalRevenue.monthly.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">
              ${metrics.totalRevenue.daily} today • +15% vs last month
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Smart Lead Magnet - Captures contractor interest for Accelerator program
 */
export function SmartLeadMagnet({ trigger }: { trigger: 'quote-view' | 'competitor-check' | 'lead-miss' }) {
  const getContent = () => {
    switch (trigger) {
      case 'quote-view':
        return {
          title: 'Want to bid on projects like this?',
          description: 'Join our contractor network and get notified of new projects in your area',
          cta: 'Get Project Alerts'
        };
      case 'competitor-check':
        return {
          title: 'See what your competitors are missing',
          description: 'Get exclusive access to leads they can\'t see',
          cta: 'Unlock Hidden Leads'
        };
      case 'lead-miss':
        return {
          title: 'Don\'t miss the next opportunity',
          description: 'Get priority access to new leads in your service area',
          cta: 'Join Priority List'
        };
    }
  };

  const content = getContent();

  return (
    <Card className="bg-gradient-to-r from-green-600 to-green-500 text-white border-none">
      <CardContent className="p-6 text-center">
        <Zap className="h-8 w-8 mx-auto mb-3" />
        <h3 className="font-bold text-lg mb-2">{content.title}</h3>
        <p className="text-sm opacity-90 mb-4">{content.description}</p>
        <Button className="bg-white text-green-600 hover:bg-gray-100">
          {content.cta}
        </Button>
        <p className="text-xs opacity-75 mt-2">Free for qualified contractors</p>
      </CardContent>
    </Card>
  );
}