import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import { buildCountyVaultAllocation } from "../services/countyVaultAllocation";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { getStripeClient } from "../services/stripeClient";

const router = Router();

// ==================== COMMUNITY BUILDER ROUTES ====================

/**
 * GET /api/community-builder/profile
 * Get current user's Community Builder settings
 */
router.get("/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const profile = await storage.getBuilderProfile(userId);

    if (!profile) {
      return res.json(null);
    }

    // Calculate live stats
    const stats = await storage.calculateBuilderStats(profile.id);

    res.json({
      ...profile,
      stats,
    });
  } catch (error) {
    console.error("Error fetching Community Builder settings:", error);
    res.status(500).json({ error: "Failed to fetch Community Builder settings" });
  }
});

/**
 * POST /api/community-builder/profile
 * Create or update Community Builder settings
 */
router.post("/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const { businessName, description, profileImageUrl, website, payoutEmail } = req.body;

    const existingProfile = await storage.getBuilderProfile(userId);

    if (existingProfile) {
      // Update existing Community Builder settings
      const updated = await storage.updateBuilderProfile(existingProfile.id, {
        businessName,
        description,
        profileImageUrl,
        website,
        payoutEmail,
      });
      return res.json(updated);
    }

    // Create new Community Builder record
    const profile = await storage.createBuilderProfile(userId, user.county || "", {
      businessName,
      description,
      profileImageUrl,
      website,
      payoutEmail,
    });

    // Send welcome notification
    await storage.sendBuilderNotification(
      profile.id,
      "profile_created",
      "Welcome to Community Builder!",
      "Your Community Builder badge is active. Start proposing contributions to your county vault.",
      undefined,
      "/community-builder/dashboard"
    );

    res.json(profile);
  } catch (error) {
    console.error("Error saving Community Builder settings:", error);
    res.status(500).json({ error: "Failed to save Community Builder settings" });
  }
});

/**
 * GET /api/community-builder/profile/:builderId
 * Get a specific builder's public Community Builder info
 */
router.get("/profile/:builderId", async (req: Request, res: Response) => {
  try {
    const { builderId } = req.params;
    const profile = await storage.getBuilderById(builderId);

    if (!profile) {
      return res.status(404).json({ error: "Builder not found" });
    }

    // Calculate stats
    const stats = await storage.calculateBuilderStats(builderId);

    res.json({
      ...profile,
      stats,
    });
  } catch (error) {
    console.error("Error fetching builder info:", error);
    res.status(500).json({ error: "Failed to fetch builder info" });
  }
});

// ==================== CONTRIBUTION ROUTES ====================

/**
 * POST /api/community-builder/contributions
 * Propose a new contribution
 */
router.post("/contributions", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const profile = await storage.getBuilderProfile(userId);

    if (!profile) {
      return res.status(403).json({ error: "Not a registered builder" });
    }

    const {
      title,
      description,
      type,
      estimatedValue,
      estimatedHours,
      proposedStartDate,
      proposedEndDate,
      tags,
      impact,
    } = req.body;

    // Validate required fields
    if (!title || !description || !type || !estimatedValue) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const contribution = await storage.proposeContribution(profile.id, {
      countyId: profile.countyId,
      title,
      description,
      type,
      estimatedValue: estimatedValue.toString(),
      estimatedHours: estimatedHours?.toString(),
      proposedStartDate: proposedStartDate ? new Date(proposedStartDate) : undefined,
      proposedEndDate: proposedEndDate ? new Date(proposedEndDate) : undefined,
      tags,
      impact,
    } as any);

    // Notify admins about new contribution
    await storage.sendBuilderNotification(
      profile.id,
      "contribution_proposed",
      "Contribution Proposed",
      `Your contribution "${title}" has been submitted for review.`,
      contribution.id,
      `/community-builder/contributions/${contribution.id}`
    );

    res.status(201).json(contribution);
  } catch (error) {
    console.error("Error creating contribution:", error);
    res.status(500).json({ error: "Failed to create contribution" });
  }
});

/**
 * GET /api/community-builder/contributions
 * Get authenticated builder's contributions
 */
router.get("/contributions", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const profile = await storage.getBuilderProfile(userId);

    if (!profile) {
      return res.status(403).json({ error: "Not a registered builder" });
    }

    const contributions = await storage.getBuilderContributions(profile.id);
    res.json(contributions);
  } catch (error) {
    console.error("Error fetching contributions:", error);
    res.status(500).json({ error: "Failed to fetch contributions" });
  }
});

/**
 * GET /api/community-builder/contributions/:contributionId
 * Get a specific contribution
 */
