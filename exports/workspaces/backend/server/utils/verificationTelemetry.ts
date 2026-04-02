/**
 * Verification Gate Telemetry (C2-6)
 *
 * Non-identifying event tracking for verification gate interactions.
 * Helps measure verification effectiveness without compromising privacy.
 *
 * Design Principles:
 * - No PII (personally identifiable information)
 * - Aggregated reporting only
 * - Action-level metrics (not user-level)
 * - Privacy-first (GDPR/CCPA compliant)
 */

export type VerificationTelemetryEvent =
  | "verification_prompt_shown" // Gate was shown to user
  | "verification_started" // User clicked "Verify now"
  | "verification_completed" // User completed verification flow
  | "verification_skipped" // User clicked alternate path / skip
  | "verification_gate_bypassed" // Soft gate: user proceeded unverified
  | "verification_retry_after_completion"; // User returned after verifying

export interface VerificationTelemetryPayload {
  event: VerificationTelemetryEvent;
  action: string; // e.g., 'MESSAGE_USER', 'APPLY_AS_CONTRACTOR'
  gateType: "blocking" | "soft"; // Hard block or optional offer
  requirementType?: string; // e.g., 'address', 'license'
  userRole?: string; // 'homeowner', 'contractor', etc
  timestamp?: Date;
  metadata?: {
    asymmetric?: boolean; // Is this an asymmetric gate?
    estimatedTime?: string; // Time estimate shown
    alternatePath?: string; // What alternate was offered
  };
}

/**
 * Record a verification gate telemetry event (non-identifying)
 *
 * @param payload - VerificationTelemetryPayload
 * @returns void (fire-and-forget, never blocks)
 */
export async function recordVerificationTelemetry(
  payload: VerificationTelemetryPayload
): Promise<void> {
  try {
    const event = {
      ...payload,
      timestamp: payload.timestamp || new Date(),
    };

    // Log to console in development
    if (process.env.NODE_ENV !== "production") {
      console.log("[VERIFICATION_TELEMETRY]", JSON.stringify(event, null, 2));
    }

    const globalAnalytics = (globalThis as any).__verificationTelemetrySink;
    if (typeof globalAnalytics === "function") {
      await Promise.resolve(globalAnalytics(event));
    } else if ((globalThis as any).posthog?.capture) {
      (globalThis as any).posthog.capture("verification_gate_event", event);
    }
  } catch (error) {
    // Never throw; telemetry failures should not affect user experience
    console.error("[VERIFICATION_TELEMETRY] Failed to record event:", error);
  }
}

/**
 * Helper to track verification prompt shown
 */
export function trackVerificationPromptShown(
  action: string,
  gateType: "blocking" | "soft",
  requirementType: string,
  userRole?: string
): void {
  recordVerificationTelemetry({
    event: "verification_prompt_shown",
    action,
    gateType,
    requirementType,
    userRole,
  });
}

/**
 * Helper to track verification started
 */
export function trackVerificationStarted(
  action: string,
  requirementType: string,
  userRole?: string
): void {
  recordVerificationTelemetry({
    event: "verification_started",
    action,
    gateType: "blocking", // User chose to verify
    requirementType,
    userRole,
  });
}

/**
 * Helper to track verification completed
 */
export function trackVerificationCompleted(
  action: string,
  requirementType: string,
  userRole?: string
): void {
  recordVerificationTelemetry({
    event: "verification_completed",
    action,
    gateType: "blocking",
    requirementType,
    userRole,
  });
}

/**
 * Helper to track verification skipped (alternate path chosen)
 */
export function trackVerificationSkipped(
  action: string,
  gateType: "blocking" | "soft",
  requirementType: string,
  alternatePath: string,
  userRole?: string
): void {
  recordVerificationTelemetry({
    event: "verification_skipped",
    action,
    gateType,
    requirementType,
    userRole,
    metadata: { alternatePath },
  });
}

/**
 * Helper to track soft gate bypass (user proceeded unverified)
 */
export function trackVerificationBypassed(
  action: string,
  requirementType: string,
  userRole?: string
): void {
  recordVerificationTelemetry({
    event: "verification_gate_bypassed",
    action,
    gateType: "soft",
    requirementType,
    userRole,
  });
}

/**
 * Helper to track verification retry after completion
 */
export function trackVerificationRetry(
  action: string,
  requirementType: string,
  userRole?: string
): void {
  recordVerificationTelemetry({
    event: "verification_retry_after_completion",
    action,
    gateType: "blocking",
    requirementType,
    userRole,
  });
}

/**
 * Verification telemetry summary (aggregated metrics)
 *
 * Used for reporting and optimization. No user-level data.
 */
export interface VerificationTelemetrySummary {
  action: string;
  totalPrompts: number;
  totalStarted: number;
  totalCompleted: number;
  totalSkipped: number;
  totalBypassed: number;
  conversionRate: number; // completed / (started + skipped)
  skipRate: number; // skipped / totalPrompts
  bypassRate: number; // bypassed / totalPrompts (soft gates only)
  averageTimeToComplete?: number; // milliseconds (if tracked)
}

/**
 * Generate aggregated telemetry summary for an action
 *
 * @param action - Action name (e.g., 'MESSAGE_USER')
 * @param events - Array of telemetry events
 * @returns VerificationTelemetrySummary
 */
export function generateTelemetrySummary(
  action: string,
  events: VerificationTelemetryPayload[]
): VerificationTelemetrySummary {
  const actionEvents = events.filter((e) => e.action === action);

  const totalPrompts = actionEvents.filter((e) => e.event === "verification_prompt_shown").length;
  const totalStarted = actionEvents.filter((e) => e.event === "verification_started").length;
  const totalCompleted = actionEvents.filter((e) => e.event === "verification_completed").length;
  const totalSkipped = actionEvents.filter((e) => e.event === "verification_skipped").length;
  const totalBypassed = actionEvents.filter((e) => e.event === "verification_gate_bypassed").length;

  const conversionRate =
    totalStarted + totalSkipped > 0 ? totalCompleted / (totalStarted + totalSkipped) : 0;

  const skipRate = totalPrompts > 0 ? totalSkipped / totalPrompts : 0;
  const bypassRate = totalPrompts > 0 ? totalBypassed / totalPrompts : 0;

  return {
    action,
    totalPrompts,
    totalStarted,
    totalCompleted,
    totalSkipped,
    totalBypassed,
    conversionRate,
    skipRate,
    bypassRate,
  };
}
