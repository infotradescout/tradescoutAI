import { Router, type Request, Response } from "express";
import { 
  getProposedBlueprints,
  getProposalById,
  approveBlueprint,
  rejectBlueprint,
  deferBlueprint,
  mergeBlueprints,
} from "../scout/toolDiscoveryObserver";

const router = Router();

/**
 * ADMIN ONLY - Tool Discovery Routes
 * 
 * These routes provide admin access to Scout's observational intelligence.
 * Tool discovery runs OFFLINE and NEVER affects live user interactions.
 */

/**
 * Get all tool blueprints
 */
router.get("/tool-blueprints", async (req: Request, res: Response) => {
  try {
    const proposed = await getProposedBlueprints();
    
    return res.json({
      blueprints: proposed,
      total: proposed.length,
    });
  } catch (error) {
    console.error("[Admin] Failed to fetch blueprints:", error);
    return res.status(500).json({ error: "Failed to fetch blueprints" });
  }
});

/**
 * Get a single proposal by ID
 */
router.get("/tool-blueprints/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const proposal = await getProposalById(parseInt(id));
    
    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }
    
    return res.json(proposal);
  } catch (error) {
    console.error("[Admin] Failed to fetch proposal:", error);
    return res.status(500).json({ error: "Failed to fetch proposal" });
  }
});

/**
 * Make a decision on a proposal
 */
router.post("/tool-blueprints/:id/decision", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { decision, notes, mergeIntoId } = req.body;
    const adminUserId = (req as any).user?.id || 1; // TODO: Get from auth
    
    const proposalId = parseInt(id);
    
    switch (decision) {
      case 'approve':
        await approveBlueprint(proposalId, adminUserId, notes);
        break;
      case 'reject':
        await rejectBlueprint(proposalId, adminUserId, notes);
        break;
      case 'defer':
        await deferBlueprint(proposalId, adminUserId, notes);
        break;
      case 'merge':
        if (!mergeIntoId) {
          return res.status(400).json({ error: "mergeIntoId required for merge decision" });
        }
        await mergeBlueprints(proposalId, parseInt(mergeIntoId), adminUserId, notes);
        break;
      default:
        return res.status(400).json({ error: "Invalid decision type" });
    }
    
    return res.json({
      success: true,
      message: `Proposal ${decision}ed successfully`,
    });
  } catch (error) {
    console.error("[Admin] Failed to process decision:", error);
    return res.status(500).json({ error: "Failed to process decision" });
  }
});

/**
 * Legacy approve endpoint (deprecated, use /decision instead)
 */
router.post("/tool-blueprints/:id/approve", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const adminUserId = (req as any).user?.id || 1;
    
    await approveBlueprint(parseInt(id), adminUserId, notes);
    
    return res.json({
      success: true,
      message: "Blueprint approved",
    });
  } catch (error) {
    console.error("[Admin] Failed to approve blueprint:", error);
    return res.status(500).json({ error: "Failed to approve blueprint" });
  }
});

/**
 * Legacy reject endpoint (deprecated, use /decision instead)
 */
router.post("/tool-blueprints/:id/reject", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminUserId = (req as any).user?.id || 1;
    
    await rejectBlueprint(parseInt(id), adminUserId, reason);
    
    return res.json({
      success: true,
      message: "Blueprint rejected",
    });
  } catch (error) {
    console.error("[Admin] Failed to reject blueprint:", error);
    return res.status(500).json({ error: "Failed to reject blueprint" });
  }
});

export default router;
