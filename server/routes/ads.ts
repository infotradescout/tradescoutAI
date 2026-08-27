import type { Express, RequestHandler } from "express";
import type { IStorage } from "../storage/contracts";

export type AdRoutesStorage = Pick<
  IStorage,
  | "getTargetedAd"
  | "normalizeAdLinkForUser"
  | "incrementAdImpressions"
  | "trackAdEvent"
  | "incrementAdClicks"
  | "submitAdFeedback"
  | "saveAdForUser"
  | "getSavedAdsForUser"
  | "removeSavedAd"
>;

export interface AdRoutesDependencies {
  storage: AdRoutesStorage;
  isAuthenticated: RequestHandler;
}

export function registerAdRoutes(app: Express, { storage, isAuthenticated }: AdRoutesDependencies) {
  app.get("/api/ads/site-visit", async (req: any, res: any) => {
    try {
      const { userType, state, county } = req.query;
      const ad = await storage.getTargetedAd({
        audience: (userType as string) || "all",
        state: state as string,
        county: county as string,
        minCommunityScore: 40,
      });
      if (!ad) return res.status(404).json({ message: "No ads available" });

      const user = req.user as any;
      const userId = user?.claims?.sub || user?.id || null;
      const linkUrl = await storage.normalizeAdLinkForUser({
        linkUrl: (ad as any).linkUrl,
        isAffiliate: (ad as any).isAffiliate,
        userId,
      });
      res.json({ ...ad, linkUrl });
    } catch (error: any) {
      console.error("Error fetching targeted ad:", error);
      res.status(500).json({ message: "Failed to fetch ad" });
    }
  });

  app.post("/api/ads/track-impression", async (req: any, res: any) => {
    try {
      const { adId, source } = (req.body ?? {}) as any;
      if (!adId) return res.status(400).json({ message: "adId is required" });

      await storage.incrementAdImpressions(adId);
      const user = req.user as any;
      const userId = user?.claims?.sub || user?.id || null;
      await storage.trackAdEvent({ adId, eventType: "impression", source, userId });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error tracking impression:", error);
      res.status(500).json({ message: "Failed to track impression" });
    }
  });

  app.post("/api/ads/track-click", async (req: any, res: any) => {
    try {
      const { adId, source } = (req.body ?? {}) as any;
      if (!adId) return res.status(400).json({ message: "adId is required" });

      await storage.incrementAdClicks(adId);
      const user = req.user as any;
      const userId = user?.claims?.sub || user?.id || null;
      await storage.trackAdEvent({ adId, eventType: "click", source, userId });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error tracking click:", error);
      res.status(500).json({ message: "Failed to track click" });
    }
  });

  app.post("/api/ads/feedback", isAuthenticated, async (req: any, res: any) => {
    try {
      const { adId, rating, source } = (req.body ?? {}) as {
        adId?: string;
        rating?: "helpful" | "not_relevant" | "spam";
        source?: "scout" | "site_visit" | "saved";
      };
      if (!adId || !rating || !source) {
        return res.status(400).json({ message: "adId, rating, and source are required" });
      }

      const user = req.user as any;
      const userId = user?.claims?.sub || user?.id;
      if (!userId) return res.status(401).json({ message: "Authentication required" });

      await storage.submitAdFeedback({ adId, userId, rating, source });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error recording ad feedback:", error);
      res.status(200).json({ success: false });
    }
  });

  app.post("/api/ads/save", isAuthenticated, async (req: any, res: any) => {
    try {
      const { adId } = (req.body ?? {}) as any;
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "User ID not found" });
      if (!adId) return res.status(400).json({ message: "adId is required" });

      const savedAd = await storage.saveAdForUser(userId, adId);
      res.json(savedAd);
    } catch (error: any) {
      console.error("Error saving ad:", error);
      res.status(500).json({ message: "Failed to save ad" });
    }
  });

  app.get("/api/saved-ads", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "User ID not found" });

      const savedAds = await storage.getSavedAdsForUser(userId);
      const adsWithAffiliateLinks = await Promise.all(
        savedAds.map(async (ad) => ({
          ...ad,
          linkUrl: await storage.normalizeAdLinkForUser({
            linkUrl: (ad as any).linkUrl,
            isAffiliate: (ad as any).isAffiliate,
            userId,
          }),
        }))
      );
      res.json(adsWithAffiliateLinks);
    } catch (error: any) {
      console.error("Error fetching saved ads:", error);
      res.status(500).json({ message: "Failed to fetch saved ads" });
    }
  });

  app.delete("/api/ads/save/:adId", isAuthenticated, async (req: any, res: any) => {
    try {
      const { adId } = req.params;
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "User ID not found" });

      await storage.removeSavedAd(userId, adId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error removing saved ad:", error);
      res.status(500).json({ message: "Failed to remove saved ad" });
    }
  });
}
