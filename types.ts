
export enum Category {
  PLUMBING = 'Plumbing',
  ELECTRICAL = 'Electrical',
  PAINTING = 'Painting',
  ROOFING = 'Roofing',
  LANDSCAPING = 'Landscaping',
  GENERAL = 'General Contractor',
}

export interface Review {
  id: string;
  userId: string;
  rating: number; // 1-5
  comment: string;
  date: string;
}

export interface User {
  id: string;
  username: string;
  avatarUrl: string;
  bio: string;
  savedContractorIds: string[];
  isAdmin?: boolean;
}

export interface Contractor {
  id: string;
  name: string;
  category: Category;
  location: string;
  monthlyScore: number;
  lifetimeScore: number;
  avatarUrl: string;
  description: string;
  specialties: string[];
  reviews: Review[];
  verified: boolean;
  lat: number;
  lng: number;
  claimed: boolean;
  phone?: string;
  email?: string;
  website?: string;
  sourceUrl?: string;
  distance?: number; // Distance in miles from user
}

export interface ProjectAnalysis {
  category: string;
  keywords: string[];
  location: string | null;
  estimatedCost: string;
  estimatedMaterials: string[];
  jobSummary: string;
  processSteps: string[];
  costFactors: string;
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  dateAdded: string;
  isActive: boolean;
}

export interface LocalTradeData {
  permitsRequired: string[];
  typicalCosts: {
    [category: string]: {
      low: number;
      high: number;
      unit: "USD";
    };
  };
  climateFactors: string[];
  riskFactors: string[];
  materialAvailability: string[];
  contractorRegulations: string[];
  popularProjectTypes: string[];
}

export interface LocalDataContext {
  national: LocalTradeData;
  state?: LocalTradeData;
  county?: LocalTradeData;
  region?: LocalTradeData;
}
