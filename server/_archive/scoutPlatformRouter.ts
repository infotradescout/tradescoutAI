/**
 * Scout Platform Router
 *
 * This service integrates Scout with the entire TradeScout Ecosystem,
 * enabling Scout to route users to any of the 250+ pages and features
 * discovered in the MASTER_FEATURE_INDEX.
 */

export interface PlatformFeature {
  id: string;
  name: string;
  category: string;
  description: string;
  pages: string[];
  tools: string[];
  keywords: string[];
  role_requirements: string[];
  requires_authentication: boolean;
}

/**
 * Master Feature Registry - All discoverable features in TradeScout
 */
export const PLATFORM_FEATURES: Record<string, PlatformFeature> = {
  // Vehicle Marketplace
  vehicle_marketplace: {
    id: "vehicle_marketplace",
    name: "Vehicle Marketplace",
    category: "Marketplace",
    description: "Buy, sell, and trade vehicles with integrated financing and VIN lookup",
    pages: [
      "/vehicles",
      "/vehicle-marketplace",
      "/car-sales-new-listing",
      "/car-sales-vin-lookup",
      "/car-sales-financing",
      "/car-sales-payment-calculator",
      "/car-sales-trade-in",
      "/car-sales-appointments",
      "/car-sales-customers",
      "/car-sales-follow-up",
    ],
    tools: ["vin_lookup", "financing_calculator", "payment_calculator", "trade_in_estimator"],
    keywords: ["cars", "vehicles", "auto", "financing", "vin", "trade-in"],
    role_requirements: ["buyer", "seller", "dealer"],
    requires_authentication: false,
  },

  // Real Estate Suite
  real_estate: {
    id: "real_estate",
    name: "Real Estate Platform",
    category: "Marketplace",
    description:
      "Complete real estate solution with CMA, mortgage calculations, and client management",
    pages: [
      "/realtor-dashboard",
      "/realtor-clients",
      "/realtor-contacts",
      "/realtor-appointments",
      "/realtor-cma",
      "/realtor-market-analysis",
      "/realtor-calculator",
      "/realtor-connections",
      "/property-listing",
      "/property-manager-dashboard",
      "/mortgage-broker-dashboard",
      "/homescout-listing",
    ],
    tools: ["cma_analysis", "mortgage_calculator", "property_search", "market_analysis"],
    keywords: ["real estate", "realtor", "property", "mortgage", "home", "listing"],
    role_requirements: ["realtor", "buyer", "seller", "property_manager"],
    requires_authentication: true,
  },

  // Worker Marketplace
  worker_marketplace: {
    id: "worker_marketplace",
    name: "Worker Marketplace",
    category: "Marketplace",
    description: "Find and hire skilled professionals with vetting and application tracking",
    pages: [
      "/worker-marketplace",
      "/contractor-apply",
      "/application-tracker",
      "/saved-contractors",
    ],
    tools: ["contractor_search", "vetting", "application_tracking", "messaging"],
    keywords: ["workers", "contractors", "professionals", "hiring", "skilled"],
    role_requirements: ["homeowner", "business", "contractor"],
    requires_authentication: true,
  },

  // General Marketplace
  general_marketplace: {
    id: "general_marketplace",
    name: "General Marketplace",
    category: "Marketplace",
    description: "Buy and sell general items with price comparison and deal identification",
    pages: ["/marketplace", "/marketplace-listing", "/trade-deals", "/trade-deals-lucky"],
    tools: ["item_search", "price_comparison", "deal_finder"],
    keywords: ["marketplace", "deals", "buy", "sell", "items"],
    role_requirements: ["buyer", "seller"],
    requires_authentication: false,
  },

  // Accounting & Finance
  accounting: {
    id: "accounting",
    name: "Accounting & Finance",
    category: "Finance",
    description: "Complete financial management including ledger, invoicing, and reporting",
    pages: [
      "/accounting",
      "/finances-invoices",
      "/payment-history",
      "/payment-processing",
      "/checkout",
      "/wallet",
      "/pricing-analytics",
    ],
    tools: ["ledger_management", "invoice_generation", "payment_processing", "analytics"],
    keywords: ["accounting", "finance", "invoice", "payment", "ledger", "reporting"],
    role_requirements: ["business", "admin"],
    requires_authentication: true,
  },

  // Admin Mission Control
  admin_mission_control: {
    id: "admin_mission_control",
    name: "Mission Control",
    category: "Admin",
    description: "Centralized platform oversight and observability",
    pages: [
      "/admin-dashboard",
      "/admin-observability",
      "/admin-geo-coverage",
      "/admin-users",
      "/admin-control",
      "/admin-testing-controls",
    ],
    tools: ["user_management", "geo_tracking", "observability", "testing"],
    keywords: ["admin", "dashboard", "observability", "control", "monitoring"],
    role_requirements: ["admin", "super_admin"],
    requires_authentication: true,
  },

  // Community Features
  community: {
    id: "community",
    name: "Community Platform",
    category: "Community",
    description: "Local engagement, HOA management, and neighborhood discussions",
    pages: [
      "/community-feed",
      "/community-profile",
      "/hoa-management",
      "/moderation-center",
      "/resource-center",
      "/training-center",
    ],
    tools: ["community_posting", "hoa_management", "moderation", "knowledge_base"],
    keywords: ["community", "hoa", "neighborhood", "local", "discussion"],
    role_requirements: ["homeowner", "resident", "hoa_leader"],
    requires_authentication: true,
  },

  // Growth & Affiliate
  growth: {
    id: "growth",
    name: "Growth & Affiliate",
    category: "Growth",
    description: "Referral programs, affiliate management, and business acceleration",
    pages: [
      "/affiliate",
      "/referral-dashboard",
      "/accelerator",
      "/apply-accelerator",
      "/api-integrations",
      "/social-integration",
    ],
    tools: ["referral_tracking", "affiliate_management", "api_integration"],
    keywords: ["affiliate", "referral", "growth", "accelerator", "partnership"],
    role_requirements: ["business", "partner", "affiliate"],
    requires_authentication: true,
  },

  // Legal & Compliance
  legal: {
    id: "legal",
    name: "Legal & Compliance",
    category: "Legal",
    description: "Privacy, terms, compliance, and verification systems",
    pages: [
      "/legal/privacy-policy",
      "/legal/terms-of-service",
      "/legal/compliance",
      "/privacy-request",
      "/address-verification",
      "/license-verification",
    ],
    tools: ["privacy_request_handling", "verification", "compliance_tracking"],
    keywords: ["legal", "privacy", "compliance", "terms", "verification"],
    role_requirements: [],
    requires_authentication: false,
  },
};

