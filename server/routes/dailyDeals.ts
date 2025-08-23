import { Request, Response } from 'express';
import { storage } from '../storage';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { dailyDeals, dealEngagements, userAffiliates } from '@shared/schema';

// Get daily deals for a county/area
export async function getDailyDeals(req: Request, res: Response) {
  try {
    const { county, limit = '20', featured, dealType } = req.query;
    
    const deals = await storage.getDailyDeals({
      countyFips: county as string,
      limit: parseInt(limit as string),
      featured: featured === 'true',
      dealType: dealType as string,
      activeOnly: true
    });

    res.json(deals);
  } catch (error) {
    console.error('Error fetching daily deals:', error);
    res.status(500).json({ message: 'Failed to fetch daily deals' });
  }
}

// Create a new daily deal (contractors/service providers only)
export async function createDailyDeal(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
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
    const userId = req.user?.id;
    
    // Create engagement record
    const engagement = await storage.createDealEngagement({
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
        sourceUrl: req.headers.referer,
        targetUrl: `/deals/${dealId}`
      });
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
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    let affiliate = await storage.getUserAffiliate(userId);
    
    // Create affiliate account if doesn't exist
    if (!affiliate) {
      affiliate = await storage.createUserAffiliate({
        userId,
        affiliateCode: await storage.generateAffiliateCode(userId)
      });
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
    const userId = req.user?.id;
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
    const userId = req.user?.id;
    
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
    const userId = req.user?.id;
    
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
    
    const deals = await storage.getDailyDeals({
      featured: true,
      activeOnly: true,
      limit: parseInt(limit as string)
    });

    res.json(deals);
  } catch (error) {
    console.error('Error fetching featured deals:', error);
    res.status(500).json({ message: 'Failed to fetch featured deals' });
  }
}