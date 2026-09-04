// Role hierarchy and permission system for TradeScout

export type UserRole =
  // Customer & business roles
  | "homeowner"
  | "property_manager"
  | "business_owner"
  | "restaurant_owner"
  | "food_truck_owner"
  | "bar_owner"

  // Service provider roles
  | "contractor_user"
  | "helper" // New role for workers/helpers
  | "accelerator_member"
  | "realtor"
  | "car_salesman"
  | "insurance_agent"
  | "mortgage_broker"

  // Community roles
  | "community_member"
  | "community_moderator"
  | "community_leader"

  // Platform staff roles
  | "support_agent"
  | "content_moderator"
  | "territory_manager"
  | "contractor_success"
  | "content_seo"
  | "analytics_specialist"
  | "marketing_specialist"

  // Admin roles
  | "moderator"
  | "ops_admin"
  | "super_admin";

export type TradeCategory =
  // Construction & General
  | "general_contractor"
  | "construction_manager"
  | "project_manager"

  // Structural & Foundation
  | "concrete_contractor"
  | "foundation_specialist"
  | "masonry_contractor"
  | "structural_engineer"

  // Building Envelope
  | "roofing_contractor"
  | "siding_contractor"
  | "window_installer"
  | "door_installer"
  | "insulation_contractor"

  // Electrical & Technology
  | "electrician"
  | "low_voltage_technician"
  | "solar_installer"
  | "security_system_installer"
  | "smart_home_specialist"

  // Plumbing & HVAC
  | "plumber"
  | "hvac_contractor"
  | "refrigeration_technician"
  | "water_heater_specialist"
  | "septic_contractor"

  // Interior Finishing
  | "flooring_contractor"
  | "tile_contractor"
  | "carpet_installer"
  | "painter"
  | "drywall_contractor"
  | "cabinet_maker"
  | "countertop_installer"

  // Kitchen & Bath
  | "kitchen_remodeler"
  | "bathroom_remodeler"
  | "appliance_installer"

  // Outdoor & Landscaping
  | "landscaper"
  | "hardscape_contractor"
  | "pool_contractor"
  | "fence_contractor"
  | "deck_builder"
  | "outdoor_lighting"

  // Specialty Services
  | "home_inspector"
  | "mold_remediation"
  | "water_damage_restoration"
  | "pest_control"
  | "cleaning_service"
  | "handyman"
  | "maintenance_contractor"

  // General & Retail Small Business (non-trade)
  | "salon_barbershop"
  | "spa_wellness"
  | "bakery_cafe"
  | "restaurant_food_service"
  | "retail_shop"
  | "boutique_apparel"
  | "florist"
  | "pet_grooming_services"
  | "childcare_provider"
  | "tutor_education_services"
  | "photographer_videographer"
  | "event_planner"
  | "auto_repair_service"
  | "laundry_dry_cleaning"
  | "fitness_instructor"
  | "bookkeeping_accounting"
  | "marketing_creative_services"
  | "general_small_business";

export interface RolePermissions {
  // Content permissions
  canCreateContent: boolean;
  canEditContent: boolean;
  canDeleteContent: boolean;
  canModerateContent: boolean;

  // User permissions
  canViewUsers: boolean;
  canEditUsers: boolean;
  canDeleteUsers: boolean;
  canBanUsers: boolean;

  // Admin permissions
  canAccessAdminPanel: boolean;
  canManageSettings: boolean;
  canViewAnalytics: boolean;
  canManagePayments: boolean;

  // Platform permissions
  canManageContractors: boolean;
  canManageListings: boolean;
  canManageReports: boolean;
  canManageModeration: boolean;

  // Special permissions
  canPromoteUsers: boolean;
  canManageRoles: boolean;
  canAccessSuperAdmin: boolean;
  canManageAdmins: boolean;
}

