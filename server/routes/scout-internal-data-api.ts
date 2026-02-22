/**
 * Scout Internal Data API (SIDA) Router
 *
 * Secure, internal-only API endpoints for accessing TradeScout's Data Factory.
 * All endpoints require valid authentication and are restricted to whitelisted projects.
 *
 * Base Path: /api/scout-internal-data
 *
 * Authentication:
 * - Header: X-Scout-API-Key
 * - Header: X-Scout-Project-ID
 * - Header: X-Scout-Timestamp
 * - Header: X-Scout-Signature
 */

import { Router, type Request, Response } from "express";
import ScoutInternalDataAPI, { type SIDARequest } from "../services/scoutInternalDataAPI";
import ScoutDataFactory from "../services/scoutDataFactory";

const router = Router();
const sidaService = new ScoutInternalDataAPI();

/**
 * Middleware: Validate SIDA authentication
 */
const validateSIDAAuth = (req: Request, res: Response, next: Function) => {
  try {
    const apiKey = req.headers["x-scout-api-key"] as string;
    const projectId = req.headers["x-scout-project-id"] as string;
    const timestamp = parseInt(req.headers["x-scout-timestamp"] as string);
    const signature = req.headers["x-scout-signature"] as string;

    if (!apiKey || !projectId || !timestamp || !signature) {
      return res.status(401).json({
        error: "Missing required authentication headers",
        required_headers: [
          "X-Scout-API-Key",
          "X-Scout-Project-ID",
          "X-Scout-Timestamp",
          "X-Scout-Signature",
        ],
      });
    }

    const sidaRequest: SIDARequest = {
      project_id: projectId,
      api_key: apiKey,
      timestamp,
      signature,
      payload: req.body || {},
    };

    const validation = sidaService.validateRequest(sidaRequest);

    if (!validation.valid) {
      return res.status(403).json({
        error: validation.error,
      });
    }

    // Attach validated info to request
    (req as any).sida = {
      project_id: projectId,
      request_id: sidaService.generateRequestId(),
      start_time: Date.now(),
    };

    next();
  } catch (error) {
    console.error("[SIDA] Auth middleware error:", error);
    return res.status(500).json({
      error: "Authentication validation failed",
    });
  }
};

/**
 * Helper: Build response with timing
 */
const buildResponse = (req: Request, data: any, success: boolean = true) => {
  const sida = (req as any).sida;
  const executionTime = Date.now() - sida.start_time;

  if (success) {
    return sidaService.buildSuccessResponse(data, sida.request_id, executionTime);
  } else {
    return sidaService.buildErrorResponse(data, sida.request_id, executionTime);
  }
};

/**
 * GET /status - Check SIDA status and configuration
 */
router.get("/status", validateSIDAAuth, (req: Request, res: Response) => {
  try {
    const status = sidaService.getStatus();
    return res.json(buildResponse(req, status));
  } catch (error) {
    console.error("[SIDA] Status error:", error);
    return res
      .status(500)
      .json(
        buildResponse(req, error instanceof Error ? error.message : "Status check failed", false)
      );
  }
});

/**
 * GET /data-factory/marketplace - Get marketplace byproducts
 */
router.get("/data-factory/marketplace", validateSIDAAuth, async (req: Request, res: Response) => {
  try {
    const data = await ScoutDataFactory.extractMarketplaceByproducts();
    return res.json(buildResponse(req, data));
  } catch (error) {
    console.error("[SIDA] Marketplace extraction error:", error);
    return res
      .status(500)
      .json(
        buildResponse(
          req,
          error instanceof Error ? error.message : "Marketplace extraction failed",
          false
        )
      );
  }
});

/**
 * GET /data-factory/contractors - Get contractor byproducts
 */
router.get("/data-factory/contractors", validateSIDAAuth, async (req: Request, res: Response) => {
  try {
    const data = await ScoutDataFactory.extractContractorByproducts();
    return res.json(buildResponse(req, data));
  } catch (error) {
    console.error("[SIDA] Contractor extraction error:", error);
    return res
      .status(500)
      .json(
        buildResponse(
          req,
          error instanceof Error ? error.message : "Contractor extraction failed",
          false
        )
      );
  }
});

/**
 * GET /data-factory/community - Get community byproducts
 */
router.get("/data-factory/community", validateSIDAAuth, async (req: Request, res: Response) => {
  try {
    const data = await ScoutDataFactory.extractCommunityByproducts();
    return res.json(buildResponse(req, data));
  } catch (error) {
    console.error("[SIDA] Community extraction error:", error);
    return res
      .status(500)
      .json(
        buildResponse(
          req,
          error instanceof Error ? error.message : "Community extraction failed",
          false
        )
      );
  }
});

/**
 * GET /data-factory/all - Get all byproducts (comprehensive)
 */
router.get("/data-factory/all", validateSIDAAuth, async (req: Request, res: Response) => {
  try {
    const data = await ScoutDataFactory.extractAllByproducts();
    return res.json(buildResponse(req, data));
  } catch (error) {
    console.error("[SIDA] Comprehensive extraction error:", error);
    return res
      .status(500)
      .json(
        buildResponse(
          req,
          error instanceof Error ? error.message : "Comprehensive extraction failed",
          false
        )
      );
  }
});

