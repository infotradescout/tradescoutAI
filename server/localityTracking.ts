/**
 * Locality-Based Tracking System
 * All user interactions and analytics are tracked with geographic context
 */

import { Request } from 'express';

export interface LocalityContext {
  state?: string;
  stateCode?: string;
  county?: string;
  countyFips?: string;
  ipLocation?: {
    state: string;
    county: string;
    city: string;
    latitude: number;
    longitude: number;
  };
  timezone?: string;
  userAgent?: string;
  sessionId?: string;
  userId?: string;
}

export interface UserInteraction {
  id: string;
  userId?: string;
  sessionId: string;
  userType: 'homeowner' | 'contractor' | 'visitor';
  interactionType: 
    | 'page_view' 
    | 'search' 
    | 'quote_request' 
    | 'contractor_view' 
    | 'profile_create' 
    | 'chat_message' 
    | 'inquiry_assignment' 
    | 'rating_submit'
    | 'ad_view'
    | 'ad_click'
    | 'affiliate_click'
    | 'accelerator_inquiry';
  
  // Geographic Context
  locality: LocalityContext;
  
  // Interaction Details
  details: {
    page?: string;
    searchQuery?: string;
    projectType?: string;
    tradeType?: string;
    contractorId?: string;
    quoteAmount?: number;
    rating?: number;
    adId?: string;
    affiliateProduct?: string;
    referrerUrl?: string;
  };
  
  timestamp: Date;
  deviceInfo?: {
    isMobile: boolean;
    browser: string;
    os: string;
  };
}

export class LocalityTracker {
  
  /**
   * Extract locality context from request
   */
  static extractLocalityFromRequest(req: Request): LocalityContext {
    const user = (req as any)?.user;
    const locality: LocalityContext = {
      sessionId: (req as any).sessionID,
      userId: user?.id,
      userAgent: req.get('User-Agent')
    };

    // Extract from query parameters (user selected)
    if (req.query.state) {
      locality.stateCode = req.query.state as string;
    }
    if (req.query.county) {
      locality.countyFips = req.query.county as string;
    }

    // Extract from route parameters
    if (req.params.state) {
      locality.stateCode = req.params.state;
    }
    if (req.params.county) {
      locality.county = req.params.county;
    }

    // Extract from user profile/session
    if (user?.profile?.state) {
      locality.stateCode = user.profile.state;
      locality.county = user.profile.county;
    }

    // IP-based geolocation (fallback)
    const clientIP = req.ip || (req as any).connection?.remoteAddress;
    if (clientIP && !locality.stateCode) {
      // In production, integrate with IP geolocation service
      locality.ipLocation = this.getLocationFromIP(clientIP);
    }

    return locality;
  }

  /**
   * Track user interaction with locality context
   */
  static async trackInteraction(
    interactionType: UserInteraction['interactionType'],
    req: Request,
    details: UserInteraction['details'] = {}
  ): Promise<void> {
    const locality = this.extractLocalityFromRequest(req);
    
    const interaction: UserInteraction = {
      id: this.generateInteractionId(),
      sessionId: req.sessionID,
      userId: (req as any).user?.id,
      userType: this.getUserType(req),
      interactionType,
      locality,
      details: {
        ...details,
        page: req.path,
        referrerUrl: req.get('Referer')
      },
      timestamp: new Date(),
      deviceInfo: this.extractDeviceInfo(req)
    };

    // Store interaction in database
    await this.storeInteraction(interaction);

    // Real-time analytics processing
    await this.processRealTimeAnalytics(interaction);
  }