// Administrative ordering for role-assignment and display workflows only.
// These values are not access grants: product, community, provider, staff, and
// administrative roles describe different scopes and cannot inherit authority
// from one another merely because one number is higher.
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  // Customer & business roles (0-9)
  homeowner: 0,
  property_manager: 1,
  business_owner: 2,
  restaurant_owner: 2,
  food_truck_owner: 2,
  bar_owner: 2,

  // Service provider roles (10-19)
  contractor_user: 10,
  helper: 11, // New role for workers/helpers
  accelerator_member: 15,
  realtor: 12,
  car_salesman: 12,
  insurance_agent: 12,
  mortgage_broker: 12,

  // Community roles (20-29)
  community_member: 20,
  community_moderator: 25,
  community_leader: 28,

  // Platform staff roles (30-49)
  support_agent: 30,
  content_moderator: 35,
  territory_manager: 40,
  contractor_success: 42,
  content_seo: 42,
  analytics_specialist: 45,
  marketing_specialist: 45,

  // Admin roles (50+)
  moderator: 50,
  ops_admin: 70,
  super_admin: 100,
};

// Role permissions matrix
export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  // Customer roles
  homeowner: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: false,
    canViewUsers: false,
    canEditUsers: false,
    canDeleteUsers: false,
    canBanUsers: false,
    canAccessAdminPanel: false,
    canManageSettings: false,
    canViewAnalytics: false,
    canManagePayments: false,
    canManageContractors: false,
    canManageListings: false,
    canManageReports: false,
    canManageModeration: false,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },

  property_manager: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: false,
    canViewUsers: true,
    canEditUsers: false,
    canDeleteUsers: false,
    canBanUsers: false,
    canAccessAdminPanel: false,
    canManageSettings: false,
    canViewAnalytics: false,
    canManagePayments: false,
    canManageContractors: false,
    canManageListings: true,
    canManageReports: false,
    canManageModeration: false,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },

  business_owner: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: false,
    canViewUsers: true,
    canEditUsers: false,
    canDeleteUsers: false,
    canBanUsers: false,
    canAccessAdminPanel: false,
    canManageSettings: false,
    canViewAnalytics: true,
    canManagePayments: false,
    canManageContractors: false,
    canManageListings: true,
    canManageReports: false,
    canManageModeration: false,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },
  restaurant_owner: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: false,
    canViewUsers: true,
    canEditUsers: false,
    canDeleteUsers: false,
    canBanUsers: false,
    canAccessAdminPanel: false,
    canManageSettings: false,
    canViewAnalytics: true,
    canManagePayments: false,
    canManageContractors: false,
    canManageListings: true,
    canManageReports: false,
    canManageModeration: false,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },
  food_truck_owner: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: false,
    canViewUsers: true,
    canEditUsers: false,
    canDeleteUsers: false,
    canBanUsers: false,
    canAccessAdminPanel: false,
    canManageSettings: false,
    canViewAnalytics: true,
    canManagePayments: false,
    canManageContractors: false,
    canManageListings: true,
    canManageReports: false,
    canManageModeration: false,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },
  bar_owner: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: false,
    canViewUsers: true,
    canEditUsers: false,
    canDeleteUsers: false,
    canBanUsers: false,
    canAccessAdminPanel: false,
    canManageSettings: false,
    canViewAnalytics: true,
    canManagePayments: false,
    canManageContractors: false,
    canManageListings: true,
    canManageReports: false,
    canManageModeration: false,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },

  // Service provider roles
  contractor_user: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: false,
    canViewUsers: true,
    canEditUsers: false,
    canDeleteUsers: false,
    canBanUsers: false,
    canAccessAdminPanel: false,
    canManageSettings: false,
    canViewAnalytics: true,
    canManagePayments: false,
    canManageContractors: false,
    canManageListings: true,
    canManageReports: false,
    canManageModeration: false,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },

  helper: {
    canCreateContent: true, // Can create worker profile content
    canEditContent: true, // Can edit own profile and applications
    canDeleteContent: true, // Can delete own applications
    canModerateContent: false,
    canViewUsers: false, // Only see relevant task posters
    canEditUsers: false,
    canDeleteUsers: false,
    canBanUsers: false,
    canAccessAdminPanel: false,
    canManageSettings: false,
    canViewAnalytics: true, // Can view own job history and earnings
    canManagePayments: false, // Cannot manage payments, only receive them
    canManageContractors: false,
    canManageListings: false, // Cannot manage other listings, only applications
    canManageReports: false,
    canManageModeration: false,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },

  accelerator_member: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: false,
    canViewUsers: true,
    canEditUsers: false,
    canDeleteUsers: false,
    canBanUsers: false,
    canAccessAdminPanel: false,
    canManageSettings: false,
    canViewAnalytics: true,
    canManagePayments: false,
    canManageContractors: false,
    canManageListings: true,
    canManageReports: false,
    canManageModeration: false,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },

  realtor: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: false,
    canViewUsers: true,
    canEditUsers: false,
    canDeleteUsers: false,
    canBanUsers: false,
    canAccessAdminPanel: false,
    canManageSettings: false,
    canViewAnalytics: true,
    canManagePayments: false,
    canManageContractors: false,
    canManageListings: true,
    canManageReports: false,
    canManageModeration: false,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },

  car_salesman: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: false,
    canViewUsers: true,
    canEditUsers: false,
    canDeleteUsers: false,
    canBanUsers: false,
    canAccessAdminPanel: false,
    canManageSettings: false,
    canViewAnalytics: true,
    canManagePayments: false,
    canManageContractors: false,
    canManageListings: true,
    canManageReports: false,
    canManageModeration: false,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },

  insurance_agent: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: false,
    canViewUsers: true,
    canEditUsers: false,
    canDeleteUsers: false,
    canBanUsers: false,
    canAccessAdminPanel: false,
    canManageSettings: false,
    canViewAnalytics: true,
    canManagePayments: false,
    canManageContractors: false,
    canManageListings: true,
    canManageReports: false,
    canManageModeration: false,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },

  mortgage_broker: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: false,
    canViewUsers: true,
    canEditUsers: false,
    canDeleteUsers: false,
    canBanUsers: false,
    canAccessAdminPanel: false,
    canManageSettings: false,
    canViewAnalytics: true,
    canManagePayments: false,
    canManageContractors: false,
    canManageListings: true,
    canManageReports: false,
    canManageModeration: false,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },

  // Community roles
  community_member: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: false,
    canViewUsers: true,
    canEditUsers: false,
    canDeleteUsers: false,
    canBanUsers: false,
    canAccessAdminPanel: false,
    canManageSettings: false,
    canViewAnalytics: false,
    canManagePayments: false,
    canManageContractors: false,
    canManageListings: false,
    canManageReports: false,
    canManageModeration: false,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },

  community_moderator: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: true,
    canViewUsers: true,
    canEditUsers: false,
    canDeleteUsers: false,
    canBanUsers: true,
    canAccessAdminPanel: false,
    canManageSettings: false,
    canViewAnalytics: false,
    canManagePayments: false,
    canManageContractors: false,
    canManageListings: false,
    canManageReports: true,
    canManageModeration: true,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },

  community_leader: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: true,
    canViewUsers: true,
    canEditUsers: false,
    canDeleteUsers: false,
    canBanUsers: true,
    canAccessAdminPanel: false,
    canManageSettings: false,
    canViewAnalytics: true,
    canManagePayments: false,
    canManageContractors: false,
    canManageListings: false,
    canManageReports: true,
    canManageModeration: true,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },

  // Platform staff roles
  support_agent: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: false,
    canModerateContent: false,
    canViewUsers: true,
    canEditUsers: false,
    canDeleteUsers: false,
    canBanUsers: false,
    canAccessAdminPanel: true,
    canManageSettings: false,
    canViewAnalytics: false,
    canManagePayments: false,
    canManageContractors: false,
    canManageListings: false,
    canManageReports: true,
    canManageModeration: false,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },

  content_moderator: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: true,
    canViewUsers: true,
    canEditUsers: false,
    canDeleteUsers: false,
    canBanUsers: true,
    canAccessAdminPanel: true,
    canManageSettings: false,
    canViewAnalytics: true,
    canManagePayments: false,
    canManageContractors: false,
    canManageListings: false,
    canManageReports: true,
    canManageModeration: true,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },

  territory_manager: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: true,
    canViewUsers: true,
    canEditUsers: true,
    canDeleteUsers: false,
    canBanUsers: true,
    canAccessAdminPanel: true,
    canManageSettings: false,
    canViewAnalytics: true,
    canManagePayments: false,
    canManageContractors: true,
    canManageListings: true,
    canManageReports: true,
    canManageModeration: true,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },

  contractor_success: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: true,
    canViewUsers: true,
    canEditUsers: true,
    canDeleteUsers: false,
    canBanUsers: true,
    canAccessAdminPanel: true,
    canManageSettings: false,
    canViewAnalytics: true,
    canManagePayments: false,
    canManageContractors: true,
    canManageListings: true,
    canManageReports: true,
    canManageModeration: true,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },

  content_seo: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: true,
    canViewUsers: true,
    canEditUsers: true,
    canDeleteUsers: false,
    canBanUsers: false,
    canAccessAdminPanel: true,
    canManageSettings: true,
    canViewAnalytics: true,
    canManagePayments: false,
    canManageContractors: false,
    canManageListings: true,
    canManageReports: true,
    canManageModeration: false,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },

  analytics_specialist: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: false,
    canModerateContent: false,
    canViewUsers: true,
    canEditUsers: false,
    canDeleteUsers: false,
    canBanUsers: false,
    canAccessAdminPanel: true,
    canManageSettings: false,
    canViewAnalytics: true,
    canManagePayments: false,
    canManageContractors: false,
    canManageListings: false,
    canManageReports: true,
    canManageModeration: false,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },

  marketing_specialist: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: false,
    canViewUsers: true,
    canEditUsers: false,
    canDeleteUsers: false,
    canBanUsers: false,
    canAccessAdminPanel: true,
    canManageSettings: true,
    canViewAnalytics: true,
    canManagePayments: false,
    canManageContractors: false,
    canManageListings: true,
    canManageReports: true,
    canManageModeration: false,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },

  // Admin roles
  moderator: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: true,
    canViewUsers: true,
    canEditUsers: true,
    canDeleteUsers: true,
    canBanUsers: true,
    canAccessAdminPanel: true,
    canManageSettings: true,
    canViewAnalytics: true,
    canManagePayments: false,
    canManageContractors: true,
    canManageListings: true,
    canManageReports: true,
    canManageModeration: true,
    canPromoteUsers: false,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },

  ops_admin: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: true,
    canViewUsers: true,
    canEditUsers: true,
    canDeleteUsers: true,
    canBanUsers: true,
    canAccessAdminPanel: true,
    canManageSettings: true,
    canViewAnalytics: true,
    canManagePayments: true,
    canManageContractors: true,
    canManageListings: true,
    canManageReports: true,
    canManageModeration: true,
    canPromoteUsers: true,
    canManageRoles: false,
    canAccessSuperAdmin: false,
    canManageAdmins: false,
  },

  super_admin: {
    canCreateContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canModerateContent: true,
    canViewUsers: true,
    canEditUsers: true,
    canDeleteUsers: true,
    canBanUsers: true,
    canAccessAdminPanel: true,
    canManageSettings: true,
    canViewAnalytics: true,
    canManagePayments: true,
    canManageContractors: true,
    canManageListings: true,
    canManageReports: true,
    canManageModeration: true,
    canPromoteUsers: true,
    canManageRoles: true,
    canAccessSuperAdmin: true,
    canManageAdmins: true,
  },
};

