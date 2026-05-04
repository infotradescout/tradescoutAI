/**
 * Enhanced Scout Router - Phase 1 Implementation
 *
 * This module extends the existing Scout router with:
 * 1. Structured reasoning and planning capabilities
 * 2. Dynamic tool invocation from LLM output
 * 3. Enhanced reflection and self-correction
 * 4. Comprehensive state acknowledgment
 *
 * This is a companion module to the existing scout.ts router.
 * It can be gradually integrated or run in parallel for testing.
 */

import { Router, type Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateGeminiTextWithFallback } from "../ai/geminiFallback";
import { loadSystemPrompt } from "../services/promptService";
import { executeAssistantAction } from "../assistantActions";
import { buildUserContext, formatUserContextForPrompt } from "../services/userContextService";
import { loadScoutEnhancementConfig, getConfigStatus } from "../services/scoutEnhancementConfig";

const router = Router();

/**
 * Enhanced response schema that includes planning, tool calls, and reflection
 */
interface EnhancedScoutResponse {
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
  suggestedActions: string[];
}

/**
 * Parse LLM output into the enhanced response schema
 * Handles both structured JSON responses and fallback parsing
 */
function parseEnhancedResponse(llmOutput: string): Partial<EnhancedScoutResponse> {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(llmOutput);
    return parsed;
  } catch (e) {
    // If JSON parsing fails, attempt to extract JSON from the output
    const jsonMatch = llmOutput.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // If extraction fails, return a minimal structured response
        return {
          intent: "unknown",
          message: llmOutput,
          thought_flow: ["Failed to parse structured response from LLM"],
          suggestedActions: [
            "Try rephrasing your question",
            "Ask about a specific topic",
            "Get help with navigation",
          ],
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
 * Execute tool calls returned by the LLM
 * Returns results that can be fed back to the LLM for reflection
 */
async function executeLLMToolCalls(
  toolCalls: EnhancedScoutResponse["tool_calls"],
  user?: any
): Promise<Array<{ tool_name: string; result: any; error?: string }>> {
  const results: Array<{ tool_name: string; result: any; error?: string }> = [];

  for (const toolCall of toolCalls) {
    try {
      const result = await executeAssistantAction(
        {
          type: toolCall.tool_name,
          params: toolCall.parameters,
        },
        user
      );
      results.push({
        tool_name: toolCall.tool_name,
        result,
      });
    } catch (error) {
      results.push({
        tool_name: toolCall.tool_name,
        result: null,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

/**
 * Build state acknowledgment from request context
 */
function buildStateAcknowledgment(req: Request): EnhancedScoutResponse["state_acknowledgment"] {
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
 * Enhanced POST endpoint for Scout messages with structured reasoning
 */
router.post("/message-enhanced", async (req: Request, res: Response) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    // Load enhanced system prompt
    const config = loadScoutEnhancementConfig();
    const { content: systemPrompt } = loadSystemPrompt(false, config.useEnhancedPrompt);
    const enhancedPrompt = systemPrompt;

    // Build user context
    const user = (req as any).user;
    const userContext = user ? await buildUserContext(user) : null;
    const userContextPrompt = userContext ? formatUserContextForPrompt(userContext) : "";

    // Build state acknowledgment
    const stateAcknowledgment = buildStateAcknowledgment(req);

    // Construct the full prompt with state injection
    const fullPrompt = `${enhancedPrompt}

## CURRENT REQUEST STATE
${JSON.stringify(stateAcknowledgment, null, 2)}

## USER CONTEXT
${userContextPrompt}

## CONVERSATION HISTORY
${conversationHistory.map((m: any) => `${m.role}: ${m.content}`).join("\n")}

## USER MESSAGE
"${message}"

Please respond with the enhanced JSON schema including state_acknowledgment, planning, tool_calls, and reflection sections.`;

    // Call Gemini with the enhanced prompt
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.status(503).json({
        error: "Gemini API key not configured",
        message: "GEMINI_API_KEY environment variable is missing for enhanced Scout",
      });
    }
    const gemini = new GoogleGenerativeAI(geminiKey);
    const { text: llmOutput } = await generateGeminiTextWithFallback(gemini, fullPrompt);

    // Parse the LLM response
    const parsedResponse = parseEnhancedResponse(llmOutput);

    // Execute any tool calls specified by the LLM
    let toolResults: Array<{ tool_name: string; result: any; error?: string }> = [];
    if (parsedResponse.tool_calls && parsedResponse.tool_calls.length > 0) {
      toolResults = await executeLLMToolCalls(parsedResponse.tool_calls, user);

      // If there were tool results, we could feed them back to the LLM for reflection
      // For now, we'll include them in the response for transparency
      (parsedResponse as any).tool_results = toolResults;
    }

    // Build the final response
    const response: Partial<EnhancedScoutResponse> = {
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
      suggestedActions: parsedResponse.suggestedActions || [
        "Find contractors in my area",
        "Explore marketplace deals",
        "Start a community post",
      ],
    };

    return res.json(response);
  } catch (error) {
    console.error("[Scout Enhanced] Error:", error);
    return res.status(500).json({
      error: "Failed to process message",
      message: "Internal Server Error",
      requestId: (req as any).requestId || null,
    });
  }
});

/**
 * GET endpoint to retrieve the enhanced system prompt
 * Useful for debugging and understanding Scout's instructions
 */
router.get("/system-prompt-enhanced", (req: Request, res: Response) => {
  try {
    const config = loadScoutEnhancementConfig();
    const { content, version } = loadSystemPrompt(false, true);
    const isEnhanced = content.includes("ENHANCED EXECUTION CONTRACT");

    return res.json({
      version,
      is_enhanced: isEnhanced,
      prompt_length: content.length,
      config: getConfigStatus(),
      key_sections: [
        "Hard Identity Rules",
        "Enhanced Execution Contract",
        "Enhanced Response Schema",
        "State Injection",
        "Data Source Hierarchy",
        "Dynamic Tool Invocation Protocol",
        "Self-Correction and Learning",
      ],
    });
  } catch (error) {
    console.error("[Scout Enhanced] Prompt retrieval error:", error);
    return res.status(500).json({
      error: "Failed to retrieve system prompt",
    });
  }
});

/**
 * GET endpoint to retrieve Scout enhancement configuration status
 */
router.get("/config", (req: Request, res: Response) => {
  try {
    const config = loadScoutEnhancementConfig();
    return res.json({
      config,
      status: getConfigStatus(),
    });
  } catch (error) {
    console.error("[Scout Enhanced] Config retrieval error:", error);
    return res.status(500).json({
      error: "Failed to retrieve configuration",
    });
  }
});

/**
 * POST endpoint to test tool invocation
 * Allows testing of the tool execution pipeline
 */
router.post("/test-tool-invocation", async (req: Request, res: Response) => {
  try {
    const { tool_name, parameters } = req.body;

    if (!tool_name) {
      return res.status(400).json({ error: "tool_name is required" });
    }

    const user = (req as any).user;
    const result = await executeAssistantAction(
      {
        type: tool_name,
        params: parameters || {},
      },
      user
    );

    return res.json({
      tool_name,
      result,
      success: result.success,
    });
  } catch (error) {
    console.error("[Scout Enhanced] Tool invocation error:", error);
    return res.status(500).json({
      error: "Failed to invoke tool",
      message: "Internal Server Error",
      requestId: (req as any).requestId || null,
    });
  }
});

export default router;
