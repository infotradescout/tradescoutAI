import { Router, Request, Response } from 'express';
import { db } from '../db';
import { foundationCauses, foundationDonations, foundationImpactReports, counties, users } from '../../shared/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { requireAuth } from '../auth';

const router = Router();

// ==================== FOUNDATION CAUSES ENDPOINTS ====================

// GET all causes (with optional filters)
router.get('/causes', async (req: Request, res: Response) => {
  try {
    const causes = await db.select().from(foundationCauses).where(eq(foundationCauses.isActive, true));
    res.json(causes);
  } catch (error) {
    console.error('Error fetching causes:', error);
    res.status(500).json({ error: 'Failed to fetch causes' });
  }
});

// GET single cause with details
router.get('/causes/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const cause = await db.select()
      .from(foundationCauses)
      .where(eq(foundationCauses.id, id));

    if (!cause.length) {
      return res.status(404).json({ error: 'Cause not found' });
    }

    // Get donation count and total raised
    const donations = await db.select()
      .from(foundationDonations)
      .where(eq(foundationDonations.causeId, id));

    const completedDonations = donations.filter(d => d.status === 'completed');
    const totalRaised = completedDonations.reduce((sum, d) => sum + parseFloat(d.netAmount?.toString() || '0'), 0);
    const donorCount = new Set(completedDonations.map(d => d.userId)).size;

    res.json({
      ...cause[0],
      totalRaised,
      donorCount,
      recentDonations: completedDonations.slice(0, 5)
    });
  } catch (error) {
    console.error('Error fetching cause:', error);
    res.status(500).json({ error: 'Failed to fetch cause' });
  }
});

// POST create new cause (admin/verified nonprofit only)
router.post('/causes', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, description, category, countyId, targetAmount, imageUrl, websiteUrl, contactEmail, taxId } = req.body;
    const userId = (req as any).user.id;

    // Validate required fields
    if (!name || !description || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user is admin (can create causes)
    const user = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length || !user[0].roles?.includes('admin')) {
      return res.status(403).json({ error: 'Only admins can create causes' });
    }

    const cause = await db.insert(foundationCauses).values({
      name,
      description,
      category,
      countyId,
      targetAmount,
      imageUrl,
      websiteUrl,
      contactEmail,
      taxId,
      createdBy: userId,
      isActive: true
    }).returning();

    res.status(201).json(cause[0]);
  } catch (error) {
    console.error('Error creating cause:', error);
    res.status(500).json({ error: 'Failed to create cause' });
  }
});

// PUT update cause
router.put('/causes/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, category, targetAmount, imageUrl, websiteUrl, contactEmail, isActive } = req.body;
    const userId = (req as any).user.id;

    // Check if user is admin
    const user = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length || !user[0].roles?.includes('admin')) {
      return res.status(403).json({ error: 'Only admins can update causes' });
    }

    const cause = await db.update(foundationCauses)
      .set({
        name,
        description,
        category,
        targetAmount,
        imageUrl,
        websiteUrl,
        contactEmail,
        isActive,
        updatedAt: new Date()
      })
      .where(eq(foundationCauses.id, id))
      .returning();

    if (!cause.length) {
      return res.status(404).json({ error: 'Cause not found' });
    }

    res.json(cause[0]);
  } catch (error) {
    console.error('Error updating cause:', error);
    res.status(500).json({ error: 'Failed to update cause' });
  }
});

// ==================== DONATIONS ENDPOINTS ====================

// POST create donation
router.post('/donations', requireAuth, async (req: Request, res: Response) => {
  try {
    const { causeId, amount, type = 'one_time', isAnonymous = false, donorMessage } = req.body;
    const userId = (req as any).user.id;

    if (!causeId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid cause or amount' });
    }

    // Create donation record
    const donation = await db.insert(foundationDonations).values({
      userId,
      causeId,
      amount,
      type: type as 'one_time' | 'roundup' | 'recurring',
      status: 'pending',
      isAnonymous,
      donorMessage,
      taxDeductible: true
    }).returning();

    res.status(201).json(donation[0]);
  } catch (error) {
    console.error('Error creating donation:', error);
    res.status(500).json({ error: 'Failed to create donation' });
  }
});