  /**
   * Get locality-specific metrics
   */
  static async getLocalityMetrics(
    stateCode?: string, 
    countyFips?: string, 
    timeRange: '1d' | '7d' | '30d' | '90d' = '30d'
  ) {
    const filters: any = {};
    
    if (stateCode) {
      filters['locality.stateCode'] = stateCode;
    }
    if (countyFips) {
      filters['locality.countyFips'] = countyFips;
    }

    const startDate = new Date();
    switch (timeRange) {
      case '1d': startDate.setDate(startDate.getDate() - 1); break;
      case '7d': startDate.setDate(startDate.getDate() - 7); break;
      case '30d': startDate.setDate(startDate.getDate() - 30); break;
      case '90d': startDate.setDate(startDate.getDate() - 90); break;
    }

    filters.timestamp = { $gte: startDate };

    // In production, query from actual database
    return {
      totalInteractions: 0,
      uniqueUsers: 0,
      quoteRequests: 0,
      contractorViews: 0,
      adClicks: 0,
      affiliateClicks: 0,
      acceleratorInquiries: 0,
      topTrades: [],
      topProjectTypes: [],
      deviceBreakdown: { mobile: 0, desktop: 0 },
      hourlyActivity: [],
      conversionRate: 0
    };
  }

  /**
   * Get contractor performance by locality
   */
  static async getContractorLocalityPerformance(contractorId: string) {
    const filters = {
      'details.contractorId': contractorId,
      interactionType: { $in: ['contractor_view', 'quote_request', 'rating_submit'] }
    };

    // Group by locality
    return {
      statePerformance: {},
      countyPerformance: {},
      totalViews: 0,
      totalQuoteRequests: 0,
      averageRating: 0,
      responseRate: 0
    };
  }

  /**
   * Track homeowner search patterns by locality
   */
  static async trackHomeownerSearch(
    req: Request,
    searchQuery: string,
    projectType: string,
    tradeType: string
  ) {
    await this.trackInteraction('search', req, {
      searchQuery,
      projectType,
      tradeType
    });

    // Update locality-specific search trends
    const locality = this.extractLocalityFromRequest(req);
    await this.updateSearchTrends(locality, { projectType, tradeType });
  }

  /**
   * Track contractor lead interactions
   */
  static async trackContractorLeadInteraction(
    req: Request,
    action: 'lead_received' | 'lead_viewed' | 'quote_submitted' | 'lead_accepted',
    leadId: string,
    contractorId: string
  ) {
    await this.trackInteraction('inquiry_assignment', req, {
      contractorId,
      projectType: 'customer_inquiry',
      searchQuery: action,
      quoteAmount: leadId as any // Temporary mapping
    });

    // Update contractor locality performance
    const locality = this.extractLocalityFromRequest(req);
    await this.updateContractorLocalityPerformance(contractorId, locality, action);
  }

  /**
   * Track ad performance by locality
   */
  static async trackAdInteraction(
    req: Request,
    adId: string,
    action: 'view' | 'click' | 'conversion',
    revenue?: number
  ) {
    const interactionType = action === 'view' ? 'ad_view' : 'ad_click';
    
    await this.trackInteraction(interactionType, req, {
      adId,
      searchQuery: action,
      quoteAmount: revenue
    });

    // Update ad performance metrics by locality
    const locality = this.extractLocalityFromRequest(req);
    await this.updateAdLocalityPerformance(adId, locality, action, revenue);
  }

  /**
   * Get popular project types by locality
   */
  static async getPopularProjectsByLocality(stateCode: string, countyFips?: string) {
    const filters: any = {
      'locality.stateCode': stateCode,
      interactionType: { $in: ['search', 'quote_request'] },
      'details.projectType': { $exists: true }
    };

    if (countyFips) {
      filters['locality.countyFips'] = countyFips;
    }

    // Aggregate project types by frequency
    return [
      { projectType: 'roof-replacement', count: 45, trend: 'up' },
      { projectType: 'kitchen-remodel', count: 38, trend: 'up' },
      { projectType: 'bathroom-renovation', count: 32, trend: 'stable' },
      { projectType: 'flooring-installation', count: 28, trend: 'down' },
      { projectType: 'hvac-installation', count: 25, trend: 'up' }
    ];
  }

