/**
 * User Type Metadata
 * User type metadata used for dashboards and feature gating.
 * HOA roles are not user types; they are per-neighborhood roles handled elsewhere.
 * The "community_builder" badge is not a user type.
 */

export interface UserTypeMetadata {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: 'property' | 'business' | 'service' | 'realestate' | 'automotive' | 'platform';
  defaultView: 'homeowner' | 'contractor' | 'business' | 'professional' | 'admin';
  features: string[]; // Features accessible to this user type
}

// Distinct badge labels for each user type and related roles.
// Community Builder and HOA roles are not selectable types but have badges.
export const USER_TYPE_BADGES: Record<string, string> = {
  homeowner: 'Homeowner Badge',
  renter: 'Renter/Tenant Badge',
  landlord: 'Landlord Badge',
  property_manager: 'Property Manager Badge',
  business_owner: 'Business Owner Badge',
  restaurant_owner: 'Restaurant Owner Badge',
  food_truck_owner: 'Food Truck Owner Badge',
  bar_owner: 'Bar Owner Badge',
  commercial_property: 'Commercial Property Badge',
  franchise_owner: 'Franchise Owner Badge',
  startup_founder: 'Startup Founder Badge',
  contractor: 'Contractor Badge',
  handyman: 'Handyman Badge',
  service_provider: 'Service Provider Badge',
  specialty_tradesperson: 'Specialty Trades Badge',
  designer: 'Designer/Architect Badge',
  inspector: 'Inspector/Appraiser Badge',
  realtor: 'Real Estate Agent Badge',
  mortgage_broker: 'Mortgage Broker Badge',
  insurance_agent: 'Insurance Agent Badge',
  title_company: 'Title/Escrow Badge',
  car_dealer: 'Car Dealer Badge',
  auto_service: 'Auto Service Badge',
  nonprofit_org: 'Non-Profit Badge',
  affiliate: 'Affiliate Partner Badge', // auto-applied to everyone
  content_creator: 'Content Creator Badge',
  admin: 'Administrator Badge',
  // Non-selectable HOA roles (per-neighborhood)
  hoa_member: 'HOA Member Badge',
  hoa_board: 'HOA Board Badge',
  // Community Builder badge: granted via monetized community actions (donations, referrals, spending)
  community_builder: 'Community Builder Badge',
};

