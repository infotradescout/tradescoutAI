import { Request, Response } from 'express';
import { storage } from '../storage';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { dailyDeals, dealEngagements, userAffiliates } from '@shared/schema';

// Mock data for when database is offline
const mockDeals = [
  {
    id: '1',
    title: 'Professional Deck Staining - 50% Off',
    description: 'Transform your outdoor space with our professional deck staining service. Includes power washing, sanding, and premium stain application.',
    dealType: 'service_discount',
    originalPrice: '800.00',
    discountPrice: '400.00',
    discountPercentage: 50,
    countyFips: '06037', // Los Angeles County
    serviceArea: ['Los Angeles', 'Beverly Hills', 'Santa Monica'],
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    maxRedemptions: 10,
    currentRedemptions: 3,
    views: 245,
    clicks: 32,
    saves: 8,
    featured: true,
    tags: ['deck', 'staining', 'outdoor'],
    providerId: 'contractor-1',
    providerType: 'contractor_user',
    priority: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    title: 'Kitchen Cabinet Refinishing Deal',
    description: 'Give your kitchen a fresh new look with our cabinet refinishing service. Includes removal, refinishing, and reinstallation.',
    dealType: 'service_discount',
    originalPrice: '1200.00',
    discountPrice: '850.00',
    discountPercentage: 30,
    countyFips: '06037',
    serviceArea: ['Los Angeles', 'Pasadena', 'Glendale'],
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    maxRedemptions: 5,
    currentRedemptions: 1,
    views: 189,
    clicks: 24,
    saves: 12,
    featured: false,
    tags: ['kitchen', 'cabinets', 'refinishing'],
    providerId: 'contractor-2',
    providerType: 'contractor_user',
    priority: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '3',
    title: 'Premium Paint & Supplies Bundle',
    description: 'Professional-grade paint bundle perfect for interior projects. Includes primer, paint, brushes, and drop cloths.',
    dealType: 'product_sale',
    originalPrice: '200.00',
    discountPrice: '150.00',
    discountPercentage: 25,
    countyFips: '06037',
    serviceArea: ['Los Angeles County'],
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    maxRedemptions: 20,
    currentRedemptions: 7,
    views: 412,
    clicks: 67,
    saves: 23,
    featured: true,
    tags: ['paint', 'supplies', 'interior'],
    providerId: 'supplier-1',
    providerType: 'service_provider',
    priority: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const mockUserAffiliate = {
  id: 'affiliate-1',
  userId: 'user-1',
  affiliateCode: 'USR123ABC',
  totalEarnings: '125.50',
  pendingEarnings: '45.25',
  paidEarnings: '80.25',
  totalReferrals: 12,
  successfulReferrals: 8,
  clicksGenerated: 156,
  tierLevel: 'standard',
  commissionRate: '10.00',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Get daily deals for a county/area
export async function getDailyDeals(req: Request, res: Response) {
  try {
    const { county, limit = '20', featured, dealType } = req.query;
    
    let deals;
    try {
      // Try database first
      deals = await storage.getDailyDeals({
        countyFips: county as string,
        limit: parseInt(limit as string),
        featured: featured === 'true',
        dealType: dealType as string,
        activeOnly: true
      });
    } catch (dbError) {
      console.log('Database offline, using mock data for daily deals');
      // Filter mock deals based on query parameters
      deals = mockDeals.filter(deal => {
        if (county && deal.countyFips !== county) return false;
        if (featured === 'true' && !deal.featured) return false;
        if (dealType && deal.dealType !== dealType) return false;
        return deal.isActive;
      }).slice(0, parseInt(limit as string));
    }

    res.json(deals);
  } catch (error) {
    console.error('Error fetching daily deals:', error);
    res.status(500).json({ message: 'Failed to fetch daily deals' });
  }
}

// Create a new daily deal (contractors/service providers only)
export async function createDailyDeal(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Verify user can create deals
    const user = await storage.getUser(userId);
    if (!user || !['contractor_user', 'service_provider', 'business_owner'].includes(user.activeRole || user.role)) {
      return res.status(403).json({ message: 'Only contractors and service providers can create deals' });
    }

    const dealData = {
      ...req.body,
      providerId: userId,
      providerType: user.activeRole || user.role
    };

    const deal = await storage.createDailyDeal(dealData);
    res.status(201).json(deal);
  } catch (error) {
    console.error('Error creating daily deal:', error);
    res.status(500).json({ message: 'Failed to create deal' });
  }
}

// Track deal engagement (views, clicks, saves)
export async function trackDealEngagement(req: Request, res: Response) {
  try {
    const { dealId, engagementType, affiliateCode } = req.body;
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    
    let engagement;
    try {
      // Create engagement record
      engagement = await storage.createDealEngagement({
        dealId,
        userId,
        engagementType,
        affiliateCode,
        sessionId: req.sessionID
      });

      // Update deal counters
      await storage.updateDealStats(dealId, engagementType);

      // Track affiliate if present
      if (affiliateCode && engagementType === 'click') {
        await storage.trackAffiliateAction({
          affiliateCode,
          action: 'deal_click',
          visitingUserId: userId,
          sessionId: req.sessionID,
          sourceUrl: req.headers.referer as string,
          targetUrl: `/deals/${dealId}`
        });
      }
    } catch (dbError) {
      console.log('Database offline, simulating engagement tracking');
      engagement = {
        id: 'engagement-' + Date.now(),
        dealId,
        userId,
        engagementType,
        affiliateCode,
        sessionId: req.sessionID,
        createdAt: new Date().toISOString()
      };
    }

    res.status(201).json(engagement);
  } catch (error) {
    console.error('Error tracking deal engagement:', error);
    res.status(500).json({ message: 'Failed to track engagement' });
  }
}

// Get user's affiliate information
export async function getUserAffiliate(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    let affiliate;
    try {
      affiliate = await storage.getUserAffiliate(userId);
      
      // Create affiliate account if doesn't exist
      if (!affiliate) {
        affiliate = await storage.createUserAffiliate({
          userId,
          affiliateCode: await storage.generateAffiliateCode(userId)
        });
      }
    } catch (dbError) {
      console.log('Database offline, using mock affiliate data');
      affiliate = { ...mockUserAffiliate, userId };
    }

    res.json(affiliate);
  } catch (error) {
    console.error('Error getting user affiliate:', error);
    res.status(500).json({ message: 'Failed to get affiliate information' });
  }
}

// Get affiliate performance dashboard
export async function getAffiliateDashboard(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const affiliate = await storage.getUserAffiliate(userId);
    if (!affiliate) {
      return res.status(404).json({ message: 'Affiliate account not found' });
    }

    const dashboard = await storage.getAffiliateDashboard(affiliate.affiliateCode);
    res.json(dashboard);
  } catch (error) {
    console.error('Error getting affiliate dashboard:', error);
    res.status(500).json({ message: 'Failed to get affiliate dashboard' });
  }
}