  /**
   * Generate locality-aware contractor recommendations
   */
  static async getLocalityRecommendations(
    stateCode: string,
    countyFips: string,
    projectType: string
  ) {
    // Get contractors with strong locality performance
    const contractors = await this.getTopLocalityContractors(stateCode, countyFips, projectType);
    
    // Get locality-specific pricing insights
    const pricingInsights = await this.getLocalityPricing(stateCode, countyFips, projectType);
    
    // Get seasonal trends for the locality
    const seasonalTrends = await this.getLocalitySeasonalTrends(stateCode, countyFips, projectType);
    
    return {
      contractors,
      pricingInsights,
      seasonalTrends,
      localDemand: 'high' // calculated from interaction frequency
    };
  }

  // Private helper methods
  private static generateInteractionId(): string {
    return `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static getUserType(req: Request): 'homeowner' | 'contractor' | 'visitor' {
    const user = (req as any).user;
    if (!user) return 'visitor';
    return user.role?.includes('contractor') ? 'contractor' : 'homeowner';
  }

  private static extractDeviceInfo(req: Request) {
    const userAgent = req.get('User-Agent') || '';
    
    return {
      isMobile: /Mobile|Android|iPhone|iPad/.test(userAgent),
      browser: this.extractBrowser(userAgent),
      os: this.extractOS(userAgent)
    };
  }

  private static extractBrowser(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Other';
  }

  private static extractOS(userAgent: string): string {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Other';
  }

  private static getLocationFromIP(ip: string) {
    // Placeholder for IP geolocation service integration
    // In production, integrate with MaxMind, IPinfo, or similar service
    return {
      state: 'Unknown',
      county: 'Unknown',
      city: 'Unknown',
      latitude: 0,
      longitude: 0
    };
  }

  private static async storeInteraction(interaction: UserInteraction): Promise<void> {
    // In development, skip logging to reduce console noise
    if (process.env.NODE_ENV !== 'production') {
      return;
    }
    // Store in database - implement with actual database connection
    console.log('Storing interaction:', {
      type: interaction.interactionType,
      locality: interaction.locality,
      timestamp: interaction.timestamp
    });
  }

  private static async processRealTimeAnalytics(interaction: UserInteraction): Promise<void> {
    // Process real-time analytics - implement with analytics service
    // Update locality-specific metrics, trends, and alerts
  }

  private static async updateSearchTrends(locality: LocalityContext, searchData: any): Promise<void> {
    // Update locality-specific search trend data
  }

  private static async updateContractorLocalityPerformance(
    contractorId: string, 
    locality: LocalityContext, 
    action: string
  ): Promise<void> {
    // Update contractor performance metrics by locality
  }

  private static async updateAdLocalityPerformance(
    adId: string, 
    locality: LocalityContext, 
    action: string, 
    revenue?: number
  ): Promise<void> {
    // Update ad performance metrics by locality
  }

  private static async getTopLocalityContractors(
    stateCode: string, 
    countyFips: string, 
    projectType: string
  ) {
    // Get contractors with best performance in specific locality
    return [];
  }

  private static async getLocalityPricing(
    stateCode: string, 
    countyFips: string, 
    projectType: string
  ) {
    // Get pricing insights specific to locality
    return {
      averagePrice: 0,
      priceRange: { min: 0, max: 0 },
      trend: 'stable'
    };
  }

  private static async getLocalitySeasonalTrends(
    stateCode: string, 
    countyFips: string, 
    projectType: string
  ) {
    // Get seasonal demand patterns for locality
    return {
      peak: 'spring',
      low: 'winter',
      currentDemand: 'moderate'
    };
  }
}

/**
 * Middleware to automatically track page views with locality
 */
export function localityTrackingMiddleware() {
  return async (req: any, res: any, next: any) => {
    // Only track actual HTML page loads, not assets or HMR
    const isPageLoad = req.method === 'GET' 
      && !req.path.startsWith('/api/')
      && !req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|json)$/i)
      && !req.path.startsWith('/@vite')
      && !req.path.startsWith('/node_modules')
      && !req.path.startsWith('/src/');
    
    if (isPageLoad) {
      await LocalityTracker.trackInteraction('page_view', req);
    }
    next();
  };
}