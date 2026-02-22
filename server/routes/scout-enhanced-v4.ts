/**
 * Enhanced Scout Router v4 - Multi-Agent Collaboration
 * 
 * This module extends scout-enhanced-v3.ts with:
 * 1. Scout Agent Supervisor coordination
 * 2. Specialized sub-agent invocation
 * 3. Multi-agent response synthesis
 * 4. Collaborative problem-solving
 * 
 * This enables Scout to leverage a "council" of specialists for deeper,
 * more expert-level reasoning and recommendations.
 */

import { Router, type Request, Response } from "express";
import { loadSystemPrompt } from "../services/promptService";
import { buildUserContext, formatUserContextForPrompt } from "../services/userContextService";
import { loadScoutEnhancementConfig } from "../services/scoutEnhancementConfig";
import ScoutAgentSupervisor, { AgentType } from "../services/scoutAgentSupervisor";
import {
  MarketplaceSpecialistAgent,
  ContractorSpecialistAgent,
  CommunitySpecialistAgent,
} from "../services/scoutSpecializedAgents";

const router = Router();

/**
 * Enhanced response schema with multi-agent collaboration
 */
interface EnhancedScoutResponseV4 {
  intent: string;
  state_acknowledgment: {
    user_authenticated: boolean;
    user_role: string;
    user_location: string;
    available_capabilities: string[];
    context_from_history: string;
  };
  agent_council_analysis: {
    primary_agent: AgentType;
    secondary_agents: AgentType[];
    delegation_reasoning: string;
    agent_responses: Array<{
      agent_type: AgentType;
      expertise_applied: string;
      analysis: string;
      recommendations: string[];
      confidence: "high" | "medium" | "low";
    }>;
  };
  synthesized_response: {
    message: string;
    key_insights: string[];
    recommendations: string[];
    confidence: "high" | "medium" | "low";
  };
  planning: {
    analysis: string;
    required_information: string[];
    approach: string;
    potential_obstacles: string[];
  };
  reflection: {
    confidence: "high" | "medium" | "low";
    data_sources_used: string[];
    gaps_identified: string[];
    learning_points: string[];
  };
  suggestedActions: string[];
}

/**
 * Build state acknowledgment from request context
 */
