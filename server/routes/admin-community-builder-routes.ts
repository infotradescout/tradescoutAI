import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { requireAuth, requireAdmin } from '../auth';

const router = Router();

// Middleware to ensure admin access
const requireCBAdmin = [requireAuth, requireAdmin];

// ==================== CONTRIBUTION APPROVAL & VERIFICATION ====================

/**
 * GET /api/admin/community-builder/contributions/pending
 * Get pending contributions for approval
 */
router.get('/contributions/pending', requireCBAdmin, async (req: Request, res: Response) => {
  try {
    const { countyId } = req.query;
    
    if (!countyId) {
      return res.status(400).json({ error: 'countyId required' });
    }

    const contributions = await storage.getCountyContributions(countyId as string, 'pending_approval');
    res.json(contributions);
  } catch (error) {
    console.error('Error fetching pending contributions:', error);
    res.status(500).json({ error: 'Failed to fetch contributions' });
  }
});

/**
 * POST /api/admin/community-builder/contributions/:contributionId/approve
 * Approve a contribution
 */
router.post('/contributions/:contributionId/approve', requireCBAdmin, async (req: Request, res: Response) => {
  try {
    const adminUserId = (req.user as any).id;
    const { contributionId } = req.params;
      const { notes } = (req.body ?? {}) as any;

    const contribution = await storage.approveContribution(contributionId, adminUserId);

    // Create audit log
    await storage.createAuditLog({
      contributionId,
      auditorId: adminUserId,
      action: 'approved',
      notes,
    });

    // Notify builder
    const builder = await storage.getBuilderById(contribution.builderId);
    if (builder) {
      await storage.sendBuilderNotification(
        builder.id,
        'contribution_approved',
        'Contribution Approved',
        `Your contribution "${contribution.title}" has been approved. You can now execute it.`,
        contributionId,
        `/community-builder/contributions/${contributionId}`
      );
    }

    res.json(contribution);
  } catch (error) {
    console.error('Error approving contribution:', error);
    res.status(500).json({ error: 'Failed to approve contribution' });
  }
});

/**
 * POST /api/admin/community-builder/contributions/:contributionId/reject
 * Reject a contribution
 */
router.post('/contributions/:contributionId/reject', requireCBAdmin, async (req: Request, res: Response) => {
  try {
    const adminUserId = (req.user as any).id;
    const { contributionId } = req.params;
      const { reason } = (req.body ?? {}) as any;

    const contribution = await storage.updateContributionStatus(contributionId, 'cancelled', {
      disputeReason: reason,
    } as any);

    // Create audit log
    await storage.createAuditLog({
      contributionId,
      auditorId: adminUserId,
      action: 'rejected',
      adjustmentReason: reason,
    });

    // Notify builder
    const builder = await storage.getBuilderById(contribution.builderId);
    if (builder) {
      await storage.sendBuilderNotification(
        builder.id,
        'contribution_rejected',
        'Contribution Not Approved',
        `Your contribution "${contribution.title}" was not approved. Reason: ${reason}`,
        contributionId,
        `/community-builder/contributions/${contributionId}`
      );
    }

    res.json(contribution);
  } catch (error) {
    console.error('Error rejecting contribution:', error);
    res.status(500).json({ error: 'Failed to reject contribution' });
  }
});

/**
 * POST /api/admin/community-builder/contributions/:contributionId/verify
 * Verify a completed contribution and lock in value
 */
router.post('/contributions/:contributionId/verify', requireCBAdmin, async (req: Request, res: Response) => {
  try {
    const adminUserId = (req.user as any).id;
    const { contributionId } = req.params;
      const { actualValue, actualHours, notes } = (req.body ?? {}) as any;

    const contribution = await storage.verifyContribution(
      contributionId,
      adminUserId,
      actualValue?.toString(),
      actualHours?.toString()
    );

    // Create audit log
    await storage.createAuditLog({
      contributionId,
      auditorId: adminUserId,
      action: 'verified',
      originalValue: contribution.estimatedValue?.toString(),
      adjustedValue: actualValue?.toString(),
      adjustmentReason: actualValue !== contribution.estimatedValue ? 'Value adjusted during verification' : undefined,
      notes,
    });

    // Update Community Builder stats
    const builder = await storage.getBuilderById(contribution.builderId);
    if (builder) {
      const stats = await storage.calculateBuilderStats(builder.id);
      const totalValue = stats.totalValue;
      
      // Update rank based on total value
      let newRank = builder.currentRank;
      const value = parseFloat(totalValue);
      if (value >= 100000) newRank = 'diamond';
      else if (value >= 25000) newRank = 'platinum';
      else if (value >= 5000) newRank = 'gold';
      else if (value >= 1000) newRank = 'silver';
      else if (value >= 1) newRank = 'bronze';

      await storage.updateBuilderProfile(builder.id, {
        currentRank: newRank,
        totalContributionValue: totalValue,
        totalHoursDonated: stats.totalHours,
        completedContributionsCount: stats.completedCount,
      } as any);

      // Notify builder
      await storage.sendBuilderNotification(
        builder.id,
        'contribution_verified',
        'Contribution Verified',
        `Your contribution "${contribution.title}" has been verified and locked in. Value: $${actualValue}`,
        contributionId,
        `/community-builder/contributions/${contributionId}`
      );
    }

    res.json(contribution);
  } catch (error) {
    console.error('Error verifying contribution:', error);
    res.status(500).json({ error: 'Failed to verify contribution' });
  }
});

