/**
 * Scout Agent Supervisor - Phase 4
 * 
 * This service coordinates a council of specialized sub-agents:
 * 1. Marketplace Specialist Agent
 * 2. Contractor Specialist Agent
 * 3. Community Specialist Agent
 * 
 * The Supervisor analyzes user requests and delegates to the appropriate specialist(s),
 * then synthesizes their findings into a comprehensive response.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Agent types and their specialties
 */
export enum AgentType {
  MARKETPLACE = "marketplace_specialist",
  CONTRACTOR = "contractor_specialist",
  COMMUNITY = "community_specialist",
  GENERAL = "general_scout",
}

/**
 * Agent response interface
 */
export interface AgentResponse {
  agent_type: AgentType;
  expertise_applied: string;
  analysis: string;
  recommendations: string[];
  tools_used: string[];
  confidence: "high" | "medium" | "low";
  findings: Record<string, any>;
}

/**
 * Supervisor delegation decision
 */
export interface DelegationDecision {
  primary_agent: AgentType;
  secondary_agents: AgentType[];
  reasoning: string;
  expected_outcome: string;
}

/**
 * Scout Agent Supervisor
 */
export class ScoutAgentSupervisor {
  private geminiKey: string;
  private model: any;

  constructor() {
    this.geminiKey = process.env.GEMINI_API_KEY || "";
    if (this.geminiKey) {
      const gemini = new GoogleGenerativeAI(this.geminiKey);
      this.model = gemini.getGenerativeModel({ model: "gemini-2.5-flash" });
    }
  }

  /**
   * Analyze user request and decide which agents to delegate to
   */
  async analyzeAndDelegate(userMessage: string): Promise<DelegationDecision> {
    const analysisPrompt = `You are the Scout Agent Supervisor. Analyze this user request and decide which specialist agent(s) should handle it.

User Request: "${userMessage}"

Available Agents:
1. MARKETPLACE_SPECIALIST: Expert at finding deals, comparing prices, and analyzing marketplace listings
2. CONTRACTOR_SPECIALIST: Expert at vetting professionals, checking licenses, and matching projects to contractors
3. COMMUNITY_SPECIALIST: Expert at HOA rules, local groups, and neighborhood dynamics
4. GENERAL_SCOUT: Handles general questions and routing

Respond with JSON:
{
  "primary_agent": "AGENT_TYPE",
  "secondary_agents": ["AGENT_TYPE"],
  "reasoning": "Why you chose these agents",
  "expected_outcome": "What the agents should deliver"
}`;

    try {
      const result = await this.model.generateContent(analysisPrompt);
      const responseText = result.response.text();
      const parsed = JSON.parse(responseText);

      return {
        primary_agent: this.normalizeAgentType(parsed.primary_agent),
        secondary_agents: (parsed.secondary_agents || []).map((a: string) =>
          this.normalizeAgentType(a)
        ),
        reasoning: parsed.reasoning,
        expected_outcome: parsed.expected_outcome,
      };
    } catch (error) {
      console.error("[Scout Supervisor] Delegation analysis error:", error);
      // Default to general scout if analysis fails
      return {
        primary_agent: AgentType.GENERAL,
        secondary_agents: [],
        reasoning: "Analysis failed, routing to general scout",
        expected_outcome: "General response",
      };
    }
  }

  /**
   * Invoke a specialized agent
   */
  async invokeAgent(
    agentType: AgentType,
    userMessage: string,
    context: Record<string, any> = {}
  ): Promise<AgentResponse> {
    const systemPrompt = this.getAgentSystemPrompt(agentType);

    const contextString = Object.entries(context)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join("\n");

    const fullPrompt = `${systemPrompt}

## CONTEXT
${contextString}

## USER REQUEST
"${userMessage}"

Provide your expert analysis and recommendations in JSON format.`;

    try {
      const result = await this.model.generateContent(fullPrompt);
      const responseText = result.response.text();
      const parsed = JSON.parse(responseText);

      return {
        agent_type: agentType,
        expertise_applied: this.getAgentExpertise(agentType),
        analysis: parsed.analysis || "",
        recommendations: parsed.recommendations || [],
        tools_used: parsed.tools_used || [],
        confidence: parsed.confidence || "medium",
        findings: parsed.findings || {},
      };
    } catch (error) {
      console.error(`[Scout ${agentType}] Error:`, error);
      return {
        agent_type: agentType,
        expertise_applied: this.getAgentExpertise(agentType),
        analysis: `Failed to analyze request with ${agentType}`,
        recommendations: [],
        tools_used: [],
        confidence: "low",
        findings: {},
      };
    }
  }

  /**
   * Invoke multiple agents and synthesize their responses
   */
  async invokeMultipleAgents(
    agentTypes: AgentType[],
    userMessage: string,
    context: Record<string, any> = {}
  ): Promise<AgentResponse[]> {
    const responses: AgentResponse[] = [];

    for (const agentType of agentTypes) {
      const response = await this.invokeAgent(agentType, userMessage, context);
      responses.push(response);
    }

    return responses;
  }

