import { Request, Response } from 'express';
import { storage } from '../storage';


// Get available boosts for user's role
export async function getAvailableBoosts(req: Request, res: Response) {
  try {
    const userRole = (req.user as any)?.role || (req.user as any)?.activeRole;
    const boosts = await storage.getBoostsByRole(userRole);
    res.json(boosts);
  } catch (error) {
    console.error('Error fetching available boosts:', error);
    res.status(500).json({ message: 'Failed to fetch boosts' });
  }
}

// Purchase a boost
export async function purchaseBoost(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { boostId, paymentMethodId } = (req.body ?? {}) as any;
    const boost = await storage.purchaseBoost({
      userId,
      boostId,
      paymentMethodId
    });

    res.status(201).json(boost);
  } catch (error) {
    console.error('Error purchasing boost:', error);
    res.status(500).json({ message: 'Failed to purchase boost' });
  }
}

// Get user's active boosts
export async function getUserBoosts(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userBoosts = await storage.getUserBoosts(userId);
    res.json(userBoosts);
  } catch (error) {
    console.error('Error fetching user boosts:', error);
    res.status(500).json({ message: 'Failed to fetch user boosts' });
  }
}

// Get boost analytics
export async function getBoostAnalytics(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    const { boostId } = req.params;
    const analytics = await storage.getBoostAnalytics(boostId, userId);
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching boost analytics:', error);
    res.status(500).json({ message: 'Failed to fetch analytics' });
  }
}

// Cancel/pause a boost
export async function cancelBoost(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    const { boostId } = req.params;

    const result = await (storage as any).cancelBoost?.(userId, boostId);
    res.json(result);
  } catch (error) {
    console.error('Error cancelling boost:', error);
    res.status(500).json({ message: 'Failed to cancel boost' });
  }
}