import type { ScoutLaunchContext } from "../scoutLaunchContext";

export type ScoutDecisionType =
  | "client_shortcut_passthrough"
  | "deterministic_route"
  | "server_behavior_handler"
  | "synthesis_required"
  | "blocked"
  | "fallback";

export interface NormalizedScoutRequest {
  message: string;
  userId?: string;
  isAuthenticated: boolean;
  userRole?: string;
  countyCode?: string;
  stateCode?: string;
  countyFips?: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  intent?: string;
  launchContext?: ScoutLaunchContext;
  sessionId?: string;
}

export interface ScoutDecision {
  type: ScoutDecisionType;
  behaviorKey?: string;
  reason?: string;
  requiresAuth?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ScoutActionContract {
  type: string;
  label: string;
  to?: string;
  path?: string;
  prompt?: string;
  subtitle?: string;
  why?: string;
  primary?: boolean;
  payload?: Record<string, unknown>;
}

export interface ScoutResponseContract {
  message: string;
  suggestedActions?: string[];
  actions?: ScoutActionContract[];
  actionResults?: unknown[];
  metadata?: Record<string, unknown>;
  llmProvider?: string;
  promptVersion?: string;
  timestamp?: string;
  [key: string]: unknown;
}
