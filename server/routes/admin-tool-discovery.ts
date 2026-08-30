import { Router, type Request, Response } from "express";
import { isAuthenticated, isSuperAdmin } from "../auth";
import {
  getToolBlueprintQueue,
  getProposalById,
  approveBlueprint,
  rejectBlueprint,
  deferBlueprint,
  mergeBlueprints,
} from "../scout/toolDiscoveryObserver";
import { toolProposalStatusEnum } from "../../shared/schema";
import { runProductionAcceptanceReport } from "../services/adminProductionAcceptance";
import { runAdminEcosystemTruthReport } from "../services/adminEcosystemTruth";

const router = Router();

router.use(isAuthenticated, isSuperAdmin);

const getAdminUserId = (req: Request): string => {
  const userId = (req as any).user?.id || (req as any).user?.claims?.sub;
  if (!userId) {
    throw new Error("Authenticated admin user id is required");
  }
  return String(userId);
};

function parseToolBlueprintQueueQuery(req: Request) {
  const statusParam = String(req.query.status || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowedStatuses = new Set(toolProposalStatusEnum.enumValues);
  const safeStatuses = statusParam.filter((status) => allowedStatuses.has(status as any)) as Array<
    "proposed" | "approved" | "rejected" | "deferred" | "merged"
  >;

  const minRiskScore = Number.parseInt(String(req.query.minRiskScore || ""), 10);
  const maxRiskScore = Number.parseInt(String(req.query.maxRiskScore || ""), 10);
  const minImpactScore = Number.parseInt(String(req.query.minImpactScore || ""), 10);
  const sortParam = String(req.query.sort || "risk_desc");
  const limitParam = Number.parseInt(String(req.query.limit || "25"), 10);
  const offsetParam = Number.parseInt(String(req.query.offset || "0"), 10);

  // Client decided_by/decidedBy is intentionally ignored for this queue endpoint.
  void req.query.decided_by;
  void req.query.decidedBy;

  return {
    status: safeStatuses,
    minRiskScore: Number.isFinite(minRiskScore) ? minRiskScore : undefined,
    maxRiskScore: Number.isFinite(maxRiskScore) ? maxRiskScore : undefined,
    minImpactScore: Number.isFinite(minImpactScore) ? minImpactScore : undefined,
    sort: sortParam,
    limit: Number.isFinite(limitParam) ? Math.min(100, Math.max(1, limitParam)) : 25,
    offset: Number.isFinite(offsetParam) ? Math.max(0, offsetParam) : 0,
  };
}

/**
 * ADMIN ONLY - Tool Discovery and production acceptance routes.
 *
 * These routes are restricted to the existing Super Admin authority.
 */

router.get("/production-acceptance", async (_req: Request, res: Response) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    return res.json(await runProductionAcceptanceReport());
  } catch (error) {
    console.error("[Admin] Production acceptance failed:", error);
    return res.status(500).json({
      error: "Production acceptance failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get("/ecosystem-truth", async (_req: Request, res: Response) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    return res.json(await runAdminEcosystemTruthReport());
  } catch (error) {
    console.error("[Admin] Ecosystem truth report failed:", error);
    return res.status(500).json({
      error: "Ecosystem truth report failed",
      detail: "The current source owners could not be read. No fallback values were invented.",
    });
  }
});

router.post("/production-acceptance/write-canary", async (_req: Request, res: Response) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    return res.json(await runProductionAcceptanceReport({ runWriteCanary: true }));
  } catch (error) {
    console.error("[Admin] Production write canary failed:", error);
    return res.status(500).json({
      error: "Production write canary failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Get all tool blueprints
 */
router.get("/tool-blueprints", async (req: Request, res: Response) => {
  try {
    const query = parseToolBlueprintQueueQuery(req);
    const proposed = await getToolBlueprintQueue({
      status: query.status,
      minRiskScore: query.minRiskScore,
      maxRiskScore: query.maxRiskScore,
      minImpactScore: query.minImpactScore,
      sort: query.sort as any,
      limit: query.limit,
      offset: query.offset,
    });

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
    const adminUserId = getAdminUserId(req);

    const proposalId = parseInt(id);

    switch (decision) {
      case "approve":
        await approveBlueprint(proposalId, adminUserId, notes);
        break;
      case "reject":
        await rejectBlueprint(proposalId, adminUserId, notes);
        break;
      case "defer":
        await deferBlueprint(proposalId, adminUserId, notes);
        break;
      case "merge":
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
    const adminUserId = getAdminUserId(req);

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
    const adminUserId = getAdminUserId(req);

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
