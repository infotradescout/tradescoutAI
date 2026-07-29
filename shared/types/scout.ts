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

export type ScoutResultContractIntentV1 =
  | "code_query"
  | "provider_search"
  | "asset_action";

export interface ScoutAmbiguityOptionV1 {
  label: string;
  action_id: string;
}

export interface ScoutPublicEntityV1 {
  id: string;
  type: string;
  name?: string;
  url?: string | null;
  match_reasons?: string[];
}

export interface ScoutEvidenceV1 {
  source_id: string;
  title: string;
  url: string | null;
  type?: string;
  provider?: string;
  match_reason?: string;
}

export interface ScoutAllowedActionV1 {
  action_id: string;
  type: string;
  label: string;
  target?: string;
  prompt?: string;
  payload?: Record<string, unknown>;
  primary?: boolean;
  requires_confirmation: boolean;
}

export interface ScoutResultContractV1 {
  contract_version: "scout_result.v1";
  intent: ScoutResultContractIntentV1;
  ambiguity_options: ScoutAmbiguityOptionV1[];
  entities: ScoutPublicEntityV1[];
  evidence: ScoutEvidenceV1[];
  answer: string;
  allowed_actions: ScoutAllowedActionV1[];
  working_memory_update: Record<string, unknown>;
}

// Internal builders may create a partial response before the route-level
// finalizer attaches the required ScoutResultContractV1 fields.
export interface ScoutResponseContract extends Partial<ScoutResultContractV1> {
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
