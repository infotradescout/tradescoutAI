import { useReducer, useCallback } from "react";
import type { ScoutResponseFrame } from "./api";
import type { ScoutResultContractV1 } from "@shared/types/scout";

export type ScoutRole = "user" | "assistant" | "system";

// High-level state machine for Scout's visible behavior
// IDLE -> RESOLVING_CONTEXT -> CHECKING_DOCUMENTS -> READY -> EXECUTING_ACTION
// We never render "thinking text" – the UI shows short, fixed progress pings
// based on this status instead.
export type ScoutStatus =
  | "idle"
  | "resolving_context"
  | "checking_documents"
  | "ready"
  | "executing_action"
  | "error";

export type ScoutClusterKind =
  | "projects"
  | "pros"
  | "marketplace"
  | "community"
  | "rules"
  | "site"
  | "account"
  | "generic";

export interface ScoutClusterItem {
  id: string;
  label: string;
  description?: string;
}

export interface ScoutCluster {
  id: string;
  title: string;
  kind: ScoutClusterKind;
  body?: string;
  items?: ScoutClusterItem[];
  primaryAction?: ScoutAction;
  actions?: ScoutAction[];
  // Optional CTA metadata for surfaces like CommunityCTA
  ctaSource?: "trade_deal" | "community_post";
  ctaContextId?: string;
  ctaOwnerUserId?: string;
  ctaCanDirectConnect?: boolean;
  ctaCanMessage?: boolean;
  ctaDisableDirectConnect?: boolean;
  ctaLabel?: string;
}

export type ScoutActionType =
  | "NAVIGATE"
  | "OPEN_APP_DRAWER"
  | "PREFILL_INPUT"
  | "OPEN_TOOLS_DRAWER"
  | "ASK_SCOUT"
  | "FOLLOW_USER"
  | "UNFOLLOW_USER"
  | "START_COMMUNITY_VAULT_DONATION"
  | "START_PLATFORM_SUPPORT"
  | "SEND_ADMIN_BROADCAST"
  | "SAVE_PROFILE"
  | "OPEN_FLOATING_NOTE"
  | "EXTERNAL_LINK"
  | "CALL_TOOL"
  | "NOOP";

export interface ScoutAction {
  type: ScoutActionType;
  label?: string;
  to?: string;
  path?: string;
  prompt?: string;
  payload?: Record<string, unknown>;
  subtitle?: string;
  why?: string;
  _scoutWhy?: string;
  primary?: boolean;
}

export interface ScoutToolCall {
  tool: string;
  input: Record<string, unknown>;
  status: "pending" | "success" | "error";
}

export interface ScoutToolResult {
  tool: string;
  success: boolean;
  data?: unknown;
  error?: string;
  durationMs?: number;
}

export interface ScoutMemoryDelta {
  lastViewedTrade?: string;
  lastJobId?: string;
  lastCommunityId?: string;
  lastIntent?: string;
  [key: string]: unknown;
}

export interface OnboardingQuestion {
  key: "Q1" | "Q2" | "Q3" | "Q4";
  prompt: string;
  options: { label: string; value: string }[];
  skippable: boolean;
}

export interface OnboardingMetadata {
  active: boolean;
  sessionId: string;
  confidence: number;
  question?: OnboardingQuestion;
}

export interface ScoutKnowledgeSource {
  title: string;
  url?: string;
  type?: string;
  provider?: string;
}

