/**
 * Scout Heatmap Routes
 *
 * Handles all backend operations for the Visual Scouting Command Center:
 * - File assignment to counties
 * - Regional intelligence retrieval
 * - Unassigned file tracking
 * - County data organization
 */

import { Router, Request, Response } from "express";
import { scoutHeatmapIntelligence } from "../services/scoutHeatmapIntelligence";
import { scoutVisualFileSorting } from "../services/scoutVisualFileSorting";
import { scoutLisaIntegration } from "../services/scoutLisaIntegration";
import { requireAuth, requireAdmin } from "../auth";

const router = Router();

/**
 * GET /api/scout/unassigned-files
 * Get all unassigned files for the data tray
 */
router.get("/unassigned-files", requireAuth, async (req: Request, res: Response) => {
  try {
    const files = scoutVisualFileSorting.getUnassignedFiles();
    res.json(files);
  } catch (error) {
    console.error("[Heatmap Route] Error fetching unassigned files:", error);
    res.status(500).json({ error: "Failed to fetch unassigned files" });
  }
});

/**
 * GET /api/heatmap/county/:fips
 * Get intelligence data for a specific county
 */
router.get("/county/:fips", requireAuth, async (req: Request, res: Response) => {
  try {
    const { fips } = req.params;
    const intelligence = await scoutHeatmapIntelligence.getCountyIntelligence(fips);
    if (!intelligence) {
      return res.status(404).json({ error: "County not found" });
    }
    res.json(intelligence);
  } catch (error) {
    console.error("[Heatmap Route] Error fetching county intelligence:", error);
    res.status(500).json({ error: "Failed to fetch county intelligence" });
  }
});

/**
 * GET /api/heatmap/counties
 * Get intelligence for multiple counties
 */
router.get("/counties", requireAuth, async (req: Request, res: Response) => {
  try {
    const { counties } = req.query;
    const countyList = typeof counties === "string" ? counties.split(",") : [];
    const intelligence = await scoutHeatmapIntelligence.getMultiCountyIntelligence({
      counties: countyList,
    });
    res.json(intelligence);
  } catch (error) {
    console.error("[Heatmap Route] Error fetching multi-county intelligence:", error);
    res.status(500).json({ error: "Failed to fetch county intelligence" });
  }
});

/**
 * POST /api/scout/assign-file
 * Assign a file to a county
 */
router.post("/assign-file", requireAuth, async (req: Request, res: Response) => {
  try {
    const { fileId, fips } = req.body;
    const userId = (req as any).user?.id;

    if (!fileId || !fips) {
      return res.status(400).json({ error: "Missing fileId or fips" });
    }

    const assignment = await scoutVisualFileSorting.assignFileToCounty(
      fileId,
      fips,
      userId,
      undefined
    );

    // Trigger LISA to update rankings/recommendations for this county
    await scoutLisaIntegration.triggerCountyUpdate(fips, "file_assigned");

    res.json(assignment);
  } catch (error) {
    console.error("[Heatmap Route] Error assigning file:", error);
    res.status(500).json({ error: "Failed to assign file" });
  }
});

/**
 * POST /api/scout/batch-assign-files
 * Batch assign multiple files to a county
 */
router.post("/batch-assign-files", requireAuth, async (req: Request, res: Response) => {
  try {
    const { fileIds, fips } = req.body;
    const userId = (req as any).user?.id;

    if (!fileIds || !Array.isArray(fileIds) || !fips) {
      return res.status(400).json({ error: "Missing fileIds array or fips" });
    }

    const batch = await scoutVisualFileSorting.batchAssignFiles(fileIds, fips, userId);

    // Trigger LISA update
    await scoutLisaIntegration.triggerCountyUpdate(fips, "batch_files_assigned");

    res.json(batch);
  } catch (error) {
    console.error("[Heatmap Route] Error batch assigning files:", error);
    res.status(500).json({ error: "Failed to batch assign files" });
  }
});

/**
 * GET /api/scout/county/:fips/files
 * Get files for a specific county
 */
router.get("/county/:fips/files", requireAuth, async (req: Request, res: Response) => {
  try {
    const { fips } = req.params;
    const { type, sortBy, limit } = req.query;

    const files = await scoutVisualFileSorting.getCountyFiles(fips);
    if (!files) {
      return res.status(404).json({ error: "County not found" });
    }

    res.json(files);
  } catch (error) {
    console.error("[Heatmap Route] Error fetching county files:", error);
    res.status(500).json({ error: "Failed to fetch county files" });
  }
});

/**
 * POST /api/scout/move-file
 * Move a file between counties
 */
router.post("/move-file", requireAuth, async (req: Request, res: Response) => {
  try {
    const { fileId, fromFips, toFips } = req.body;
    const userId = (req as any).user?.id;

    if (!fileId || !fromFips || !toFips) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const assignment = await scoutVisualFileSorting.moveFileBetweenCounties(
      fileId,
      fromFips,
      toFips,
      userId
    );

    // Trigger LISA updates for both counties
    await Promise.all([
      scoutLisaIntegration.triggerCountyUpdate(fromFips, "file_moved_out"),
      scoutLisaIntegration.triggerCountyUpdate(toFips, "file_moved_in"),
    ]);

    res.json(assignment);
  } catch (error) {
    console.error("[Heatmap Route] Error moving file:", error);
    res.status(500).json({ error: "Failed to move file" });
  }
});

/**
 * GET /api/scout/county/:fips/compare/:otherFips
 * Compare two counties
 */
router.get("/county/:fips/compare/:otherFips", requireAuth, async (req: Request, res: Response) => {
  try {
    const { fips, otherFips } = req.params;
    const comparison = await scoutHeatmapIntelligence.compareCounties(fips, otherFips);
    if (!comparison) {
      return res.status(404).json({ error: "One or both counties not found" });
    }
    res.json(comparison);
  } catch (error) {
    console.error("[Heatmap Route] Error comparing counties:", error);
    res.status(500).json({ error: "Failed to compare counties" });
  }
});

/**
 * GET /api/scout/assignment-history
 * Get assignment history (admin only)
 */
router.get(
  "/assignment-history",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { limit, fips } = req.query;
      const history = scoutVisualFileSorting.getAssignmentHistory(
        parseInt(String(limit)) || 100,
        String(fips) || undefined
      );
      res.json(history);
    } catch (error) {
      console.error("[Heatmap Route] Error fetching assignment history:", error);
      res.status(500).json({ error: "Failed to fetch assignment history" });
    }
  }
);

/**
 * GET /api/scout/statistics
 * Get visual sorting statistics (admin only)
 */
router.get("/statistics", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = scoutVisualFileSorting.getStatistics();
    res.json(stats);
  } catch (error) {
    console.error("[Heatmap Route] Error fetching statistics:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

/**
 * POST /api/scout/trigger-mission
 * Trigger a scouting mission for a county
 */
router.post("/trigger-mission", requireAuth, async (req: Request, res: Response) => {
  try {
    const { fips, missionType } = req.body;
    const userId = (req as any).user?.id;

    if (!fips || !missionType) {
      return res.status(400).json({ error: "Missing fips or missionType" });
    }

    const mission = await scoutHeatmapIntelligence.triggerCountyScouting(fips, missionType);

    // Trigger LISA to monitor mission progress
    await scoutLisaIntegration.monitorMission(mission.missionId, fips);

    res.json(mission);
  } catch (error) {
    console.error("[Heatmap Route] Error triggering mission:", error);
    res.status(500).json({ error: "Failed to trigger mission" });
  }
});

export const scoutHeatmapRoutes = router;
