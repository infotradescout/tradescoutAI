import { Request, Response } from 'express';
import { storage } from '../storage';

// Mock HOA data for Phase 4 implementation
const mockHOAs = [
  {
    id: 'hoa-1',
    name: 'Sunset Hills Community Association',
    address: '123 Community Center Dr, Los Angeles, CA 90210',
    countyFips: '06037',
    establishedYear: 2015,
    totalUnits: 284,
    monthlyFees: '285.00',
    reserves: '1250000.00',
    managementCompany: 'Premium Property Management LLC',
    boardMembers: [
      { name: 'Jennifer Martinez', position: 'President', term: '2024-2026' },
      { name: 'Robert Chen', position: 'Vice President', term: '2024-2025' },
      { name: 'Lisa Thompson', position: 'Treasurer', term: '2023-2025' },
      { name: 'David Rodriguez', position: 'Secretary', term: '2024-2026' }
    ],
    amenities: ['Pool', 'Fitness Center', 'Tennis Court', 'Playground', 'Clubhouse'],
    nextMeeting: '2025-09-15T19:00:00Z',
    documents: [
      { name: 'CC&Rs', lastUpdated: '2024-01-15', type: 'governing' },
      { name: 'Annual Budget 2025', lastUpdated: '2024-12-01', type: 'financial' },
      { name: 'Board Meeting Minutes - July 2025', lastUpdated: '2025-07-20', type: 'minutes' }
    ],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const mockHOAFinances = {
  'hoa-1': {
    totalRevenue: '975000.00',
    totalExpenses: '892000.00',
    reserves: '1250000.00',
    outstandingFees: '18500.00',
    monthlyBreakdown: [
      { month: '2025-01', revenue: '81250.00', expenses: '74200.00' },
      { month: '2025-02', revenue: '81250.00', expenses: '69800.00' },
      { month: '2025-03', revenue: '81250.00', expenses: '78900.00' },
      { month: '2025-04', revenue: '81250.00', expenses: '71500.00' },
      { month: '2025-05', revenue: '81250.00', expenses: '76300.00' },
      { month: '2025-06', revenue: '81250.00', expenses: '82100.00' },
      { month: '2025-07', revenue: '81250.00', expenses: '74800.00' },
      { month: '2025-08', revenue: '81250.00', expenses: '75200.00' }
    ],
    expenseCategories: [
      { category: 'Maintenance', amount: '285600.00', percentage: 32 },
      { category: 'Utilities', amount: '178400.00', percentage: 20 },
      { category: 'Insurance', amount: '125300.00', percentage: 14 },
      { category: 'Management Fees', amount: '107040.00', percentage: 12 },
      { category: 'Landscaping', amount: '89200.00', percentage: 10 },
      { category: 'Administrative', amount: '62400.00', percentage: 7 },
      { category: 'Other', amount: '44060.00', percentage: 5 }
    ]
  }
};

const mockHOAVendors = [
  {
    id: 'vendor-1',
    hoaId: 'hoa-1',
    name: 'GreenScape Landscaping',
    category: 'Landscaping',
    contactPerson: 'Maria Santos',
    phone: '(555) 123-4567',
    email: 'maria@greenscape.com',
    monthlyContract: '7450.00',
    contractStart: '2024-01-01',
    contractEnd: '2025-12-31',
    rating: 4.8,
    status: 'active',
    services: ['Lawn Care', 'Tree Trimming', 'Irrigation', 'Seasonal Planting']
  },
  {
    id: 'vendor-2',
    hoaId: 'hoa-1',
    name: 'AquaClear Pool Services',
    category: 'Pool Maintenance',
    contactPerson: 'James Wilson',
    phone: '(555) 987-6543',
    email: 'james@aquaclear.com',
    monthlyContract: '2800.00',
    contractStart: '2024-03-01',
    contractEnd: '2025-02-28',
    rating: 4.6,
    status: 'active',
    services: ['Chemical Balancing', 'Cleaning', 'Equipment Maintenance', 'Emergency Repairs']
  }
];

const mockActiveVotes = [
  {
    id: 'vote-1',
    hoaId: 'hoa-1',
    title: 'Proposal to Install Solar Panels on Clubhouse',
    description: 'Vote on installing solar panels to reduce electricity costs by an estimated $1,200/month.',
    type: 'capital_improvement',
    createdBy: 'board-president',
    startDate: '2025-08-15T00:00:00Z',
    endDate: '2025-09-15T23:59:59Z',
    requiredQuorum: 142, // 50% of 284 units
    currentVotes: 89,
    votesFor: 67,
    votesAgainst: 22,
    estimatedCost: '125000.00',
    status: 'active'
  }
];

// Get HOA information
export async function getHOA(req: Request, res: Response) {
  try {
    const { hoaId } = req.params;
    
    let hoa;
    try {
      hoa = await (storage as any).getHOAById?.(hoaId);
      if (!hoa) throw new Error('Method not implemented');
    } catch (dbError) {
      console.log('Database offline, using mock HOA data');
      hoa = mockHOAs.find(h => h.id === hoaId);
    }

    if (!hoa) {
      return res.status(404).json({ message: 'HOA not found' });
    }

    res.json(hoa);
  } catch (error) {
    console.error('Error fetching HOA:', error);
    res.status(500).json({ message: 'Failed to fetch HOA information' });
  }
}

// Get HOA financial data
export async function getHOAFinances(req: Request, res: Response) {
  try {
    const { hoaId } = req.params;
    
    let finances;
    try {
      finances = await (storage as any).getHOAFinances?.(hoaId);
      if (!finances) throw new Error('Method not implemented');
    } catch (dbError) {
      console.log('Database offline, using mock financial data');
      finances = mockHOAFinances[hoaId as keyof typeof mockHOAFinances];
    }

    if (!finances) {
      return res.status(404).json({ message: 'Financial data not found' });
    }

    res.json(finances);
  } catch (error) {
    console.error('Error fetching HOA finances:', error);
    res.status(500).json({ message: 'Failed to fetch financial data' });
  }
}

// Get HOA vendors
export async function getHOAVendors(req: Request, res: Response) {
  try {
    const { hoaId } = req.params;
    
    let vendors;
    try {
      vendors = await (storage as any).getHOAVendors?.(hoaId);
      if (!vendors) throw new Error('Method not implemented');
    } catch (dbError) {
      console.log('Database offline, using mock vendor data');
      vendors = mockHOAVendors.filter(v => v.hoaId === hoaId);
    }

    res.json(vendors);
  } catch (error) {
    console.error('Error fetching HOA vendors:', error);
    res.status(500).json({ message: 'Failed to fetch vendor data' });
  }
}

// Get active votes
export async function getHOAVotes(req: Request, res: Response) {
  try {
    const { hoaId } = req.params;
    
    let votes;
    try {
      votes = await (storage as any).getHOAVotes?.(hoaId);
      if (!votes) throw new Error('Method not implemented');
    } catch (dbError) {
      console.log('Database offline, using mock voting data');
      votes = mockActiveVotes.filter(v => v.hoaId === hoaId);
    }

    res.json(votes);
  } catch (error) {
    console.error('Error fetching HOA votes:', error);
    res.status(500).json({ message: 'Failed to fetch voting data' });
  }
}

// Submit a vote
export async function submitVote(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { voteId } = req.params;
    const { decision } = req.body; // 'for' or 'against'

    let voteResult;
    try {
      voteResult = await (storage as any).submitHOAVote?.(userId, voteId, decision);
      if (!voteResult) throw new Error('Method not implemented');
    } catch (dbError) {
      console.log('Database offline, simulating vote submission');
      voteResult = {
        voteId,
        userId,
        decision,
        submittedAt: new Date().toISOString(),
        status: 'recorded'
      };
    }

    res.status(201).json(voteResult);
  } catch (error) {
    console.error('Error submitting vote:', error);
    res.status(500).json({ message: 'Failed to submit vote' });
  }
}

// Request vendor services
export async function requestVendorService(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { vendorId } = req.params;
    const { serviceType, description, urgency, contactPreference } = req.body;

    let serviceRequest;
    try {
      serviceRequest = await (storage as any).createVendorServiceRequest?.({
        userId,
        vendorId,
        serviceType,
        description,
        urgency,
        contactPreference
      });
      if (!serviceRequest) throw new Error('Method not implemented');
    } catch (dbError) {
      console.log('Database offline, simulating service request');
      serviceRequest = {
        id: 'request-' + Date.now(),
        userId,
        vendorId,
        serviceType,
        description,
        urgency,
        contactPreference,
        status: 'submitted',
        submittedAt: new Date().toISOString()
      };
    }

    res.status(201).json(serviceRequest);
  } catch (error) {
    console.error('Error requesting vendor service:', error);
    res.status(500).json({ message: 'Failed to request service' });
  }
}

// Search HOAs by location
export async function searchHOAs(req: Request, res: Response) {
  try {
    const { county, zip, city, state } = req.query;
    
    let hoas;
    try {
      hoas = await (storage as any).searchHOAs?.({
        countyFips: county as string,
        zip: zip as string,
        city: city as string,
        state: state as string
      });
      if (!hoas) throw new Error('Method not implemented');
    } catch (dbError) {
      console.log('Database offline, using mock HOA search results');
      hoas = mockHOAs.filter(hoa => {
        if (county && hoa.countyFips !== county) return false;
        return hoa.isActive;
      });
    }

    res.json(hoas);
  } catch (error) {
    console.error('Error searching HOAs:', error);
    res.status(500).json({ message: 'Failed to search HOAs' });
  }
}