// Utility functions
export function getRoleHierarchyLevel(role: UserRole): number {
  return ROLE_HIERARCHY[role] || 0;
}

export function getRolePermissions(role: UserRole): RolePermissions {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.homeowner;
}

/**
 * Route role gates are explicit grants. Callers must name every role that may
 * enter a boundary; ROLE_HIERARCHY must never turn an unrelated role into an
 * implied grant.
 */
export function hasExplicitRoleGrant(
  userRole: UserRole,
  allowedRoles: readonly UserRole[]
): boolean {
  return allowedRoles.includes(userRole);
}

export function canUserPerformAction(
  userRole: UserRole,
  targetRole: UserRole,
  action: keyof RolePermissions
): boolean {
  const userLevel = getRoleHierarchyLevel(userRole);
  const targetLevel = getRoleHierarchyLevel(targetRole);
  const permissions = getRolePermissions(userRole);

  // User must have the permission and sufficient hierarchy level
  return permissions[action] && userLevel >= targetLevel;
}

export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    // Customer roles
    homeowner: "Homeowner",
    property_manager: "Property Manager",
    business_owner: "Business Owner",
    restaurant_owner: "Restaurant Owner",
    food_truck_owner: "Food Truck Owner",
    bar_owner: "Bar Owner",

    // Service provider roles
    contractor_user: "Contractor",
    accelerator_member: "Accelerator Member",
    realtor: "Realtor",
    car_salesman: "Car Salesman",
    insurance_agent: "Insurance Agent",
    mortgage_broker: "Mortgage Broker",
    helper: "Helper",

    // Community roles
    community_member: "Community Member",
    community_moderator: "Community Moderator",
    community_leader: "Community Leader",

    // Platform staff roles
    support_agent: "Support Agent",
    content_moderator: "Content Moderator",
    territory_manager: "Territory Manager",
    contractor_success: "Contractor Success Manager",
    content_seo: "Content & SEO Specialist",
    analytics_specialist: "Analytics Specialist",
    marketing_specialist: "Marketing Specialist",

    // Admin roles
    moderator: "Staff",
    ops_admin: "Operations Admin",
    super_admin: "Super Admin",
  };

  return roleNames[role] || role;
}