function buildStateAcknowledgment(req: Request): EnhancedScoutResponseV4["state_acknowledgment"] {
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
 * Enhanced POST endpoint with multi-agent collaboration
 */
router.post("/message-v4", async (req: Request, res: Response) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    const user = (req as any).user;
    const stateAcknowledgment = buildStateAcknowledgment(req);

    // Load configuration
    const config = loadScoutEnhancementConfig();
    const { content: systemPrompt } = loadSystemPrompt(false, config.useEnhancedPrompt);

    // Build user context
    const userContext = user ? await buildUserContext(user) : null;
    const userContextPrompt = userContext ? formatUserContextForPrompt(userContext) : "";

    // PHASE 1: Initialize Agent Supervisor
    const supervisor = new ScoutAgentSupervisor();

    // PHASE 2: Analyze request and delegate to appropriate agents
    const delegationDecision = await supervisor.analyzeAndDelegate(message);

    // PHASE 3: Invoke agents
    const agentsToInvoke = [
      delegationDecision.primary_agent,
      ...delegationDecision.secondary_agents,
    ];

    const agentResponses = [];

    // Invoke marketplace specialist if needed
    if (agentsToInvoke.includes(AgentType.MARKETPLACE)) {
      const marketplaceAnalysis = await MarketplaceSpecialistAgent.analyzeDeal(message);
      agentResponses.push({
        agent_type: AgentType.MARKETPLACE,
        expertise_applied: "Marketplace analysis, price comparison, deal identification",
        analysis: `Found ${marketplaceAnalysis.best_deals.length} potential deals. Average market price: $${marketplaceAnalysis.market_analysis.average_price}`,
        recommendations: marketplaceAnalysis.recommendations,
        confidence: marketplaceAnalysis.best_deals.length > 0 ? "high" : "medium",
      });
    }

    // Invoke contractor specialist if needed
    if (agentsToInvoke.includes(AgentType.CONTRACTOR)) {
      const contractorAnalysis = await ContractorSpecialistAgent.vetContractors(
        message,
        stateAcknowledgment.user_location
      );
      agentResponses.push({
        agent_type: AgentType.CONTRACTOR,
        expertise_applied: "Contractor vetting, license verification, specialty matching",
        analysis: `Reviewed ${contractorAnalysis.vetting_analysis.total_reviewed} contractors. ${contractorAnalysis.vetting_analysis.qualified_count} are fully qualified.`,
        recommendations: contractorAnalysis.recommendations,
        confidence:
          contractorAnalysis.vetting_analysis.qualified_count > 0 ? "high" : "medium",
      });
    }

    // Invoke community specialist if needed
    if (agentsToInvoke.includes(AgentType.COMMUNITY)) {
      const communityAnalysis = await CommunitySpecialistAgent.analyzeCommunityCommunity(
        stateAcknowledgment.user_location
      );
      agentResponses.push({
        agent_type: AgentType.COMMUNITY,
        expertise_applied: "HOA regulations, community engagement, local resources",
        analysis: `Found ${communityAnalysis.local_groups.length} active local groups. ${communityAnalysis.hoa_info.exists ? "HOA is active in your area." : "No HOA in your area."}`,
        recommendations: communityAnalysis.recommendations,
        confidence: "high",
      });
    }

    // PHASE 4: Synthesize agent responses
    let synthesizedResponse = {
      message: "I've consulted with my specialist agents to provide you with expert guidance.",
      key_insights: [] as string[],
      recommendations: [] as string[],
      confidence: "medium" as const,
    };

    if (agentResponses.length > 0) {
      // Aggregate insights and recommendations
      agentResponses.forEach((response) => {
        synthesizedResponse.key_insights.push(response.analysis);
        synthesizedResponse.recommendations.push(...response.recommendations);
      });

      // Determine overall confidence
      const avgConfidence =
        agentResponses.filter((r) => r.confidence === "high").length /
        agentResponses.length;
      synthesizedResponse.confidence = avgConfidence > 0.66 ? "high" : "medium";

      // Build comprehensive message
      synthesizedResponse.message = `Based on consultation with my specialist agents:\n\n${agentResponses
        .map((r) => `**${r.agent_type}:** ${r.analysis}`)
        .join("\n\n")}`;
    }

    // Build final response
    const response: EnhancedScoutResponseV4 = {
      intent: delegationDecision.primary_agent,
      state_acknowledgment: stateAcknowledgment,
      agent_council_analysis: {
        primary_agent: delegationDecision.primary_agent,
        secondary_agents: delegationDecision.secondary_agents,
        delegation_reasoning: delegationDecision.reasoning,
        agent_responses: agentResponses,
      },
      synthesized_response: synthesizedResponse,
      planning: {
        analysis: delegationDecision.expected_outcome,
        required_information: [],
        approach: `Delegated to ${agentsToInvoke.length} specialist agent(s)`,
        potential_obstacles: [],
      },
      reflection: {
        confidence: synthesizedResponse.confidence,
        data_sources_used: agentResponses.map((r) => r.agent_type),
        gaps_identified: [],
        learning_points: [
          `Successfully coordinated ${agentResponses.length} specialist agents`,
          "Multi-agent collaboration provides deeper expertise",
        ],
      },
      suggestedActions: [
        "Review specialist recommendations",
        "Ask follow-up questions",
        "Take action on recommendations",
      ],
    };

    return res.json(response);
  } catch (error) {
    console.error("[Scout Enhanced v4] Error:", error);
    return res.status(500).json({
      error: "Failed to process message with agent council",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET endpoint to retrieve agent council status
 */
router.get("/agent-council-status", (req: Request, res: Response) => {
  try {
    const supervisor = new ScoutAgentSupervisor();
    const status = supervisor.getStatus();

    return res.json({
      council_status: "operational",
      supervisor: status,
      agents: [
        {
          type: "MARKETPLACE_SPECIALIST",
          expertise: "Deal finding, price comparison, marketplace analysis",
          status: "active",
        },
        {
          type: "CONTRACTOR_SPECIALIST",
          expertise: "Contractor vetting, license verification, project matching",
          status: "active",
        },
        {
          type: "COMMUNITY_SPECIALIST",
          expertise: "HOA rules, local groups, community engagement",
          status: "active",
        },
      ],
    });
  } catch (error) {
    console.error("[Scout Enhanced v4] Status error:", error);
    return res.status(500).json({
      error: "Failed to retrieve agent council status",
    });
  }
});

/**
 * POST endpoint to test agent delegation
 */
router.post("/test-delegation", async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const supervisor = new ScoutAgentSupervisor();
    const delegation = await supervisor.analyzeAndDelegate(message);

    return res.json({
      user_message: message,
      delegation_decision: delegation,
      agents_to_invoke: [delegation.primary_agent, ...delegation.secondary_agents],
    });
  } catch (error) {
    console.error("[Scout Enhanced v4] Delegation test error:", error);
    return res.status(500).json({
      error: "Failed to test delegation",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
