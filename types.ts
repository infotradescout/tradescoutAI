
export enum Category {
  PLUMBING = 'Plumbing',
  ELECTRICAL = 'Electrical',
  PAINTING = 'Painting',
  ROOFING = 'Roofing',
  LANDSCAPING = 'Landscaping',
  GENERAL = 'General Contractor',
}

export type UserRole = 'homeowner' | 'contractor' | 'realtor';

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
  role?: UserRole;
  linkedContractorId?: string; // If they are a pro, link to their business profile
}

export interface Lead {
    id: string;
    userId: string; // Homeowner who requested it
    userName: string;
    category: string;
    description: string;
    location: string;
    date: string;
    status: 'open' | 'claimed';
}

// New Interface for Active Projects
export interface ProjectTask {
    id: string;
    title: string;
    status: 'pending' | 'in-progress' | 'completed';
    dueDate?: string;
}

export interface ProjectDocument {
    id: string;
    name: string;
    type: 'invoice' | 'permit' | 'photo' | 'other';
    url: string; // In a real app this is a cloud URL, here we might simulate or use dataURIs
    date: string;
}

export interface ActiveProject {
    id: string;
    userId: string;
    title: string;
    category: string;
    status: 'planning' | 'in-progress' | 'completed' | 'paused';
    contractorId?: string; // Optional, they might DIY or haven't hired yet
    tasks: ProjectTask[];
    documents: ProjectDocument[];
    notes: string;
    startDate: string;
    budget: number;
}

// Community Forum Interfaces
export interface ForumComment {
    id: string;
    postId: string;
    userId: string; // 'ai' for bot
    username: string;
    userRole: UserRole | 'ai';
    content: string;
    date: string;
    upvotes: number;
}

export interface ForumPost {
    id: string;
    userId: string;
    username: string;
    userRole: UserRole;
    title: string;
    content: string;
    category: string;
    location?: string;
    date: string;
    upvotes: number;
    comments: ForumComment[];
    views: number;
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
  isPromoted?: boolean; // New field for Sponsored/Partner status
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
  relatedServices: string[]; // Internal cross-sells (e.g. search for 'Painters')
  affiliateOffers: { title: string; type: string }[]; // External money-makers (e.g. 'Get Financing')
  thoughtProcess: string; // The "Brain" log
  intent?: 'PROJECT' | 'CODES' | 'VEHICLE' | 'GENERAL'; // New: Intent Classification
  recommendations?: { name: string; specs: string; link?: string }[]; // New: For Vehicle/Tool intent
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  dateAdded: string;
  isActive: boolean;
}

export interface Partnership {
  id: string;
  title: string;
  description: string;
  link: string;
  type: 'Marketplace' | 'Affiliate' | 'Sponsored';
  triggerKeywords: string[]; // Keywords that trigger this ad
  priority: number; // 1-10
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
