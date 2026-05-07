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
import { webSearch } from "../services/webSearchService";
import {
  buildEnrichedPrompt,
  extractRelevantKnowledge,
  isCodeRelatedQuery,
  isPricingRelatedQuery,
} from "../services/scoutKnowledgeIntegration";

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

    // Extract relevant knowledge based on query
    const relevantKnowledge = extractRelevantKnowledge(query, trade, county, state);

    // Build enriched prompt with knowledge context
    const enrichedPrompt = buildEnrichedPrompt(
      query,
      {
        query,
        county,
        state,
        trade,
      },
      relevantKnowledge
    );

    // Build LLM providers with failover
    const providers = buildScoutLlmProviders();

    // Generate response using LLM with fallback
    const { text: llmResponse, provider } = await generateWithFallback(
      enrichedPrompt.systemPrompt,
      providers,
      {
        maxTokens: 900,
      }
    );

    // Check if we should do a web search for real-time data
    let includesWebSearch = false;
    let webSearchContent = "";

    if ((isCodeRelatedQuery(query) || isPricingRelatedQuery(query)) && provider === "openai") {
      // OpenAI can do web search, but we'll do it explicitly for transparency
      try {
        const searchResult = await webSearch(query, 3);
        if (searchResult.success && searchResult.content) {
          includesWebSearch = true;
          webSearchContent = `\n\n**Real-time Web Search Results:**\n${searchResult.content}`;
          enrichedPrompt.sources.push("Web Search (Real-time)");
        }
      } catch (e) {
        // Web search is optional, continue without it
        console.warn("[Scout 2.0] Web search failed:", e);
      }
    }

    // Add disclaimers based on query type
    if (isCodeRelatedQuery(query)) {
      disclaimers.push("Always verify with your local building department before starting work");
      disclaimers.push("Building codes vary by jurisdiction and may have been updated");
    }

    if (isPricingRelatedQuery(query)) {
      disclaimers.push("Pricing varies significantly by location and contractor");
      disclaimers.push("Get quotes from multiple contractors for accurate estimates");
    }

    // Build final response
    const finalMessage = llmResponse + webSearchContent;

    return res.json({
      success: true,
      message: finalMessage,
      sources: enrichedPrompt.sources,
      confidence: enrichedPrompt.confidence,
      provider,
      includesWebSearch,
      disclaimers,
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