export const USER_TYPES: Record<string, UserTypeMetadata> = {
  // Property Owners & Managers (5)
  homeowner: {
    id: 'homeowner',
    label: 'Homeowner',
    description: 'Single-family home owner looking for contractors and services',
    icon: 'Home',
    category: 'property',
    defaultView: 'homeowner',
    features: ['find_contractors', 'get_quotes', 'project_management', 'reviews'],
  },
  renter: {
    id: 'renter',
    label: 'Renter/Tenant',
    description: 'Renting a property, need services or looking for a new place',
    icon: 'Key',
    category: 'property',
    defaultView: 'homeowner',
    features: ['find_contractors', 'rental_search', 'maintenance_requests'],
  },
  landlord: {
    id: 'landlord',
    label: 'Landlord',
    description: 'Property owner managing rental units',
    icon: 'Building2',
    category: 'property',
    defaultView: 'business',
    features: ['property_management', 'tenant_screening', 'maintenance_tracking', 'find_contractors'],
  },
  property_manager: {
    id: 'property_manager',
    label: 'Property Manager',
    description: 'Professional managing multiple properties for owners',
    icon: 'Briefcase',
    category: 'property',
    defaultView: 'business',
    features: ['multi_property', 'vendor_management', 'tenant_portal', 'financial_reports'],
  },
  other: {
    id: 'other',
    label: 'Other (specify)',
    description: 'Custom role entered by the user; we will add a dedicated badge if enough users share it',
    icon: 'Tag',
    category: 'platform',
    defaultView: 'professional',
    features: [],
  },
  // Business & Commercial (4)
  business_owner: {
    id: 'business_owner',
    label: 'Business Owner',
    description: 'Local business needing commercial services',
    icon: 'Store',
    category: 'business',
    defaultView: 'business',
    features: ['commercial_services', 'vendor_management', 'business_profile', 'marketplace'],
  },
  restaurant_owner: {
    id: 'restaurant_owner',
    label: 'Restaurant Owner',
    description: 'Restaurant, cafe, or food business owner connecting with local diners and communities',
    icon: 'UtensilsCrossed',
    category: 'business',
    defaultView: 'business',
    features: ['commercial_services', 'business_profile', 'marketplace', 'mealscout_deals', 'mealscout_subscription'],
  },
  food_truck_owner: {
    id: 'food_truck_owner',
    label: 'Food Truck Owner',
    description: 'Mobile food or coffee truck owner promoting routes and daily specials',
    icon: 'Truck',
    category: 'business',
    defaultView: 'business',
    features: ['business_profile', 'marketplace', 'route_optimization', 'mealscout_deals', 'mealscout_subscription'],
  },
  bar_owner: {
    id: 'bar_owner',
    label: 'Bar / Lounge Owner',
    description: 'Bar, lounge, or nightlife venue promoting events and specials',
    icon: 'Wine',
    category: 'business',
    defaultView: 'business',
    features: ['business_profile', 'marketplace', 'event_management', 'mealscout_deals', 'mealscout_subscription'],
  },
  commercial_property: {
    id: 'commercial_property',
    label: 'Commercial Property',
    description: 'Commercial real estate owner or manager',
    icon: 'Building',
    category: 'business',
    defaultView: 'business',
    features: ['facility_management', 'commercial_contractors', 'tenant_services', 'compliance'],
  },
  franchise_owner: {
    id: 'franchise_owner',
    label: 'Franchise Owner',
    description: 'Operating a franchise business location',
    icon: 'Network',
    category: 'business',
    defaultView: 'business',
    features: ['franchise_services', 'multi_location', 'brand_compliance', 'vendor_network'],
  },
  startup_founder: {
    id: 'startup_founder',
    label: 'Startup Founder',
    description: 'Entrepreneur building a new business',
    icon: 'Rocket',
    category: 'business',
    defaultView: 'business',
    features: ['startup_services', 'networking', 'office_setup', 'growth_resources'],
  },

  // Service Providers & Contractors (6)
  contractor: {
    id: 'contractor',
    label: 'Licensed Contractor',
    description: 'Licensed general contractor offering construction services',
    icon: 'HardHat',
    category: 'service',
    defaultView: 'contractor',
    features: ['lead_generation', 'project_bidding', 'scheduling', 'invoicing', 'licensing'],
  },
  handyman: {
    id: 'handyman',
    label: 'Handyman',
    description: 'General repair and maintenance services',
    icon: 'Wrench',
    category: 'service',
    defaultView: 'contractor',
    features: ['small_jobs', 'quick_quotes', 'scheduling', 'reviews'],
  },
  service_provider: {
    id: 'service_provider',
    label: 'Service Provider',
    description: 'Professional services (cleaning, landscaping, moving, etc.)',
    icon: 'Sparkles',
    category: 'service',
    defaultView: 'contractor',
    features: ['recurring_services', 'scheduling', 'route_optimization', 'customer_management'],
  },
  specialty_tradesperson: {
    id: 'specialty_tradesperson',
    label: 'Specialty Trades',
    description: 'Plumber, electrician, HVAC, roofing specialist, etc.',
    icon: 'Tool',
    category: 'service',
    defaultView: 'contractor',
    features: ['specialty_leads', 'licensing', 'emergency_services', 'warranty_tracking'],
  },
  designer: {
    id: 'designer',
    label: 'Designer/Architect',
    description: 'Interior designer, architect, or design professional',
    icon: 'Palette',
    category: 'service',
    defaultView: 'professional',
    features: ['portfolio', 'project_showcase', 'consultation_booking', '3d_visualization'],
  },
  inspector: {
    id: 'inspector',
    label: 'Inspector/Appraiser',
    description: 'Home inspector, appraiser, or assessor',
    icon: 'ClipboardCheck',
    category: 'service',
    defaultView: 'professional',
    features: ['inspection_scheduling', 'report_generation', 'certification_display', 'booking'],
  },

  // Real Estate & Finance (4)
  realtor: {
    id: 'realtor',
    label: 'Real Estate Agent',
    description: 'Licensed real estate professional',
    icon: 'HomeIcon',
    category: 'realestate',
    defaultView: 'professional',
    features: ['listings', 'client_management', 'showing_scheduler', 'market_analytics', 'referrals'],
  },
  mortgage_broker: {
    id: 'mortgage_broker',
    label: 'Mortgage Broker',
    description: 'Mortgage and loan specialist',
    icon: 'DollarSign',
    category: 'realestate',
    defaultView: 'professional',
    features: ['loan_calculator', 'application_portal', 'rate_comparison', 'client_portal'],
  },
  insurance_agent: {
    id: 'insurance_agent',
    label: 'Insurance Agent',
    description: 'Property and casualty insurance professional',
    icon: 'Shield',
    category: 'realestate',
    defaultView: 'professional',
    features: ['quote_generator', 'policy_management', 'claims_portal', 'risk_assessment'],
  },
  title_company: {
    id: 'title_company',
    label: 'Title/Escrow',
    description: 'Title insurance and escrow services',
    icon: 'FileText',
    category: 'realestate',
    defaultView: 'professional',
    features: ['closing_coordination', 'document_management', 'wire_verification', 'title_search'],
  },

  // Automotive (2)
  car_dealer: {
    id: 'car_dealer',
    label: 'Car Dealer',
    description: 'Auto dealership or vehicle sales professional',
    icon: 'Car',
    category: 'automotive',
    defaultView: 'business',
    features: ['vehicle_inventory', 'test_drive_scheduling', 'trade_in_valuation', 'financing'],
  },
  auto_service: {
    id: 'auto_service',
    label: 'Auto Service',
    description: 'Auto repair, detailing, maintenance services',
    icon: 'Cog',
    category: 'automotive',
    defaultView: 'contractor',
    features: ['appointment_booking', 'service_packages', 'vehicle_history', 'mobile_service'],
  },

  // Community & Admin (3)
  nonprofit_org: {
    id: 'nonprofit_org',
    label: 'Non-Profit',
    description: 'Non-profit organization or charity',
    icon: 'HandHeart',
    category: 'business',
    defaultView: 'business',
    features: ['volunteer_coordination', 'donation_portal', 'event_management', 'impact_reporting'],
  },

  // Platform & Special (3)
  affiliate: {
    id: 'affiliate',
    label: 'Affiliate',
    description: 'Affiliate marketer or referral partner',
    icon: 'Share2',
    category: 'platform',
    defaultView: 'professional',
    features: ['referral_dashboard', 'commission_tracking', 'marketing_materials', 'analytics'],
  },
  content_creator: {
    id: 'content_creator',
    label: 'Content Creator',
    description: 'Blogger, influencer, or review specialist',
    icon: 'Megaphone',
    category: 'platform',
    defaultView: 'professional',
    features: ['content_tools', 'partnership_opportunities', 'analytics', 'media_kit'],
  },
  admin: {
    id: 'admin',
    label: 'Platform Admin',
    description: 'TradeScout platform administrator',
    icon: 'ShieldCheck',
    category: 'platform',
    defaultView: 'admin',
    features: ['full_access', 'user_management', 'content_moderation', 'system_settings'],
  },
};

