/**
 * Admin-only routes for private Scout verification-document organization.
 */
import { Router, type Request, type Response } from "express";
import { scoutHeatmapIntelligence } from "../services/scoutHeatmapIntelligence";
import {
  ScoutFileAssignmentError,
  isScoutFileStorageUnavailable,
  scoutVisualFileSorting,
} from "../services/scoutVisualFileSorting";
import { requireAuth, requireAdmin } from "../auth";

const router = Router();
router.use(requireAuth, requireAdmin);

function userId(req: Request): string {
  return String(
    (req as any).user?.claims?.sub ||
      (req as any).user?.id ||
      ""
  ).trim();
}

function pageValue(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sendError(res: Response, error: unknown, fallback: string): Response {
  if (error instanceof ScoutFileAssignmentError) {
    return res.status(error.statusCode).json({ error: error.message, code: error.code });
  }
  if (isScoutFileStorageUnavailable(error)) {
    return res.status(503).json({
      error: "Scout file assignment storage is unavailable",
      code: "SCOUT_FILE_ASSIGNMENT_STORAGE_UNAVAILABLE",
    });
  }
  const message = String((error as any)?.message || "");
  if (/required|five-digit|unsupported|maximum/i.test(message)) {
    return res.status(400).json({ error: message });
  }
  if (/was not found/i.test(message)) {
    return res.status(404).json({ error: message });
  }
  console.error("[Heatmap Route]", error);
  return res.status(500).json({ error: fallback });
}

router.get("/unassigned-files", async (req, res) => {
  try {
    const files = await scoutVisualFileSorting.getUnassignedFiles(
      pageValue(req.query.limit, 50),
      pageValue(req.query.offset, 0)
    );
    return res.json(files);
  } catch (error) {
    return sendError(res, error, "Failed to fetch unassigned files");
  }
});

router.get("/county/:fips", async (req, res) => {
  try {
    const intelligence = await scoutHeatmapIntelligence.getCountyIntelligence(req.params.fips);
    if (!intelligence) return res.status(404).json({ error: "County not found" });
    return res.json(intelligence);
  } catch (error) {
    return sendError(res, error, "Failed to fetch county intelligence");
  }
});

router.get("/counties", async (req, res) => {
  try {
    const countyList =
      typeof req.query.counties === "string"
        ? req.query.counties.split(",").map((value) => value.trim()).filter(Boolean)
        : [];
    const intelligence = await scoutHeatmapIntelligence.getMultiCountyIntelligence({
      counties: countyList,
    });
    return res.json(intelligence);
  } catch (error) {
    return sendError(res, error, "Failed to fetch county intelligence");
  }
});

router.post("/assign-file", async (req, res) => {
  try {
    const actor = userId(req);
    if (!actor) return res.status(401).json({ error: "User not authenticated" });
    const assignment = await scoutVisualFileSorting.assignFileToCounty(
      req.body?.fileId,
      req.body?.fips,
      actor,
      req.body?.notes
    );
    return res.status(201).json(assignment);
  } catch (error) {
    return sendError(res, error, "Failed to assign file");
  }
});

router.post("/batch-assign-files", async (req, res) => {
  try {
    const actor = userId(req);
    if (!actor) return res.status(401).json({ error: "User not authenticated" });
    const batch = await scoutVisualFileSorting.batchAssignFiles(
      req.body?.fileIds,
      req.body?.fips,
      actor
    );
    return res.status(201).json(batch);
  } catch (error) {
    return sendError(res, error, "Failed to batch assign files");
  }
});

router.get("/county/:fips/files", async (req, res) => {
  try {
    const files = await scoutVisualFileSorting.getCountyFiles(req.params.fips, {
      type: typeof req.query.type === "string" ? req.query.type : undefined,
      sortBy: req.query.sortBy === "type" ? "type" : "recent",
      limit: pageValue(req.query.limit, 50),
      offset: pageValue(req.query.offset, 0),
    });
    if (!files) return res.status(404).json({ error: "County not found" });
    return res.json(files);
  } catch (error) {
    return sendError(res, error, "Failed to fetch county files");
  }
});

router.post("/move-file", async (req, res) => {
  try {
    const actor = userId(req);
    if (!actor) return res.status(401).json({ error: "User not authenticated" });
    const assignment = await scoutVisualFileSorting.moveFileBetweenCounties(
      req.body?.fileId,
      req.body?.fromFips,
      req.body?.toFips,
      actor,
      Number.isInteger(req.body?.version) ? req.body.version : undefined
    );
    return res.json(assignment);
  } catch (error) {
    return sendError(res, error, "Failed to move file");
  }
});

router.get("/county/:fips/compare/:otherFips", async (req, res) => {
  try {
    const comparison = await scoutHeatmapIntelligence.compareCounties(
      req.params.fips,
      req.params.otherFips
    );
    if (!comparison) return res.status(404).json({ error: "One or both counties not found" });
    return res.json(comparison);
  } catch (error) {
    return sendError(res, error, "Failed to compare counties");
  }
});

router.get("/assignment-history", async (req, res) => {
  try {
    const history = await scoutVisualFileSorting.getAssignmentHistory(
      pageValue(req.query.limit, 50),
      typeof req.query.fips === "string" && req.query.fips ? req.query.fips : undefined,
      pageValue(req.query.offset, 0)
    );
    return res.json(history);
  } catch (error) {
    return sendError(res, error, "Failed to fetch assignment history");
  }
});

router.get("/statistics", async (_req, res) => {
  try {
    return res.json(await scoutVisualFileSorting.getStatistics());
  } catch (error) {
    return sendError(res, error, "Failed to fetch statistics");
  }
});

router.post("/trigger-mission", async (req, res) => {
  try {
    const actor = userId(req);
    if (!actor) return res.status(401).json({ error: "User not authenticated" });
    const mission = await scoutHeatmapIntelligence.triggerCountyScouting(
      req.body?.fips,
      req.body?.missionType,
      actor,
      typeof req.body?.requestId === "string" ? req.body.requestId : undefined
    );
    return res.status(201).json(mission);
  } catch (error) {
    return sendError(res, error, "Failed to record scouting mission");
  }
});

export const scoutHeatmapRoutes = router;