router.get("/contributions/:contributionId", async (req: Request, res: Response) => {
  try {
    const { contributionId } = req.params;
    const contribution = await storage.getContribution(contributionId);

    if (!contribution) {
      return res.status(404).json({ error: "Contribution not found" });
    }

    // Get audit logs
    const auditLogs = await storage.getAuditLogs(contributionId);

    res.json({
      ...contribution,
      auditLogs,
    });
  } catch (error) {
    console.error("Error fetching contribution:", error);
    res.status(500).json({ error: "Failed to fetch contribution" });
  }
});

/**
 * PUT /api/community-builder/contributions/:contributionId
 * Update a contribution (builder can edit until approved)
 */
router.put("/contributions/:contributionId", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const { contributionId } = req.params;

    const contribution = await storage.getContribution(contributionId);
    if (!contribution) {
      return res.status(404).json({ error: "Contribution not found" });
    }

    // Check ownership
    const profile = await storage.getBuilderById(contribution.builderId);
    if (!profile || profile.userId !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Can only edit if status is 'proposed'
    if (contribution.status !== "proposed") {
      return res.status(400).json({ error: "Can only edit proposed contributions" });
    }

    const {
      title,
      description,
      type,
      estimatedValue,
      estimatedHours,
      proposedStartDate,
      proposedEndDate,
      tags,
      impact,
    } = req.body;

    const updated = await storage.updateContributionStatus(contributionId, "proposed", {
      title: title || contribution.title,
      description: description || contribution.description,
      type: type || contribution.type,
      estimatedValue: estimatedValue?.toString(),
      estimatedHours: estimatedHours?.toString(),
      proposedStartDate: proposedStartDate
        ? new Date(proposedStartDate)
        : contribution.proposedStartDate,
      proposedEndDate: proposedEndDate ? new Date(proposedEndDate) : contribution.proposedEndDate,
      tags,
      impact,
    } as any);

    res.json(updated);
  } catch (error) {
    console.error("Error updating contribution:", error);
    res.status(500).json({ error: "Failed to update contribution" });
  }
});

/**
 * POST /api/community-builder/contributions/:contributionId/evidence
 * Add evidence to a contribution
 */
router.post(
  "/contributions/:contributionId/evidence",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const { contributionId } = req.params;
      const { type, url, description } = (req.body ?? {}) as any;

      const contribution = await storage.getContribution(contributionId);
      if (!contribution) {
        return res.status(404).json({ error: "Contribution not found" });
      }

      // Check ownership
      const profile = await storage.getBuilderById(contribution.builderId);
      if (!profile || profile.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const evidence = contribution.evidence || [];
      evidence.push({
        type,
        url,
        description,
        uploadedAt: new Date().toISOString(),
      });

      const updated = await storage.updateContributionStatus(contributionId, contribution.status, {
        evidence,
      } as any);

      res.json(updated);
    } catch (error) {
      console.error("Error adding evidence:", error);
      res.status(500).json({ error: "Failed to add evidence" });
    }
  }
);

// ==================== COUNTY CONTRIBUTIONS (PUBLIC) ====================

/**
 * GET /api/community-builder/county/:countyId/contributions
 * Get all verified contributions for a county
 */
router.get("/county/:countyId/contributions", async (req: Request, res: Response) => {
  try {
    const { countyId } = req.params;
    const contributions = await storage.getCountyContributions(countyId, "verified");

    res.json(contributions);
  } catch (error) {
    console.error("Error fetching county contributions:", error);
    res.status(500).json({ error: "Failed to fetch contributions" });
  }
});

/**
 * GET /api/community-builder/county/:countyId/leaderboard
 * Get builder leaderboard for a county
 */
