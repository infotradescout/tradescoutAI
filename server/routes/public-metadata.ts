import type { Express } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { addressVerifications, counties, missionControlDecisions } from "@shared/schema";

type ProofMetricsResponse = {
  generatedAt: string;
  cacheSeconds: number;
  countiesIndexed: number;
  decisionsLast7Days: number;
  verifiedClaimsLast30Days: number;
};

type RegisterPublicMetadataRoutesOptions = {
  buildRevision: string;
  defaultFirstIntroAppendix: string;
};

export function registerPublicMetadataRoutes(
  app: Express,
  options: RegisterPublicMetadataRoutesOptions
) {
  const { buildRevision, defaultFirstIntroAppendix } = options;
  const proofCache: { value: ProofMetricsResponse | null; expiresAt: number } = {
    value: null,
    expiresAt: 0,
  };

  app.get("/api/public/config", (_req: any, res: any) => {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      firstIntroAppendix: process.env.TS_FIRST_INTRO_APPENDIX || defaultFirstIntroAppendix,
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null,
      buildRevision,
    });
  });

  app.get("/api/public/proof-metrics", async (_req: any, res: any) => {
    try {
      const now = Date.now();
      const cacheSeconds = 60;

      if (proofCache.value && proofCache.expiresAt > now) {
        res.setHeader(
          "Cache-Control",
          `public, max-age=${cacheSeconds}, stale-while-revalidate=${cacheSeconds}`
        );
        return res.status(200).json(proofCache.value);
      }

      const [countiesRow, decisionsRow, verifiedRow] = await Promise.all([
        db.select({ n: sql<number>`count(*)` }).from(counties),
        db
          .select({ n: sql<number>`count(*)` })
          .from(missionControlDecisions)
          .where(
            sql`${missionControlDecisions.decisionDate} >= (current_date - interval '7 days')`
          ),
        db
          .select({ n: sql<number>`count(*)` })
          .from(addressVerifications)
          .where(
            and(
              eq(addressVerifications.status, "approved"),
              sql`${addressVerifications.approvedAt} >= (now() - interval '30 days')`
            )
          ),
      ]);

      const countiesIndexed = Number((countiesRow?.[0] as any)?.n ?? 0);
      const decisionsLast7Days = Number((decisionsRow?.[0] as any)?.n ?? 0);
      const verifiedClaimsLast30Days = Number((verifiedRow?.[0] as any)?.n ?? 0);

      const payload: ProofMetricsResponse = {
        generatedAt: new Date().toISOString(),
        cacheSeconds,
        countiesIndexed: Number.isFinite(countiesIndexed) ? countiesIndexed : 0,
        decisionsLast7Days: Number.isFinite(decisionsLast7Days) ? decisionsLast7Days : 0,
        verifiedClaimsLast30Days: Number.isFinite(verifiedClaimsLast30Days)
          ? verifiedClaimsLast30Days
          : 0,
      };

      proofCache.value = payload;
      proofCache.expiresAt = now + cacheSeconds * 1000;

      res.setHeader(
        "Cache-Control",
        `public, max-age=${cacheSeconds}, stale-while-revalidate=${cacheSeconds}`
      );
      return res.status(200).json(payload);
    } catch (error: any) {
      console.error("Error in /api/public/proof-metrics:", error);
      return res.status(503).json({ message: "Proof metrics temporarily unavailable" });
    }
  });
}
