import type { Express } from "express";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { professionalPartnerships, users } from "../../shared/schema";
import { isAuthenticated, requireAdmin } from "../auth";
import { db } from "../db";
import {
  createManagedPartnerIntake,
  getRuntimeManagedPartnerProfileDefinitions,
  listManagedPartnerIntakes,
  updateManagedPartnerIntake,
} from "../services/managedPartnerIntake";
import { normalizeManagedPartnerContact } from "../services/jwStoneManagedContactProvisioning";
import { getRuntimeManagedPartnerProfileHealth } from "../services/runtimeManagedPartnerProfileHealth";

function authenticatedUserId(req: any): string {
  return String(req.user?.claims?.sub || req.user?.id || "").trim();
}

function intakeErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("not found")) return 404;
  if (message.includes("already in use")) return 409;
  if (
    message.includes("required") ||
    message.includes("invalid") ||
    message.includes("not supported") ||
    message.includes("must") ||
    message.includes("could not be created")
  ) {
    return 400;
  }
  return 500;
}

async function normalizePromotedManagedContact(record: {
  slug: string | null;
  stage: string;
  contactMode: string;
}): Promise<string[]> {
  if (
    record.stage !== "live" ||
    record.contactMode !== "tradescout_managed" ||
    !record.slug
  ) {
    return [];
  }

  try {
    const definitions = await getRuntimeManagedPartnerProfileDefinitions();
    const definition = definitions.find((entry) => entry.slug === record.slug);
    if (!definition) {
      return ["The profile is live, but its managed-contact definition is not available yet."];
    }
    await normalizeManagedPartnerContact(definition);
    return [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[managed-partner-intake] ${record.slug} contact normalization failed`,
      error
    );
    return [
      `The intake is live, but managed contact needs attention: ${message}`,
    ];
  }
}

export function registerProfessionalPartnershipRoutes(app: Express): void {
  // ==================== MANAGED PARTNER OPERATIONS ====================

  app.get(
    "/api/admin/managed-partners",
    isAuthenticated,
    requireAdmin,
    async (_req: any, res: any) => {
      try {
        const report = await getRuntimeManagedPartnerProfileHealth();
        res.setHeader("Cache-Control", "no-store");
        return res.json(report);
      } catch (error: any) {
        console.error("Error auditing managed partner profiles:", error);
        return res.status(500).json({ message: "Failed to audit managed partner profiles" });
      }
    }
  );

  app.get(
    "/api/admin/managed-partner-intakes",
    isAuthenticated,
    requireAdmin,
    async (req: any, res: any) => {
      try {
        const report = await listManagedPartnerIntakes({
          includeArchived: String(req.query?.includeArchived || "") === "true",
        });
        res.setHeader("Cache-Control", "no-store");
        return res.json(report);
      } catch (error: any) {
        console.error("Error listing managed partner intakes:", error);
        return res.status(500).json({ message: "Failed to load managed partner intake queue" });
      }
    }
  );

  app.post(
    "/api/admin/managed-partner-intakes",
    isAuthenticated,
    requireAdmin,
    async (req: any, res: any) => {
      const actorUserId = authenticatedUserId(req);
      if (!actorUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      try {
        const item = await createManagedPartnerIntake({
          input: req.body || {},
          actorUserId,
        });
        const warnings = await normalizePromotedManagedContact(item);
        return res.status(201).json({ item, warnings });
      } catch (error: unknown) {
        const status = intakeErrorStatus(error);
        const message = error instanceof Error ? error.message : "Failed to create partner intake";
        console.error("Error creating managed partner intake:", error);
        return res.status(status).json({ message });
      }
    }
  );

  app.patch(
    "/api/admin/managed-partner-intakes/:id",
    isAuthenticated,
    requireAdmin,
    async (req: any, res: any) => {
      const actorUserId = authenticatedUserId(req);
      if (!actorUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      try {
        const item = await updateManagedPartnerIntake({
          id: String(req.params?.id || ""),
          input: req.body || {},
          actorUserId,
        });
        const warnings = await normalizePromotedManagedContact(item);
        return res.json({ item, warnings });
      } catch (error: unknown) {
        const status = intakeErrorStatus(error);
        const message = error instanceof Error ? error.message : "Failed to update partner intake";
        console.error("Error updating managed partner intake:", error);
        return res.status(status).json({ message });
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
