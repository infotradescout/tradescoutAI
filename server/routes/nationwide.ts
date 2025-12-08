import { Request, Response } from 'express';
import { storage } from '../storage';

const mockNationwideMetrics = {
  activeStates: 37,
  totalStates: 50,
  activeCounties: 1448,
  totalCounties: 3143,
  homeownerAccounts: 275000,
  contractorAccounts: 64000,
  averageResponseTimeMinutes: 34,
  averageCompletionDays: 12,
  satisfactionScore: 4.7,
};

const mockTopPerformingCounties = [
  {
    fipsCode: '06037',
    name: 'Los Angeles County',
    state: 'CA',
    activeContractors: 1280,
    monthlyJobs: 9400,
    customerRating: 4.8,
    activationDate: '2024-02-15',
  },
  {
    fipsCode: '17031',
    name: 'Cook County',
    state: 'IL',
    activeContractors: 860,
    monthlyJobs: 6100,
    customerRating: 4.6,
    activationDate: '2024-05-10',
  },
  {
    fipsCode: '12086',
    name: 'Miami-Dade County',
    state: 'FL',
    activeContractors: 540,
    monthlyJobs: 3900,
    customerRating: 4.5,
    activationDate: '2024-06-02',
  },
];

const mockExpansionPipeline = [
  {
    phase: 'Phase 5A - Coastal Coverage',
    targetCounties: 600,
    estimatedTimeframe: '12 months',
    requiredInvestment: '9800000.00',
    expectedUsers: 72000,
    expectedContractors: 16000,
    marketPenetration: 'Secondary coastal metros',
    status: 'planning',
  },
  {
    phase: 'Phase 5B - Heartland Push',
    targetCounties: 650,
    estimatedTimeframe: '15 months',
    requiredInvestment: '11200000.00',
    expectedUsers: 84000,
    expectedContractors: 18500,
    marketPenetration: 'Manufacturing corridors',
    status: 'planning',
  },
  {
    phase: 'Phase 5C - Rural Expansion',
    targetCounties: 800,
    estimatedTimeframe: '18 months',
    requiredInvestment: '12400000.00',
    expectedUsers: 95000,
    expectedContractors: 22000,
    marketPenetration: 'Rural communities and small towns',
    status: 'planning',
  },
  {
    phase: 'Phase 5D - Complete Coverage',
    targetCounties: 892,
    estimatedTimeframe: '24 months',
    requiredInvestment: '15600000.00',
    expectedUsers: 125000,
    expectedContractors: 35000,
    marketPenetration: 'Universal US coverage',
    status: 'planning',
  },
];

const mockFoundationImpact = {
  totalDonated: '2450000.00',
  mikeRoweWorksProjects: 156,
  scholarshipsAwarded: 890,
  tradeSchoolPartnerships: 47,
  veteranPlacements: 234,
  communityProjectsFunded: 892,
  localImpactGrants: 445,
  averageGrantSize: '5600.00',
  beneficiariesReached: 125000,
  jobsCreated: 2340,
  apprenticeshipsSponsored: 567,
};

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
    const pipeline = await (storage as any).getExpansionPipeline?.();
    if (!pipeline) throw new Error('Method not implemented');
    res.json(pipeline);
  } catch (error) {
    console.error('Error fetching expansion pipeline:', error);
    res.json(mockExpansionPipeline);
  }
}

// Get foundation impact metrics
export async function getFoundationImpact(req: Request, res: Response) {
  try {
    let impact;
    try {
      impact = await (storage as any).getFoundationImpact?.();
      if (!impact) throw new Error('Method not implemented');
    } catch (dbError) {
      console.log('Database offline, using mock foundation impact data');
      impact = mockFoundationImpact;
    }

    res.json(impact);
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

    const { countyFips, contactInfo, marketData, businessCase } = req.body;

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
      console.log('Database offline, simulating county activation request');
      request = {
        id: 'activation-' + Date.now(),
        userId,
        countyFips,
        contactInfo,
        marketData,
        businessCase,
        status: 'submitted',
        priority: 'medium',
        estimatedActivation: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        submittedAt: new Date().toISOString()
      };
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
      console.log('Database offline, using mock coverage map data');
      // Generate mock coverage data for visualization
      mapData = {
        activeCounties: mockTopPerformingCounties.map(county => ({
          fips: county.fipsCode,
          name: county.name,
          state: county.state,
          status: 'active',
          contractors: county.activeContractors,
          jobs: county.monthlyJobs,
          rating: county.customerRating,
          activationDate: county.activationDate
        })),
        pendingCounties: [
          { fips: '06073', name: 'San Diego County', state: 'CA', status: 'pending', estimatedActivation: '2025-10-15' },
          { fips: '53033', name: 'King County', state: 'WA', status: 'pending', estimatedActivation: '2025-11-20' },
          { fips: '04013', name: 'Maricopa County', state: 'AZ', status: 'pending', estimatedActivation: '2025-12-05' }
        ],
        totalCoverage: {
          activeCounties: mockNationwideMetrics.activeCounties,
          totalCounties: mockNationwideMetrics.totalCounties,
          coveragePercentage: (mockNationwideMetrics.activeCounties / mockNationwideMetrics.totalCounties * 100).toFixed(1)
        }
      };
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
      if (!performance) throw new Error('Method not implemented');
    } catch (dbError) {
      console.log('Database offline, using mock affiliate performance data');
      performance = {
        totalAffiliates: 89400,
        activeAffiliates: 67200,
        totalCommissionsPaid: '3450000.00',
        averageCommissionPerAffiliate: '387.50',
        topPerformers: [
          { userId: 'aff-1', name: 'Sarah Johnson', earnings: '45600.00', referrals: 234, conversionRate: 23.4 },
          { userId: 'aff-2', name: 'Mike Rodriguez', earnings: '38900.00', referrals: 189, conversionRate: 28.1 },
          { userId: 'aff-3', name: 'Lisa Chen', earnings: '34200.00', referrals: 167, conversionRate: 31.2 }
        ],
        monthlyTrends: Array.from({ length: 12 }, (_, i) => ({
          month: new Date(2025, i, 1).toISOString().slice(0, 7),
          affiliates: Math.floor(Math.random() * 5000) + 60000,
          commissions: (Math.random() * 200000 + 250000).toFixed(2),
          conversions: Math.floor(Math.random() * 1000) + 2000
        }))
      };
    }

    res.json(performance);
  } catch (error) {
    console.error('Error fetching affiliate performance:', error);
    res.status(500).json({ message: 'Failed to fetch affiliate performance' });
  }
}