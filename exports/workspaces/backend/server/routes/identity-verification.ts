import type { Express } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { isAuthenticated, requireAdmin } from "../auth";
import { db } from "../db";
import { identityVerifications } from "@shared/schema";

const submitSchema = z.object({
  documentType: z.enum(["drivers_license", "passport", "state_id"]),
  objectKey: z.string().min(6),
});

export function registerIdentityVerificationRoutes(app: Express) {
  app.get("/api/identity-verification/status", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = String((req.user as any)?.id || (req.user as any)?.claims?.sub || "").trim();
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const [row] = await db
        .select()
        .from(identityVerifications)
        .where(eq(identityVerifications.userId, userId))
        .orderBy(desc(identityVerifications.createdAt))
        .limit(1);

      const status = String((row as any)?.status || "").toLowerCase();
      const isVerified = status === "approved";

      res.json({
        isVerified,
        verification: row || null,
      });
    } catch (error: any) {
      const message = String(error?.message || "");
      const code = String(error?.code || "");
      if (code === "42P01" && message.includes("identity_verifications")) {
        console.warn(
          "[identity-verification] identity_verifications table missing; returning unverified status."
        );
        res.setHeader("X-Data-Disabled", "identity_verifications_missing");
        res.json({ isVerified: false, verification: null });
        return;
      }

      if (process.env.NODE_ENV === "production") {
        console.error(
          "[identity-verification] Failed to fetch status; returning unverified status:",
          error
        );
        res.setHeader("X-Data-Disabled", "identity_verifications_unavailable");
        res.json({ isVerified: false, verification: null });
        return;
      }

      console.error("Error fetching identity verification status:", error);
      res.status(500).json({ message: "Failed to fetch identity verification status" });
    }
  });

  app.post("/api/identity-verification/submit", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = String((req.user as any)?.id || (req.user as any)?.claims?.sub || "").trim();
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const parsed = submitSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid payload", issues: parsed.error.issues });
      }

      const payload = parsed.data;
      const now = new Date();

      const [upserted] = await db
        .insert(identityVerifications)
        .values({
          userId,
          documentType: payload.documentType,
          objectKey: payload.objectKey,
          status: "submitted",
          submittedAt: now,
          updatedAt: now,
        } as any)
        .onConflictDoUpdate({
          target: identityVerifications.userId,
          set: {
            documentType: payload.documentType,
            objectKey: payload.objectKey,
            status: "submitted",
            submittedAt: now,
            updatedAt: now,
            reviewedBy: null,
            reviewedAt: null,
            rejectionReason: null,
            adminNotes: null,
          } as any,
        })
        .returning();

      res.json(upserted);
    } catch (error: any) {
      const message = String(error?.message || "");
      const code = String(error?.code || "");
      if (code === "42P01" && message.includes("identity_verifications")) {
        console.warn(
          "[identity-verification] identity_verifications table missing; submit unavailable."
        );
        res.setHeader("X-Data-Disabled", "identity_verifications_missing");
        res.status(503).json({ message: "Identity verification is temporarily unavailable." });
        return;
      }

      if (process.env.NODE_ENV === "production") {
        console.error("[identity-verification] Submit failed in production:", error);
        res.setHeader("X-Data-Disabled", "identity_verifications_unavailable");
        res.status(503).json({ message: "Identity verification is temporarily unavailable." });
        return;
      }

      console.error("Error submitting identity verification:", error);
      res.status(500).json({ message: "Failed to submit identity verification" });
    }
  });

  // Minimal admin review endpoints (UI can be added later).
  app.get(
    "/api/admin/identity-verifications",
    isAuthenticated,
    requireAdmin,
    async (_req: any, res: any) => {
      try {
        const rows = await db
          .select()
          .from(identityVerifications)
          .orderBy(desc(identityVerifications.createdAt))
          .limit(200);
        res.json(rows);
      } catch (error: any) {
        console.error("Error fetching identity verifications:", error);
        res.status(500).json({ message: "Failed to fetch identity verifications" });
      }
    }
  );

  app.post(
    "/api/admin/identity-verifications/:id/review",
    isAuthenticated,
    requireAdmin,
    async (req: any, res: any) => {
      try {
        const id = String(req.params.id || "").trim();
        if (!id) return res.status(400).json({ message: "Missing id" });

        const reviewSchema = z.object({
          status: z.enum(["approved", "rejected"]),
          adminNotes: z.string().max(4000).optional(),
          rejectionReason: z.string().max(500).optional(),
        });
        const parsed = reviewSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid payload", issues: parsed.error.issues });
        }

        const adminId = String(
          (req.user as any)?.id || (req.user as any)?.claims?.sub || ""
        ).trim();
        const now = new Date();

        const [updated] = await db
          .update(identityVerifications)
          .set({
            status: parsed.data.status,
            reviewedBy: adminId || null,
            reviewedAt: now,
            updatedAt: now,
            adminNotes: parsed.data.adminNotes ?? null,
            rejectionReason:
              parsed.data.status === "rejected" ? (parsed.data.rejectionReason ?? null) : null,
          } as any)
          .where(eq(identityVerifications.id, id))
          .returning();

        if (!updated) return res.status(404).json({ message: "Not found" });
        res.json(updated);
      } catch (error: any) {
        console.error("Error reviewing identity verification:", error);
        res.status(500).json({ message: "Failed to review identity verification" });
      }
    }
  );
}