// GET donations for current user
router.get('/donations/user', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const donations = await db.select()
      .from(foundationDonations)
      .where(eq(foundationDonations.userId, userId))
      .orderBy(desc(foundationDonations.createdAt));

    res.json(donations);
  } catch (error) {
    console.error('Error fetching user donations:', error);
    res.status(500).json({ error: 'Failed to fetch donations' });
  }
});

// GET donations for specific cause
router.get('/causes/:causeId/donations', async (req: Request, res: Response) => {
  try {
    const { causeId } = req.params;
    const { limit = 10 } = req.query;

    const donations = await db.select()
      .from(foundationDonations)
      .where(and(
        eq(foundationDonations.causeId, causeId),
        eq(foundationDonations.status, 'completed')
      ))
      .orderBy(desc(foundationDonations.createdAt))
      .limit(parseInt(limit as string));

    res.json(donations);
  } catch (error) {
    console.error('Error fetching cause donations:', error);
    res.status(500).json({ error: 'Failed to fetch donations' });
  }
});

// PUT update donation status
router.put('/donations/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, stripeChargeId } = req.body;
    const userId = (req as any).user.id;

    // Verify user owns this donation
    const donation = await db.select()
      .from(foundationDonations)
      .where(eq(foundationDonations.id, id))
      .limit(1);

    if (!donation.length || donation[0].userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updated = await db.update(foundationDonations)
      .set({
        status: status as 'pending' | 'processing' | 'completed' | 'failed' | 'refunded',
        stripeChargeId,
        completedAt: status === 'completed' ? new Date() : undefined,
        updatedAt: new Date()
      })
      .where(eq(foundationDonations.id, id))
      .returning();

    res.json(updated[0]);
  } catch (error) {
    console.error('Error updating donation:', error);
    res.status(500).json({ error: 'Failed to update donation' });
  }
});

// ==================== IMPACT REPORTS ====================

// GET impact reports for cause
router.get('/causes/:causeId/impact-reports', async (req: Request, res: Response) => {
  try {
    const { causeId } = req.params;

    const reports = await db.select()
      .from(foundationImpactReports)
      .where(eq(foundationImpactReports.causeId, causeId))
      .orderBy(desc(foundationImpactReports.createdAt));

    res.json(reports);
  } catch (error) {
    console.error('Error fetching impact reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// POST create impact report (admin only)
router.post('/impact-reports', requireAuth, async (req: Request, res: Response) => {
  try {
    const { causeId, reportingPeriod, totalBeneficiaries, impactMetrics, storytelling, mediaUrls, adminCosts, programCosts } = req.body;
    const userId = (req as any).user.id;

    // Check if user is admin
    const user = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length || !user[0].roles?.includes('admin')) {
      return res.status(403).json({ error: 'Only admins can create impact reports' });
    }

    const report = await db.insert(foundationImpactReports).values({
      causeId,
      reportingPeriod,
      totalBeneficiaries,
      impactMetrics,
      storytelling,
      mediaUrls,
      adminCosts,
      programCosts,
      publishedAt: new Date()
    }).returning();

    res.status(201).json(report[0]);
  } catch (error) {
    console.error('Error creating impact report:', error);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

// GET foundation statistics
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const allDonations = await db.select()
      .from(foundationDonations)
      .where(eq(foundationDonations.status, 'completed'));

    const totalRaised = allDonations.reduce((sum, d) => sum + parseFloat(d.netAmount?.toString() || '0'), 0);
    const totalDonors = new Set(allDonations.map(d => d.userId)).size;
    const activeCauses = await db.select()
      .from(foundationCauses)
      .where(eq(foundationCauses.isActive, true));

    res.json({
      totalRaised,
      totalDonors,
      activeCauses: activeCauses.length,
      recentDonations: allDonations.length
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
