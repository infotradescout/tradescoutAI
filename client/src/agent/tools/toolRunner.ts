/**
 * Central tool runner for Scout agent tools.
 * Provides retries, timeouts, telemetry, and error classification.
 */

export interface ToolContext {
  userId?: string;
  communityId?: string;
  intent?: string;
  jobId?: string;
  sessionId?: string;
}

// Accept plain object inputs; no index signature requirement for ergonomics
export type ToolInput = object;

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    category: "network" | "validation" | "auth" | "not_found" | "server" | "unknown";
    retryable: boolean;
  };
  telemetry: {
    startedAt: number;
    completedAt: number;
    durationMs: number;
    attemptCount: number;
    timestamp: string;
  };
}

export interface ToolDefinition<TInput extends ToolInput = ToolInput, TOutput = unknown> {
  name: string;
  description?: string;
  timeout?: number; // ms, default 10000
  retries?: number; // default 2
  execute: (input: TInput, context: ToolContext) => Promise<TOutput>;
}

interface ToolRunnerConfig {
  defaultTimeout: number;
  defaultRetries: number;
  telemetryEnabled: boolean;
  circuitBreakerThreshold?: number; // consecutive failures before circuit opens
}

const DEFAULT_CONFIG: ToolRunnerConfig = {
  defaultTimeout: 10000,
  defaultRetries: 2,
  telemetryEnabled: true,
  circuitBreakerThreshold: 5,
};

class ToolRunnerImpl {
  private config: ToolRunnerConfig;
  private circuitState: Map<string, { failures: number; lastFailureAt: number }> = new Map();