// ==================== PAYOUT MANAGEMENT ====================

/**
 * GET /api/admin/community-builder/payouts/pending
 * Get pending payouts for processing
 */
router.get('/payouts/pending', requireCBAdmin, async (req: Request, res: Response) => {
  try {
    // This would need a storage method for pending payouts by status
    // For now, we'll return an empty result
    res.json([]);
  } catch (error) {
    console.error('Error fetching pending payouts:', error);
    res.status(500).json({ error: 'Failed to fetch payouts' });
  }
});

/**
 * POST /api/admin/community-builder/payouts
 * Create a payout for a builder
 */
router.post('/payouts', requireCBAdmin, async (req: Request, res: Response) => {
  try {
    const adminUserId = (req.user as any).id;
      const { builderId, amount, payoutType, relatedContributionIds } = (req.body ?? {}) as any;

    const builder = await storage.getBuilderById(builderId);
    if (!builder) {
      return res.status(404).json({ error: 'Builder not found' });
    }

    const payout = await storage.recordPayout({
      builderId,
      countyId: builder.countyId,
      amount: amount.toString(),
      payoutType,
      relatedContributionIds,
      createdBy: adminUserId,
    } as any);

    // Notify builder
    await storage.sendBuilderNotification(
      builderId,
      'payout_scheduled',
      'Payout Scheduled',
      `A payout of $${amount} has been scheduled for you.`,
      payout.id,
      '/community-builder/payouts'
    );

    res.json(payout);
  } catch (error) {
    console.error('Error creating payout:', error);
    res.status(500).json({ error: 'Failed to create payout' });
  }
});

/**
 * POST /api/admin/community-builder/payouts/:payoutId/process
 * Mark a payout as processed (sent to builder)
 */
router.post('/payouts/:payoutId/process', requireCBAdmin, async (req: Request, res: Response) => {
  try {
    const adminUserId = (req.user as any).id;
    const { payoutId } = req.params;
      const { transactionId, externalPaymentId } = (req.body ?? {}) as any;

    const payout = await storage.updateBuilderPayoutStatus(payoutId, 'completed', {
      transactionId,
      externalPaymentId,
      approvedBy: adminUserId,
      approvedAt: new Date(),
    } as any);

    // Notify builder
    const builder = await storage.getBuilderById(payout.builderId);
    if (builder) {
      await storage.sendBuilderNotification(
        builder.id,
        'payout_completed',
        'Payout Processed',
        `Your payout of $${payout.amount} has been processed and sent to your account.`,
        payoutId,
        '/community-builder/payouts'
      );
    }

    res.json(payout);
  } catch (error) {
    console.error('Error processing payout:', error);
    res.status(500).json({ error: 'Failed to process payout' });
  }
});

/**
 * POST /api/admin/community-builder/payouts/:payoutId/fail
 * Mark a payout as failed
 */
router.post('/payouts/:payoutId/fail', requireCBAdmin, async (req: Request, res: Response) => {
  try {
    const { payoutId } = req.params;
      const { failureReason } = (req.body ?? {}) as any;

    const payout = await storage.updateBuilderPayoutStatus(payoutId, 'failed', {
      failureReason,
    } as any);

    // Notify builder
    const builder = await storage.getBuilderById(payout.builderId);
    if (builder) {
      await storage.sendBuilderNotification(
        builder.id,
        'payout_failed',
        'Payout Failed',
        `Your payout of $${payout.amount} failed to process. Reason: ${failureReason}`,
        payoutId,
        '/community-builder/payouts'
      );
    }

    res.json(payout);
  } catch (error) {
    console.error('Error failing payout:', error);
    res.status(500).json({ error: 'Failed to fail payout' });
  }
});

// ==================== BUILDER MANAGEMENT ====================

/**
 * GET /api/admin/community-builder/builders
 * Get all builders for admin management
 */
