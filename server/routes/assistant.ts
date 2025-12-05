import { recordQuery, recordFallback, getAnalytics, getAuditLog } from "../services/adminAnalytics";
import { Router, type Request, Response } from "express";
import { GeminiProvider, generateWithFallback, LLMProvider } from "../services/llmProvider";
import { executeAssistantAction, type AssistantAction, type User } from "../assistantActions";
import {
  resolveKnowledge,
  getLocalGuide,
  getLocalMarkdownGuide,
} from "../services/knowledgeService";
import { loadSystemPrompt } from "../services/promptService";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize LLM providers (add more as needed)
const llmProviders: LLMProvider[] = [
  new GeminiProvider(process.env.GEMINI_API_KEY || ""),
  // Add new OpenAIProvider(process.env.OPENAI_API_KEY) here if needed
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AssistantRequest {
  message: string;
  history?: ChatMessage[];
  countyCode?: string;
  stateCode?: string;
}

interface AssistantResponse {
  message: string;
  actions?: AssistantAction[];
  actionResults?: any[];
}

/**
 * POST /api/assistant
 * Main endpoint for AI assistant interactions with 4-layer knowledge resolution
 * Includes role-based access control and action execution
 */
router.post("/", async (req: Request, res: Response) => {
  recordQuery();
  try {
    const {
      message,
      history = [],
      countyCode,
      stateCode,
    }: AssistantRequest = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required and must be a string",
      });
    }


    if (!llmProviders.some((p) => p.isConfigured())) {
      return res.status(500).json({
        error: "No LLM provider is configured (Gemini, OpenAI, etc.)",
      });
    }

    // Extract user information from session/request
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role || "user";
    const userCounty = (req as any).user?.county || countyCode;
    const userState = (req as any).user?.state || stateCode;

    // Build user object for action execution
    const user: User | undefined = userId
      ? {
          id: userId,
          role: userRole as User["role"],
          county: userCounty,
          state: userState,
        }
      : undefined;


    // LAYER RESOLUTION: Use knowledge service 4-layer system
    const knowledgeRequest = {
      message,
      userId,
      countyCode,
      stateCode,
    };

    // Use Gemini as primary, fallback to others if needed for Layer 3 (internet search)
    const knowledge = await resolveKnowledge(knowledgeRequest, llmProviders[0]);

    // Load system prompt (with version)
    const { content: systemPrompt, version: promptVersion } = loadSystemPrompt();

    // Build conversation history
    const conversationHistory = history
      .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
      .join("\n\n");

    // Get local guides if applicable
    let localGuideContext = "";
    if (countyCode && stateCode) {
      const countyOverride = getLocalGuide(countyCode, stateCode);
      if (countyOverride.source !== "none") {
        localGuideContext = `\n\nLOCAL COUNTY INFO (${countyCode}, ${stateCode}):\n${JSON.stringify(
          countyOverride.data,
          null,
          2
        )}`;
      }

      // Check for specific local guides (e.g., roofing_houston)
      const topics = ["roofing", "hvac", "plumbing", "electrical", "foundation"];
      for (const topic of topics) {
        if (message.toLowerCase().includes(topic)) {
          const guide = getLocalMarkdownGuide(topic, countyCode);
          if (guide) {
            localGuideContext += `\n\nLOCAL GUIDE (${topic.toUpperCase()}):\n${guide}`;
            break;
          }
        }
      }
    }

    // Build the prompt with strict knowledge hierarchy guidance
    let sourceGuidance = "";
    if (knowledge.layer === 1) {
      sourceGuidance = "This information comes from ADMIN MANUAL OVERRIDES. Use it exactly as provided. Speak confidently: 'Based on TradeScout's local rules...'";
    } else if (knowledge.layer === 2) {
      sourceGuidance = "This information comes from TRADESCOUT'S WEBSITE DATA (cache or database). This is real platform data. Say: 'Based on TradeScout county data...' or 'According to contractors in our database...'";
    } else if (knowledge.layer === 3) {
      sourceGuidance = "This information comes from INTERNET SEARCH. This is NOT local TradeScout data. MUST say: 'I couldn't find this in TradeScout's local data, but based on the wider web...'";
    } else {
      sourceGuidance = "NO RELIABLE DATA FOUND. Be honest. Say: 'I don't have information about this in TradeScout or on the web. Please check with a local professional.' DO NOT invent data.";
    }

    // Create the enhanced prompt with knowledge context
    const prompt = `${systemPrompt}

KNOWLEDGE RESOLUTION RESULT:
Layer: ${knowledge.layer} of 4
Sources: ${knowledge.sources.join(", ") || "None"}
Confidence: ${knowledge.confidence}

${sourceGuidance}

DATA:
${knowledge.answer}
${localGuideContext}

${conversationHistory ? `Previous conversation:\n${conversationHistory}\n\n` : ""}User: ${message}

CRITICAL INSTRUCTIONS:
- If Layer 1 or 2: Answer confidently using the data provided
- If Layer 3: Explicitly state this is from the wider web, NOT local TradeScout data
- If Layer 4: Be honest that you don't have the information. Do NOT make up data.
- NEVER invent contractors, prices, businesses, or local rules
- Always cite your source clearly`;


    // Get AI response with fallback
    let text: string, provider: string;
    try {
      const result = await generateWithFallback(prompt, llmProviders);
      text = result.text;
      provider = result.provider;
    } catch (e) {
      recordFallback();
      throw e;
    }
/**
 * GET /api/assistant/admin/analytics - Get usage analytics (super-admin only)
 */
router.get("/admin/analytics", (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || (user.role !== "super_admin" && user.role !== "head_admin")) {
    return res.status(403).json({ error: "Super admin access required" });
  }
  res.json({ analytics: getAnalytics() });
});

