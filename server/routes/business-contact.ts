import type { Express, Request, Response } from "express";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../db";
import { createPostgresRateLimitStore } from "../utils/postgresRateLimitStore";
import { businesses, decisionCards } from "@shared/schema";
import { isAuthenticated, requireOnboardingComplete } from "../auth";
import { storage } from "../storage";
import { hasPrivilegedVerificationBypass } from "../utils/privilegedVerification";

type AuthedRequest = Request & {
  user?: { id?: string; claims?: { sub?: string }; role?: string; [key: string]: any };
};

const revealSchema = z.object({
  businessId: z.string().min(1),
  contactType: z.enum(["call"]).default("call"),
  intent: z.enum(["hire", "advise", "collaborate", "reconnect"]).default("hire"),
  decisionScope: z.string().min(1).max(2000).optional(),
  authorityGate: z.literal("decision_card"),
  sourceDecisionCardId: z.string().min(1),
});

function normalizePhoneForTel(raw: unknown): { display: string; tel: string } | null {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;
  const digits = value.replace(/[^\d+]/g, "");
  const telDigits = digits.startsWith("+") ? digits : `+1${digits.replace(/\D/g, "")}`;
  const display = value;
  if (!/^\+?\d{10,15}$/.test(telDigits)) {
    // Fallback to raw digits (still gated; this just prevents producing an invalid tel link).
    const plain = value.replace(/\D/g, "");
    if (plain.length < 10) return null;
    return { display, tel: `tel:${plain}` };
  }
  return { display, tel: `tel:${telDigits}` };
}

export function registerBusinessContactRoutes(app: Express) {
  const isProductionEnv = process.env.NODE_ENV === "production";
  const noopRateLimiter: any = (_req: any, _res: any, next: any) => next();

  const limiterStore = (prefix: string) =>
    createPostgresRateLimitStore({
      pool,
      prefix: `rl:${prefix}`,
      cleanupIntervalMs: Number(process.env.RATE_LIMIT_CLEANUP_INTERVAL_MS || 10 * 60 * 1000),
    });

  const rateLimitKey = (req: any) => {
    const userId = req?.user?.claims?.sub || req?.user?.id;
    if (userId) return `u:${userId}`;
    return req.ip;
  };

  const revealLimiter = isProductionEnv
    ? rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 30,
        message: "Too many contact reveals, please slow down",
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: rateLimitKey,
        store: limiterStore("business_contact_reveal"),
      })
    : noopRateLimiter;

  // Auth: reveal contact details for a directory business (intent-gated; verified users only).
  // This preserves Intent → Decision Card → Contact:
  // - client must create a Decision Card (POST /api/decision-cards)
  // - this endpoint validates the Decision Card belongs to requester and is active
  // - then returns a tel: link without ever making the business a "site user"
  app.post(
    "/api/business-contact/reveal",
    isAuthenticated,
    requireOnboardingComplete,
    revealLimiter,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = req.user?.id || req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const body = revealSchema.parse(req.body ?? {});

        const user = await storage.getUser(String(userId));
        const viewerVerified =
          hasPrivilegedVerificationBypass(req.user) || Boolean((user as any)?.addressVerified);
        if (!viewerVerified) {
          return res.status(403).json({
            message: "Verify your address before initiating contact.",
            code: "VIEWER_NOT_VERIFIED",
          });
        }

        // Authority gate: decision_card is required.
        const [decision] = await db
          .select()
          .from(decisionCards)
          .where(
            and(eq(decisionCards.id, body.sourceDecisionCardId), eq(decisionCards.userId, userId))
          )
          .limit(1);
        if (!decision || decision.status === "archived") {
          return res.status(400).json({
            message: "Decision Card not found or inactive.",
            code: "INVALID_DECISION_CARD",
          });
        }
        if (decision.intent && decision.intent !== body.intent) {
          return res.status(400).json({
            message: "Decision Card intent does not match request intent.",
            code: "DECISION_INTENT_MISMATCH",
          });
        }
        if (
          typeof body.decisionScope === "string" &&
          decision.decisionScope &&
          decision.decisionScope !== body.decisionScope
        ) {
          return res.status(400).json({
            message: "Decision Card scope does not match request scope.",
            code: "DECISION_SCOPE_MISMATCH",
          });
        }

        const [biz] = await db
          .select({
            id: businesses.id,
            name: businesses.name,
            status: businesses.status,
            claimStatus: businesses.claimStatus,
            ownerUserId: businesses.ownerUserId,
            profileData: businesses.profileData,
          })
          .from(businesses)
          .where(eq(businesses.id, body.businessId))
          .limit(1);

        if (!biz || String(biz.status || "") !== "active") {
          return res.status(404).json({ message: "Business not found" });
        }

        // This endpoint is specifically for directory entries (unclaimed). Claimed businesses should
        // use Direct Connect / published contact flows to preserve platform invariants.
        if (biz.ownerUserId || String(biz.claimStatus || "") !== "unclaimed") {
          return res.status(409).json({
            message: "Business is already claimed. Use TradeScout contact flows.",
            code: "BUSINESS_ALREADY_CLAIMED",
          });
        }

        const profileData: any = biz.profileData || {};
        const phone = normalizePhoneForTel(profileData.phone);
        if (!phone) {
          return res.status(404).json({
            message: "No phone number on file for this business.",
            code: "NO_PHONE_ON_FILE",
          });
        }

        // Minimal server-side audit log (can be promoted to DB table later).
        console.info("[business-contact] reveal", {
          when: new Date().toISOString(),
          userId: String(userId),
          businessId: biz.id,
          contactType: body.contactType,
          intent: body.intent,
          decisionScope: body.decisionScope || decision.decisionScope || null,
          sourceDecisionCardId: body.sourceDecisionCardId,
        });

        return res.json({
          businessId: biz.id,
          businessName: biz.name,
          contactType: body.contactType,
          phone: phone.display,
          tel: phone.tel,
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid request", errors: error.errors });
        }
        console.error("Error revealing business contact:", error);
        return res.status(500).json({ message: error?.message || "Failed to reveal contact" });
      }
    }
  );
}
