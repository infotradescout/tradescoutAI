/**
 * Scout Enhancement Configuration
 * 
 * This module provides configuration helpers for the enhanced Scout features
 * introduced in Phase 1: Structured Reasoning & Dynamic Tool Use.
 */

export interface ScoutEnhancementConfig {
  enabled: boolean;
  useEnhancedPrompt: boolean;
  promptVersion: "v1" | "v2";
  enabledFeatures: {
    structuredReasoning: boolean;
    dynamicToolInvocation: boolean;
    selfReflection: boolean;
    stateAcknowledgment: boolean;
  };
}

/**
 * Load Scout enhancement configuration from environment variables
 */
export function loadScoutEnhancementConfig(): ScoutEnhancementConfig {
  const enabled = process.env.SCOUT_ENHANCED_ENABLED === "true";
  const useEnhancedPrompt = process.env.SCOUT_USE_ENHANCED_PROMPT === "true";
  const promptVersion = (process.env.SCOUT_PROMPT_VERSION || "v1") as "v1" | "v2";

  // If enhanced is enabled, automatically use enhanced prompt
  const finalUseEnhancedPrompt = enabled || useEnhancedPrompt;
  const finalPromptVersion = finalUseEnhancedPrompt ? "v2" : "v1";

  return {
    enabled,
    useEnhancedPrompt: finalUseEnhancedPrompt,
    promptVersion: finalPromptVersion,
    enabledFeatures: {
      structuredReasoning: enabled,
      dynamicToolInvocation: enabled,
      selfReflection: enabled,
      stateAcknowledgment: enabled,
    },
  };
}

/**
 * Get the system prompt version based on configuration
 */
export function getSystemPromptVersion(): "v1" | "v2" {
  const config = loadScoutEnhancementConfig();
  return config.promptVersion;
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(feature: keyof ScoutEnhancementConfig["enabledFeatures"]): boolean {
  const config = loadScoutEnhancementConfig();
  return config.enabledFeatures[feature];
}

/**
 * Get configuration status for logging/debugging
 */
export function getConfigStatus(): Record<string, any> {
  const config = loadScoutEnhancementConfig();
  return {
    scoutEnhancement: {
      enabled: config.enabled,
      useEnhancedPrompt: config.useEnhancedPrompt,
      promptVersion: config.promptVersion,
      features: config.enabledFeatures,
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      scoutEnhancedEnabled: process.env.SCOUT_ENHANCED_ENABLED,
      scoutUseEnhancedPrompt: process.env.SCOUT_USE_ENHANCED_PROMPT,
      scoutPromptVersion: process.env.SCOUT_PROMPT_VERSION,
    },
  };
}
