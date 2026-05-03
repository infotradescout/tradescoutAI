import type { Express } from "express";
import { isAuthenticated, isContractor } from "../auth";
import { storage } from "../storage";
import { insertContractorPromoSchema } from "@shared/schema";

export function registerContractorPromoRoutes(app: Express) {
  app.post("/api/contractor-promos", isAuthenticated, isContractor, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const contractor = await storage.getContractorByUserId(userId);
      if (!contractor) {
        return res
          .status(403)
          .json({ message: "You must be a verified contractor to create promos" });
      }

      const parsedPromo = insertContractorPromoSchema.safeParse({
        ...req.body,
        contractorId: contractor.id,
      });
      if (!parsedPromo.success) {
        return res.status(400).json({
          message: "Invalid contractor promo payload",
          issues: parsedPromo.error.issues,
        });
      }

      const promo = await storage.createContractorPromo(parsedPromo.data);
      res.json(promo);
    } catch (error: any) {
      console.error("Error creating contractor promo:", error);
      res.status(500).json({ message: "Failed to create promo" });
    }
  });

  app.get("/api/contractor-promos", isAuthenticated, isContractor, async (req: any, res: any) => {
    try {
      const contractor = await storage.getContractorByUserId(req.user?.claims?.sub);
      if (!contractor) {
        return res.status(403).json({ message: "Contractor not found" });
      }

      const promos = await storage.getContractorPromos(contractor.id);
      res.json(promos);
    } catch (error: any) {
      console.error("Error fetching contractor promos:", error);
      res.status(500).json({ message: "Failed to fetch promos" });
    }
  });

  app.put(
    "/api/contractor-promos/:promoId",
    isAuthenticated,
    isContractor,
    async (req: any, res: any) => {
      try {
        const contractor = await storage.getContractorByUserId(req.user?.claims?.sub);
        if (!contractor) {
          return res.status(403).json({ message: "Contractor not found" });
        }

        const existingPromo = await storage.getContractorPromo(req.params.promoId);
        if (!existingPromo || existingPromo.contractorId !== contractor.id) {
          return res.status(403).json({ message: "You can only edit your own promos" });
        }

        const updatedPromo = await storage.updateContractorPromo(req.params.promoId, req.body);
        res.json(updatedPromo);
      } catch (error: any) {
        console.error("Error updating contractor promo:", error);
        res.status(500).json({ message: "Failed to update promo" });
      }
    }
  );

  app.delete(
    "/api/contractor-promos/:promoId",
    isAuthenticated,
    isContractor,
    async (req: any, res: any) => {
      try {
        const contractor = await storage.getContractorByUserId(req.user?.claims?.sub);
        if (!contractor) {
          return res.status(403).json({ message: "Contractor not found" });
        }

        const existingPromo = await storage.getContractorPromo(req.params.promoId);
        if (!existingPromo || existingPromo.contractorId !== contractor.id) {
          return res.status(403).json({ message: "You can only delete your own promos" });
        }

        await storage.deleteContractorPromo(req.params.promoId);
        res.status(204).send();
      } catch (error: any) {
        console.error("Error deleting contractor promo:", error);
        res.status(500).json({ message: "Failed to delete promo" });
      }
    }
  );

  app.get("/promo/:slug", async (req: any, res: any) => {
    try {
      const promo = await storage.getContractorPromoBySlug(req.params.slug);
      if (!promo) {
        return res.status(404).json({ message: "Promo not found" });
      }

      const now = new Date();
      if (!promo.isActive || (promo.expiresAt && promo.expiresAt < now)) {
        return res.status(410).json({ message: "Promo has expired" });
      }

      const currentUses = promo.currentUses ?? 0;
      if (promo.maxUses && currentUses >= promo.maxUses) {
        return res.status(410).json({ message: "Promo has reached maximum uses" });
      }

      await storage.incrementPromoView(promo.id);
      await storage.recordPromoInteraction({
        promoId: promo.id,
        interactionType: "view",
        sessionId: req.sessionID,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        referrer: req.get("Referer"),
        county: req.locality?.county,
        state: req.locality?.state,
        city: req.locality?.city,
      });

      const contractor = await storage.getContractor(promo.contractorId);
      res.json({
        promo,
        contractor: contractor
          ? {
              id: contractor.id,
              companyName: contractor.companyName,
              slug: contractor.slug,
              about: contractor.about,
              photos: contractor.photos,
              yearsInBusiness: contractor.yearsInBusiness,
              verifiedLicensed: contractor.verifiedLicensed,
              verifiedInsured: contractor.verifiedInsured,
              contactAccess: {
                mode: "request_required",
                ctaLabel: "Request Quote",
                ctaPath: "/request-quote",
              },
            }
          : null,
      });
    } catch (error: any) {
      console.error("Error fetching promo:", error);
      res.status(500).json({ message: "Failed to fetch promo" });
    }
  });

  app.post("/api/promo/:slug/click", async (req: any, res: any) => {
    try {
      const promo = await storage.getContractorPromoBySlug(req.params.slug);
      if (!promo) {
        return res.status(404).json({ message: "Promo not found" });
      }

      await storage.incrementPromoClick(promo.id);
      await storage.recordPromoInteraction({
        promoId: promo.id,
        interactionType: "click",
        sessionId: req.sessionID,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        referrer: req.get("Referer"),
        county: req.locality?.county,
        state: req.locality?.state,
        city: req.locality?.city,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error tracking promo click:", error);
      res.status(500).json({ message: "Failed to track click" });
    }
  });

  app.get(
    "/api/contractor-promos/:promoId/analytics",
    isAuthenticated,
    isContractor,
    async (req: any, res: any) => {
      try {
        const contractor = await storage.getContractorByUserId(req.user?.claims?.sub);
        if (!contractor) {
          return res.status(403).json({ message: "Contractor not found" });
        }

        const promo = await storage.getContractorPromo(req.params.promoId);
        if (!promo || promo.contractorId !== contractor.id) {
          return res
            .status(403)
            .json({ message: "You can only view analytics for your own promos" });
        }

        const analytics = await storage.getPromoAnalytics(req.params.promoId);
        res.json(analytics);
      } catch (error: any) {
        console.error("Error fetching promo analytics:", error);
        res.status(500).json({ message: "Failed to fetch analytics" });
      }
    }
  );

  app.get("/api/promos/area/:countyFips", async (req: any, res: any) => {
    try {
      const promos = await storage.getActivePromosInArea(req.params.countyFips);
      const promosWithContractors = await Promise.all(
        promos.map(async (promo) => {
          const contractor = await storage.getContractor(promo.contractorId);
          return {
            ...promo,
            contractor: contractor
              ? {
                  companyName: contractor.companyName,
                  slug: contractor.slug,
                  verifiedLicensed: contractor.verifiedLicensed,
                  verifiedInsured: contractor.verifiedInsured,
                }
              : null,
          };
        })
      );

      res.json(promosWithContractors);
    } catch (error: any) {
      console.error("Error fetching area promos:", error);
      res.status(500).json({ message: "Failed to fetch area promos" });
    }
  });
}
