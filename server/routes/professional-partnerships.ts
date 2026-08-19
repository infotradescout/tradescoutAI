import type { Express } from "express";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { professionalPartnerships, users } from "../../shared/schema";
import { isAuthenticated, requireAdmin } from "../auth";
import { db } from "../db";
import { getManagedPartnerProfileHealth } from "../services/managedPartnerProfileHealth";

export function registerProfessionalPartnershipRoutes(app: Express): void {
  // ==================== MANAGED PARTNER OPERATIONS ====================

  app.get(
    "/api/admin/managed-partners",
    isAuthenticated,
    requireAdmin,
    async (_req: any, res: any) => {
      try {
        const report = await getManagedPartnerProfileHealth();
        res.setHeader("Cache-Control", "no-store");
        return res.json(report);
      } catch (error: any) {
        console.error("Error auditing managed partner profiles:", error);
        return res.status(500).json({ message: "Failed to audit managed partner profiles" });
      }
    }
  );

  // ==================== PROFESSIONAL PARTNERSHIPS ====================

  // Request partnership between professionals (dealers, contractors, realtors)
  app.post("/api/partnerships/request", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const { partnerId, partnershipType, referralTerms, partnershipDescription } = req.body;

      if (!partnerId || !partnershipType) {
        return res.status(400).json({ message: "Partner ID and partnership type are required" });
      }

      const existing = await db
        .select()
        .from(professionalPartnerships)
        .where(
          and(
            or(
              and(
                eq(professionalPartnerships.initiatorId, String(userId)),
                eq(professionalPartnerships.partnerId, String(partnerId))
              ),
              and(
                eq(professionalPartnerships.initiatorId, String(partnerId)),
                eq(professionalPartnerships.partnerId, String(userId))
              )
            ),
            or(
              eq(professionalPartnerships.status, "pending"),
              eq(professionalPartnerships.status, "active")
            )
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return res.status(409).json({ message: "Partnership already exists for this pair" });
      }

      const [partnership] = await db
        .insert(professionalPartnerships)
        .values({
          initiatorId: String(userId),
          partnerId: String(partnerId),
          partnershipType,
          referralTerms: referralTerms ?? null,
          partnershipDescription: partnershipDescription ?? null,
          status: "pending",
        } as any)
        .returning();

      res.status(201).json(partnership);
    } catch (error: any) {
      console.error("Error creating partnership:", error);
      res.status(500).json({ message: "Failed to create partnership request" });
    }
  });

  // Get user's partnerships
  app.get("/api/partnerships/my", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const rows = await db
        .select()
        .from(professionalPartnerships)
        .where(
          or(
            eq(professionalPartnerships.initiatorId, String(userId)),
            eq(professionalPartnerships.partnerId, String(userId))
          )
        )
        .orderBy(desc(professionalPartnerships.createdAt))
        .limit(200);

      return res.json(rows);
    } catch (error: any) {
      console.error("Error fetching partnerships:", error);
      res.status(500).json({ message: "Failed to fetch partnerships" });
    }
  });

  // Find potential partners by role
  app.get("/api/partnerships/find/:role", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      const { role } = req.params;
      const targetRole = String(role || "").trim();
      if (!targetRole) {
        return res.status(400).json({ message: "Role is required" });
      }

      const candidates = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          county: users.county,
          state: users.state,
          city: users.city,
          profileImageUrl: users.profileImageUrl,
        })
        .from(users)
        .where(and(eq(users.role, targetRole as any), sql`${users.id} <> ${String(userId)}`))
        .orderBy(desc(users.createdAt))
        .limit(50);

      res.json(candidates);
    } catch (error: any) {
      console.error("Error finding potential partners:", error);
      res.status(500).json({ message: "Failed to find potential partners" });
    }
  });
}