router.get("/county/:countyId/leaderboard", async (req: Request, res: Response) => {
  try {
    const { countyId } = req.params;
    const leaderboard = await storage.getLeaderboard(countyId);

    res.json(leaderboard);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

/**
 * GET /api/community-builder/county/:countyId/contributors
 * List county vault contributors tied to user identity, with profile/business context.
 */
router.get("/county/:countyId/contributors", async (req: Request, res: Response) => {
  try {
    const { countyId } = req.params;
    const rawLimit = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(200, rawLimit)) : 50;

    const result = await db.execute(sql`
      with aggregated as (
        select
          a.user_id as user_id,
          coalesce(sum(a.direct_amount::numeric), 0) as direct_total,
          coalesce(sum(a.network_amount::numeric), 0) as network_total,
          max(a.created_at) as last_contribution_at
        from user_county_vault_contribution_adjustments a
        where a.county_id = ${countyId}
        group by a.user_id
      )
      select
        ag.user_id as "userId",
        coalesce(u.first_name, '') as "firstName",
        coalesce(u.last_name, '') as "lastName",
        u.email as "email",
        p.slug as "profileSlug",
        p.display_name as "profileDisplayName",
        b.slug as "businessSlug",
        b.name as "businessName",
        ag.direct_total::text as "directTotal",
        ag.network_total::text as "networkTotal",
        (ag.direct_total + ag.network_total)::text as "totalAmount",
        ag.last_contribution_at as "lastContributionAt"
      from aggregated ag
      left join users u on u.id = ag.user_id
      left join lateral (
        select pr.slug, pr.display_name
        from profiles pr
        where pr.owner_user_id = ag.user_id
          and pr.status = 'published'
        order by pr.updated_at desc
        limit 1
      ) p on true
      left join lateral (
        select bs.slug, bs.name
        from businesses bs
        where bs.owner_user_id = ag.user_id
          and bs.claim_status = 'claimed'
          and bs.status <> 'suspended'
        order by bs.updated_at desc
        limit 1
      ) b on true
      order by (ag.direct_total + ag.network_total) desc, ag.last_contribution_at desc nulls last
      limit ${limit}
    `);

    const rows = (result.rows ?? []) as Array<{
      userId: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      profileSlug: string | null;
      profileDisplayName: string | null;
      businessSlug: string | null;
      businessName: string | null;
      directTotal: string | null;
      networkTotal: string | null;
      totalAmount: string | null;
      lastContributionAt: string | Date | null;
    }>;

    const contributors = rows.map((row) => {
      const fullName = `${row.firstName || ""} ${row.lastName || ""}`.trim();
      const displayName =
        row.profileDisplayName ||
        row.businessName ||
        fullName ||
        row.email ||
        `User ${String(row.userId || "").slice(0, 8)}`;

      return {
        userId: row.userId,
        displayName,
        profileSlug: row.profileSlug || null,
        businessSlug: row.businessSlug || null,
        directTotal: Number(row.directTotal || 0),
        networkTotal: Number(row.networkTotal || 0),
        totalAmount: Number(row.totalAmount || 0),
        lastContributionAt: row.lastContributionAt ? new Date(row.lastContributionAt) : null,
      };
    });

    return res.json(contributors);
  } catch (error) {
    console.error("Error fetching county contributors:", error);
    return res.status(500).json({ error: "Failed to fetch county contributors" });
  }
});

// ==================== NOTIFICATIONS ====================

/**
 * GET /api/community-builder/notifications
 * Get builder notifications
 */
router.get("/notifications", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const profile = await storage.getBuilderProfile(userId);

    if (!profile) {
      return res.status(403).json({ error: "Not a registered builder" });
    }

    const { unreadOnly } = req.query;
    const notifications = await storage.getBuilderNotifications(profile.id, unreadOnly === "true");

    res.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

/**
 * POST /api/community-builder/notifications/:notificationId/read
 * Mark notification as read
 */
router.post(
  "/notifications/:notificationId/read",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const { notificationId } = req.params;

      const profile = await storage.getBuilderProfile(userId);
      if (!profile) {
        return res.status(403).json({ error: "Not a registered builder" });
      }

      const notifications = await storage.getBuilderNotifications(profile.id, false);
      const ownsNotification = notifications.some(
        (notification) => notification.id === notificationId
      );
      if (!ownsNotification) {
        return res.status(404).json({ error: "Notification not found" });
      }

      const updated = await storage.markBuilderNotificationAsRead(notificationId);
      res.json(updated);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  }
);

// ==================== PAYOUT ROUTES ====================

/**
 * POST /api/community-builder/connect/onboard
 * Create or resume Stripe Connect onboarding for a builder (Express).
 */
router.post("/connect/onboard", requireAuth, async (req: Request, res: Response) => {
  try {
    const stripe = getStripeClient();
    if (!stripe) return res.status(400).json({ error: "Stripe not configured" });

    const userId = (req.user as any).id;
    const profile = await storage.getBuilderProfile(userId);
    if (!profile) return res.status(403).json({ error: "Not a registered builder" });

    // Create connected account if none exists; reuse bankAccountId as connected account id slot
    let accountId = profile.bankAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: profile.payoutEmail || undefined,
        metadata: {
          builderId: profile.id,
          countyId: profile.countyId,
        },
      });

      accountId = account.id;
      await storage.updateBuilderProfile(profile.id, { bankAccountId: accountId });
    }

    const refreshUrl = req.body.refreshUrl || req.body.returnUrl || req.body.redirectUrl;
    const returnUrl = req.body.returnUrl || req.body.redirectUrl;

    if (!refreshUrl || !returnUrl) {
      return res.status(400).json({ error: "refreshUrl and returnUrl are required" });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    res.json({ url: link.url, accountId });
  } catch (error) {
    console.error("Error creating connect onboarding link:", error);
    res.status(500).json({ error: "Failed to start onboarding" });
  }
});

/**
 * POST /api/community-builder/checkout-session
 * Create a Stripe Checkout Session with required metadata guarantees.
 */
