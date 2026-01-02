/**
 * Scout Copy Assist Tool
 * 
 * Generates 2 description variants for business profiles:
 * - Safe: clarity-first, locality-forward
 * - Growth: differentiated, benefits-led, competitive
 * 
 * Contract: Read-only preview → explicit accept → no overwrites
 */

import { runTool, ToolDefinition, ToolContext } from "./toolRunner";
import { recordActivity } from "@/agent/activity";

export interface ScoutCopyAssistInput {
  field: 'description' | 'headline' | 'services';
  businessName: string;
  countyName: string;
  stateCode: string;
  serviceAreas?: string[];
  existingDescription?: string;
  existingHeadline?: string;
  existingServices?: string[];
  userType: string;
}

export interface ScoutCopyVariant {
  id: "safe" | "growth";
  text: string;
  rationale: string;
}

export interface ScoutCopyAssistResponse {
  variants: ScoutCopyVariant[];
}

const scoutCopyAssistTool: ToolDefinition<ScoutCopyAssistInput, ScoutCopyAssistResponse> = {
  name: "scout_copy_assist",
  description: "Generate 2 description variants (safe + growth) for business profiles",
  timeout: 15000,
  retries: 2,
  async execute(input, context) {
    const res = await fetch("/api/scout/copy-assist", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName: input.businessName,
        countyName: input.countyName,
        stateCode: input.stateCode,
        serviceAreas: input.serviceAreas || [],
        existingDescription: input.existingDescription || "",
        userType: input.userType,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Scout copy assist HTTP ${res.status}: ${text}`);
    }

    const data: ScoutCopyAssistResponse = await res.json();

    // Validate response shape
    if (!data.variants || !Array.isArray(data.variants) || data.variants.length !== 2) {
      throw new Error("Invalid response from scout copy assist: expected 2 variants");
    }

    // Validate each variant
    for (const variant of data.variants) {
      if (!variant.id || !variant.text || !variant.rationale) {
        throw new Error("Invalid variant structure");
      }
      // Character limit check
      if (variant.text.length > 200) {
        throw new Error(`Variant ${variant.id} exceeds 200 character limit`);
      }
    }

    return data;
  },
};

/**
 * Generate copy variants for a business profile
 * 
 * Usage:
 * ```ts
 * const response = await generateCopyVariants({
 *   businessName: "Smith's Plumbing",
 *   countyName: "Dallas County",
 *   stateCode: "TX",
 *   userType: "contractor",
 * });
 * ```
 */
export async function generateCopyVariants(
  input: ScoutCopyAssistInput,
  context?: ToolContext
): Promise<ScoutCopyAssistResponse> {
  return runTool(scoutCopyAssistTool, input, context);
}

/**
 * Record telemetry for copy assist interactions
 */
export function recordCopyAssistTelemetry(event: "opened" | "viewed" | "accepted" | "closed", variant?: "safe" | "growth") {
  const baseEvent = `scout_copy_assist_${event}`;
  const telemetryEvent: any = {
    type: baseEvent,
    ts: new Date().toISOString(),
    path: window.location.pathname,
  };

  if (variant) {
    telemetryEvent.context = { variant };
  }

  recordActivity(telemetryEvent);
}