// Update deal (provider only)
export async function updateDailyDeal(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Verify ownership
    const deal = await storage.getDailyDeal(id);
    if (!deal || deal.providerId !== userId) {
      return res.status(403).json({ message: 'Can only update your own deals' });
    }

    const updatedDeal = await storage.updateDailyDeal(id, req.body);
    res.json(updatedDeal);
  } catch (error) {
    console.error('Error updating daily deal:', error);
    res.status(500).json({ message: 'Failed to update deal' });
  }
}

// Delete deal (provider only)
export async function deleteDailyDeal(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Verify ownership
    const deal = await storage.getDailyDeal(id);
    if (!deal || deal.providerId !== userId) {
      return res.status(403).json({ message: 'Can only delete your own deals' });
    }

    await storage.deleteDailyDeal(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting daily deal:', error);
    res.status(500).json({ message: 'Failed to delete deal' });
  }
}

// Get featured deals for homepage
export async function getFeaturedDeals(req: Request, res: Response) {
  try {
    const { limit = '6' } = req.query;
    
    let deals;
    try {
      deals = await storage.getDailyDeals({
        featured: true,
        activeOnly: true,
        limit: parseInt(limit as string)
      });
    } catch (dbError) {
      console.log('Database offline, using mock featured deals');
      deals = mockDeals.filter(deal => deal.featured && deal.isActive)
        .slice(0, parseInt(limit as string));
    }

    res.json(deals);
  } catch (error) {
    console.error('Error fetching featured deals:', error);
    res.status(500).json({ message: 'Failed to fetch featured deals' });
  }
}