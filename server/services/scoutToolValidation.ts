/**
 * Scout Tool Validation and Error Recovery Service
 * 
 * This service provides:
 * 1. Tool outcome validation - checking if results match expectations
 * 2. Error recovery strategies - alternative approaches when tools fail
 * 3. Result quality assessment - determining if results are sufficient
 * 4. Fallback tool selection - choosing alternatives when primary tools fail
 */

export interface ToolOutcomeExpectation {
  tool_name: string;
  expected_data_fields?: string[];
  expected_result_count?: number;
  expected_success_rate?: number;
  acceptable_error_types?: string[];
}

export interface ToolValidationResult {
  is_valid: boolean;
  confidence: "high" | "medium" | "low";
  issues: string[];
  recommendations: string[];
  should_retry: boolean;
  fallback_tools?: string[];
}

export interface ErrorRecoveryStrategy {
  original_tool: string;
  reason_for_failure: string;
  recommended_fallback: string;
  modified_parameters?: Record<string, any>;
  explanation: string;
}

/**
 * Validate tool outcome against expectations
 */
export function validateToolOutcome(
  toolName: string,
  result: any,
  expectation?: ToolOutcomeExpectation
): ToolValidationResult {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let confidence: "high" | "medium" | "low" = "high";
  let shouldRetry = false;
  const fallbackTools: string[] = [];

  // Check if result exists
  if (!result) {
    issues.push("Tool returned null or undefined result");
    confidence = "low";
    shouldRetry = true;
    fallbackTools.push(...getFallbackTools(toolName));
    return {
      is_valid: false,
      confidence,
      issues,
      recommendations: [
        `Tool ${toolName} failed to return data. Try using ${fallbackTools[0] || "web_search"} instead.`,
      ],
      should_retry: shouldRetry,
      fallback_tools: fallbackTools,
    };
  }

  // Check for error in result
  if (result.error || result.success === false) {
    issues.push(`Tool returned error: ${result.error || "Unknown error"}`);
    confidence = "low";
    shouldRetry = true;
    fallbackTools.push(...getFallbackTools(toolName));
    recommendations.push(
      `The ${toolName} tool encountered an error. Consider using ${fallbackTools[0] || "web_search"} as an alternative.`
    );
  }

  // Validate against expectations if provided
  if (expectation) {
    // Check expected data fields
    if (expectation.expected_data_fields) {
      const missingFields = expectation.expected_data_fields.filter(
        (field) => !(field in result)
      );
      if (missingFields.length > 0) {
        issues.push(`Missing expected fields: ${missingFields.join(", ")}`);
        confidence = confidence === "high" ? "medium" : "low";
      }
    }

    // Check result count
    if (expectation.expected_result_count !== undefined && Array.isArray(result.data)) {
      if (result.data.length < expectation.expected_result_count) {
        issues.push(
          `Expected at least ${expectation.expected_result_count} results, got ${result.data.length}`
        );
        confidence = "medium";
        recommendations.push("Consider refining search parameters or using web search for broader results");
      }
    }
  }

  const isValid = issues.length === 0;

  return {
    is_valid: isValid,
    confidence,
    issues,
    recommendations,
    should_retry: shouldRetry,
    fallback_tools: fallbackTools,
  };
}

/**
 * Get fallback tools for a given tool
 */
export function getFallbackTools(toolName: string): string[] {
  const fallbacks: Record<string, string[]> = {
    search_contractors: ["get_county_contractors", "web_search"],
    search_marketplace: ["get_county_listings", "web_search"],
    get_county_contractors: ["web_search"],
    get_county_listings: ["web_search"],
    get_hoa_data: ["web_search"],
    get_local_groups: ["web_search"],
    web_search: [], // web_search is the ultimate fallback
  };

  return fallbacks[toolName] || ["web_search"];
}

/**
 * Determine if tool result is sufficient for answering user query
 */
export function isResultSufficient(
  result: any,
  queryType: string,
  minimumDataPoints: number = 1
): boolean {
  if (!result || result.success === false) {
    return false;
  }

  // For contractor searches, need at least one contractor
  if (queryType === "contractor_search") {
    if (Array.isArray(result.data)) {
      return result.data.length >= minimumDataPoints;
    }
    return !!result.contractor;
  }

  // For marketplace searches, need at least one listing
  if (queryType === "marketplace_search") {
    if (Array.isArray(result.data)) {
      return result.data.length >= minimumDataPoints;
    }
    return !!result.listing;
  }

  // For general data retrieval, just check if we have data
  if (queryType === "data_retrieval") {
    return !!result.data || Object.keys(result).length > 1;
  }

  // Default: if we have a result, it's sufficient
  return true;
}

/**
 * Suggest error recovery strategy
 */
