import type { Express, Request } from "express";
import { z } from "zod";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import { counties, employmentPosts, identityVerifications, users } from "@shared/schema";

type AuthedRequest = Request & {
  user?: { id?: string; claims?: { sub?: string }; role?: string; [key: string]: any };
};

const createEmploymentPostSchema = z.object({
  postType: z.enum(["job", "resume"]),
  title: z.string().min(1).max(140),
  body: z.string().min(1).max(6000),
  countyFips: z.string().length(5),
  city: z.string().max(80).optional(),
  tradeId: z.string().max(80).optional(),
  payMin: z.number().positive().optional(),
  payMax: z.number().positive().optional(),
  payUnit: z.enum(["hour", "year", "month", "project"]).optional(),
});

export function registerEmploymentRoutes(app: Express) {
  app.get("/api/employment/posts", async (req, res) => {
    try {
      const viewerUserId = String((req as any)?.user?.id || (req as any)?.user?.claims?.sub || "");
      const postType = typeof req.query?.type === "string" ? req.query.type.trim() : "";
      const countyFips =
        typeof req.query?.countyFips === "string" ? req.query.countyFips.trim() : "";
      const tradeId = typeof req.query?.tradeId === "string" ? req.query.tradeId.trim() : "";
      const q = typeof req.query?.q === "string" ? req.query.q.trim() : "";

      const filters: any[] = [];
      if (postType === "job" || postType === "resume") {
        filters.push(eq(employmentPosts.postType, postType));
      }
      if (countyFips) {
        filters.push(eq(employmentPosts.countyFips, countyFips));
      }
      if (tradeId) {
        filters.push(eq(employmentPosts.tradeId, tradeId));
      }
      if (q) {
        const like = `%${q}%`;
        filters.push(or(ilike(employmentPosts.title, like), ilike(employmentPosts.body, like)));
      }

      const whereClause =
        filters.length === 0 ? undefined : filters.length === 1 ? filters[0] : and(...filters);

      const base = db
        .select({
          id: employmentPosts.id,
          createdByUserId: employmentPosts.createdByUserId,
          postType: employmentPosts.postType,
          status: employmentPosts.status,
          title: employmentPosts.title,
          body: employmentPosts.body,
          countyFips: employmentPosts.countyFips,
          stateCode: employmentPosts.stateCode,
          city: employmentPosts.city,
          tradeId: employmentPosts.tradeId,
          payMin: employmentPosts.payMin,
          payMax: employmentPosts.payMax,
          payUnit: employmentPosts.payUnit,
          createdAt: employmentPosts.createdAt,
          updatedAt: employmentPosts.updatedAt,
          posterAddressVerified: users.addressVerified,
          posterIdVerified: identityVerifications.status,
        })
        .from(employmentPosts)
        .leftJoin(users, eq(employmentPosts.createdByUserId, users.id))
        .leftJoin(
          identityVerifications,
          eq(employmentPosts.createdByUserId, identityVerifications.userId)
        );

      const rows = whereClause
        ? await base.where(whereClause).orderBy(desc(employmentPosts.createdAt)).limit(100)
        : await base.orderBy(desc(employmentPosts.createdAt)).limit(100);

      res.json(
        rows.map((row: any) => {
          const isOwner =
            viewerUserId && row.createdByUserId && String(row.createdByUserId) === viewerUserId;
          const posterVerified =
            Boolean(row.posterAddressVerified) &&
            String(row.posterIdVerified || "").toLowerCase() === "approved";
          const {
            createdByUserId: _ignore,
            posterAddressVerified: _ignore2,
            posterIdVerified: _ignore3,
            ...safe
          } = row;
          return { ...safe, isOwner, posterVerified };
        })
      );
    } catch (error: any) {
      const message = String(error?.message || "");
      const code = String(error?.code || "");
      if (code === "42P01" && message.includes("employment_posts")) {
        console.warn("[employment] employment_posts table missing; returning empty list.");
        res.setHeader("X-Data-Disabled", "employment_posts_missing");
        res.json([]);
        return;
      }
      if (code === "42P01" && message.includes("identity_verifications")) {
        console.warn("[employment] identity_verifications table missing; returning empty list.");
        res.setHeader("X-Data-Disabled", "identity_verifications_missing");
        res.json([]);
        return;
      }

      console.error("Error fetching employment posts:", error);
      res.status(500).json({ message: "Failed to fetch employment posts" });
    }
  });

  app.post("/api/employment/posts", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = String((req.user as any)?.id || (req.user as any)?.claims?.sub || "").trim();
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const parsed = createEmploymentPostSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid payload", issues: parsed.error.issues });
      }

      const payload = parsed.data;

      const [county] = await db
        .select({ stateCode: counties.stateCode })
        .from(counties)
        .where(eq(counties.fips, payload.countyFips))
        .limit(1);

      if (!county) {
        return res.status(400).json({ message: "Unknown countyFips" });
      }

      const nextPayMin = payload.payMin;
      const nextPayMax = payload.payMax;
      if (nextPayMin != null && nextPayMax != null && nextPayMin > nextPayMax) {
        return res.status(400).json({ message: "payMin cannot be greater than payMax" });
      }

      const [created] = await db
        .insert(employmentPosts)
        .values({
          createdByUserId: userId,
          postType: payload.postType,
          status: "open",
          title: payload.title.trim(),
          body: payload.body.trim(),
          countyFips: payload.countyFips,
          stateCode: county.stateCode ?? null,
          city: payload.city?.trim() || null,
          tradeId: payload.tradeId?.trim() || null,
          payMin: nextPayMin ?? null,
          payMax: nextPayMax ?? null,
          payUnit: payload.payUnit ?? null,
          updatedAt: new Date(),
        } as any)
        .returning();

      res.json(created);
    } catch (error: any) {
      console.error("Error creating employment post:", error);
      res.status(500).json({ message: "Failed to create employment post" });
    }
  });

  app.post("/api/employment/posts/:id/close", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = String((req.user as any)?.id || (req.user as any)?.claims?.sub || "").trim();
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const id = String(req.params.id || "").trim();
      if (!id) return res.status(400).json({ message: "Missing id" });

      const [row] = await db
        .select({
          id: employmentPosts.id,
          createdByUserId: employmentPosts.createdByUserId,
          status: employmentPosts.status,
        })
        .from(employmentPosts)
        .where(eq(employmentPosts.id, id))
        .limit(1);

      if (!row) return res.status(404).json({ message: "Not found" });
      if (row.createdByUserId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const [updated] = await db
        .update(employmentPosts)
        .set({ status: "closed", updatedAt: new Date() })
        .where(eq(employmentPosts.id, id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error closing employment post:", error);
      res.status(500).json({ message: "Failed to close post" });
    }
  });
}
