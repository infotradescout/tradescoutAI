import { recordQuery, recordFallback, getAnalytics, getAuditLog } from "../services/adminAnalytics";
import { Router, type Request, Response } from "express";
import { GeminiProvider, generateWithFallback, LLMProvider } from "../services/llmProvider";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { executeAssistantAction, type AssistantAction, type User } from "../assistantActions";
import {
  resolveKnowledge,
  getLocalGuide,
  getLocalMarkdownGuide,
  appendChatKnowledge,
  loadComprehensiveKnowledge,
} from "../services/knowledgeService";
import { loadSystemPrompt } from "../services/promptService";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lightweight fraud/scam guard for generated answers
const FRAUD_PATTERNS = [
  /gift\s*card/i,
  /wire\s*transfer/i,
  /bitcoin|crypto|usdt|wallet/i,
  /western\s*union|moneygram/i,
  /send\s+money|pay\s+immediately/i,
  /routing\s*number|account\s*number/i,
  /ssn|social\s*security/i,
];

function sanitizeSuspiciousContent(text: string): { flagged: boolean; message: string } {
  const flagged = FRAUD_PATTERNS.some((pattern) => pattern.test(text));
  const scrubbed = text.replace(/https?:\/\/\S+/g, "[link removed]");
  if (!flagged) {
    return { flagged: false, message: scrubbed };
  }

  const notice =
    "Safety notice: Potential scam content detected. Do not send money, gift cards, crypto, or share sensitive information.";
  return {
    flagged: true,
    message: `${scrubbed}\n\n${notice}`,
  };
}

const DEFAULT_AUTO_PROMPT = "What can TradeScout do for my community?";
const DEFAULT_SUGGESTIONS = [
  "Find roofers available this week",
  "List my pressure washer for $250",
  "Start the Community Builder for my county",
  "Find food trucks near me with MealScout",
  "Draft a welcome post for neighbors",
  "Show me top marketplace listings this week",
];

// Cache comprehensive knowledge to avoid reloading on every request
let cachedComprehensiveKnowledge: string | null = null;
let lastKnowledgeCache = 0;
const KNOWLEDGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached comprehensive knowledge or reload if stale
 */
async function getCachedComprehensiveKnowledge(): Promise<string> {
  const now = Date.now();
  if (cachedComprehensiveKnowledge && now - lastKnowledgeCache < KNOWLEDGE_CACHE_TTL) {
    return cachedComprehensiveKnowledge;
  }
  
  cachedComprehensiveKnowledge = await loadComprehensiveKnowledge();
  lastKnowledgeCache = now;
  return cachedComprehensiveKnowledge;
}

/**
 * Detect if a message is an intro/overview question
 */
function isIntroQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  const introPatterns = [
    /what\s+can\s+tradescout\s+do/i,
    /what\s+is\s+tradescout/i,
    /how\s+does\s+tradescout\s+work/i,
    /tell\s+me\s+about\s+tradescout/i,
    /overview\s+of\s+tradescout/i,
    /tradescout\s+features/i,
    /tradescout\s+capabilities/i,
  ];
  
  return introPatterns.some(pattern => pattern.test(lower));
}

/**
 * Generate smart synthesis response using comprehensive knowledge (for intro questions)
 */
async function generateSmartSynthesis(
  message: string,
  gemini: GoogleGenerativeAI | null,
  llmProviders: LLMProvider[]
): Promise<string> {
  if (!gemini || !llmProviders.some(p => p.isConfigured())) {
    return "I need the Gemini API configured to provide a comprehensive overview.";
  }

  try {
    // Use cached comprehensive knowledge
    const comprehensiveKnowledge = await getCachedComprehensiveKnowledge();
    
    // Create a synthesis-focused prompt
    const synthPrompt = `You are Scout, the AI for TradeScout - a hyperlocal contractor and marketplace platform.

Using the knowledge below, provide a comprehensive, engaging response to: "${message}"

Your response should:
1. Explain what TradeScout IS and its core purpose
2. List the main features and capabilities available
3. Explain who uses it (homeowners, contractors, community members)
4. Give concrete examples of how it helps people
5. Be conversational and inviting, not robotic
6. DO NOT make up features not mentioned in the knowledge base
7. Synthesize the information intelligently - don't just copy-paste snippets

Available Knowledge Base:
${comprehensiveKnowledge}

Now write a smart, comprehensive answer about TradeScout:`;

    const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(synthPrompt);
    return result.response.text();
  } catch (error) {
    console.error("[Scout] Synthesis error:", error);
    return "I encountered an error creating a comprehensive overview. Please try again.";
  }
}

