/**
 * Enhanced Scout Router v5 - Deep Tool Integration
 *
 * This module extends scout-enhanced-v4.ts with:
 * 1. Car Sales action execution (VIN lookup, payment calculation, trade-in estimation)
 * 2. Real Estate action execution (CMA generation, mortgage calculation)
 * 3. Accounting action execution (ledger summary, invoice lookup, financial reports)
 * 4. Intelligent action selection based on user intent
 *
 * This enables Scout to not just find features, but actually *operate* them
 * and return real results directly in the conversation.
 */

import { Router, type Request, Response } from "express";
import { loadSystemPrompt } from "../services/promptService";
import { buildUserContext, formatUserContextForPrompt } from "../services/userContextService";
import { loadScoutEnhancementConfig } from "../services/scoutEnhancementConfig";
import ScoutAgentSupervisor, { AgentType } from "../services/scoutAgentSupervisor";
import {
  CarSalesConnector,
  RealEstateConnector,
  AccountingConnector,
} from "../services/scoutActionConnectors";

const router = Router();

/**
 * Enhanced response schema with deep tool integration
 */
interface EnhancedScoutResponseV5 {
  intent: string;
  detected_action: {
    action_type: "car_sales" | "real_estate" | "accounting" | "routing" | "general";
    action_name: string;
    parameters_detected: Record<string, any>;
    confidence: "high" | "medium" | "low";
  };
  action_execution: {
    executed: boolean;
    action_type?: string;
    result?: any;
    error?: string;
    execution_time_ms?: number;
  };
  agent_council_analysis: {
    primary_agent: AgentType;
    secondary_agents: AgentType[];
    delegation_reasoning: string;
  };
  message: string;
  suggested_next_actions: string[];
  suggestedActions: string[];
}

/**
 * Build state acknowledgment from request context
 */
function buildStateAcknowledgment(req: Request) {
  const user = (req as any).user;
  const capabilities = (req as any).capabilities || [];
  const location = (req as any).location || {};

  return {
    user_authenticated: !!user,
    user_role: user?.role || "guest",
    user_location: `${location.county || "unknown"}, ${location.state || "unknown"}`,
    available_capabilities: capabilities,
  };
}

/**
 * Detect action intent from user message
 */
function detectActionIntent(message: string): {
  action_type: "car_sales" | "real_estate" | "accounting" | "routing" | "general";
  action_name: string;
  parameters_detected: Record<string, any>;
  confidence: "high" | "medium" | "low";
} {
  const messageLower = message.toLowerCase();

  // Car Sales Detection
  if (
    messageLower.includes("vin") ||
    messageLower.includes("car") ||
    messageLower.includes("vehicle") ||
    messageLower.includes("financing") ||
    messageLower.includes("monthly payment")
  ) {
    if (messageLower.includes("vin")) {
      const vinMatch = message.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
      return {
        action_type: "car_sales",
        action_name: "vin_lookup",
        parameters_detected: { vin: vinMatch ? vinMatch[0] : null },
        confidence: vinMatch ? "high" : "medium",
      };
    }

    if (messageLower.includes("payment") || messageLower.includes("financing")) {
      return {
        action_type: "car_sales",
        action_name: "calculate_payment",
        parameters_detected: {},
        confidence: "medium",
      };
    }

    if (messageLower.includes("trade")) {
      return {
        action_type: "car_sales",
        action_name: "estimate_trade_in",
        parameters_detected: {},
        confidence: "medium",
      };
    }
  }

  // Real Estate Detection
  if (
    messageLower.includes("home") ||
    messageLower.includes("property") ||
    messageLower.includes("real estate") ||
    messageLower.includes("mortgage") ||
    messageLower.includes("cma") ||
    messageLower.includes("realtor")
  ) {
    if (messageLower.includes("cma") || messageLower.includes("comparable")) {
      return {
        action_type: "real_estate",
        action_name: "generate_cma",
        parameters_detected: {},
        confidence: "high",
      };
    }

    if (messageLower.includes("mortgage") || messageLower.includes("payment")) {
      return {
        action_type: "real_estate",
        action_name: "calculate_mortgage",
        parameters_detected: {},
        confidence: "high",
      };
    }
  }

  // Accounting Detection
  if (
    messageLower.includes("invoice") ||
    messageLower.includes("ledger") ||
    messageLower.includes("accounting") ||
    messageLower.includes("financial") ||
    messageLower.includes("income") ||
    messageLower.includes("expense")
  ) {
    if (messageLower.includes("invoice")) {
      return {
        action_type: "accounting",
        action_name: "find_invoice",
        parameters_detected: {},
        confidence: "high",
      };
    }

    if (messageLower.includes("ledger") || messageLower.includes("summary")) {
      return {
        action_type: "accounting",
        action_name: "get_ledger_summary",
        parameters_detected: {},
        confidence: "high",
      };
    }

    if (messageLower.includes("report") || messageLower.includes("financial")) {
      return {
        action_type: "accounting",
        action_name: "generate_financial_report",
        parameters_detected: {},
        confidence: "medium",
      };
    }
  }

  return {
    action_type: "general",
    action_name: "general_response",
    parameters_detected: {},
    confidence: "low",
  };
}

/**
 * Execute detected action
 */
