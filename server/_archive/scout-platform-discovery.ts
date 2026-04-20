/**
 * Scout Platform Discovery Router
 *
 * Provides endpoints for Scout to discover, search, and route to
 * any of the 250+ features in the TradeScout Ecosystem.
 */

import { Router, type Request, Response } from "express";
import ScoutPlatformRouter from "../services/scoutPlatformRouter";

const router = Router();

/**
 * GET /search - Search for features matching a query
 */
router.get("/search", (req: Request, res: Response) => {
  try {
    const { query, role } = req.query;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query parameter is required" });
    }

    const userRole = role && typeof role === "string" ? role : undefined;
    const matches = ScoutPlatformRouter.findFeatures(query, userRole);

    return res.json({
      query,
      user_role: userRole,
      matches_found: matches.length,
      features: matches.map((f) => ({
        id: f.id,
        name: f.name,
        category: f.category,
        description: f.description,
        primary_page: f.pages[0],
        all_pages: f.pages,
        tools: f.tools,
      })),
    });
  } catch (error) {
    console.error("[Scout Platform Discovery] Search error:", error);
    return res.status(500).json({
      error: "Failed to search features",
      message: "Internal Server Error",
      requestId: (req as any).requestId || null,
    });
  }
});

/**
 * GET /categories - Get all feature categories
 */
router.get("/categories", (req: Request, res: Response) => {
  try {
    const categories = ScoutPlatformRouter.getCategories();
    const stats = ScoutPlatformRouter.getPlatformStats();

    return res.json({
      categories,
      stats,
      features_by_category: stats.features_by_category,
    });
  } catch (error) {
    console.error("[Scout Platform Discovery] Categories error:", error);
    return res.status(500).json({
      error: "Failed to retrieve categories",
    });
  }
});

/**
 * GET /category/:category - Get all features in a category
 */
router.get("/category/:category", (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const features = ScoutPlatformRouter.getFeaturesByCategory(category);

    return res.json({
      category,
      features_found: features.length,
      features: features.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        primary_page: f.pages[0],
        pages: f.pages,
      })),
    });
  } catch (error) {
    console.error("[Scout Platform Discovery] Category error:", error);
    return res.status(500).json({
      error: "Failed to retrieve category features",
    });
  }
});

/**
 * GET /feature/:featureId - Get detailed routing information for a feature
 */
router.get("/feature/:featureId", (req: Request, res: Response) => {
  try {
    const { featureId } = req.params;
    const routing = ScoutPlatformRouter.getFeatureRouting(featureId);

    if (!routing.feature) {
      return res.status(404).json({
        error: "Feature not found",
        feature_id: featureId,
      });
    }

    return res.json({
      feature: routing.feature,
      routing: {
        primary_page: routing.primary_page,
        all_pages: routing.all_pages,
        available_tools: routing.tools,
      },
    });
  } catch (error) {
    console.error("[Scout Platform Discovery] Feature error:", error);
    return res.status(500).json({
      error: "Failed to retrieve feature details",
    });
  }
});

/**
 * GET /recommended - Get recommended features for a user role
 */
router.get("/recommended", (req: Request, res: Response) => {
  try {
    const { role } = req.query;

    if (!role || typeof role !== "string") {
      return res.status(400).json({ error: "Role parameter is required" });
    }

    const recommended = ScoutPlatformRouter.getRecommendedFeatures(role);

    return res.json({
      user_role: role,
      recommendations_count: recommended.length,
      features: recommended.map((f) => ({
        id: f.id,
        name: f.name,
        category: f.category,
        description: f.description,
        primary_page: f.pages[0],
      })),
    });
  } catch (error) {
    console.error("[Scout Platform Discovery] Recommended error:", error);
    return res.status(500).json({
      error: "Failed to retrieve recommendations",
    });
  }
});

/**
 * GET /stats - Get platform statistics
 */
router.get("/stats", (req: Request, res: Response) => {
  try {
    const stats = ScoutPlatformRouter.getPlatformStats();

    return res.json({
      platform_statistics: stats,
      message: `TradeScout Ecosystem contains ${stats.total_features} features across ${stats.categories} categories, with ${stats.total_pages} discoverable pages and ${stats.total_tools} available tools.`,
    });
  } catch (error) {
    console.error("[Scout Platform Discovery] Stats error:", error);
    return res.status(500).json({
      error: "Failed to retrieve statistics",
    });
  }
});

export default router;