export function suggestErrorRecoveryStrategy(
  toolName: string,
  error: string,
  previousAttempts: number = 1
): ErrorRecoveryStrategy | null {
  const fallbacks = getFallbackTools(toolName);

  if (fallbacks.length === 0) {
    return null; // No recovery possible
  }

  const strategies: Record<string, ErrorRecoveryStrategy> = {
    search_contractors: {
      original_tool: "search_contractors",
      reason_for_failure: error,
      recommended_fallback: "get_county_contractors",
      explanation:
        "The search_contractors tool failed. Try get_county_contractors to retrieve all contractors in the county, then filter locally.",
    },
    search_marketplace: {
      original_tool: "search_marketplace",
      reason_for_failure: error,
      recommended_fallback: "get_county_listings",
      explanation:
        "The search_marketplace tool failed. Try get_county_listings to retrieve all listings in the county.",
    },
    get_county_contractors: {
      original_tool: "get_county_contractors",
      reason_for_failure: error,
      recommended_fallback: "web_search",
      explanation:
        "Local contractor data is unavailable. Use web_search to find contractors on the wider internet.",
    },
    get_county_listings: {
      original_tool: "get_county_listings",
      reason_for_failure: error,
      recommended_fallback: "web_search",
      explanation:
        "Local marketplace data is unavailable. Use web_search to find listings on the wider internet.",
    },
  };

  return strategies[toolName] || {
    original_tool: toolName,
    reason_for_failure: error,
    recommended_fallback: "web_search",
    explanation: `The ${toolName} tool failed. Use web_search as a fallback to find information on the wider internet.`,
  };
}

/**
 * Assess result quality and identify gaps
 */
export function assessResultQuality(
  result: any,
  expectedFields: string[] = []
): {
  quality_score: number;
  gaps: string[];
  completeness_percentage: number;
  recommendations: string[];
} {
  let qualityScore = 100;
  const gaps: string[] = [];
  let completenessPercentage = 100;
  const recommendations: string[] = [];

  if (!result) {
    return {
      quality_score: 0,
      gaps: ["No result data"],
      completeness_percentage: 0,
      recommendations: ["Tool returned no data. Try a different tool or refine search parameters."],
    };
  }

  // Check for errors
  if (result.error || result.success === false) {
    qualityScore -= 50;
    gaps.push(`Error: ${result.error || "Unknown error"}`);
  }

  // Check expected fields
  if (expectedFields.length > 0) {
    const presentFields = expectedFields.filter((field) => field in result);
    completenessPercentage = Math.round((presentFields.length / expectedFields.length) * 100);
    const missingFields = expectedFields.filter((field) => !(field in result));

    if (missingFields.length > 0) {
      qualityScore -= missingFields.length * 10;
      gaps.push(`Missing fields: ${missingFields.join(", ")}`);
      recommendations.push(`Consider calling additional tools to get: ${missingFields.join(", ")}`);
    }
  }

  // Check data count
  if (Array.isArray(result.data)) {
    if (result.data.length === 0) {
      qualityScore -= 30;
      gaps.push("No items in result");
      recommendations.push("No results found. Try refining your search or using a broader search tool.");
    } else if (result.data.length === 1) {
      qualityScore -= 10;
      gaps.push("Only one result found");
      recommendations.push("Only one result found. Consider searching with different parameters.");
    }
  }

  // Ensure quality score is between 0 and 100
  qualityScore = Math.max(0, Math.min(100, qualityScore));

  return {
    quality_score: qualityScore,
    gaps,
    completeness_percentage,
    recommendations,
  };
}

/**
 * Determine if a tool call should be retried with modified parameters
 */
export function shouldRetryWithModifiedParameters(
  toolName: string,
  result: any,
  originalParameters: Record<string, any>
): { should_retry: boolean; modified_parameters?: Record<string, any> } {
  // If tool succeeded, don't retry
  if (result && result.success !== false && !result.error) {
    return { should_retry: false };
  }

  // If we got no results, try with broader parameters
  if (Array.isArray(result?.data) && result.data.length === 0) {
    const modifiedParams = { ...originalParameters };

    // Remove restrictive filters
    if (modifiedParams.trade) {
      // Remove trade filter to get all contractors
      delete modifiedParams.trade;
    }
    if (modifiedParams.category) {
      // Remove category filter to get all listings
      delete modifiedParams.category;
    }

    return {
      should_retry: true,
      modified_parameters: modifiedParams,
    };
  }

  return { should_retry: false };
}

/**
 * Log tool execution for learning and debugging
 */
export function logToolExecution(
  toolName: string,
  parameters: Record<string, any>,
  result: any,
  executionTimeMs: number,
  success: boolean
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    tool_name: toolName,
    parameters,
    success,
    execution_time_ms: executionTimeMs,
    result_summary: {
      has_data: !!result?.data,
      data_count: Array.isArray(result?.data) ? result.data.length : 0,
      has_error: !!result?.error,
    },
  };

  console.log("[Scout Tool Execution]", JSON.stringify(logEntry, null, 2));
}

/**
 * Get tool execution statistics for monitoring
 */
export function getToolExecutionStats(
  executions: Array<{
    tool_name: string;
    success: boolean;
    execution_time_ms: number;
  }>
): Record<string, any> {
  const stats: Record<string, any> = {};

  for (const execution of executions) {
    if (!stats[execution.tool_name]) {
      stats[execution.tool_name] = {
        count: 0,
        success_count: 0,
        failure_count: 0,
        avg_execution_time_ms: 0,
        total_execution_time_ms: 0,
      };
    }

    const toolStats = stats[execution.tool_name];
    toolStats.count++;
    if (execution.success) {
      toolStats.success_count++;
    } else {
      toolStats.failure_count++;
    }
    toolStats.total_execution_time_ms += execution.execution_time_ms;
    toolStats.avg_execution_time_ms = Math.round(
      toolStats.total_execution_time_ms / toolStats.count
    );
  }

  return stats;
}
