/**
 * Scout 2.0 Route Handler
 *
 * Admin-only endpoint for the new Scout with:
 * - OpenAI integration with web search
 * - Building codes, pricing, and trade guide knowledge
 * - Source attribution and trust signals
 * - Real-time web search fallback
 *
 * Available only to admin users for testing and refinement.
 */

import { Router, Request, Response } from "express";
import { buildScoutLlmProviders, generateWithFallback } from "../services/llmProvider";
import {
  gatherMultiSourceData,
  synthesizeMultiSourcePrompt,
  buildMultiSourceResponse,
} from "../services/scoutMultiSourceSynthesis";
import { isCodeRelatedQuery, isPricingRelatedQuery } from "../services/scoutKnowledgeIntegration";
import { scoutFindingsToLisaFeed, type ScoutIntelligenceFinding } from "../services/scoutToLisaConverter";
import { storeScoutLisaFindings, ensureScoutLisaTable } from "../services/scoutLisaPersistence";
import { getScoutTrendMetadata } from "../services/scoutTrendEngine";
import type { LisaFeedItem } from "../../shared/lisa";

const router = Router();

/**
 * Check if user has admin access
 */
function isAdmin(req: Request): boolean {
  const user = (req as any)?.user;
  if (!user) return false;
  const role = user?.role || user?.userRole;
  return role === "admin" || user?.isAdmin === true || user?.hasAdminUiAccess === true;
}

/**
 * Extract trade from query (simple heuristic)
 */
function extractTrade(query: string): string | undefined {
  const trades = [
    "deck",
    "roofing",
    "roof",
    "electrical",
    "plumbing",
    "hvac",
    "carpentry",
    "foundation",
    "framing",
  ];
  const lowerQuery = query.toLowerCase();
  for (const trade of trades) {
    if (lowerQuery.includes(trade)) {
      return trade;
    }
  }
  return undefined;
}

function generateRoutingTags(query: string, synthesis: any): string[] {
  const tags: string[] = [];

  if (isCodeRelatedQuery(query)) {
    tags.push("CODE_RELATED");
  }
  if (isPricingRelatedQuery(query)) {
    tags.push("PRICING_RELATED");
  }
  if (synthesis.overallConfidence === "high") {
    tags.push("HIGH_CONFIDENCE");
  }
  if (synthesis.conflictStatus === "unresolved") {
    tags.push("CONFLICT_UNRESOLVED");
  }
  if (synthesis.dataBySource?.knowledge) {
    tags.push("KNOWLEDGE_BASE_USED");
  }
  if (synthesis.dataBySource?.local) {
    tags.push("LOCAL_DATA_USED");
  }
  if (synthesis.dataBySource?.webSearch) {
    tags.push("WEB_SEARCH_USED");
  }

  return tags;
}

