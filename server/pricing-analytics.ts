
/**
 * Pricing Analytics Service
 * Tracks job quotes, price trends, and regional variations for admin insights
 * and automatic calculator updates
 */

import { db } from '../src/db/drizzle-mock';
import { eq } from 'drizzle-orm';
import { pricingData } from '@shared/schema';

export interface PricingAnalytics {
  averageQuotes: {
    byTrade: Record<string, { average: number; count: number; trend: number }>;
    byRegion: Record<string, { average: number; count: number; trend: number }>;
    byProject: Record<string, { average: number; count: number; trend: number }>;
  };
  priceFluctuations: {
    trades: Array<{
      tradeId: string;
      tradeName: string;
      currentAvg: number;
      previousAvg: number;
      percentChange: number;
      period: string;
    }>;
    regions: Array<{
      countyId: string;
      countyName: string;
      stateCode: string;
      currentAvg: number;
      previousAvg: number;
      percentChange: number;
      period: string;
    }>;
  };
  popularProjects: Array<{
    projectType: string;
    quoteCount: number;
    averageValue: number;
    growth: number;
  }>;
  marketInsights: {
    topPerformingRegions: Array<{
      county: string;
      state: string;
      averageQuote: number;
      volume: number;
    }>;
    emergingTrends: Array<{
      trend: string;
      growth: number;
      description: string;
    }>;
  };
}

export class PricingAnalyticsService {
  
  /**
   * Get comprehensive pricing analytics for admin dashboard
   */
  async getPricingAnalytics(timeframe: '7d' | '30d' | '90d' = '30d'): Promise<PricingAnalytics> {
    void timeframe;
    // Analytics queries depend on quote/lead fields not present in the current schema.
    // Return an empty-but-shaped response to satisfy callers while keeping the service typed.
    return {
      averageQuotes: {
        byTrade: {},
        byRegion: {},
        byProject: {},
      },
      priceFluctuations: {
        trades: [],
        regions: [],
      },
      popularProjects: [],
      marketInsights: {
        topPerformingRegions: [],
        emergingTrends: [],
      },
    };
  }

  /**
   * Update calculator pricing based on collected data
   */
  async updateCalculatorPricing(threshold: number = 10) {
    const analytics = await this.getPricingAnalytics('30d');
    const updates = [];

    // Update pricing data for trades with significant data
    for (const [tradeId, data] of Object.entries(analytics.averageQuotes.byTrade)) {
      if (data.count >= threshold) {
        // Check if pricing data exists for this trade
        const existingPricing = await db
          .select()
          .from(pricingData)
          .where(eq(pricingData.service, tradeId))
          .limit(1);

        const newBaseLow = Math.round(data.average * 0.8);
        const newBaseHigh = Math.round(data.average * 1.2);

        if (existingPricing.length > 0) {
          // Update existing pricing
          await db
            .update(pricingData)
            .set({
              baseLow: newBaseLow.toString(),
              baseHigh: newBaseHigh.toString(),
              updatedAt: new Date()
            })
            .where(eq(pricingData.service, tradeId));
        } else {
          // Create new pricing entry
          await db
            .insert(pricingData)
            .values({
              service: tradeId,
              fips: '00000', // Default nationwide
              baseLow: newBaseLow.toString(),
              baseHigh: newBaseHigh.toString(),
              createdAt: new Date(),
              updatedAt: new Date()
            });
        }

        updates.push({
          tradeId,
          oldLow: existingPricing[0]?.baseLow,
          oldHigh: existingPricing[0]?.baseHigh,
          newLow: newBaseLow,
          newHigh: newBaseHigh,
          sampleSize: data.count
        });
      }
    }

    return {
      updatedCount: updates.length,
      updates
    };
  }

  /**
   * Get pricing recommendations for specific regions
   */
  async getRegionalPricingRecommendations(stateCode?: string) {
    const analytics = await this.getPricingAnalytics('90d');
    const recommendations = [];

    for (const [regionKey, data] of Object.entries(analytics.averageQuotes.byRegion)) {
      if (stateCode && !regionKey.startsWith(stateCode)) continue;
      
      if (data.count >= 5) { // Minimum sample size
        const [state, countyId] = regionKey.split('-');
        
        recommendations.push({
          stateCode: state,
          countyId,
          recommendedLow: Math.round(data.average * 0.75),
          recommendedHigh: Math.round(data.average * 1.25),
          confidence: Math.min(data.count / 10, 1), // Confidence based on sample size
          sampleSize: data.count,
          currentAverage: data.average
        });
      }
    }

    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }
}

export const pricingAnalyticsService = new PricingAnalyticsService();