router.post("/checkout-session", requireAuth, async (req: Request, res: Response) => {
  try {
    const stripe = getStripeClient();
    if (!stripe) return res.status(400).json({ error: "Stripe not configured" });

    const userId = (req.user as any).id;
    const profile = await storage.getBuilderProfile(userId);
    if (!profile) return res.status(403).json({ error: "Not a registered builder" });

    const { contributionId, amount, payoutToVault = true, successUrl, cancelUrl } = req.body;

    if (!contributionId || !amount || !successUrl || !cancelUrl) {
      return res
        .status(400)
        .json({ error: "Missing contributionId, amount, successUrl, or cancelUrl" });
    }

    const contribution = await storage.getContribution(contributionId);
    if (!contribution || contribution.builderId !== profile.id) {
      return res.status(404).json({ error: "Contribution not found or not owned by builder" });
    }

    // Enforce required metadata for webhook processing
    const metadata = {
      contributionId,
      builderId: profile.id,
      countyId: profile.countyId,
      amount: amount.toString(),
      payoutToVault: payoutToVault ? "true" : "false",
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      currency: "usd",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: contribution.title,
              description:
                contribution.description?.slice(0, 120) || "Community Builder contribution",
            },
            unit_amount: Math.round(parseFloat(amount) * 100),
          },
          quantity: 1,
        },
      ],
      metadata,
    });

    res.json({ url: session.url, id: session.id });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

/**
 * GET /api/community-builder/payouts
 * Get builder's payouts
 */
router.get("/payouts", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const profile = await storage.getBuilderProfile(userId);

    if (!profile) {
      return res.status(403).json({ error: "Not a registered builder" });
    }

    const payouts = await storage.getBuilderPayouts(profile.id);
    res.json(payouts);
  } catch (error) {
    console.error("Error fetching payouts:", error);
    res.status(500).json({ error: "Failed to fetch payouts" });
  }
});

// ==================== PUBLIC TRANSPARENCY ROUTES ====================

/**
 * GET /api/community-builder/county/:countyId/vault
 * Get public county vault information (transparency)
 */
router.get("/county/:countyId/vault", async (req: Request, res: Response) => {
  try {
    const { countyId } = req.params;

    const vaultSnapshot = await storage.getCountyVaultSnapshot({ countyId });

    res.json({
      countyId,
      currentBalance: vaultSnapshot.vault?.currentBalance || "0",
      totalInflow: vaultSnapshot.vault?.lifetimeInflow || "0",
      totalOutflow: vaultSnapshot.vault?.lifetimeOutflow || "0",
      allocation: buildCountyVaultAllocation(Number(vaultSnapshot.vault?.currentBalance ?? 0)),
      createdAt: vaultSnapshot.vault?.createdAt || new Date(),
      updatedAt: vaultSnapshot.vault?.updatedAt || new Date(),
    });
  } catch (error) {
    console.error("Error fetching county vault:", error);
    res.status(500).json({ error: "Failed to fetch county vault" });
  }
});

/**
 * GET /api/community-builder/county/:countyId/ledger
 * Get public county ledger entries (transparency)
 */
router.get("/county/:countyId/ledger", async (req: Request, res: Response) => {
  try {
    const { countyId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    // Get vault for this county
    const vaultSnapshot = await storage.getCountyVaultSnapshot({ countyId });

    // Get ledger entries
    if (!vaultSnapshot.vault) {
      return res.status(404).json({ error: "County vault not found" });
    }
    const entries = await storage.getVaultLedgerEntries(vaultSnapshot.vault.id, limit);

    res.json(entries);
  } catch (error) {
    console.error("Error fetching county ledger:", error);
    res.status(500).json({ error: "Failed to fetch county ledger" });
  }
});

/**
 * GET /api/community-builder/county/:countyId/top-contributions
 * Get top verified contributions for a county (transparency)
 */
router.get("/county/:countyId/top-contributions", async (req: Request, res: Response) => {
  try {
    const { countyId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const allContributions = await storage.getCountyContributions(countyId, "verified");

    // Sort by actual value (highest first)
    const sorted = allContributions
      .filter((c) => c.actualValue)
      .sort((a, b) => parseFloat(b.actualValue!) - parseFloat(a.actualValue!))
      .slice(0, limit);

    // Enrich with builder info
    const enriched = await Promise.all(
      sorted.map(async (contribution) => {
        const builder = await storage.getBuilderById(contribution.builderId);
        return {
          ...contribution,
          builderName: builder?.businessName || "Unknown",
          builderRank: builder?.currentRank || "unranked",
        };
      })
    );

    res.json(enriched);
  } catch (error) {
    console.error("Error fetching top contributions:", error);
    res.status(500).json({ error: "Failed to fetch top contributions" });
  }
});

export default router;
