import type { Express, Request } from "express";
import { z } from "zod";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import { redactContactDetails } from "../utils/workRequestShare";
import { sanitizePublicListingText } from "@shared/publicListingSafety";
import {
  counties,
  employmentPosts,
  employmentPostApplications,
  identityVerifications,
  users,
} from "@shared/schema";

type AuthedRequest = Request & {
  user?: { id?: string; claims?: { sub?: string }; role?: string | null; [key: string]: any };
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
          return {
            ...safe,
            title: sanitizePublicListingText(safe.title, 140),
            body: sanitizePublicListingText(safe.body, 6000),
            city: safe.city ? sanitizePublicListingText(safe.city, 80) : safe.city,
            isOwner,
            posterVerified,
          };
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

      // Fail-soft in production: Direct Connect must remain usable even if this data source
      // is temporarily unavailable (schema drift, permission issues, transient DB error).
      if (process.env.NODE_ENV === "production") {
        console.error("[employment] Failed to fetch posts; returning empty list:", error);
        res.setHeader("X-Data-Disabled", "employment_posts_unavailable");
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
          title: sanitizePublicListingText(payload.title, 140),
          body: sanitizePublicListingText(payload.body, 6000),
          countyFips: payload.countyFips,
          stateCode: county.stateCode ?? null,
          city: payload.city ? sanitizePublicListingText(payload.city, 80) || null : null,
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

  // Apply to a job post (or express interest in a resume post)
  app.post("/api/employment/posts/:id/apply", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = String((req.user as any)?.id || (req.user as any)?.claims?.sub || "").trim();
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const postId = String(req.params.id || "").trim();
      if (!postId) return res.status(400).json({ message: "Missing post id" });

      const message =
        typeof req.body?.message === "string"
          ? redactContactDetails(req.body.message).trim()
          : null;

      const [post] = await db
        .select({
          id: employmentPosts.id,
          createdByUserId: employmentPosts.createdByUserId,
          status: employmentPosts.status,
        })
        .from(employmentPosts)
        .where(eq(employmentPosts.id, postId))
        .limit(1);

      if (!post) return res.status(404).json({ message: "Post not found" });
      if (post.status !== "open")
        return res.status(409).json({ message: "This post is no longer accepting applications" });
      if (post.createdByUserId === userId)
        return res.status(400).json({ message: "You cannot apply to your own post" });

      // Upsert: if already applied, return existing application
      const [existing] = await db
        .select()
        .from(employmentPostApplications)
        .where(
          and(
            eq(employmentPostApplications.postId, postId),
            eq(employmentPostApplications.applicantUserId, userId)
          )
        )
        .limit(1);

      if (existing) {
        return res.status(409).json({
          message: "You have already applied to this post",
          application: {
            ...existing,
            message: existing.message ? redactContactDetails(existing.message) : existing.message,
          },
        });
      }

      const [created] = await db
        .insert(employmentPostApplications)
        .values({
          postId,
          applicantUserId: userId,
          message: message || null,
          status: "pending",
          updatedAt: new Date(),
        } as any)
        .returning();

      res.json(created);
    } catch (error: any) {
      console.error("Error applying to employment post:", error);
      res.status(500).json({ message: "Failed to apply" });
    }
  });

  // List applications for a post (owner only) or own applications (any user)
  app.get(
    "/api/employment/posts/:id/applications",
    isAuthenticated,
    async (req: AuthedRequest, res) => {
      try {
        const userId = String((req.user as any)?.id || (req.user as any)?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const postId = String(req.params.id || "").trim();
        if (!postId) return res.status(400).json({ message: "Missing post id" });

        const [post] = await db
          .select({ id: employmentPosts.id, createdByUserId: employmentPosts.createdByUserId })
          .from(employmentPosts)
          .where(eq(employmentPosts.id, postId))
          .limit(1);

        if (!post) return res.status(404).json({ message: "Post not found" });

        const isOwner = post.createdByUserId === userId;

        if (isOwner) {
          // Owner sees applicant identity and decision context, but raw contact stays gated.
          const applications = await db
            .select({
              id: employmentPostApplications.id,
              postId: employmentPostApplications.postId,
              applicantUserId: employmentPostApplications.applicantUserId,
              message: employmentPostApplications.message,
              status: employmentPostApplications.status,
              createdAt: employmentPostApplications.createdAt,
              updatedAt: employmentPostApplications.updatedAt,
              applicantName: sql<string>`trim(coalesce(${users.firstName}, '') || ' ' || coalesce(${users.lastName}, ''))`,
            })
            .from(employmentPostApplications)
            .leftJoin(users, eq(employmentPostApplications.applicantUserId, users.id))
            .where(eq(employmentPostApplications.postId, postId))
            .orderBy(desc(employmentPostApplications.createdAt));
          return res.json(
            applications.map((application) => ({
              ...application,
              message: application.message
                ? redactContactDetails(application.message)
                : application.message,
            }))
          );
        }

        // Non-owner: return only their own application status
        const [own] = await db
          .select()
          .from(employmentPostApplications)
          .where(
            and(
              eq(employmentPostApplications.postId, postId),
              eq(employmentPostApplications.applicantUserId, userId)
            )
          )
          .limit(1);

        res.json(
          own
            ? [
                {
                  ...own,
                  message: own.message ? redactContactDetails(own.message) : own.message,
                },
              ]
            : []
        );
      } catch (error: any) {
        console.error("Error fetching applications:", error);
        res.status(500).json({ message: "Failed to fetch applications" });
      }
    }
  );

  // Applicant: list all their own employment applications with post details
  app.get("/api/employment/my-applications", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = String((req.user as any)?.id || (req.user as any)?.claims?.sub || "").trim();
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const rows = await db
        .select({
          id: employmentPostApplications.id,
          postId: employmentPostApplications.postId,
          status: employmentPostApplications.status,
          coverLetter: employmentPostApplications.message,
          createdAt: employmentPostApplications.createdAt,
          updatedAt: employmentPostApplications.updatedAt,
          post: {
            title: employmentPosts.title,
            description: employmentPosts.body,
            location: employmentPosts.city,
            payRate: sql<string | null>`case
              when ${employmentPosts.payMin} is not null or ${employmentPosts.payMax} is not null
              then concat_ws(' - ', ${employmentPosts.payMin}, ${employmentPosts.payMax}) || coalesce(' / ' || ${employmentPosts.payUnit}, '')
              else null
            end`,
            businessName: sql<string | null>`null`,
            status: employmentPosts.status,
          },
        })
        .from(employmentPostApplications)
        .leftJoin(employmentPosts, eq(employmentPostApplications.postId, employmentPosts.id))
        .where(eq(employmentPostApplications.applicantUserId, userId))
        .orderBy(desc(employmentPostApplications.createdAt));

      res.json(
        rows.map((row) => ({
          ...row,
          coverLetter: row.coverLetter ? redactContactDetails(row.coverLetter) : row.coverLetter,
          post: {
            ...row.post,
            title: sanitizePublicListingText(row.post.title, 140),
            description: sanitizePublicListingText(row.post.description, 6000),
            location: row.post.location
              ? sanitizePublicListingText(row.post.location, 80)
              : row.post.location,
          },
        }))
      );
    } catch (error: any) {
      console.error("Error fetching my applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  // Post owner: update application status (shortlist, reject, etc.)
  app.patch(
    "/api/employment/applications/:id",
    isAuthenticated,
    async (req: AuthedRequest, res) => {
      try {
        const userId = String((req.user as any)?.id || (req.user as any)?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const appId = String(req.params.id || "").trim();
        if (!appId) return res.status(400).json({ message: "Missing application id" });

        const newStatus = typeof req.body?.status === "string" ? req.body.status.trim() : "";
        const validStatuses = ["pending", "shortlisted", "rejected", "withdrawn"];
        if (!validStatuses.includes(newStatus)) {
          return res
            .status(400)
            .json({ message: `status must be one of: ${validStatuses.join(", ")}` });
        }

        const [application] = await db
          .select({
            id: employmentPostApplications.id,
            postId: employmentPostApplications.postId,
            applicantUserId: employmentPostApplications.applicantUserId,
            status: employmentPostApplications.status,
          })
          .from(employmentPostApplications)
          .where(eq(employmentPostApplications.id, appId))
          .limit(1);

        if (!application) return res.status(404).json({ message: "Application not found" });

        // Applicant can withdraw their own application; post owner can shortlist/reject
        const isApplicant = application.applicantUserId === userId;
        if (isApplicant) {
          if (newStatus !== "withdrawn") {
            return res
              .status(403)
              .json({ message: "Applicants can only withdraw their own application" });
          }
        } else {
          // Verify caller is the post owner
          const [post] = await db
            .select({ createdByUserId: employmentPosts.createdByUserId })
            .from(employmentPosts)
            .where(eq(employmentPosts.id, application.postId))
            .limit(1);
          if (!post || post.createdByUserId !== userId) {
            return res.status(403).json({ message: "Forbidden" });
          }
        }

        const [updated] = await db
          .update(employmentPostApplications)
          .set({ status: newStatus, updatedAt: new Date() } as any)
          .where(eq(employmentPostApplications.id, appId))
          .returning();

        res.json({
          ...updated,
          message: updated.message ? redactContactDetails(updated.message) : updated.message,
        });
      } catch (error: any) {
        console.error("Error updating application status:", error);
        res.status(500).json({ message: "Failed to update application" });
      }
    }
  );
}