async function executeDetectedAction(
  actionType: string,
  actionName: string,
  params: Record<string, any>
): Promise<{ success: boolean; result?: any; error?: string; execution_time_ms: number }> {
  const startTime = Date.now();

  try {
    switch (actionType) {
      case "car_sales":
        if (actionName === "vin_lookup") {
          const result = await CarSalesConnector.vinLookup(params.vin || "");
          return {
            success: result.success,
            result,
            execution_time_ms: Date.now() - startTime,
          };
        } else if (actionName === "calculate_payment") {
          const result = await CarSalesConnector.calculatePayment({
            vehicle_price: params.vehicle_price || 25000,
            down_payment: params.down_payment || 5000,
            interest_rate: params.interest_rate || 5.5,
            loan_term_months: params.loan_term_months || 60,
          });
          return {
            success: result.success,
            result,
            execution_time_ms: Date.now() - startTime,
          };
        } else if (actionName === "estimate_trade_in") {
          const result = await CarSalesConnector.estimateTradeIn({
            vin: params.vin || "",
            mileage: params.mileage || 50000,
            condition: params.condition || "good",
          });
          return {
            success: result.success,
            result,
            execution_time_ms: Date.now() - startTime,
          };
        }
        break;

      case "real_estate":
        if (actionName === "generate_cma") {
          const result = await RealEstateConnector.generateCMA({
            address: params.address || "123 Main St",
            bedrooms: params.bedrooms || 3,
            bathrooms: params.bathrooms || 2,
            square_feet: params.square_feet || 2000,
            year_built: params.year_built || 2000,
          });
          return {
            success: result.success,
            result,
            execution_time_ms: Date.now() - startTime,
          };
        } else if (actionName === "calculate_mortgage") {
          const result = await RealEstateConnector.calculateMortgage({
            home_price: params.home_price || 350000,
            down_payment_percent: params.down_payment_percent || 20,
            interest_rate: params.interest_rate || 6.5,
            loan_term_years: params.loan_term_years || 30,
            property_tax_annual: params.property_tax_annual || 3000,
            insurance_annual: params.insurance_annual || 1200,
          });
          return {
            success: result.success,
            result,
            execution_time_ms: Date.now() - startTime,
          };
        }
        break;

      case "accounting":
        if (actionName === "get_ledger_summary") {
          const result = await AccountingConnector.getLedgerSummary({
            user_id: params.user_id || "default",
            date_range: params.date_range,
          });
          return {
            success: result.success,
            result,
            execution_time_ms: Date.now() - startTime,
          };
        } else if (actionName === "find_invoice") {
          const result = await AccountingConnector.findInvoice({
            user_id: params.user_id || "default",
            invoice_id: params.invoice_id,
            customer_name: params.customer_name,
          });
          return {
            success: result.success,
            result,
            execution_time_ms: Date.now() - startTime,
          };
        } else if (actionName === "generate_financial_report") {
          const result = await AccountingConnector.generateFinancialReport({
            user_id: params.user_id || "default",
            report_type: params.report_type || "income_statement",
            date_range: params.date_range || {
              start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              end: new Date().toISOString().split("T")[0],
            },
          });
          return {
            success: result.success,
            result,
            execution_time_ms: Date.now() - startTime,
          };
        }
        break;
    }

    return {
      success: false,
      error: `Unknown action: ${actionType}/${actionName}`,
      execution_time_ms: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Action execution failed",
      execution_time_ms: Date.now() - startTime,
    };
  }
}

/**
 * Enhanced POST endpoint with deep tool integration
 */
router.post("/message-v5", async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

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

    // PHASE 1: Detect action intent
    const detectedAction = detectActionIntent(message);

    // PHASE 2: Execute action if detected
    let actionExecution: EnhancedScoutResponseV5["action_execution"] = {
      executed: false,
      execution_time_ms: 0,
    };

    if (detectedAction.confidence === "high" && detectedAction.action_type !== "general") {
      const execution = await executeDetectedAction(
        detectedAction.action_type,
        detectedAction.action_name,
        detectedAction.parameters_detected
      );

      actionExecution = {
        executed: execution.success,
        action_type: detectedAction.action_name,
        result: execution.result,
        error: execution.error,
        execution_time_ms: execution.execution_time_ms,
      };
    }

    // PHASE 3: Delegate to Agent Council for synthesis
    const supervisor = new ScoutAgentSupervisor();
    const delegationDecision = await supervisor.analyzeAndDelegate(message);

    // Build response
    const response: EnhancedScoutResponseV5 = {
      intent: delegationDecision.primary_agent,
      detected_action: detectedAction,
      action_execution: actionExecution,
      agent_council_analysis: {
        primary_agent: delegationDecision.primary_agent,
        secondary_agents: delegationDecision.secondary_agents,
        delegation_reasoning: delegationDecision.reasoning,
      },
      message: actionExecution.executed
        ? `I've completed the ${detectedAction.action_name} for you. Here are the results: ${JSON.stringify(actionExecution.result, null, 2)}`
        : `I'm here to help with your ${detectedAction.action_type} needs. What would you like to do?`,
      suggested_next_actions: [
        actionExecution.executed ? "Review the results above" : "Provide more details for analysis",
        "Explore related features",
        "Get expert recommendations",
      ],
      suggestedActions: [
        actionExecution.executed ? "Review the results above" : "Provide more details for analysis",
        "Explore related features",
        "Get expert recommendations",
      ],
    };

    return res.json(response);
  } catch (error) {
    console.error("[Scout Enhanced v5] Error:", error);
    return res.status(500).json({
      error: "Failed to process message with deep tool integration",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET endpoint to test action detection
 */
router.get("/test-action-detection", (req: Request, res: Response) => {
  try {
    const { message } = req.query;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message parameter is required" });
    }

    const detectedAction = detectActionIntent(message);

    return res.json({
      user_message: message,
      detected_action: detectedAction,
      will_execute:
        detectedAction.confidence === "high" && detectedAction.action_type !== "general",
    });
  } catch (error) {
    console.error("[Scout Enhanced v5] Detection test error:", error);
    return res.status(500).json({
      error: "Failed to test action detection",
    });
  }
});

export default router;