/**
 * Scout 2.0 Main Endpoint
 * POST /api/scout-v2
 *
 * Request body:
 * {
 *   "message": "Do I need a permit for a deck?",
 *   "county": "Travis",
 *   "state": "TX",
 *   "history": [{ "role": "user", "content": "..." }]
 * }
 *
 * Response:
 * {
 *   "message": "Yes, you need a permit...",
 *   "sources": ["Building Codes Database", "Local Data (Travis, TX)"],
 *   "confidence": "high",
 *   "provider": "openai",
 *   "includesWebSearch": false,
 *   "disclaimers": ["Verify with local building department"],
 *   "timestamp": "2026-05-07T..."
 * }
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    // Admin-only check
    if (!isAdmin(req)) {
      return res.status(403).json({
        error: "Unauthorized",
        message: "Scout 2.0 is currently available to admin users only",
      });
    }

    const { message, county, state, history } = req.body;

    // Validate input
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Invalid request",
        message: "Message is required and must be a non-empty string",
      });
    }

    const query = message.trim();
    const trade = extractTrade(query);
    const disclaimers: string[] = [];

    // Proactively gather data from ALL sources (Knowledge + Web + Local)
    const sourceData = await gatherMultiSourceData({
      query,
      county,
      state,
      trade,
    });

    // Synthesize all sources into a comprehensive prompt
    const synthesis = synthesizeMultiSourcePrompt(
      query,
      { query, county, state, trade },
      sourceData
    );

    // Build LLM providers with failover
    const providers = buildScoutLlmProviders();

    // Generate response using LLM with multi-source context
    const { text: llmResponse, provider } = await generateWithFallback(
      synthesis.systemPrompt,
      providers,
      {
        maxTokens: 900,
      }
    );

    // Build multi-source response
    const multiSourceResponse = buildMultiSourceResponse(synthesis, llmResponse);
    const { overallConfidence, conflictStatus } = synthesis;
    const routingTags = generateRoutingTags(query, synthesis);

    const scoutingReport = {
      mission: query,
      date: new Date().toISOString(),
      findings: multiSourceResponse.sourceBreakdown,
      synthesis: multiSourceResponse.message,
      confidence: overallConfidence,
      conflictStatus,
      routingTags,
      sources: multiSourceResponse.sources,
      disclaimers: allWarnings,
    };

    // Ensure table exists
    await ensureScoutLisaTable();

    // Build Scout findings for LISA persistence
    const scoutFindings: Array<{ item: LisaFeedItem; metadata: any }> = [];

    if (isCodeRelatedQuery(query)) {
      disclaimers.push("Always verify with your local building department before starting work");
      disclaimers.push("Building codes vary by jurisdiction and may have been updated");

      const trendMetadata = await getScoutTrendMetadata(
        "building_code",
        county,
        state,
        trade
      );

      // Extract a numeric value from the message for trend analysis, if possible
      const numericValueMatch = multiSourceResponse.message.match(/\d+(\.\d+)?/);
      const valueNumeric = numericValueMatch ? parseFloat(numericValueMatch[0]) : undefined;

      const codeFindings = scoutFindingsToLisaFeed([{
        type: "building_code",
        county,
        state,
        headline: multiSourceResponse.message.split(".")[0],
        narrative: multiSourceResponse.message,
        evidence: multiSourceResponse.sources.map((s) => `source=${s}`),
        confidence: overallConfidence,
        freshnessMinutes: 60,
        sources: synthesis.sourceUsage || [],
        valueNumeric,
        ...trendMetadata,
      }]);
      if (codeFindings.length > 0) {
        scoutFindings.push({
          item: codeFindings[0],
          metadata: {
            type: "building_code",
            county,
            state,
            trade,
            confidence: overallConfidence,
            conflictStatus,
            sources: multiSourceResponse.sources,
            expiresInMinutes: 1440,
            valueNumeric,
            ...trendMetadata,
            routingTags,
            scoutingReportJson: JSON.stringify(scoutingReport),
          },
        });
      }
    }

    if (isPricingRelatedQuery(query)) {
      disclaimers.push("Pricing varies significantly by location and contractor");
      disclaimers.push("Get quotes from multiple contractors for accurate estimates");

      const trendMetadata = await getScoutTrendMetadata(
        "material_price",
        county,
        state,
        trade
      );

      // Extract a numeric value from the message for trend analysis, if possible
      const numericValueMatch = multiSourceResponse.message.match(/\d+(\.\d+)?/);
      const valueNumeric = numericValueMatch ? parseFloat(numericValueMatch[0]) : undefined;

      const priceFindings = scoutFindingsToLisaFeed([{
        type: "material_price",
        state,
        trade,
        headline: multiSourceResponse.message.split(".")[0],
        narrative: multiSourceResponse.message,
        evidence: multiSourceResponse.sources.map((s) => `source=${s}`),
        confidence: overallConfidence,
        freshnessMinutes: 120,
        sources: synthesis.sourceUsage || [],
        valueNumeric,
        ...trendMetadata,
      }]);
      if (priceFindings.length > 0) {
        scoutFindings.push({
          item: priceFindings[0],
          metadata: {
            type: "material_price",
            state,
            trade,
            confidence: overallConfidence,
            conflictStatus,
            sources: multiSourceResponse.sources,
            expiresInMinutes: 2880,
            valueNumeric,
            ...trendMetadata,
            routingTags,
            scoutingReportJson: JSON.stringify(scoutingReport),
          },
        });
      }
    }

    // Combine all warnings
    const allWarnings = [...disclaimers, ...synthesis.warnings];

    // Store findings in LISA table
    if (scoutFindings.length > 0) {
      try {
        await storeScoutLisaFindings(scoutFindings);
      } catch (persistError) {
        console.error("[Scout 2.0] Failed to persist findings:", persistError);
      }
    }

    return res.json({
      success: true,
      // Active Scouting Response
      scoutingReport: scoutingReport,
      // Legacy compatibility
      message: multiSourceResponse.message,
      sources: multiSourceResponse.sources,
      sourceBreakdown: multiSourceResponse.sourceBreakdown,
      provider,
      disclaimers: allWarnings,
      timestamp: new Date().toISOString(),
      scoutVersion: "2.0",
      adminOnly: true,
    });
  } catch (error) {
    console.error("[Scout 2.0] Error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: (error as any)?.message || "Scout 2.0 encountered an error",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Scout 2.0 Test Endpoint
 * POST /api/scout-v2/test
 *
 * Quick test of Scout 2.0 capabilities
 */
router.post("/test", async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        error: "Unauthorized",
        message: "Scout 2.0 test is available to admin users only",
      });
    }

    const testQueries = [
      {
        message: "Do I need a permit for a deck in Texas?",
        county: "Travis",
        state: "TX",
      },
      {
        message: "How much does a roof replacement cost?",
        county: "Harris",
        state: "TX",
      },
      {
        message: "What are the electrical code requirements?",
        county: "Travis",
        state: "TX",
      },
    ];

    const results = [];

    for (const testQuery of testQueries) {
      try {
        const response = await new Promise((resolve, reject) => {
          const mockReq = {
            body: testQuery,
            user: (req as any).user,
            headers: req.headers,
          } as Request;

          const mockRes = {
            status: () => mockRes,
            json: (data: any) => {
              resolve(data);
            },
          } as any;

          // Call the main handler
          router.stack.find((r) => r.route?.path === "/" && r.route?.methods?.post)?.handle(
            mockReq,
            mockRes
          );
        });

        results.push({
          query: testQuery.message,
          response,
        });
      } catch (e) {
        results.push({
          query: testQuery.message,
          error: (e as any)?.message,
        });
      }
    }

    return res.json({
      success: true,
      testResults: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Scout 2.0] Test error:", error);
    return res.status(500).json({
      error: "Test failed",
      message: (error as any)?.message,
    });
  }
});

/**
 * Scout 2.0 Status Endpoint
 * GET /api/scout-v2/status
 *
 * Check Scout 2.0 configuration and LLM provider status
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        error: "Unauthorized",
      });
    }

    const providers = buildScoutLlmProviders();
    const providerStatus = providers.map((p) => ({
      name: p.name,
      configured: p.isConfigured(),
    }));

    return res.json({
      success: true,
      version: "2.0",
      status: "ready",
      providers: providerStatus,
      features: {
        openaiIntegration: true,
        webSearch: true,
        buildingCodes: true,
        pricing: true,
        tradeGuides: true,
        localData: true,
        sourceAttribution: true,
        confidenceIndicators: true,
      },
      adminOnly: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Scout 2.0] Status error:", error);
    return res.status(500).json({
      error: "Status check failed",
    });
  }
});

export default router;
