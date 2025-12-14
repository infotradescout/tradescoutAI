import { Router, Request, Response } from 'express';
import { db } from '../db';
import { communityVaults, communityVaultLedgerEntries, profiles, users } from '../../shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { requireAuth } from '../auth';

const router = Router();

// ==================== COMMUNITY VAULTS ENDPOINTS ====================

// GET vault for a profile
router.get('/vaults/:profileId', async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    // Verify profile exists
    const profile = await db.select()
      .from(profiles)
      .where(eq(profiles.id, profileId));

    if (!profile.length) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Get or create vault
    let vault = await db.select()
      .from(communityVaults)
      .where(eq(communityVaults.profileId, profileId));

    if (!vault.length) {
      // Create new vault
      vault = await db.insert(communityVaults).values({
        profileId,
        currentBalance: '0',
        lifetimeInflow: '0',
        lifetimeOutflow: '0'
      }).returning();
    }

    // Get recent ledger entries
    const ledger = await db.select()
      .from(communityVaultLedgerEntries)
      .where(eq(communityVaultLedgerEntries.vaultId, vault[0].id));

    res.json({
      vault: vault[0],
      recentTransactions: ledger.slice(-20)
    });
  } catch (error) {
    console.error('Error fetching vault:', error);
    res.status(500).json({ error: 'Failed to fetch vault' });
  }
});

// GET all vaults (for admin dashboard)
router.get('/vaults', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    // Verify user is admin
    const user = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length || !user[0].roles?.includes('admin')) {
      return res.status(403).json({ error: 'Only admins can view all vaults' });
    }

    const vaults = await db.select()
      .from(communityVaults)
      .orderBy(desc(communityVaults.currentBalance));

    res.json(vaults);
  } catch (error) {
    console.error('Error fetching vaults:', error);
    res.status(500).json({ error: 'Failed to fetch vaults' });
  }
});

// POST add funds to vault (admin only)
router.post('/vaults/:vaultId/deposit', requireAuth, async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const { sourceType, amount, sourceId, memo } = req.body;
    const userId = (req as any).user.id;

    // Verify user is admin
    const user = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length || !user[0].roles?.includes('admin')) {
      return res.status(403).json({ error: 'Only admins can manage vaults' });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Get vault
    const vault = await db.select()
      .from(communityVaults)
      .where(eq(communityVaults.id, vaultId))
      .limit(1);

    if (!vault.length) {
      return res.status(404).json({ error: 'Vault not found' });
    }

    // Add ledger entry
    const ledgerEntry = await db.insert(communityVaultLedgerEntries).values({
      vaultId,
      sourceType: sourceType || 'manual_adjustment',
      sourceId,
      amount: parseFloat(amount).toString(),
      memo
    }).returning();

    // Update vault balance
    const newBalance = (parseFloat(vault[0].currentBalance?.toString() || '0') + parseFloat(amount)).toString();
    const newInflow = (parseFloat(vault[0].lifetimeInflow?.toString() || '0') + parseFloat(amount)).toString();

    const updated = await db.update(communityVaults)
      .set({
        currentBalance: newBalance,
        lifetimeInflow: newInflow,
        lastContributionAt: new Date(),
        lastUpdated: new Date()
      })
      .where(eq(communityVaults.id, vaultId))
      .returning();

    res.json({
      vault: updated[0],
      ledgerEntry: ledgerEntry[0]
    });
  } catch (error) {
    console.error('Error depositing to vault:', error);
    res.status(500).json({ error: 'Failed to deposit funds' });
  }
});

// GET vault statistics
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const vaults = await db.select()
      .from(communityVaults);

    const totalVaultBalance = vaults.reduce((sum, v) => sum + parseFloat(v.currentBalance?.toString() || '0'), 0);
    const topVaults = vaults
      .sort((a, b) => parseFloat(b.currentBalance?.toString() || '0') - parseFloat(a.currentBalance?.toString() || '0'))
      .slice(0, 5);

    res.json({
      totalVaults: vaults.length,
      totalBalance: totalVaultBalance,
      topVaults,
      avgBalance: totalVaultBalance / (vaults.length || 1)
    });
  } catch (error) {
    console.error('Error fetching vault statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// POST fund distribution (admin only)
router.post('/vaults/:vaultId/distribute', requireAuth, async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const { amount, reason } = req.body;
    const userId = (req as any).user.id;

    // Verify user is admin
    const user = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length || !user[0].roles?.includes('admin')) {
      return res.status(403).json({ error: 'Only admins can distribute funds' });
    }

    // Get vault
    const vault = await db.select()
      .from(communityVaults)
      .where(eq(communityVaults.id, vaultId))
      .limit(1);

    if (!vault.length) {
      return res.status(404).json({ error: 'Vault not found' });
    }

    // Check sufficient balance
    const currentBalance = parseFloat(vault[0].currentBalance?.toString() || '0');
    if (currentBalance < parseFloat(amount)) {
      return res.status(400).json({ error: 'Insufficient vault balance' });
    }

    // Create distribution ledger entry (negative amount)
    const ledgerEntry = await db.insert(communityVaultLedgerEntries).values({
      vaultId,
      sourceType: 'other',
      amount: `-${parseFloat(amount)}`,
      memo: `Distribution: ${reason}`
    }).returning();

    // Update vault balance
    const newBalance = (currentBalance - parseFloat(amount)).toString();
    const newOutflow = (parseFloat(vault[0].lifetimeOutflow?.toString() || '0') + parseFloat(amount)).toString();

    const updated = await db.update(communityVaults)
      .set({
        currentBalance: newBalance,
        lifetimeOutflow: newOutflow,
        lastUpdated: new Date()
      })
      .where(eq(communityVaults.id, vaultId))
      .returning();

    res.json({
      vault: updated[0],
      ledgerEntry: ledgerEntry[0]
    });
  } catch (error) {
    console.error('Error distributing funds:', error);
    res.status(500).json({ error: 'Failed to distribute funds' });
  }
});

// GET ledger entries for vault
router.get('/vaults/:vaultId/ledger', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const { limit = 50 } = req.query;

    const ledger = await db.select()
      .from(communityVaultLedgerEntries)
      .where(eq(communityVaultLedgerEntries.vaultId, vaultId))
      .orderBy(desc(communityVaultLedgerEntries.createdAt))
      .limit(parseInt(limit as string));

    res.json(ledger);
  } catch (error) {
    console.error('Error fetching ledger:', error);
    res.status(500).json({ error: 'Failed to fetch ledger' });
  }
});

export default router;
