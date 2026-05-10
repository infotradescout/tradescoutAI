export type ScoutAbilityCapability =
  | "answer-only"
  | "draft-only"
  | "open-work-area"
  | "approved-action"
  | "blocked";

export interface SupportedScoutToolDefinition {
  name: string;
  capability: ScoutAbilityCapability;
  description: string;
}

export const SUPPORTED_SCOUT_TOOLS = {
  "ads.feedback": {
    name: "ads.feedback",
    capability: "approved-action",
    description: "Record a user-approved ad feedback click from Scout.",
  },
} as const satisfies Record<string, SupportedScoutToolDefinition>;

export type SupportedScoutToolName = keyof typeof SUPPORTED_SCOUT_TOOLS;

export const UNSUPPORTED_SCOUT_TOOL_MESSAGE =
  "Scout can't do that yet. You can still ask Scout to help another way.";

export function getScoutToolName(action: unknown): string {
  if (!action || typeof action !== "object") return "";
  const value = action as {
    name?: unknown;
    payload?: { name?: unknown } | null;
  };

  if (typeof value.name === "string") return value.name.trim();
  if (value.payload && typeof value.payload.name === "string") {
    return value.payload.name.trim();
  }
  return "";
}

export function getSupportedScoutTool(name: string): SupportedScoutToolDefinition | null {
  const normalized = name.trim();
  return SUPPORTED_SCOUT_TOOLS[normalized as SupportedScoutToolName] ?? null;
}

export function isSupportedScoutToolName(name: string): name is SupportedScoutToolName {
  return Boolean(getSupportedScoutTool(name));
}