/**
 * GET /data-factory/status - Get data factory health
 */
router.get("/data-factory/status", validateSIDAAuth, async (req: Request, res: Response) => {
  try {
    const status = await ScoutDataFactory.getDataFactoryStatus();
    return res.json(buildResponse(req, status));
  } catch (error) {
    console.error("[SIDA] Data factory status error:", error);
    return res
      .status(500)
      .json(
        buildResponse(req, error instanceof Error ? error.message : "Status check failed", false)
      );
  }
});

/**
 * POST /reasoning - Scout Reasoning-as-a-Service (RaaS)
 *
 * Send raw data and get back intelligent analysis from Scout.
 * Scout will analyze the data and provide recommendations.
 *
 * Request body:
 * {
 *   "analysis_type": "trend_analysis" | "opportunity_detection" | "risk_assessment",
 *   "data": { ... },
 *   "context": { ... }
 * }
 */
router.post("/reasoning", validateSIDAAuth, async (req: Request, res: Response) => {
  try {
    const { analysis_type, data, context } = req.body;

    if (!analysis_type || !data) {
      return res
        .status(400)
        .json(buildResponse(req, "Missing required fields: analysis_type, data", false));
    }

    // Simulate Scout reasoning based on analysis type
    let analysis: any = {};

    switch (analysis_type) {
      case "trend_analysis":
        analysis = {
          analysis_type: "trend_analysis",
          findings: [
            "Roofing materials showing 15% price increase over 30 days",
            "Electrical contractors experiencing 40% higher demand than average",
            "Community sentiment trending positive in downtown district",
          ],
          confidence: 0.92,
          recommendation:
            "Consider increasing inventory of roofing materials and recruiting electrical contractors",
        };
        break;

      case "opportunity_detection":
        analysis = {
          analysis_type: "opportunity_detection",
          opportunities: [
            {
              type: "market_gap",
              description: "High demand for plumbing contractors in suburban areas",
              potential_revenue: 150000,
              confidence: 0.85,
            },
            {
              type: "product_demand",
              description: "HVAC equipment experiencing shortage",
              potential_revenue: 200000,
              confidence: 0.78,
            },
          ],
          top_opportunity: "Recruit plumbing contractors for suburban expansion",
        };
        break;

      case "risk_assessment":
        analysis = {
          analysis_type: "risk_assessment",
          risks: [
            {
              risk: "Market saturation in downtown roofing",
              severity: "medium",
              mitigation: "Expand to suburban markets",
            },
            {
              risk: "Negative sentiment in neighborhood safety discussions",
              severity: "low",
              mitigation: "Increase community engagement and transparency",
            },
          ],
          overall_risk_level: "low",
        };
        break;

      default:
        return res
          .status(400)
          .json(
            buildResponse(
              req,
              `Unknown analysis_type: ${analysis_type}. Valid types: trend_analysis, opportunity_detection, risk_assessment`,
              false
            )
          );
    }

    return res.json(
      buildResponse(req, {
        ...analysis,
        context_used: !!context,
        data_points_analyzed: Object.keys(data).length,
      })
    );
  } catch (error) {
    console.error("[SIDA] Reasoning error:", error);
    return res
      .status(500)
      .json(buildResponse(req, error instanceof Error ? error.message : "Reasoning failed", false));
  }
});

/**
 * POST /actions - Execute cross-project actions
 *
 * Trigger TradeScout workflows from other internal applications.
 *
 * Request body:
 * {
 *   "action": "vet_contractor" | "calculate_market_value" | "send_notification",
 *   "parameters": { ... }
 * }
 */
router.post("/actions", validateSIDAAuth, async (req: Request, res: Response) => {
  try {
    const { action, parameters } = req.body;

    if (!action || !parameters) {
      return res
        .status(400)
        .json(buildResponse(req, "Missing required fields: action, parameters", false));
    }

    // Simulate action execution
    let result: any = {};

    switch (action) {
      case "vet_contractor":
        result = {
          action: "vet_contractor",
          contractor_id: parameters.contractor_id,
          status: "vetting_in_progress",
          estimated_completion: "2 hours",
          checks_running: ["license_verification", "background_check", "reference_calls"],
        };
        break;

      case "calculate_market_value":
        result = {
          action: "calculate_market_value",
          item_id: parameters.item_id,
          estimated_value: 2500,
          confidence: 0.88,
          comparable_sales: 12,
          last_updated: new Date().toISOString(),
        };
        break;

      case "send_notification":
        result = {
          action: "send_notification",
          notification_id: `notif_${Date.now()}`,
          recipient: parameters.recipient_id,
          status: "queued",
          message: parameters.message,
          delivery_estimated: "5 minutes",
        };
        break;

      default:
        return res
          .status(400)
          .json(
            buildResponse(
              req,
              `Unknown action: ${action}. Valid actions: vet_contractor, calculate_market_value, send_notification`,
              false
            )
          );
    }

    return res.json(buildResponse(req, result));
  } catch (error) {
    console.error("[SIDA] Action execution error:", error);
    return res
      .status(500)
      .json(
        buildResponse(
          req,
          error instanceof Error ? error.message : "Action execution failed",
          false
        )
      );
  }
});

export default router;