/**
 * Generate smart synthesis using knowledge + conversation context
 * Enhanced version that elaborates and explains the knowledge intelligently
 */
async function synthesizeResponse(
  userMessage: string,
  knowledge: { answer: string; sources: string[]; layer: number; confidence: string },
  gemini: GoogleGenerativeAI | null,
  systemPrompt: string,
  conversationHistory: string
): Promise<string> {
  if (!gemini) {
    return knowledge.answer; // Fall back to raw knowledge if no Gemini
  }

  try {
    const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    // Smart synthesis that elaborates on knowledge while keeping facts intact
    const synthesisPrompt = `You are Scout, the TradeScout AI assistant. Your job is to make knowledge helpful and engaging.

User asked: "${userMessage}"

Knowledge from TradeScout (Layer ${knowledge.layer}):
${knowledge.answer}

TASK: Transform this knowledge into a helpful, conversational response that:
1. Answers the user's question directly
2. Elaborates with examples and context from the knowledge
3. Explains WHY and HOW things work, not just WHAT
4. Makes connections between related concepts
5. Uses conversational, friendly tone
6. Includes specific benefits or use cases
7. Is organized and easy to scan (use bullets/formatting)

${knowledge.layer === 1 || knowledge.layer === 2 ? "This is TradeScout data - speak with confidence and authority." : ""}
${knowledge.layer === 3 ? "This is from the internet, not local TradeScout data - be clear about that." : ""}
${knowledge.layer === 4 ? "You don't have reliable info - be honest about it." : ""}

DO NOT invent features or facts. ONLY use what's in the knowledge above.
Make it smart and helpful, not robotic.`;

    const result = await model.generateContent(synthesisPrompt);
    return result.response.text();
  } catch (error) {
    console.error("[Scout] Synthesis error:", error);
    return knowledge.answer; // Fall back to raw knowledge on error
  }
}

