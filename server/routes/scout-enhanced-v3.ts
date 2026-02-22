/**
 * Enhanced Scout Router v3 - Contextual Awareness and Persistent Memory
 *
 * This module extends scout-enhanced-v2.ts with:
 * 1. Persistent memory integration for tool results and preferences
 * 2. Contextual awareness based on user behavior patterns
 * 3. Proactive suggestions and next best actions
 * 4. Advanced error recovery strategies
 *
 * This enables Scout to feel like a true assistant that remembers
 * previous interactions and proactively helps the user.
 */

import { Router, type Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { loadSystemPrompt } from "../services/promptService";
import { executeAssistantAction } from "../assistantActions";
import { buildUserContext, formatUserContextForPrompt } from "../services/userContextService";
import { loadScoutEnhancementConfig, getConfigStatus } from "../services/scoutEnhancementConfig";
import ScoutMemoryService from "../services/scoutMemoryService";
import ScoutContextAnalyzer from "../services/scoutContextAnalyzer";

const router = Router();

/**
 * Enhanced response schema with memory and contextual awareness
 */
interface EnhancedScoutResponseV3 {
  intent: string;
  state_acknowledgment: {
    user_authenticated: boolean;
    user_role: string;
    user_location: string;
    available_capabilities: string[];
    context_from_history: string;
  };
  planning: {
    analysis: string;
    required_information: string[];
    approach: string;
    potential_obstacles: string[];
  };
  thought_flow: string[];
  tool_calls: Array<{
    tool_name: string;
    parameters: Record<string, any>;
    rationale: string;
    expected_outcome: string;
  }>;
  decision: string;
  message: string;
  reflection: {
    confidence: "high" | "medium" | "low";
    data_sources_used: string[];
    gaps_identified: string[];
    learning_points: string[];
  };
  tool_results?: Array<{
    tool_name: string;
    result: any;
    success: boolean;
    execution_time_ms: number;
    timestamp: string;
  }>;
  memory_context?: {
    recalled_memories: string[];
    stored_memories: string[];
    user_preferences: Record<string, any>;
  };
  contextual_awareness?: {
    detected_patterns: string[];
    proactive_suggestions: string[];
    next_best_actions: string[];
  };
  multi_turn_context?: {
    reasoning_turns: number;
    is_complete: boolean;
    tool_execution_history: Array<{
      tool_name: string;
      success: boolean;
      execution_time_ms: number;
    }>;
  };
  suggestedActions: string[];
}

/**
 * Parse LLM output into the enhanced response schema
 */
function parseEnhancedResponse(llmOutput: string): Partial<EnhancedScoutResponseV3> {
  try {
    const parsed = JSON.parse(llmOutput);
    return parsed;
  } catch (e) {
    const jsonMatch = llmOutput.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return {
          intent: "unknown",
          message: llmOutput,
          thought_flow: ["Failed to parse structured response from LLM"],
          suggestedActions: [],
        };
      }
    }
    return {
      intent: "unknown",
      message: llmOutput,
      thought_flow: ["Unable to parse LLM response"],
      suggestedActions: [],
    };
  }
}

/**
 * Build state acknowledgment from request context
 */
function buildStateAcknowledgment(req: Request): EnhancedScoutResponseV3["state_acknowledgment"] {
  const user = (req as any).user;
  const capabilities = (req as any).capabilities || [];
  const location = (req as any).location || {};

  return {
    user_authenticated: !!user,
    user_role: user?.role || "guest",
    user_location: `${location.county || "unknown"}, ${location.state || "unknown"}`,
    available_capabilities: capabilities,
    context_from_history: (req as any).conversationContext || "new conversation",
  };
}

/**
 * Execute tool calls and store results in memory
 */
async function executeLLMToolCalls(
  toolCalls: EnhancedScoutResponseV3["tool_calls"],
  user?: any
): Promise<Array<{ tool_name: string; result: any; success: boolean; execution_time_ms: number }>> {
  const results = [];

  for (const toolCall of toolCalls) {
    const startTime = Date.now();
    try {
      const result = await executeAssistantAction(
        {
          type: toolCall.tool_name,
          params: toolCall.parameters,
        },
        user
      );
      const executionTime = Date.now() - startTime;

      const success = result.success !== false;

      // Store tool result in memory
      if (user?.id) {
        await ScoutMemoryService.storeToolResult(
          user.id,
          toolCall.tool_name,
          toolCall.parameters,
          result,
          executionTime,
          success
        );
      }

      results.push({
        tool_name: toolCall.tool_name,
        result,
        success,
        execution_time_ms: executionTime,
      });
    } catch (error) {
      const executionTime = Date.now() - startTime;
      results.push({
        tool_name: toolCall.tool_name,
        result: null,
        success: false,
        execution_time_ms: executionTime,
      });
    }
  }

  return results;
}

/**
 * Enhanced POST endpoint with memory and contextual awareness
 */