export interface ScoutMessage {
  id: string;
  role: ScoutRole;
  content: string;
  timestamp: string; // ISO string
  suggestedActions?: string[];
  overrideOption?: {
    label: string;
    message: string;
    scope?: string;
    logAction: "ignored_advice";
    contextType?: string;
    contextId?: string | null;
  };
  clusters?: ScoutCluster[];
  frame?: ScoutResponseFrame;
  // The server is the sole owner of result interpretation and permitted actions.
  resultContract?: ScoutResultContractV1;
  // Structured agent outputs
  toolCall?: ScoutToolCall;
  toolResult?: ScoutToolResult;
  navTarget?: string; // primary navigation target for this message
  memoryDelta?: ScoutMemoryDelta; // working context updates
  // Ephemeral, derived context roles used for tone + defaults
  contextRoles?: string[];
  // D2: Onboarding metadata (server-controlled, client renders only)
  onboarding?: OnboardingMetadata;
  provenance?: {
    sourceUsed?: string;
    attemptedSource?: string;
    fallbackUsed?: boolean;
    degradationReason?:
      | "provider_unavailable"
      | "schema_violation"
      | "json_parse_error"
      | "synthesis_rate_limited"
      | "synthesis_system_error"
      | "enhanced_confidence_gate"
      | "enhanced_proxy_error"
      | "route_exception";
    confidenceBand?: "low" | "medium" | "high" | "unknown";
    knowledgeLayer?: number;
    sources?: ScoutKnowledgeSource[];
    sourceTitles?: string[];
    resolvedStage?: string;
    blockingReason?: string | null;
    allowedActions?: string[];
  };
}

export interface ScoutState {
  messages: ScoutMessage[];
  status: ScoutStatus;
  error: string | null;
  lastActions: ScoutAction[];
}

export type ScoutEvent =
  | { type: "USER_MESSAGE"; content: string }
  | { type: "SERVER_RESPONSE"; message: ScoutMessage; actions?: ScoutAction[] }
  | { type: "ERROR"; error: string }
  | { type: "LOAD_MESSAGES"; messages: ScoutMessage[] }
  | { type: "RESET" }
  | { type: "SET_STATUS"; status: ScoutStatus };

const initialState: ScoutState = {
  messages: [],
  status: "idle",
  error: null,
  lastActions: [],
};

function createMessage(role: ScoutRole, content: string): ScoutMessage {
  return {
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    role,
    content,
    timestamp: new Date().toISOString(),
  };
}

export function scoutReducer(state: ScoutState, event: ScoutEvent): ScoutState {
  switch (event.type) {
    case "USER_MESSAGE": {
      const msg = createMessage("user", event.content);
      return {
        ...state,
        messages: [...state.messages, msg],
        status: "resolving_context",
        error: null,
        lastActions: [],
      };
    }

    case "SERVER_RESPONSE": {
      return {
        ...state,
        messages: [...state.messages, event.message],
        status: "idle",
        error: null,
        lastActions: event.actions ?? [],
      };
    }

    case "ERROR": {
      const errorMessage = createMessage(
        "assistant",
        "That did not go through. Try again, or say it a little differently."
      );
      return {
        ...state,
        messages: [...state.messages, errorMessage],
        status: "error",
        error: event.error,
        lastActions: [],
      };
    }

    case "SET_STATUS": {
      // Allow transitions only between known states; reducer is a pass-through
      // to keep status changes centralized.
      return {
        ...state,
        status: event.status,
      };
    }

    case "LOAD_MESSAGES": {
      return {
        ...initialState,
        messages: event.messages,
      };
    }

    case "RESET": {
      return { ...initialState };
    }

    default:
      return state;
  }
}

export function useScoutState(initialMessages?: ScoutMessage[]) {
  const [state, dispatch] = useReducer(scoutReducer, {
    ...initialState,
    messages: initialMessages ?? [],
  });

  const recordUserMessage = useCallback(
    (content: string) => dispatch({ type: "USER_MESSAGE", content }),
    []
  );

  const applyServerResponse = useCallback(
    (message: ScoutMessage, actions?: ScoutAction[]) =>
      dispatch({ type: "SERVER_RESPONSE", message, actions }),
    []
  );

  const setError = useCallback((error: string) => dispatch({ type: "ERROR", error }), []);

  const setStatus = useCallback(
    (status: ScoutStatus) => dispatch({ type: "SET_STATUS", status }),
    []
  );

  const loadMessages = useCallback(
    (messages: ScoutMessage[]) => dispatch({ type: "LOAD_MESSAGES", messages }),
    []
  );

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    state,
    dispatch,
    recordUserMessage,
    applyServerResponse,
    setError,
    setStatus,
    loadMessages,
    reset,
  };
}
