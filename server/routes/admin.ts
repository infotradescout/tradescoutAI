import type { Request, Response } from "express";
import { isAuthenticated, isSuperAdmin, requireAdmin, isAdmin } from "../auth";
import { storage } from "../storage";
import { db } from "../db";
import {
  affiliateAccounts,
  users,
  type AffiliateAccount,
  type AffiliateReferral,
  type AffiliatePayout,
} from "../../shared/schema";
import { eq, desc } from "drizzle-orm";

/**
 * Admin OS routes: health and high-level telemetry endpoints.
 *
 * URLs and behavior are preserved exactly from the legacy routes.ts
 * implementation; only the registration location has changed.
 */
export function mountAdminRoutes(app: any) {
  // ---------------------------------------------------------------------------
  // Super Admin OS Health
  // ---------------------------------------------------------------------------
  // Super admin health check / OS gate
  app.get(
    "/api/admin/health",
    isAuthenticated,
    isSuperAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub || null;
        const user = userId ? await storage.getUser(userId) : null;

        const primaryRole = (user as any)?.role ?? null;

        res.json({
          ok: true,
          userId,
          role: primaryRole,
          isSuperAdmin: true,
        });
      } catch (error: any) {
        console.error("Error in /api/admin/health:", error);
        res.status(500).json({ message: "Failed to resolve admin health" });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Admin locality heatmap (same behavior as legacy, with role checks)
  // ---------------------------------------------------------------------------
  app.get("/api/admin/heatmap", isAuthenticated, async (req: Request & { user?: any }, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      const user = await storage.getUser(userId);

      if (!user || !["head_admin", "moderator", "ops_admin"].includes(user.role || "")) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const timeframe = (req.query.timeframe as string) || "30d";
      const days = timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 90;

      const heatmapData = await storage.getLocalityHeatmapData(days);

      res.json(heatmapData);
    } catch (error: any) {
      console.error("Error fetching heatmap data:", error);
      res.status(500).json({ message: "Failed to fetch heatmap data" });
    }
  });

  // ---------------------------------------------------------------------------
  // Feature Flags & Admin User Management
  // ---------------------------------------------------------------------------
  app.get("/api/admin/feature-flags", isAuthenticated, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const features = await storage.getFeatureFlags();
      res.json(features);
    } catch (error: any) {
      console.error("Error fetching feature flags:", error);
      res.status(500).json({ message: "Failed to fetch feature flags" });
    }
  });

  app.post("/api/admin/feature-flags", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const feature = await storage.createFeatureFlag(req.body);
      res.json(feature);
    } catch (error: any) {
      console.error("Error creating feature flag:", error);
      res.status(500).json({ message: "Failed to create feature flag" });
    }
  });

  app.patch(
    "/api/admin/feature-flags/:id",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const feature = await storage.updateFeatureFlag(id, req.body);
        res.json(feature);
      } catch (error: any) {
        console.error("Error updating feature flag:", error);
        res.status(500).json({ message: "Failed to update feature flag" });
      }
    }
  );

  // User Management API Routes
  app.get("/api/admin/users", isAuthenticated, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          roles: users.roles,
          activeRole: users.activeRole,
          badges: users.badges,
          profileImageUrl: users.profileImageUrl,
          emailVerified: users.emailVerified,
          addressVerified: users.addressVerified,
          createdAt: users.createdAt,
          facebookId: users.facebookId,
          provider: users.provider,
        })
        .from(users)
        .orderBy(desc(users.createdAt));

      res.json(allUsers);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch(
    "/api/admin/users/:userId/roles",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { userId } = req.params;
        const { roles, activeRole } = (req.body || {}) as any;

        if (!Array.isArray(roles) || roles.length === 0) {
          return res.status(400).json({ message: "Roles must be a non-empty array" });
        }

        if (!activeRole || !roles.includes(activeRole)) {
          return res.status(400).json({ message: "Active role must be one of the assigned roles" });
        }

        await db
          .update(users)
          .set({
            roles,
            activeRole,
            role: activeRole,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));

        res.json({ message: "User roles updated successfully" });
      } catch (error: any) {
        console.error("Error updating user roles:", error);
        res.status(500).json({ message: "Failed to update user roles" });
      }
    }
  );

  app.patch(
    "/api/admin/users/:userId/badges",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { userId } = req.params;
        const { badges } = (req.body || {}) as any;

        if (!Array.isArray(badges)) {
          return res.status(400).json({ message: "Badges must be an array" });
        }

        await db
          .update(users)
          .set({ badges, updatedAt: new Date() })
          .where(eq(users.id, userId));

        res.json({ message: "Badges updated successfully", badges });
      } catch (error: any) {
        console.error("Error updating user badges:", error);
        res.status(500).json({ message: "Failed to update user badges" });
      }
    }
  );

  app.post(
    "/api/admin/users/:userId/impersonate",
    isAuthenticated,
    requireAdmin,
    async (req: Request & { user?: any }, res: Response) => {
      try {
        const { userId } = req.params;

        const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
        if (!targetUser) {
          return res.status(404).json({ message: "User not found" });
        }

        const originalUser = req.user;

        req.user = {
          id: targetUser.id,
          email: targetUser.email,
          role: targetUser.activeRole || targetUser.role,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName,
          profileImageUrl: targetUser.profileImageUrl,
          roles: targetUser.roles || [targetUser.role],
          activeRole: targetUser.activeRole || targetUser.role,
          impersonating: true,
          originalAdminId: (originalUser as any)?.id,
        };

        res.json({
          message: "Impersonation active",
          user: req.user,
          originalAdmin: originalUser,
        });
      } catch (error: any) {
        console.error("Error impersonating user:", error);
        res.status(500).json({ message: "Failed to impersonate user" });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Admin Affiliate Management (super_admin / admin only)
  // ---------------------------------------------------------------------------
  app.get("/api/admin/affiliates", isAuthenticated, isAdmin, async (req: Request & { user?: any }, res: Response) => {
    try {
      const rows = await db
        .select({
          id: affiliateAccounts.id,
          affiliateId: affiliateAccounts.affiliateId,
          status: affiliateAccounts.status,
          lifetimeEarned: affiliateAccounts.lifetimeEarned,
          available: affiliateAccounts.available,
          pending: affiliateAccounts.pending,
          referralCode: affiliateAccounts.referralCode,
          commissionRate: affiliateAccounts.commissionRate,
          createdAt: affiliateAccounts.createdAt,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(affiliateAccounts)
        .leftJoin(users, eq(affiliateAccounts.affiliateId, users.id))
        .orderBy(desc(affiliateAccounts.createdAt));

      const payload = rows.map((row) => ({
        id: row.id,
        affiliateId: row.affiliateId,
        email: row.email ?? undefined,
        name: `${row.firstName || ""} ${row.lastName || ""}`.trim() || undefined,
        status: row.status ?? undefined,
        lifetimeEarned: String(row.lifetimeEarned ?? "0"),
        available: String(row.available ?? "0"),
        pending: String(row.pending ?? "0"),
        referralCode: row.referralCode ?? undefined,
        commissionRate: row.commissionRate != null ? String(row.commissionRate) : undefined,
        createdAt: (row.createdAt as Date | null)?.toISOString?.() || new Date().toISOString(),
      }));

      res.json(payload);
    } catch (error: any) {
      console.error("Error listing affiliates:", error);
      res.status(500).json({ message: "Failed to load affiliates" });
    }
  });

  app.put(
    "/api/admin/affiliates/:id/commission-rate",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { commissionRate } = (req.body || {}) as any;

        if (commissionRate === undefined || commissionRate === null || commissionRate === "") {
          return res.status(400).json({ message: "commissionRate is required" });
        }

        const numeric = Number(commissionRate);
        if (!Number.isFinite(numeric) || numeric <= 0 || numeric >= 1) {
          return res.status(400).json({
            message: "commissionRate must be a decimal between 0 and 1 (e.g. 0.05 for 5%)",
          });
        }

        const [updated] = await db
          .update(affiliateAccounts)
          .set({ commissionRate: numeric.toString() })
          .where(eq(affiliateAccounts.id, id))
          .returning();

        if (!updated) {
          return res.status(404).json({ message: "Affiliate program not found" });
        }

        res.json({
          id: updated.id,
          commissionRate: updated.commissionRate,
        });
      } catch (error: any) {
        console.error("Error updating affiliate commission rate:", error);
        res.status(500).json({ message: "Failed to update commission rate" });
      }
    }
  );

  app.get(
    "/api/admin/affiliates/:id/detail",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const affiliateId = req.params.id;
        const account = ([] as AffiliateAccount[]).find((a) => a.id === affiliateId);
        if (!account) return res.status(404).json({ message: "Affiliate not found" });

        const referrals = ([] as AffiliateReferral[]).filter((r) => r.affiliateId === affiliateId);
        const payouts = ([] as AffiliatePayout[]).filter((p) => p.affiliateId === affiliateId);

        res.json({ account, referrals, payouts });
      } catch (error: any) {
        console.error("Error loading affiliate detail:", error);
        res.status(500).json({ message: "Failed to load affiliate detail" });
      }
    }
  );

  app.post(
    "/api/admin/affiliates/:id/payout",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const affiliateId = req.params.id;
        const { amount, method, note } = (req.body || {}) as any;
        if (!amount) return res.status(400).json({ message: "amount is required" });

        const payout: AffiliatePayout = {
          id: "stub-payout-id",
          affiliateId,
          payoutAmount: amount,
          status: "pending",
          method: (method as any) || "manual",
          note: (note as any) || null,
          createdAt: new Date(),
        } as AffiliatePayout;

        res.json(payout);
      } catch (error: any) {
        console.error("Error creating admin payout:", error);
        res.status(500).json({ message: "Failed to create payout" });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Site Settings, Prize Configurations, and Advertisements
  // ---------------------------------------------------------------------------
  app.get("/api/admin/site-settings", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { category } = req.query as any;
      const settings = await storage.getSiteSettings(category as string);
      res.json(settings);
    } catch (error: any) {
      console.error("Error fetching site settings:", error);
      res.status(500).json({ message: "Failed to fetch site settings" });
    }
  });

  app.post("/api/admin/site-settings", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const setting = await storage.createSiteSetting(req.body);
      res.json(setting);
    } catch (error: any) {
      console.error("Error creating site setting:", error);
      res.status(500).json({ message: "Failed to create site setting" });
    }
  });

  app.put("/api/admin/site-settings/:id", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const setting = await storage.updateSiteSetting(req.params.id, req.body);
      res.json(setting);
    } catch (error: any) {
      console.error("Error updating site setting:", error);
      res.status(500).json({ message: "Failed to update site setting" });
    }
  });

  app.delete("/api/admin/site-settings/:id", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteSiteSetting(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting site setting:", error);
      res.status(500).json({ message: "Failed to delete site setting" });
    }
  });

  app.get("/api/admin/prizes", isAuthenticated, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const prizes = await storage.getPrizeConfigurations();
      res.json(prizes);
    } catch (error: any) {
      console.error("Error fetching prizes:", error);
      res.status(500).json({ message: "Failed to fetch prizes" });
    }
  });

  app.post("/api/admin/prizes", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const prize = await storage.createPrizeConfiguration(req.body);
      res.json(prize);
    } catch (error: any) {
      console.error("Error creating prize:", error);
      res.status(500).json({ message: "Failed to create prize" });
    }
  });

  app.put("/api/admin/prizes/:id", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const prize = await storage.updatePrizeConfiguration(req.params.id, req.body);
      res.json(prize);
    } catch (error: any) {
      console.error("Error updating prize:", error);
      res.status(500).json({ message: "Failed to update prize" });
    }
  });

  app.delete("/api/admin/prizes/:id", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deletePrizeConfiguration(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting prize:", error);
      res.status(500).json({ message: "Failed to delete prize" });
    }
  });

  app.get("/api/admin/advertisements", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { placement } = req.query as any;
      const ads = await storage.getAdvertisements(placement as string);
      res.json(ads);
    } catch (error: any) {
      console.error("Error fetching advertisements:", error);
      res.status(500).json({ message: "Failed to fetch advertisements" });
    }
  });

  app.post("/api/admin/advertisements", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const ad = await storage.createAdvertisement(req.body);
      res.json(ad);
    } catch (error: any) {
      console.error("Error creating advertisement:", error);
      res.status(500).json({ message: "Failed to create advertisement" });
    }
  });

  app.put("/api/admin/advertisements/:id", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const ad = await storage.updateAdvertisement(req.params.id, req.body);
      res.json(ad);
    } catch (error: any) {
      console.error("Error updating advertisement:", error);
      res.status(500).json({ message: "Failed to update advertisement" });
    }
  });

  app.delete("/api/admin/advertisements/:id", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteAdvertisement(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting advertisement:", error);
      res.status(500).json({ message: "Failed to delete advertisement" });
    }
  });
}