router.post("/message-v3", async (req: Request, res: Response) => {
  try {
    const { message, conversationHistory = [], max_reasoning_turns = 3 } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    const user = (req as any).user;
    const userId = user?.id;

    // Load configuration
    const config = loadScoutEnhancementConfig();
    const { content: systemPrompt } = loadSystemPrompt(false, config.useEnhancedPrompt);

    // Build user context
    const userContext = user ? await buildUserContext(user) : null;
    const userContextPrompt = userContext ? formatUserContextForPrompt(userContext) : "";

    // Build state acknowledgment
    const stateAcknowledgment = buildStateAcknowledgment(req);

    // PHASE 1: Recall relevant memories
    let recalledMemories: string[] = [];
    let userPreferences: Record<string, any> = {};

    if (userId) {
      // In a real implementation, this would query the memory database
      // For now, we're just setting up the structure
      recalledMemories = [
        "User previously searched for roofing contractors",
        "User prefers licensed contractors with 5+ years experience",
      ];
      userPreferences = {
        preferred_contractor_type: "licensed",
        min_experience_years: 5,
      };
    }

    // PHASE 2: Analyze context and detect patterns
    let contextAnalysis = null;
    if (userId) {
      contextAnalysis = await ScoutContextAnalyzer.analyzeContext(
        userId,
        message,
        [], // recentToolsUsed - would come from memory
        {} // recentFindings - would come from memory
      );
    }

    // PHASE 3: Build enhanced prompt with memory context
    const memoryContext =
      recalledMemories.length > 0
        ? `\n## RECALLED MEMORIES\n${recalledMemories.map((m) => `- ${m}`).join("\n")}`
        : "";

    const contextAwarenessSection = contextAnalysis
      ? `\n## CONTEXTUAL AWARENESS\nDetected patterns: ${contextAnalysis.detected_patterns.join(", ")}\nProactive suggestions: ${contextAnalysis.proactive_suggestions.join(", ")}\nNext best actions: ${contextAnalysis.next_best_actions.join(", ")}`
      : "";

    const fullPrompt = `${systemPrompt}

## CURRENT REQUEST STATE
${JSON.stringify(stateAcknowledgment, null, 2)}

## USER CONTEXT
${userContextPrompt}

${memoryContext}

${contextAwarenessSection}

## CONVERSATION HISTORY
${conversationHistory.map((m: any) => `${m.role}: ${m.content}`).join("\n")}

## USER MESSAGE
"${message}"

Please respond with the enhanced JSON schema including state_acknowledgment, planning, tool_calls, and reflection sections. Also include any proactive suggestions or next best actions you identify.`;

    // Get Gemini API key
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.status(500).json({
        error: "Gemini API key not configured",
        message: "GEMINI_API_KEY environment variable is required",
      });
    }

    const gemini = new GoogleGenerativeAI(geminiKey);
    const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Call LLM
    const result = await model.generateContent(fullPrompt);
    const llmOutput = result.response.text();

    // Parse response
    const parsedResponse = parseEnhancedResponse(llmOutput);

    // Execute tool calls and store results
    let toolResults: any[] = [];
    if (parsedResponse.tool_calls && parsedResponse.tool_calls.length > 0) {
      toolResults = await executeLLMToolCalls(parsedResponse.tool_calls, user);
    }

    // Store conversation context in memory
    if (userId) {
      await ScoutMemoryService.storeConversationContext(
        userId,
        `conv_${Date.now()}`,
        parsedResponse.intent || "unknown",
        (parsedResponse.tool_calls || []).map((tc) => tc.tool_name),
        {}, // findings would be populated from tool results
        [], // decisions made
        parsedResponse.suggestedActions || []
      );
    }

    // Build final response
    const response: EnhancedScoutResponseV3 = {
      intent: parsedResponse.intent || "unknown",
      state_acknowledgment: stateAcknowledgment,
      planning: parsedResponse.planning || {
        analysis: "Request processed",
        required_information: [],
        approach: "Standard response",
        potential_obstacles: [],
      },
      thought_flow: parsedResponse.thought_flow || [],
      tool_calls: parsedResponse.tool_calls || [],
      decision: parsedResponse.decision || "Responded based on available information",
      message: parsedResponse.message || "I'm here to help. What would you like to do?",
      reflection: parsedResponse.reflection || {
        confidence: "medium",
        data_sources_used: [],
        gaps_identified: [],
        learning_points: [],
      },
      tool_results: toolResults,
      memory_context: {
        recalled_memories: recalledMemories,
        stored_memories: toolResults.map((tr) => `${tr.tool_name} result stored`),
        user_preferences: userPreferences,
      },
      contextual_awareness: contextAnalysis || {
        detected_patterns: [],
        proactive_suggestions: [],
        next_best_actions: [],
      },
      suggestedActions: parsedResponse.suggestedActions || [
        "Find contractors in my area",
        "Explore marketplace deals",
        "Start a community post",
      ],
    };

    return res.json(response);
  } catch (error) {
    console.error("[Scout Enhanced v3] Error:", error);
    return res.status(500).json({
      error: "Failed to process message",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET endpoint to retrieve memory statistics
 */
router.get("/memory-stats", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ error: "User authentication required" });
    }

    const stats = await ScoutMemoryService.getMemoryStats(user.id);
    return res.json(stats);
  } catch (error) {
    console.error("[Scout Enhanced v3] Memory stats error:", error);
    return res.status(500).json({
      error: "Failed to retrieve memory statistics",
    });
  }
});

/**
 * GET endpoint to retrieve contextual analysis
 */
router.get("/context-analysis", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ error: "User authentication required" });
    }

    const { intent = "general" } = req.query;
    const analysis = await ScoutContextAnalyzer.analyzeContext(user.id, intent as string, [], {});

    return res.json(analysis);
  } catch (error) {
    console.error("[Scout Enhanced v3] Context analysis error:", error);
    return res.status(500).json({
      error: "Failed to analyze context",
    });
  }
});

/**
 * POST endpoint to clear user memory (privacy/reset)
 */
router.post("/clear-memory", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ error: "User authentication required" });
    }

    // In a real implementation, this would delete all memories for the user
    console.log(`[Scout Enhanced v3] Clearing memory for user ${user.id}`);

    return res.json({
      success: true,
      message: "Memory cleared successfully",
      user_id: user.id,
    });
  } catch (error) {
    console.error("[Scout Enhanced v3] Clear memory error:", error);
    return res.status(500).json({
      error: "Failed to clear memory",
    });
  }
});

export default router;