export function getTradeDisplayName(trade: TradeCategory): string {
  const tradeNames: Record<TradeCategory, string> = {
    // Construction & General
    general_contractor: "General Contractor",
    construction_manager: "Construction Manager",
    project_manager: "Project Manager",

    // Structural & Foundation
    concrete_contractor: "Concrete Contractor",
    foundation_specialist: "Foundation Specialist",
    masonry_contractor: "Masonry Contractor",
    structural_engineer: "Structural Engineer",

    // Building Envelope
    roofing_contractor: "Roofing Contractor",
    siding_contractor: "Siding Contractor",
    window_installer: "Window Installer",
    door_installer: "Door Installer",
    insulation_contractor: "Insulation Contractor",

    // Electrical & Technology
    electrician: "Electrician",
    low_voltage_technician: "Low Voltage Technician",
    solar_installer: "Solar Installer",
    security_system_installer: "Security System Installer",
    smart_home_specialist: "Smart Home Specialist",

    // Plumbing & HVAC
    plumber: "Plumber",
    hvac_contractor: "HVAC Contractor",
    refrigeration_technician: "Refrigeration Technician",
    water_heater_specialist: "Water Heater Specialist",
    septic_contractor: "Septic Contractor",

    // Interior Finishing
    flooring_contractor: "Flooring Contractor",
    tile_contractor: "Tile Contractor",
    carpet_installer: "Carpet Installer",
    painter: "Painter",
    drywall_contractor: "Drywall Contractor",
    cabinet_maker: "Cabinet Maker",
    countertop_installer: "Countertop Installer",

    // Kitchen & Bath
    kitchen_remodeler: "Kitchen Remodeler",
    bathroom_remodeler: "Bathroom Remodeler",
    appliance_installer: "Appliance Installer",

    // Outdoor & Landscaping
    landscaper: "Landscaper",
    hardscape_contractor: "Hardscape Contractor",
    pool_contractor: "Pool Contractor",
    fence_contractor: "Fence Contractor",
    deck_builder: "Deck Builder",
    outdoor_lighting: "Outdoor Lighting Specialist",

    // Specialty Services
    home_inspector: "Home Inspector",
    mold_remediation: "Mold Remediation Specialist",
    water_damage_restoration: "Water Damage Restoration",
    pest_control: "Pest Control",
    cleaning_service: "Cleaning Service",
    handyman: "Handyman",
    maintenance_contractor: "Maintenance Contractor",

    // General & Retail Small Business
    salon_barbershop: "Salon / Barbershop",
    spa_wellness: "Spa & Wellness",
    bakery_cafe: "Bakery / Cafe",
    restaurant_food_service: "Restaurant / Food Service",
    retail_shop: "Retail Shop",
    boutique_apparel: "Boutique / Apparel",
    florist: "Florist",
    pet_grooming_services: "Pet Grooming Services",
    childcare_provider: "Childcare Provider",
    tutor_education_services: "Tutor / Education Services",
    photographer_videographer: "Photographer / Videographer",
    event_planner: "Event Planner",
    auto_repair_service: "Auto Repair Service",
    laundry_dry_cleaning: "Laundry / Dry Cleaning",
    fitness_instructor: "Fitness Instructor",
    bookkeeping_accounting: "Bookkeeping / Accounting",
    marketing_creative_services: "Marketing / Creative Services",
    general_small_business: "Other Small Business",
  };

  return tradeNames[trade] || trade;
}