  /**
   * Synthesize multiple agent responses into a cohesive answer
   */
  async synthesizeResponses(
    userMessage: string,
    agentResponses: AgentResponse[]
  ): Promise<{
    synthesized_message: string;
    key_insights: string[];
    recommendations: string[];
    confidence: "high" | "medium" | "low";
  }> {
    const agentSummaries = agentResponses
      .map(
        (r) =>
          `${r.agent_type}: ${r.analysis}\nRecommendations: ${r.recommendations.join(", ")}`
      )
      .join("\n\n");

    const synthesisPrompt = `You are the Scout Agent Supervisor synthesizing responses from multiple specialist agents.

User Request: "${userMessage}"

Agent Responses:
${agentSummaries}

Synthesize these responses into a single, cohesive message that:
1. Integrates insights from all agents
2. Prioritizes the most important findings
3. Provides clear, actionable recommendations
4. Maintains the user's trust and confidence

Respond with JSON:
{
  "synthesized_message": "The complete response to the user",
  "key_insights": ["insight1", "insight2"],
  "recommendations": ["recommendation1", "recommendation2"],
  "confidence": "high|medium|low"
}`;

    try {
      const result = await this.model.generateContent(synthesisPrompt);
      const responseText = result.response.text();
      return JSON.parse(responseText);
    } catch (error) {
      console.error("[Scout Supervisor] Synthesis error:", error);
      return {
        synthesized_message: "Unable to synthesize agent responses",
        key_insights: [],
        recommendations: [],
        confidence: "low",
      };
    }
  }

  /**
   * Get system prompt for a specific agent
   */
  private getAgentSystemPrompt(agentType: AgentType): string {
    const prompts: Record<AgentType, string> = {
      [AgentType.MARKETPLACE]: `You are the Marketplace Specialist Agent. You are an expert at:
- Finding and analyzing marketplace listings
- Comparing prices and quality
- Identifying deals and value
- Understanding item conditions and specifications
- Recommending similar items
- Detecting potential issues or red flags

Your analysis should be detailed, practical, and focused on helping users make smart purchasing decisions.`,

      [AgentType.CONTRACTOR]: `You are the Contractor Specialist Agent. You are an expert at:
- Vetting and evaluating contractors
- Checking licenses and certifications
- Assessing contractor specialties and experience
- Matching projects to qualified professionals
- Identifying red flags or concerns
- Recommending the best contractor for specific jobs
- Understanding trade requirements and standards

Your analysis should be thorough, professional, and focused on ensuring users hire the right person for the job.`,

      [AgentType.COMMUNITY]: `You are the Community Specialist Agent. You are an expert at:
- Understanding HOA rules and regulations
- Navigating local group dynamics
- Identifying relevant community resources
- Understanding neighborhood norms and standards
- Connecting users with community opportunities
- Resolving community-related questions

Your analysis should be community-focused and help users engage effectively with their local community.`,

      [AgentType.GENERAL]: `You are the General Scout Agent. You provide helpful, accurate information about TradeScout and help route users to the right resources.`,
    };

    return prompts[agentType] || prompts[AgentType.GENERAL];
  }

  /**
   * Get expertise description for an agent
   */
  private getAgentExpertise(agentType: AgentType): string {
    const expertise: Record<AgentType, string> = {
      [AgentType.MARKETPLACE]:
        "Marketplace analysis, price comparison, deal identification, and item evaluation",
      [AgentType.CONTRACTOR]:
        "Contractor vetting, license verification, specialty matching, and professional assessment",
      [AgentType.COMMUNITY]:
        "HOA regulations, community engagement, local resources, and neighborhood dynamics",
      [AgentType.GENERAL]: "General information and routing",
    };

    return expertise[agentType] || "General assistance";
  }

  /**
   * Normalize agent type string to enum
   */
  private normalizeAgentType(agentString: string): AgentType {
    const normalized = agentString.toUpperCase().replace(/[_-]/g, "_");

    switch (normalized) {
      case "MARKETPLACE_SPECIALIST":
        return AgentType.MARKETPLACE;
      case "CONTRACTOR_SPECIALIST":
        return AgentType.CONTRACTOR;
      case "COMMUNITY_SPECIALIST":
        return AgentType.COMMUNITY;
      default:
        return AgentType.GENERAL;
    }
  }

  /**
   * Get supervisor status
   */
  getStatus(): {
    available_agents: AgentType[];
    status: string;
    gemini_configured: boolean;
  } {
    return {
      available_agents: [
        AgentType.MARKETPLACE,
        AgentType.CONTRACTOR,
        AgentType.COMMUNITY,
        AgentType.GENERAL,
      ],
      status: "operational",
      gemini_configured: !!this.geminiKey,
    };
  }
}

export default ScoutAgentSupervisor;