  constructor(config: Partial<ToolRunnerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async runTool<TInput extends ToolInput, TOutput>(
    tool: ToolDefinition<TInput, TOutput>,
    input: TInput,
    context: ToolContext
  ): Promise<ToolResult<TOutput>> {
    const startedAt = performance.now();
    const timeout = tool.timeout ?? this.config.defaultTimeout;
    const maxRetries = tool.retries ?? this.config.defaultRetries;

    // Check circuit breaker
    if (this.isCircuitOpen(tool.name)) {
      const completedAt = performance.now();
      return {
        success: false,
        error: {
          code: "CIRCUIT_OPEN",
          message: `Tool ${tool.name} circuit is open due to repeated failures`,
          category: "server",
          retryable: false,
        },
        telemetry: {
          startedAt,
          completedAt,
          durationMs: completedAt - startedAt,
          attemptCount: 0,
          timestamp: new Date().toISOString(),
        },
      };
    }

    let attemptCount = 0;
    let lastError: ToolResult<TOutput>["error"] | undefined;

    while (attemptCount <= maxRetries) {
      attemptCount++;

      try {
        const result = await this.executeWithTimeout(tool.execute(input, context), timeout);
        const completedAt = performance.now();

        // Success: reset circuit breaker
        this.recordSuccess(tool.name);

        if (this.config.telemetryEnabled) {
          this.emitTelemetry({
            tool: tool.name,
            success: true,
            durationMs: completedAt - startedAt,
            attemptCount,
          });
        }

        return {
          success: true,
          data: result,
          telemetry: {
            startedAt,
            completedAt,
            durationMs: completedAt - startedAt,
            attemptCount,
            timestamp: new Date().toISOString(),
          },
        };
      } catch (err: any) {
        lastError = this.classifyError(err);

        // If not retryable or last attempt, bail
        if (!lastError || !lastError.retryable || attemptCount > maxRetries) {
          break;
        }

        // Exponential backoff before retry
        await this.sleep(Math.min(100 * Math.pow(2, attemptCount - 1), 2000));
      }
    }

    // All retries exhausted
    const completedAt = performance.now();
    this.recordFailure(tool.name);

    const finalError = lastError || {
      code: "UNKNOWN_ERROR",
      message: "Tool failed without classified error",
      category: "unknown" as const,
      retryable: false,
    };
    if (this.config.telemetryEnabled) {
      this.emitTelemetry({
        tool: tool.name,
        success: false,
        error: finalError,
        durationMs: completedAt - startedAt,
        attemptCount,
      });
    }

    return {
      success: false,
      error: finalError,
      telemetry: {
        startedAt,
        completedAt,
        durationMs: completedAt - startedAt,
        attemptCount,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs)),
    ]);
  }

  private classifyError(err: any): ToolResult["error"] {
    const message = String(err?.message || err || "Unknown error");
    const lowerMsg = message.toLowerCase();

    if (message === "TIMEOUT") {
      return {
        code: "TIMEOUT",
        message: "Tool execution timed out",
        category: "network",
        retryable: true,
      };
    }

    if (
      lowerMsg.includes("network") ||
      lowerMsg.includes("fetch") ||
      lowerMsg.includes("econnrefused")
    ) {
      return {
        code: "NETWORK_ERROR",
        message,
        category: "network",
        retryable: true,
      };
    }

    if (
      lowerMsg.includes("temporary") ||
      lowerMsg.includes("temporarily") ||
      lowerMsg.includes("try again") ||
      lowerMsg.includes("etimedout")
    ) {
      return {
        code: "NETWORK_ERROR",
        message,
        category: "network",
        retryable: true,
      };
    }

    if (
      lowerMsg.includes("401") ||
      lowerMsg.includes("unauthorized") ||
      lowerMsg.includes("forbidden")
    ) {
      return {
        code: "AUTH_ERROR",
        message,
        category: "auth",
        retryable: false,
      };
    }

    if (lowerMsg.includes("404") || lowerMsg.includes("not found")) {
      return {
        code: "NOT_FOUND",
        message,
        category: "not_found",
        retryable: false,
      };
    }

    if (
      lowerMsg.includes("400") ||
      lowerMsg.includes("invalid") ||
      lowerMsg.includes("validation")
    ) {
      return {
        code: "VALIDATION_ERROR",
        message,
        category: "validation",
        retryable: false,
      };
    }

    if (lowerMsg.includes("500") || lowerMsg.includes("502") || lowerMsg.includes("503")) {
      return {
        code: "SERVER_ERROR",
        message,
        category: "server",
        retryable: true,
      };
    }

    return {
      code: "UNKNOWN_ERROR",
      message,
      category: "unknown",
      retryable: false,
    };
  }

  private isCircuitOpen(toolName: string): boolean {
    const state = this.circuitState.get(toolName);
    if (!state) return false;

    const threshold = this.config.circuitBreakerThreshold ?? 5;
    if (state.failures < threshold) return false;

    // Circuit opens for 60 seconds after threshold failures
    const now = Date.now();
    const cooldownMs = 60000;
    return now - state.lastFailureAt < cooldownMs;
  }

  private recordSuccess(toolName: string): void {
    this.circuitState.delete(toolName);
  }

  private recordFailure(toolName: string): void {
    const state = this.circuitState.get(toolName) || { failures: 0, lastFailureAt: 0 };
    state.failures++;
    state.lastFailureAt = Date.now();
    this.circuitState.set(toolName, state);
  }

  private emitTelemetry(event: {
    tool: string;
    success: boolean;
    durationMs: number;
    attemptCount: number;
    error?: ToolResult["error"];
  }): void {
    if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
      return;
    }

    // Send to analytics/logging endpoint
    // For now, just console in dev
    if (import.meta.env.DEV) {
      console.log("[Tool Telemetry]", event);
    }

    // In production, emit to your analytics service
    try {
      void fetch("/api/analytics/tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: "tool_execution",
          ...event,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {
        // Telemetry failures should never break the app
      });
    } catch {
      // ignore
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const toolRunner = new ToolRunnerImpl();

/**
 * Convenience wrapper for running a tool.
 */
export async function runTool<TInput extends ToolInput, TOutput>(
  tool: ToolDefinition<TInput, TOutput>,
  input: TInput,
  context: ToolContext = {}
): Promise<ToolResult<TOutput>> {
  return toolRunner.runTool(tool, input, context);
}