// Role categories for UI organization
export const ROLE_CATEGORIES = {
  customer: ["homeowner", "property_manager", "business_owner"],
  service_provider: [
    "contractor_user",
    "accelerator_member",
    "realtor",
    "car_salesman",
    "insurance_agent",
    "mortgage_broker",
  ],
  community: ["community_member", "community_moderator", "community_leader"],
  staff: [
    "support_agent",
    "content_moderator",
    "territory_manager",
    "contractor_success",
    "content_seo",
    "analytics_specialist",
    "marketing_specialist",
  ],
  admin: ["moderator", "ops_admin", "super_admin"],
} as const;

export const BUSINESS_PROVIDER_ROLE_ALIASES = [
  "business_owner",
  "contractor_user",
  "contractor",
  "business_user",
  "service_provider",
  "accelerator_member",
  "helper",
  "realtor",
  "car_salesman",
  "vehicle_dealer",
  "car_dealer",
  "insurance_agent",
  "mortgage_broker",
] as const;

export type BusinessProviderRoleAlias = (typeof BUSINESS_PROVIDER_ROLE_ALIASES)[number];

export function normalizeRoleToken(role: unknown): string {
  const raw = typeof role === "string" ? role.trim().toLowerCase() : "";
  if (!raw) return "";
  const normalized = raw.replace(/[\s-]+/g, "_");
  if (normalized === "owner" || normalized === "head_admin" || normalized === "superadmin") {
    return "super_admin";
  }
  return normalized;
}