/**
 * Scout Platform Router Service
 */
export class ScoutPlatformRouter {
  /**
   * Find features matching a user query
   */
  static findFeatures(query: string, userRole?: string): PlatformFeature[] {
    const queryLower = query.toLowerCase();
    const matches: PlatformFeature[] = [];

    for (const feature of Object.values(PLATFORM_FEATURES)) {
      // Check role requirements
      if (userRole && feature.role_requirements.length > 0) {
        if (!feature.role_requirements.includes(userRole)) {
          continue;
        }
      }

      // Check keyword matches
      const keywordMatch = feature.keywords.some((keyword) => queryLower.includes(keyword));

      // Check name/description matches
      const nameMatch =
        feature.name.toLowerCase().includes(queryLower) ||
        feature.description.toLowerCase().includes(queryLower);

      if (keywordMatch || nameMatch) {
        matches.push(feature);
      }
    }

    return matches;
  }

  /**
   * Get all features in a category
   */
  static getFeaturesByCategory(category: string): PlatformFeature[] {
    return Object.values(PLATFORM_FEATURES).filter((f) => f.category === category);
  }

  /**
   * Get recommended features based on user role
   */
  static getRecommendedFeatures(userRole: string): PlatformFeature[] {
    return Object.values(PLATFORM_FEATURES).filter(
      (f) => f.role_requirements.length === 0 || f.role_requirements.includes(userRole)
    );
  }

  /**
   * Get routing information for a feature
   */
  static getFeatureRouting(featureId: string): {
    feature: PlatformFeature | null;
    primary_page: string;
    all_pages: string[];
    tools: string[];
  } {
    const feature = PLATFORM_FEATURES[featureId];

    if (!feature) {
      return {
        feature: null,
        primary_page: "/",
        all_pages: [],
        tools: [],
      };
    }

    return {
      feature,
      primary_page: feature.pages[0],
      all_pages: feature.pages,
      tools: feature.tools,
    };
  }

  /**
   * Get all available categories
   */
  static getCategories(): string[] {
    const categories = new Set<string>();
    for (const feature of Object.values(PLATFORM_FEATURES)) {
      categories.add(feature.category);
    }
    return Array.from(categories).sort();
  }

  /**
   * Get platform statistics
   */
  static getPlatformStats(): {
    total_features: number;
    total_pages: number;
    total_tools: number;
    categories: number;
    features_by_category: Record<string, number>;
  } {
    const allPages = new Set<string>();
    const allTools = new Set<string>();
    const featuresByCategory: Record<string, number> = {};

    for (const feature of Object.values(PLATFORM_FEATURES)) {
      feature.pages.forEach((p) => allPages.add(p));
      feature.tools.forEach((t) => allTools.add(t));
      featuresByCategory[feature.category] = (featuresByCategory[feature.category] || 0) + 1;
    }

    return {
      total_features: Object.keys(PLATFORM_FEATURES).length,
      total_pages: allPages.size,
      total_tools: allTools.size,
      categories: Object.keys(featuresByCategory).length,
      features_by_category: featuresByCategory,
    };
  }
}

export default ScoutPlatformRouter;
