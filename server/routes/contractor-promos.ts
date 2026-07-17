import type { Express } from "express";
import { isAuthenticated, isContractor } from "../auth";
import { storage } from "../storage";
import { insertContractorPromoSchema } from "@shared/schema";
import {
  buildPublicContractorPromoDetail,
  isContractorPromoPubliclyAvailable,
  listContractorPromoImageUrls,
  normalizeContractorPromoSlug,
} from "@shared/contractorPromoShare";
import { sanitizePublicListingText } from "@shared/publicListingSafety";
import { buildExposureAuthorityMap, hasExposureAuthority } from "../services/exposureAuthority";

const updateContractorPromoSchema = insertContractorPromoSchema
  .omit({ contractorId: true })
  .partial();

const CONTRACTOR_PROMO_UPDATE_FIELDS = [
  "title",
  "description",
  "offerDetails",
  "imageUrl",
  "discountType",
  "discountValue",
  "minimumJobValue",
  "promoCode",
  "isActive",
  "maxUses",
  "serviceAreas",
  "tradeCategories",
  "startsAt",
  "expiresAt",
] as const;

function normalizePromoImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const candidate = value.trim();
  if (candidate.length > 2048 || /[\r\n\\]/.test(candidate)) return null;
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizePromoWritePayload(value: unknown): Record<string, unknown> {
  const body = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const normalized: Record<string, unknown> = { ...body };

  if ("imageUrl" in body) normalized.imageUrl = normalizePromoImageUrl(body.imageUrl);
  for (const field of ["startsAt", "expiresAt"] as const) {
    if (!(field in body)) continue;
    const raw = body[field];
    normalized[field] = raw ? new Date(String(raw)) : null;
  }
  return normalized;
}

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
        ...normalizePromoWritePayload(req.body),
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

        const normalizedBody = normalizePromoWritePayload(req.body);
        const candidateUpdates = Object.fromEntries(
          CONTRACTOR_PROMO_UPDATE_FIELDS.filter((field) => field in normalizedBody).map((field) => [
            field,
            normalizedBody[field],
          ])
        );
        const parsedUpdates = updateContractorPromoSchema.safeParse(candidateUpdates);
        if (!parsedUpdates.success) {
          return res.status(400).json({
            message: "Invalid contractor promo payload",
            issues: parsedUpdates.error.issues,
          });
        }

        const updatedPromo = await storage.updateContractorPromo(
          req.params.promoId,
          parsedUpdates.data
        );
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

  const sendPublicPromoJson = async (req: any, res: any) => {
    try {
      const slug = normalizeContractorPromoSlug(req.params.slug);
      if (!slug) return res.status(404).json({ message: "Promo not found" });

      const promo = await storage.getContractorPromoBySlug(slug);
      if (!promo) {
        return res.status(404).json({ message: "Promo not found" });
      }

      if (!isContractorPromoPubliclyAvailable(promo))
        return res.status(410).json({ message: "Promo is no longer available" });

      const contractor = await storage.getContractor(promo.contractorId);
      const authorityUserId = String(contractor?.userId || "").trim();
      if (!contractor || !authorityUserId || !(await hasExposureAuthority(authorityUserId))) {
        return res.status(404).json({ message: "Promo not found" });
      }

      const publicPromo = buildPublicContractorPromoDetail({ promo, provider: contractor });
      if (!publicPromo) return res.status(404).json({ message: "Promo not found" });

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

      res.json({
        promo: {
          ...promo,
          ...publicPromo,
        },
        contractor: {
          ...publicPromo.provider,
          about: sanitizePublicListingText(contractor.about, 2000),
          photos: listContractorPromoImageUrls({ providerPhotos: contractor.photos }),
          yearsInBusiness: contractor.yearsInBusiness,
          contactAccess: {
            mode: "request_required",
            ctaLabel: publicPromo.contactAccess.ctaLabel,
            ctaPath: `/direct-connect?intent=hire&targetProviderId=${encodeURIComponent(
              publicPromo.provider.id
            )}&targetName=${encodeURIComponent(publicPromo.provider.companyName)}&contractor=${encodeURIComponent(
              publicPromo.provider.slug
            )}&promo=${encodeURIComponent(publicPromo.slug)}`,
          },
        },
      });
    } catch (error: any) {
      console.error("Error fetching promo:", error);
      res.status(500).json({ message: "Failed to fetch promo" });
    }
  };

  app.get("/api/promo/:slug", sendPublicPromoJson);

  // Preserve the legacy JSON URL for non-browser callers while allowing real
  // page navigations and social crawlers to reach the SPA/metadata route.
  app.get("/promo/:slug", async (req: any, res: any, next: any) => {
    const accept = String(req.get("Accept") || "").toLowerCase();
    if (accept.includes("text/html")) return next();
    return sendPublicPromoJson(req, res);
  });

  app.post("/api/promo/:slug/click", async (req: any, res: any) => {
    try {
      const promo = await storage.getContractorPromoBySlug(req.params.slug);
      if (!promo) {
        return res.status(404).json({ message: "Promo not found" });
      }
      if (!isContractorPromoPubliclyAvailable(promo)) {
        return res.status(410).json({ message: "Promo is no longer available" });
      }

      const contractor = await storage.getContractor(promo.contractorId);
      const authorityUserId = String(contractor?.userId || "").trim();
      if (!contractor || !authorityUserId || !(await hasExposureAuthority(authorityUserId))) {
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
          return { promo, contractor };
        })
      );
      const authority = await buildExposureAuthorityMap(
        promosWithContractors.map(({ contractor }) => contractor?.userId)
      );
      const publicPromos = promosWithContractors.flatMap(({ promo, contractor }) => {
        const authorityUserId = String(contractor?.userId || "").trim();
        if (!contractor || authority[authorityUserId] !== true) return [];
        const publicPromo = buildPublicContractorPromoDetail({ promo, provider: contractor });
        if (!publicPromo) return [];
        return [
          {
            ...promo,
            ...publicPromo,
            contractor: publicPromo.provider,
          },
        ];
      });

      res.json(publicPromos);
    } catch (error: any) {
      console.error("Error fetching area promos:", error);
      res.status(500).json({ message: "Failed to fetch area promos" });
    }
  });
}