export function isBusinessProviderRole(role: unknown): boolean {
  const normalized = normalizeRoleToken(role);
  return BUSINESS_PROVIDER_ROLE_ALIASES.includes(normalized as BusinessProviderRoleAlias);
}

export function getUserRoleTokens(user: unknown): string[] {
  const record =
    user && typeof user === "object"
      ? (user as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const claims =
    record.claims && typeof record.claims === "object"
      ? (record.claims as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const rawRoles = [
    record.role,
    record.activeRole,
    claims.role,
    claims.activeRole,
    ...(Array.isArray(record.roles) ? record.roles : []),
    ...(Array.isArray(claims.roles) ? claims.roles : []),
  ];

  return Array.from(
    new Set(rawRoles.map((role) => normalizeRoleToken(role)).filter((role) => role.length > 0))
  );
}

export function userHasBusinessProviderTools(user: unknown): boolean {
  return getUserRoleTokens(user).some((role) => isBusinessProviderRole(role));
}

// Trade categories for UI organization
export const TRADE_CATEGORIES = {
  construction: ["general_contractor", "construction_manager", "project_manager"],
  structural: [
    "concrete_contractor",
    "foundation_specialist",
    "masonry_contractor",
    "structural_engineer",
  ],
  building_envelope: [
    "roofing_contractor",
    "siding_contractor",
    "window_installer",
    "door_installer",
    "insulation_contractor",
  ],
  electrical: [
    "electrician",
    "low_voltage_technician",
    "solar_installer",
    "security_system_installer",
    "smart_home_specialist",
  ],
  plumbing_hvac: [
    "plumber",
    "hvac_contractor",
    "refrigeration_technician",
    "water_heater_specialist",
    "septic_contractor",
  ],
  interior: [
    "flooring_contractor",
    "tile_contractor",
    "carpet_installer",
    "painter",
    "drywall_contractor",
    "cabinet_maker",
    "countertop_installer",
  ],
  kitchen_bath: ["kitchen_remodeler", "bathroom_remodeler", "appliance_installer"],
  outdoor: [
    "landscaper",
    "hardscape_contractor",
    "pool_contractor",
    "fence_contractor",
    "deck_builder",
    "outdoor_lighting",
  ],
  specialty: [
    "home_inspector",
    "mold_remediation",
    "water_damage_restoration",
    "pest_control",
    "cleaning_service",
    "handyman",
    "maintenance_contractor",
  ],
  general_small_business: [
    "salon_barbershop",
    "spa_wellness",
    "bakery_cafe",
    "restaurant_food_service",
    "retail_shop",
    "boutique_apparel",
    "florist",
    "pet_grooming_services",
    "childcare_provider",
    "tutor_education_services",
    "photographer_videographer",
    "event_planner",
    "auto_repair_service",
    "laundry_dry_cleaning",
    "fitness_instructor",
    "bookkeeping_accounting",
    "marketing_creative_services",
    "general_small_business",
  ],
} as const;
