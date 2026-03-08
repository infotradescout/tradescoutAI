/**
 * Scout Internal Data API (SIDA)
 *
 * A secure, internal-only API that exposes TradeScout's "Data Factory" byproducts
 * to other internal projects. This API provides:
 *
 * 1. Data Factory Extraction: Access to marketplace trends, contractor insights, and community data
 * 2. Reasoning-as-a-Service: Send raw data and get back intelligent analysis
 * 3. Cross-Project Actions: Trigger TradeScout workflows from other internal applications
 *
 * SECURITY: This API is internal-only and requires:
 * - Internal API Key (environment variable)
 * - Project ID whitelist
 * - Request signing with HMAC-SHA256
 */

import crypto from "crypto";

/**
 * SIDA Request Authentication
 */
export interface SIDARequest {
  project_id: string;
  api_key: string;
  timestamp: number;
  signature: string;
  payload: Record<string, any>;
}

/**
 * SIDA Response
 */
export interface SIDAResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata: {
    request_id: string;
    timestamp: number;
    execution_time_ms: number;
  };
}

/**
 * Scout Internal Data API Service
 */
export class ScoutInternalDataAPI {
  private internalApiKey: string;
  private allowedProjects: Set<string>;
  private requestTimeout: number = 30000; // 30 seconds

  constructor() {
    this.internalApiKey = process.env.SCOUT_INTERNAL_API_KEY || "";
    // Load allowed projects from environment (comma-separated)
    const allowedProjectsEnv = process.env.SCOUT_ALLOWED_PROJECTS || "";
    this.allowedProjects = new Set(allowedProjectsEnv.split(",").filter((p) => p.trim()));
  }

  /**
   * Validate incoming SIDA request
   */
  validateRequest(request: SIDARequest): {
    valid: boolean;
    error?: string;
  } {
    // Check if API key is configured
    if (!this.internalApiKey) {
      return {
        valid: false,
        error: "Internal API not configured",
      };
    }

    // Check project whitelist
    if (this.allowedProjects.size > 0 && !this.allowedProjects.has(request.project_id)) {
      return {
        valid: false,
        error: `Project '${request.project_id}' is not whitelisted`,
      };
    }

    // Check API key
    if (request.api_key !== this.internalApiKey) {
      return {
        valid: false,
        error: "Invalid API key",
      };
    }

    // Check timestamp (must be within 5 minutes)
    const now = Date.now();
    const requestTime = request.timestamp;
    const timeDiff = Math.abs(now - requestTime);

    if (timeDiff > 5 * 60 * 1000) {
      return {
        valid: false,
        error: "Request timestamp is too old or in the future",
      };
    }

    // Verify signature
    const expectedSignature = this.generateSignature(
      request.project_id,
      request.timestamp,
      request.payload
    );

    if (request.signature !== expectedSignature) {
      return {
        valid: false,
        error: "Invalid request signature",
      };
    }

    return { valid: true };
  }

  /**
   * Generate HMAC-SHA256 signature for request validation
   */
  generateSignature(projectId: string, timestamp: number, payload: Record<string, any>): string {
    const message = `${projectId}:${timestamp}:${JSON.stringify(payload)}`;
    return crypto.createHmac("sha256", this.internalApiKey).update(message).digest("hex");
  }

  /**
   * Generate request ID for tracking
   */
  generateRequestId(): string {
    return `sida_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
  }

  /**
   * Build successful response
   */
  buildSuccessResponse<T>(data: T, requestId: string, executionTime: number): SIDAResponse<T> {
    return {
      success: true,
      data,
      metadata: {
        request_id: requestId,
        timestamp: Date.now(),
        execution_time_ms: executionTime,
      },
    };
  }

  /**
   * Build error response
   */
  buildErrorResponse(error: string, requestId: string, executionTime: number): SIDAResponse {
    return {
      success: false,
      error,
      metadata: {
        request_id: requestId,
        timestamp: Date.now(),
        execution_time_ms: executionTime,
      },
    };
  }

  /**
   * Get API status and configuration
   */
  getStatus(): {
    configured: boolean;
    allowed_projects: string[];
    request_timeout_ms: number;
  } {
    return {
      configured: !!this.internalApiKey,
      allowed_projects: Array.from(this.allowedProjects),
      request_timeout_ms: this.requestTimeout,
    };
  }
}

export default ScoutInternalDataAPI;