export const USER_TYPE_CATEGORIES = {
  property: {
    label: 'Property Owners & Renters',
    description: 'Homeowners, renters, landlords, and property managers',
    icon: 'Home',
  },
  business: {
    label: 'Business & Commercial',
    description: 'Business owners and commercial property managers',
    icon: 'Briefcase',
  },
  service: {
    label: 'Service Providers',
    description: 'Contractors, handymen, and service professionals',
    icon: 'Wrench',
  },
  realestate: {
    label: 'Real Estate & Finance',
    description: 'Realtors, mortgage brokers, insurance agents',
    icon: 'Building',
  },
  automotive: {
    label: 'Automotive',
    description: 'Car dealers and auto service providers',
    icon: 'Car',
  },
  platform: {
    label: 'Platform Partners',
    description: 'Affiliates, content creators, and administrators',
    icon: 'Star',
  },
};

// User types selectable during account creation and profile settings.
// Excludes HOA roles (handled per-neighborhood), affiliate (auto-applied), and admin (backend only).
export const ACCOUNT_CREATION_USER_TYPES: string[] = [
  'homeowner',
  'renter',
  'landlord',
  'property_manager',
  'other',
  'business_owner',
  'restaurant_owner',
  'food_truck_owner',
  'bar_owner',
  'commercial_property',
  'franchise_owner',
  'startup_founder',
  'contractor',
  'handyman',
  'service_provider',
  'specialty_tradesperson',
  'designer',
  'inspector',
  'realtor',
  'mortgage_broker',
  'insurance_agent',
  'title_company',
  'car_dealer',
  'auto_service',
  'nonprofit_org',
  'content_creator',
];

// Helper: resolve a badge label for a given user type/role id
export function getUserTypeBadgeLabel(typeId: string): string | undefined {
  return USER_TYPE_BADGES[typeId];
}

// Helper: derive badges from a list of user types/roles
export function getUserTypeBadges(userTypes: string[]): string[] {
  if (!userTypes || userTypes.length === 0) return [];
  const badges = new Set<string>();
  for (const typeId of userTypes) {
    const badge = getUserTypeBadgeLabel(typeId);
    if (badge) badges.add(badge);
  }
  return Array.from(badges);
}

// Helper to get user type metadata
export function getUserTypeMetadata(typeId: string): UserTypeMetadata | undefined {
  return USER_TYPES[typeId];
}

// Helper to get all user types in a category
export function getUserTypesByCategory(category: string): UserTypeMetadata[] {
  return Object.values(USER_TYPES).filter(type => type.category === category);
}

// Helper to determine default dashboard based on user types
export function getDefaultDashboard(userTypes: string[]): string {
  if (!userTypes || userTypes.length === 0) return 'homeowner';
  
  // Priority order: admin > contractor > business > professional > homeowner
  const priorities: Record<string, number> = {
    admin: 5,
    contractor: 4,
    business: 3,
    professional: 2,
    homeowner: 1,
  };
  
  let highestPriority = 0;
  let defaultView = 'homeowner';
  
  for (const typeId of userTypes) {
    const metadata = getUserTypeMetadata(typeId);
    if (metadata) {
      const priority = priorities[metadata.defaultView] || 0;
      if (priority > highestPriority) {
        highestPriority = priority;
        defaultView = metadata.defaultView;
      }
    }
  }
  
  return defaultView;
}
