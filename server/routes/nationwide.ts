import { Request, Response } from 'express';
import { storage } from '../storage';

// Get nationwide expansion metrics
export async function getNationwideMetrics(req: Request, res: Response) {
  try {
    const metrics = await storage.getNationwideMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching nationwide metrics:', error);
    res.status(500).json({ message: 'Failed to fetch nationwide metrics' });
  }
}

// Get top performing counties
export async function getTopCounties(req: Request, res: Response) {
  try {
    const { limit = '10' } = req.query;
    const counties = await storage.getTopPerformingCounties(parseInt(limit as string));
    res.json(counties);
  } catch (error) {
    console.error('Error fetching top counties:', error);
    res.status(500).json({ message: 'Failed to fetch top counties' });
  }
}

// Get expansion pipeline
export async function getExpansionPipeline(req: Request, res: Response) {
  try {
    const pipeline = await storage.getExpansionPipeline();
    res.json(pipeline);
  } catch (error) {
    console.error('Error fetching expansion pipeline:', error);
    res
      .status(503)
      .json({ message: 'Expansion pipeline data is temporarily unavailable' });
  }
}

// Get foundation impact metrics
export async function getFoundationImpact(req: Request, res: Response) {
  try {
    const stats = await storage.getFoundationStats();

    res.json({
      totalRaised: Number(stats?.totalRaised ?? 0),
      totalDonors: Number(stats?.totalDonors ?? 0),
      activeCauses: Number(stats?.activeCauses ?? 0),
      countiesSupported: Number(stats?.countiesSupported ?? 0),
    });
  } catch (error) {
    console.error('Error fetching foundation impact:', error);
    res.status(500).json({ message: 'Failed to fetch foundation impact' });
  }
}

// Submit county activation request
export async function requestCountyActivation(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { countyFips, contactInfo, marketData, businessCase } = (req.body ?? {}) as any;

    if (!countyFips || typeof countyFips !== 'string') {
      return res.status(400).json({ message: 'countyFips is required' });
    }

    let request;
    try {
      request = await (storage as any).createCountyActivationRequest?.({
        userId,
        countyFips,
        contactInfo,
        marketData,
        businessCase
      });
      if (!request) throw new Error('Method not implemented');
    } catch (dbError) {
      console.error('County activation unavailable:', dbError);
      return res.status(503).json({ message: 'County activation temporarily unavailable' });
    }

    res.status(201).json(request);
  } catch (error) {
    console.error('Error submitting county activation request:', error);
    res.status(500).json({ message: 'Failed to submit activation request' });
  }
}

// Get county coverage map data
export async function getCoverageMapData(req: Request, res: Response) {
  try {
    let mapData;
    try {
      mapData = await (storage as any).getCoverageMapData?.();
      if (!mapData) throw new Error('Method not implemented');
    } catch (dbError) {
      console.error('Coverage map data unavailable:', dbError);
      return res.status(503).json({ message: 'Coverage map data is temporarily unavailable' });
    }

    res.json(mapData);
  } catch (error) {
    console.error('Error fetching coverage map data:', error);
    res.status(500).json({ message: 'Failed to fetch coverage map data' });
  }
}

// Get affiliate program performance
export async function getAffiliatePerformance(req: Request, res: Response) {
  try {
    let performance;
    try {
      performance = await (storage as any).getAffiliatePerformance?.();
      if (!performance) throw new Error("Method not implemented");
    } catch (dbError) {
      console.error("Affiliate performance data unavailable:", dbError);
      return res
        .status(503)
        .json({ message: "Affiliate performance data is temporarily unavailable" });
    }

    res.json(performance);
  } catch (error) {
    console.error("Error fetching affiliate performance:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch affiliate performance" });
  }
}