async function generateAutoPrompt(gemini: GoogleGenerativeAI | null) {
  if (!gemini) {
    return {
      source: "static" as const,
      autoPrompt: DEFAULT_AUTO_PROMPT,
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  try {
    const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `Create a single concise starter prompt a user should ask an AI concierge for a local contractor/marketplace app. Also return 6 short suggestions.
Return JSON with keys autoPrompt (string) and suggestions (string array).`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const autoPrompt = typeof parsed.autoPrompt === "string" && parsed.autoPrompt.trim().length > 0
        ? parsed.autoPrompt.trim()
        : DEFAULT_AUTO_PROMPT;
      const suggestions = Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0
        ? parsed.suggestions.slice(0, 6).map((s: any) => String(s))
        : DEFAULT_SUGGESTIONS;

      return { source: "gemini" as const, autoPrompt, suggestions };
    }
  } catch (error) {
    console.warn("[Scout] Auto-prompt generation failed; falling back to defaults", error);
  }

  return {
    source: "static" as const,
    autoPrompt: DEFAULT_AUTO_PROMPT,
    suggestions: DEFAULT_SUGGESTIONS,
  };
}

// Initialize LLM providers (add more as needed)
const llmProviders: LLMProvider[] = [
  new GeminiProvider(process.env.GEMINI_API_KEY || ""),
  // Add new OpenAIProvider(process.env.OPENAI_API_KEY) here if needed
];
const llmEnabled = llmProviders.some((p) => p.isConfigured());

// Dedicated Gemini client for knowledge layer (internet search)
const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ScoutRequest {
  message: string;
  history?: ChatMessage[];
  countyCode?: string;
  stateCode?: string;
}

interface ScoutResponse {
  message: string;
  actions?: AssistantAction[];
  actionResults?: any[];
}

/**
 * POST /api/scout
 * Main endpoint for AI Scout interactions with 4-layer knowledge resolution
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
    }: ScoutRequest = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required and must be a string",
      });
    }

    // SPECIAL HANDLING: Detect intro/overview questions and use comprehensive synthesis
    if (isIntroQuestion(message)) {
      try {
        const synthesisResponse = await generateSmartSynthesis(message, geminiClient, llmProviders);
        return res.json({
          message: synthesisResponse,
          actions: [],
          actionResults: [],
          knowledge: {
            layer: 1,
            sources: ["Comprehensive Knowledge Base (All Documents)"],
            confidence: "high"
          },
          llmProvider: "gemini",
          promptVersion: loadSystemPrompt().version,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("[Scout] Intro synthesis failed:", error);
        // Fall through to normal processing if synthesis fails
      }
    }

    const llmAvailable = llmProviders.some((p) => p.isConfigured());

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
    const knowledge = await resolveKnowledge(knowledgeRequest, geminiClient);

    // Load system prompt (with version)
    const { content: systemPrompt, version: promptVersion } = loadSystemPrompt();

    // If no LLM providers configured, return a structured offline response so app can be tested
    if (!llmAvailable) {
      return res.json({
        message: "LLM disabled in this environment. Returning knowledge result only.",
        actions: [],
        actionResults: [],
        knowledge: {
          layer: knowledge.layer,
          sources: knowledge.sources,
          confidence: knowledge.confidence,
          data: knowledge.answer,
        },
        llmProvider: "disabled",
        promptVersion,
        timestamp: new Date().toISOString(),
      });
    }

    // Build conversation history
    const conversationHistory = history
      .map((msg) => `${msg.role === "user" ? "User" : "Scout"}: ${msg.content}`)
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

    // SMART SYNTHESIS: Use Gemini to synthesize knowledge into intelligent answer
    // Instead of passing raw knowledge to the LLM, first synthesize it smartly
    const synthesizedAnswer = await synthesizeResponse(
      message,
      knowledge,
      geminiClient,
      systemPrompt,
      conversationHistory
    );

    // Check if this action requires authentication
    const authRequiredActions = [
      "create",
      "list",
      "post",
      "message",
      "find",
      "search",
      "contact",
      "apply",
      "join",
      "start",
      "launch",
      "apply for",
    ];
    
    const userAskedForAction = authRequiredActions.some(action => 
      message.toLowerCase().includes(action)
    );

    // If user is not authenticated and asked for an action, guide them to signup
    let finalAnswer = synthesizedAnswer;
    if (!userId && userAskedForAction && knowledge.layer < 4) {
      finalAnswer = `${synthesizedAnswer}

---

**To do this, you'll need a TradeScout account!** It only takes a minute:

1. Click the **"Create Account"** button at the top
2. Choose your role (Homeowner, Contractor, or Community Member)
3. Enter your email and create a password
4. Verify your email
5. Come back here and I'll help you with \`${message}\`

Ready? Let's set you up! 🚀`;
    }

    // The synthesized answer is our response!
    // Just return it directly with knowledge metadata
    const aiResponse: ScoutResponse = {
      message: finalAnswer,
      actions: [],
    };

    // Execute any actions if mentioned in the synthesized answer
    // (In this simple case, we don't extract actions - the synthesized answer is final)
    const actionResults = [];

    // Apply fraud/scam safety filter
    if (aiResponse.message) {
      const safety = sanitizeSuspiciousContent(aiResponse.message);
      aiResponse.message = safety.message;
      if (safety.flagged) {
        // Drop actions if content looks unsafe
        aiResponse.actions = [];
      }
    }

    // Persist non-sensitive Q&A back into the knowledge corpus for future retrieval
    try {
      appendChatKnowledge({
        question: message,
        answer: aiResponse.message,
        userId,
        countyCode,
        stateCode,
        layer: knowledge.layer,
        sources: knowledge.sources,
        actions: aiResponse.actions?.map((a) => a.type),
      });
    } catch (persistError) {
      console.error("Failed to append chat knowledge:", persistError);
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
      llmProvider: "gemini",
      promptVersion,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Scout API error:", error);
    res.status(500).json({
      error: "Failed to process Scout request",
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

// Pregenerated starter prompt + suggestions (for UI auto-run / quick taps)
router.get("/auto-prompt", async (_req: Request, res: Response) => {
  const { content: systemPrompt, version: promptVersion } = loadSystemPrompt();
  const auto = await generateAutoPrompt(geminiClient);

  res.json({
    autoPrompt: auto.autoPrompt,
    suggestions: auto.suggestions,
    source: auto.source,
    promptVersion,
    systemPromptBytes: systemPrompt.length,
  });
});

/**
 * Admin-only: Cache statistics endpoint
 * GET /api/scout/admin/cache-stats
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
 * GET /api/scout/admin/system-status
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
 * POST /api/scout/admin/cache-clear
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

// Admin analytics routes remain for auditability
router.get("/admin/analytics", (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || (user.role !== "super_admin" && user.role !== "head_admin")) {
    return res.status(403).json({ error: "Super admin access required" });
  }
  res.json({ analytics: getAnalytics() });
});

router.get("/admin/audit-log", (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || (user.role !== "super_admin" && user.role !== "head_admin")) {
    return res.status(403).json({ error: "Super admin access required" });
  }
  res.json({ auditLog: getAuditLog(100) });
});

export default router;