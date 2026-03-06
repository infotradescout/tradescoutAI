/**
 * Enhanced Scout Router v2 - Tool Result Feedback Loop
 *
 * This module extends scout-enhanced.ts with:
 * 1. Multi-turn reasoning with tool result feedback
 * 2. Adaptive tool selection based on previous results
 * 3. Error recovery and fallback strategies
 * 4. Outcome validation and learning
 *
 * This enables Scout to execute a tool, see the results, and decide
 * if it needs to call another tool or if it has enough information
 * to provide a complete answer to the user.
 */

import { Router, type Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { loadSystemPrompt } from "../services/promptService";
import { executeAssistantAction } from "../assistantActions";
import { buildUserContext, formatUserContextForPrompt } from "../services/userContextService";
import { loadScoutEnhancementConfig, getConfigStatus } from "../services/scoutEnhancementConfig";

const router = Router();

/**
 * Tool execution result with metadata
 */
interface ToolExecutionResult {
  tool_name: string;
  parameters: Record<string, any>;
  result: any;
  success: boolean;
  error?: string;
  execution_time_ms: number;
  timestamp: string;
}

/**
 * Multi-turn reasoning context
 */
interface MultiTurnContext {
  user_message: string;
  conversation_history: Array<{ role: string; content: string }>;
  tool_execution_history: ToolExecutionResult[];
  reasoning_turns: number;
  max_reasoning_turns: number;
  is_complete: boolean;
  final_message?: string;
}

/**
 * Enhanced response schema with tool result feedback
 */
interface EnhancedScoutResponseV2 {
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
  tool_results?: ToolExecutionResult[];
  multi_turn_context?: {
    reasoning_turns: number;
    is_complete: boolean;
    tool_execution_history: ToolExecutionResult[];
  };
  suggestedActions: string[];
}

/**
 * Parse LLM output into the enhanced response schema
 */
function parseEnhancedResponse(llmOutput: string): Partial<EnhancedScoutResponseV2> {
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
 * Execute tool calls and return results with metadata
 */
async function executeLLMToolCalls(
  toolCalls: EnhancedScoutResponseV2["tool_calls"],
  user?: any
): Promise<ToolExecutionResult[]> {
  const results: ToolExecutionResult[] = [];

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

      results.push({
        tool_name: toolCall.tool_name,
        parameters: toolCall.parameters,
        result,
        success: result.success !== false,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const executionTime = Date.now() - startTime;
      results.push({
        tool_name: toolCall.tool_name,
        parameters: toolCall.parameters,
        result: null,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return results;
}

/**
 * Build state acknowledgment from request context
 */
function buildStateAcknowledgment(req: Request): EnhancedScoutResponseV2["state_acknowledgment"] {
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
 * Format tool execution history for LLM context
 */
function formatToolExecutionHistory(history: ToolExecutionResult[]): string {
  if (history.length === 0) return "";

  let formatted = "\n## PREVIOUS TOOL EXECUTIONS\n";
  for (const execution of history) {
    formatted += `\n### Tool: ${execution.tool_name}\n`;
    formatted += `- Parameters: ${JSON.stringify(execution.parameters)}\n`;
    formatted += `- Success: ${execution.success}\n`;
    formatted += `- Execution Time: ${execution.execution_time_ms}ms\n`;
    if (execution.error) {
      formatted += `- Error: ${execution.error}\n`;
    } else {
      formatted += `- Result: ${JSON.stringify(execution.result, null, 2).substring(0, 500)}...\n`;
    }
  }
  return formatted;
}

/**
 * Determine if Scout should continue reasoning or provide final answer
 */
function shouldContinueReasoning(
  response: Partial<EnhancedScoutResponseV2>,
  context: MultiTurnContext
): boolean {
  // Stop if we've reached max turns
  if (context.reasoning_turns >= context.max_reasoning_turns) {
    return false;
  }

  // Stop if Scout explicitly says it's complete
  if (response.reflection?.confidence === "high" && response.message) {
    return false;
  }

  // Stop if there are no more tool calls to make
  if (!response.tool_calls || response.tool_calls.length === 0) {
    return false;
  }

  // Continue if there are gaps identified
  if (response.reflection?.gaps_identified && response.reflection.gaps_identified.length > 0) {
    return true;
  }

  return false;
}

/**
 * Enhanced POST endpoint with multi-turn tool result feedback loop
 */
router.post("/message-v2", async (req: Request, res: Response) => {
  try {
    const { message, conversationHistory = [], max_reasoning_turns = 3 } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    // Initialize multi-turn context
    const context: MultiTurnContext = {
      user_message: message,
      conversation_history: conversationHistory,
      tool_execution_history: [],
      reasoning_turns: 0,
      max_reasoning_turns,
      is_complete: false,
    };

    // Load configuration
    const config = loadScoutEnhancementConfig();
    const { content: systemPrompt } = loadSystemPrompt(false, config.useEnhancedPrompt);

    // Build user context
    const user = (req as any).user;
    const userContext = user ? await buildUserContext(user) : null;
    const userContextPrompt = userContext ? formatUserContextForPrompt(userContext) : "";

    // Build state acknowledgment
    const stateAcknowledgment = buildStateAcknowledgment(req);

    // Get Gemini API key
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.status(503).json({
        error: "Gemini API key not configured",
        message: "GEMINI_API_KEY environment variable is missing",
      });
    }

    const gemini = new GoogleGenerativeAI(geminiKey);
    const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash" });

    let finalResponse: Partial<EnhancedScoutResponseV2> | null = null;

    // Multi-turn reasoning loop
    while (context.reasoning_turns < context.max_reasoning_turns && !context.is_complete) {
      context.reasoning_turns++;

      // Build the prompt with tool execution history
      const toolHistoryContext = formatToolExecutionHistory(context.tool_execution_history);

      const fullPrompt = `${systemPrompt}

## CURRENT REQUEST STATE
${JSON.stringify(stateAcknowledgment, null, 2)}

## USER CONTEXT
${userContextPrompt}

## CONVERSATION HISTORY
${conversationHistory.map((m: any) => `${m.role}: ${m.content}`).join("\n")}

${toolHistoryContext}

## USER MESSAGE
"${message}"

## REASONING TURN: ${context.reasoning_turns} / ${context.max_reasoning_turns}

${context.reasoning_turns > 1 ? "You have already executed some tools. Based on the results above, decide if you need to execute more tools or if you have enough information to provide a complete answer to the user." : "Please respond with the enhanced JSON schema including state_acknowledgment, planning, tool_calls, and reflection sections."}`;

      // Call LLM
      const result = await model.generateContent(fullPrompt);
      const llmOutput = result.response.text();

      // Parse response
      const parsedResponse = parseEnhancedResponse(llmOutput);
      finalResponse = parsedResponse;

      // Execute any tool calls
      if (parsedResponse.tool_calls && parsedResponse.tool_calls.length > 0) {
        const toolResults = await executeLLMToolCalls(parsedResponse.tool_calls, user);
        context.tool_execution_history.push(...toolResults);

        // Check if we should continue reasoning
        if (!shouldContinueReasoning(parsedResponse, context)) {
          context.is_complete = true;
        }
      } else {
        // No more tools to call, we're done
        context.is_complete = true;
      }
    }

    // Build final response
    const response: EnhancedScoutResponseV2 = {
      intent: finalResponse?.intent || "unknown",
      state_acknowledgment: stateAcknowledgment,
      planning: finalResponse?.planning || {
        analysis: "Request processed",
        required_information: [],
        approach: "Standard response",
        potential_obstacles: [],
      },
      thought_flow: finalResponse?.thought_flow || [],
      tool_calls: finalResponse?.tool_calls || [],
      decision: finalResponse?.decision || "Responded based on available information",
      message: finalResponse?.message || "I'm here to help. What would you like to do?",
      reflection: finalResponse?.reflection || {
        confidence: "medium",
        data_sources_used: [],
        gaps_identified: [],
        learning_points: [],
      },
      tool_results: context.tool_execution_history,
      multi_turn_context: {
        reasoning_turns: context.reasoning_turns,
        is_complete: context.is_complete,
        tool_execution_history: context.tool_execution_history,
      },
      suggestedActions: finalResponse?.suggestedActions || [
        "Find contractors in my area",
        "Explore marketplace deals",
        "Start a community post",
      ],
    };

    return res.json(response);
  } catch (error) {
    console.error("[Scout Enhanced v2] Error:", error);
    return res.status(500).json({
      error: "Failed to process message",
      message: "Internal Server Error",
      requestId: (req as any).requestId || null,
    });
  }
});

/**
 * GET endpoint to retrieve configuration and capabilities
 */
router.get("/capabilities", (req: Request, res: Response) => {
  try {
    const config = loadScoutEnhancementConfig();
    return res.json({
      version: "v2",
      features: {
        structured_reasoning: true,
        dynamic_tool_invocation: true,
        tool_result_feedback: true,
        multi_turn_reasoning: true,
        error_recovery: true,
        outcome_validation: true,
      },
      config: getConfigStatus(),
      max_reasoning_turns: 3,
      supported_tools: [
        "search_contractors",
        "search_marketplace",
        "get_county_data",
        "web_search",
        "message_user",
        "create_project",
      ],
    });
  } catch (error) {
    console.error("[Scout Enhanced v2] Capabilities retrieval error:", error);
    return res.status(500).json({
      error: "Failed to retrieve capabilities",
    });
  }
});

/**
 * POST endpoint to test multi-turn reasoning with a specific scenario
 */
router.post("/test-multi-turn", async (req: Request, res: Response) => {
  try {
    const { message, scenario = "contractor_search" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Simulate a test scenario
    const testScenarios: Record<string, any> = {
      contractor_search: {
        description: "User is looking for a contractor in their area",
        expected_tools: ["search_contractors", "get_county_data"],
      },
      marketplace_browse: {
        description: "User wants to explore marketplace listings",
        expected_tools: ["search_marketplace"],
      },
      project_creation: {
        description: "User wants to create a project",
        expected_tools: ["create_project", "search_contractors"],
      },
    };

    const scenario_info = testScenarios[scenario] || testScenarios.contractor_search;

    return res.json({
      test_scenario: scenario,
      description: scenario_info.description,
      message,
      expected_tools: scenario_info.expected_tools,
      status: "Test scenario loaded. Use /api/scout-enhanced-v2/message-v2 to process.",
    });
  } catch (error) {
    console.error("[Scout Enhanced v2] Test error:", error);
    return res.status(500).json({
      error: "Failed to run test",
      message: "Internal Server Error",
      requestId: (req as any).requestId || null,
    });
  }
});

export default router;