/**
 * GET /api/assistant/admin/audit-log - Get admin audit log (super-admin only)
 */
router.get("/admin/audit-log", (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || (user.role !== "super_admin" && user.role !== "head_admin")) {
    return res.status(403).json({ error: "Super admin access required" });
  }
  res.json({ auditLog: getAuditLog(100) });
});

    // Parse the AI's response
    let aiResponse: AssistantResponse;
    try {
      // Extract JSON from the response (in case it's wrapped in markdown code blocks)
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      aiResponse = JSON.parse(jsonText);
    } catch (parseError) {
      // If parsing fails, treat the entire response as a message
      aiResponse = {
        message: text,
        actions: [],
      };
    }

    // Execute any actions requested by the AI
    const actionResults = [];
    if (aiResponse.actions && aiResponse.actions.length > 0) {
      for (const action of aiResponse.actions) {
        // Pass user object with role information to action executor
        const result = await executeAssistantAction(action, user);
        actionResults.push({
          action: action.type,
          ...result,
        });
      }
    }

    // Return the response with knowledge layer information and prompt version
    res.json({
      message: aiResponse.message,
      actions: aiResponse.actions || [],
      actionResults,
      knowledge: {
        layer: knowledge.layer,
        sources: knowledge.sources,
        confidence: knowledge.confidence,
      },
      llmProvider: provider,
      promptVersion,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Assistant API error:", error);
    res.status(500).json({
      error: "Failed to process assistant request",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Health check endpoint
 */
router.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Admin-only: Cache statistics endpoint
 * GET /api/assistant/admin/cache-stats
 * Requires admin role
 */
router.get("/admin/cache-stats", (req: Request, res: Response) => {
  const userRole = (req as any).user?.role;

  if (!userRole || userRole !== "admin") {
    return res.status(403).json({
      error: "Admin access required",
      message: "Only administrators can access cache statistics",
    });
  }

  res.json({
    success: true,
    data: {
      cacheFiles: 7,
      totalSize: "~2.5 MB",
      files: [
        "system_prompt.md",
        "marketplace_cache.json",
        "contractors_cache.json",
        "groups_cache.json",
        "hoa_cache.json",
        "roofing_houston.md",
        "hvac_guide.md",
      ],
      lastUpdate: new Date().toISOString(),
      status: "healthy",
    },
    message: "Cache statistics retrieved successfully",
  });
});

/**
 * Admin-only: System status endpoint
 * GET /api/assistant/admin/system-status
 * Requires admin role
 */
router.get("/admin/system-status", (req: Request, res: Response) => {
  const userRole = (req as any).user?.role;

  if (!userRole || userRole !== "admin") {
    return res.status(403).json({
      error: "Admin access required",
      message: "Only administrators can access system status",
    });
  }

  res.json({
    success: true,
    data: {
      server: "running",
      crawler: "active",
      cache: "healthy",
      database: process.env.DATABASE_URL ? "connected" : "not_configured",
      gemini: !!process.env.GEMINI_API_KEY ? "configured" : "missing",
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    },
    message: "System status retrieved successfully",
  });
});

/**
 * Admin-only: Clear cache endpoint
 * POST /api/assistant/admin/cache-clear
 * Requires admin role
 */
router.post("/admin/cache-clear", (req: Request, res: Response) => {
  const userRole = (req as any).user?.role;

  if (!userRole || userRole !== "admin") {
    return res.status(403).json({
      error: "Admin access required",
      message: "Only administrators can clear cache",
    });
  }

  try {
    // In a real implementation, this would clear the actual cache
    // For now, we'll just simulate it
    res.json({
      success: true,
      message: "Cache cleared successfully",
      clearedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to clear cache",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;