router.get('/builders', requireCBAdmin, async (req: Request, res: Response) => {
  try {
    const { countyId } = req.query;
    
    if (!countyId) {
      return res.status(400).json({ error: 'countyId required' });
    }

    // Get all builders filtered by county
    const builders = await storage.getBuildersByCounty(countyId as string);
    
    // Enrich with stats for each builder
    const buildersWithStats = await Promise.all(
      builders.map(async (builder: any) => {
        const stats = await storage.calculateBuilderStats(builder.id);
        return {
          ...builder,
          stats,
        };
      })
    );

    res.json(buildersWithStats);
  } catch (error) {
    console.error('Error fetching builders:', error);
    res.status(500).json({ error: 'Failed to fetch builders' });
  }
});

/**
 * POST /api/admin/community-builder/builders/:builderId/suspend
 * Suspend a builder
 */
router.post('/builders/:builderId/suspend', requireCBAdmin, async (req: Request, res: Response) => {
  try {
    const { builderId } = req.params;
      const { reason } = (req.body ?? {}) as any;

    const builder = await storage.updateBuilderProfile(builderId, {
      status: 'suspended',
      suspensionReason: reason,
      suspendedAt: new Date(),
    } as any);

    // Notify builder
    await storage.sendBuilderNotification(
      builderId,
      'account_suspended',
      'Account Suspended',
      `Your Community Builder account has been suspended. Reason: ${reason}`
    );

    res.json(builder);
  } catch (error) {
    console.error('Error suspending builder:', error);
    res.status(500).json({ error: 'Failed to suspend builder' });
  }
});

/**
 * POST /api/admin/community-builder/builders/:builderId/unsuspend
 * Unsuspend a builder
 */
router.post('/builders/:builderId/unsuspend', requireCBAdmin, async (req: Request, res: Response) => {
  try {
    const { builderId } = req.params;

    const builder = await storage.updateBuilderProfile(builderId, {
      status: 'active',
      suspensionReason: null,
      suspendedAt: null,
    } as any);

    // Notify builder
    await storage.sendBuilderNotification(
      builderId,
      'account_restored',
      'Account Restored',
      'Your Community Builder account has been restored.'
    );

    res.json(builder);
  } catch (error) {
    console.error('Error unsuspending builder:', error);
    res.status(500).json({ error: 'Failed to unsuspend builder' });
  }
});

// ==================== AUDIT & REPORTING ====================

/**
 * GET /api/admin/community-builder/audit-logs/:contributionId
 * Get audit logs for a contribution
 */
router.get('/audit-logs/:contributionId', requireCBAdmin, async (req: Request, res: Response) => {
  try {
    const { contributionId } = req.params;
    const logs = await storage.getAuditLogs(contributionId);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

/**
 * GET /api/admin/community-builder/county/:countyId/stats
 * Get Community Builder stats for a county
 */
router.get('/county/:countyId/stats', requireCBAdmin, async (req: Request, res: Response) => {
  try {
    const { countyId } = req.params;
    
    // This would need more storage methods to calculate comprehensive stats
    // For now, returning basic structure
    const stats = {
      totalBuilders: 0,
      totalContributions: 0,
      totalValue: '$0',
      totalHours: 0,
      verifiedContributions: 0,
      pendingApproval: 0,
      totalPayouts: '$0',
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching county stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/admin/community-builder/reconciliation
 * Get vault reconciliation data across all counties
 */
router.get('/reconciliation', requireCBAdmin, async (req: Request, res: Response) => {
  try {
    const { countyId } = req.query;
    
    // Get county IDs to reconcile
    const countyIds = countyId 
      ? [countyId as string]
      : []; // For MVP, require countyId parameter

    const reconciliationData = await Promise.all(
      countyIds.map(async (cId) => {
        const vaultSnapshot = await storage.getCountyVaultSnapshot({ countyId: cId });
        const contributions = await storage.getCountyContributions(cId);
        
        const verifiedCount = contributions.filter(c => c.status === 'verified').length;
        const payoutCount = 0; // Would need payout query

        return {
          countyId: cId,
          vaultBalance: vaultSnapshot.vault?.currentBalance || '0',
          ledgerInflow: vaultSnapshot.vault?.lifetimeInflow || '0',
          ledgerOutflow: vaultSnapshot.vault?.lifetimeOutflow || '0',
          contributionCount: contributions.length,
          verifiedCount,
          payoutCount,
        };
      })
    );

    res.json(reconciliationData);
  } catch (error) {
    console.error('Error fetching reconciliation data:', error);
    res.status(500).json({ error: 'Failed to fetch reconciliation data' });
  }
});

export default router;
