import type { Express, RequestHandler } from "express";

export type CommercialPromotionRouteDependencies = {
  isAuthenticated: RequestHandler;
  isSuperAdmin: RequestHandler;
};

export async function registerCommercialPromotionRoutes(
  app: Express,
  dependencies: CommercialPromotionRouteDependencies
): Promise<void> {
  const { isAuthenticated, isSuperAdmin } = dependencies;

  // Phase 1: Daily Deals System Routes
  const {
    getDailyDeals,
    createDailyDeal,
    trackDealEngagement,
    getUserAffiliate,
    getAffiliateDashboard,
    updateDailyDeal,
    deleteDailyDeal,
    getFeaturedDeals,
  } = await import("./dailyDeals");

  // Public daily deals endpoints
  app.get("/api/daily-deals", getDailyDeals);
  app.get("/api/deals/featured", getFeaturedDeals);

  // Protected daily deals endpoints
  app.post("/api/daily-deals", isAuthenticated, createDailyDeal);
  app.put("/api/daily-deals/:id", isAuthenticated, updateDailyDeal);
  app.delete("/api/daily-deals/:id", isAuthenticated, deleteDailyDeal);

  // Deal engagement tracking
  app.post("/api/deal-engagements", trackDealEngagement);

  // Affiliate system endpoints (daily deals performance)
  app.get("/api/user/affiliate", isAuthenticated, getUserAffiliate);
  app.get("/api/affiliate/performance", isAuthenticated, getAffiliateDashboard as any);

  const {
    listPromotionsHandler,
    createPromotionHandler,
    updatePromotionHandler,
    deletePromotionHandler,
  } = await import("./promotions");

  // Promotions admin endpoints (super admin only)
  app.get("/api/admin/promotions", isAuthenticated, isSuperAdmin, listPromotionsHandler as any);
  app.post("/api/admin/promotions", isAuthenticated, isSuperAdmin, createPromotionHandler as any);
  app.put(
    "/api/admin/promotions/:id",
    isAuthenticated,
    isSuperAdmin,
    updatePromotionHandler as any
  );
  app.delete(
    "/api/admin/promotions/:id",
    isAuthenticated,
    isSuperAdmin,
    deletePromotionHandler as any
  );

  const {
    listTradePartnerCampaignsPublicHandler,
    getTradePartnerCampaignPublicHandler,
    listTradePartnerCampaignsAdminHandler,
    getTradePartnerCampaignAdminHandler,
    upsertTradePartnerCampaignAdminHandler,
  } = await import("./tradepartner-campaigns");

  // TradePartner campaign system (public + super-admin controls)
  app.get("/api/tradepartner-campaigns", listTradePartnerCampaignsPublicHandler as any);
  app.get("/api/tradepartner-campaigns/:partnerSlug", getTradePartnerCampaignPublicHandler as any);
  app.get(
    "/api/admin/tradepartner-campaigns",
    isAuthenticated,
    isSuperAdmin,
    listTradePartnerCampaignsAdminHandler as any
  );
  app.get(
    "/api/admin/tradepartner-campaigns/:partnerSlug",
    isAuthenticated,
    isSuperAdmin,
    getTradePartnerCampaignAdminHandler as any
  );
  app.put(
    "/api/admin/tradepartner-campaigns/:partnerSlug",
    isAuthenticated,
    isSuperAdmin,
    upsertTradePartnerCampaignAdminHandler as any
  );

  // Phase 2: Boost System Routes for Realtors & Dealers
  const { getAvailableBoosts, purchaseBoost, getUserBoosts, getBoostAnalytics, cancelBoost } =
    await import("./boosts");

  app.get("/api/boosts/available", isAuthenticated, getAvailableBoosts);
  app.post("/api/boosts/purchase", isAuthenticated, purchaseBoost);
  app.get("/api/boosts/user", isAuthenticated, getUserBoosts);
  app.get("/api/boosts/:boostId/analytics", isAuthenticated, getBoostAnalytics);
  app.delete("/api/boosts/:boostId", isAuthenticated, cancelBoost);
}
