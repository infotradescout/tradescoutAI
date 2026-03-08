/**
 * Scout Outbound Dispatcher (SOD) Router
 *
 * Endpoints for managing and monitoring Scout's outbound intelligence broadcasts.
 *
 * Base Path: /api/scout-outbound-dispatcher
 */

import { Router, type Request, Response } from "express";
import ScoutOutboundDispatcher, { type DispatchConfig } from "../services/scoutOutboundDispatcher";

const router = Router();
const sodService = new ScoutOutboundDispatcher();

/**
 * POST /register-channel - Register a new dispatch channel
 */
router.post("/register-channel", (req: Request, res: Response) => {
  try {
    const { channel_type, endpoint, api_key, event_filters, retry_policy } = req.body;

    if (!channel_type || !endpoint) {
      return res.status(400).json({
        error: "Missing required fields: channel_type, endpoint",
      });
    }

    const config: DispatchConfig = {
      channel_type: channel_type as any,
      enabled: true,
      endpoint,
      api_key,
      event_filters: event_filters || {
        event_types: [
          "marketplace_trend",
          "contractor_alert",
          "community_insight",
          "opportunity_detected",
          "risk_detected",
        ],
        min_priority: "medium",
      },
      retry_policy: retry_policy || {
        max_retries: 3,
        backoff_ms: 1000,
      },
    };

    const result = sodService.registerDispatchChannel(config);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
      });
    }

    return res.status(201).json({
      success: true,
      channel_id: result.channel_id,
      message: `Dispatch channel registered: ${channel_type}`,
    });
  } catch (error) {
    console.error("[SOD Router] Register channel error:", error);
    return res.status(500).json({
      error: "Failed to register dispatch channel",
    });
  }
});

/**
 * DELETE /unregister-channel/:channelId - Unregister a dispatch channel
 */
router.delete("/unregister-channel/:channelId", (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;

    const result = sodService.unregisterDispatchChannel(channelId);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
      });
    }

    return res.json({
      success: true,
      message: `Dispatch channel unregistered: ${channelId}`,
    });
  } catch (error) {
    console.error("[SOD Router] Unregister channel error:", error);
    return res.status(500).json({
      error: "Failed to unregister dispatch channel",
    });
  }
});

/**
 * GET /channels - List all registered dispatch channels
 */
router.get("/channels", (req: Request, res: Response) => {
  try {
    const channels = sodService.getDispatchChannels();

    return res.json({
      success: true,
      channels_count: channels.length,
      channels,
    });
  } catch (error) {
    console.error("[SOD Router] List channels error:", error);
    return res.status(500).json({
      error: "Failed to list dispatch channels",
    });
  }
});

/**
 * POST /queue-event - Queue an outbound event for dispatch
 */
router.post("/queue-event", (req: Request, res: Response) => {
  try {
    const { event_type, priority, source, payload, metadata } = req.body;

    if (!event_type || !source || !payload) {
      return res.status(400).json({
        error: "Missing required fields: event_type, source, payload",
      });
    }

    const result = sodService.queueEvent({
      event_type: event_type as any,
      priority: priority || "medium",
      source: source as any,
      payload,
      metadata: metadata || { tags: [] },
    });

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
      });
    }

    return res.status(201).json({
      success: true,
      event_id: result.event_id,
      message: "Event queued for dispatch",
    });
  } catch (error) {
    console.error("[SOD Router] Queue event error:", error);
    return res.status(500).json({
      error: "Failed to queue event",
    });
  }
});

/**
 * GET /history - Get dispatch history
 */
router.get("/history", (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const history = sodService.getDispatchHistory(limit);

    return res.json({
      success: true,
      dispatches_count: history.length,
      dispatches: history,
    });
  } catch (error) {
    console.error("[SOD Router] Get history error:", error);
    return res.status(500).json({
      error: "Failed to retrieve dispatch history",
    });
  }
});

/**
 * GET /statistics - Get dispatcher statistics
 */
router.get("/statistics", (req: Request, res: Response) => {
  try {
    const stats = sodService.getStatistics();

    return res.json({
      success: true,
      statistics: stats,
    });
  } catch (error) {
    console.error("[SOD Router] Get statistics error:", error);
    return res.status(500).json({
      error: "Failed to retrieve dispatcher statistics",
    });
  }
});

/**
 * POST /test-dispatch - Test dispatch to a channel
 */
router.post("/test-dispatch", (req: Request, res: Response) => {
  try {
    const { channel_type, endpoint } = req.body;

    if (!channel_type || !endpoint) {
      return res.status(400).json({
        error: "Missing required fields: channel_type, endpoint",
      });
    }

    // Queue a test event
    const result = sodService.queueEvent({
      event_type: "marketplace_trend",
      priority: "medium",
      source: "marketplace",
      payload: {
        test: true,
        message: "This is a test dispatch from Scout Outbound Dispatcher",
        timestamp: new Date().toISOString(),
      },
      metadata: {
        tags: ["test"],
      },
    });

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
      });
    }

    return res.json({
      success: true,
      event_id: result.event_id,
      message: `Test event queued for dispatch to ${channel_type}`,
    });
  } catch (error) {
    console.error("[SOD Router] Test dispatch error:", error);
    return res.status(500).json({
      error: "Failed to test dispatch",
    });
  }
});

export default router;
