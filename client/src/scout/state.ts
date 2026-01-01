import { useReducer, useCallback } from "react";
import type { ScoutResponseFrame } from "./api";

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
  | "MEALSCOUT_COMMAND"
  | "FOLLOW_USER"
  | "UNFOLLOW_USER"
  | "START_COMMUNITY_VAULT_DONATION"
  | "START_PLATFORM_SUPPORT"
  | "SEND_ADMIN_BROADCAST"
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
  // Structured agent outputs
  toolCall?: ScoutToolCall;
  toolResult?: ScoutToolResult;
  navTarget?: string; // primary navigation target for this message
  memoryDelta?: ScoutMemoryDelta; // working context updates
  // Ephemeral, derived context roles used for tone + defaults
  contextRoles?: string[];
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

function reducer(state: ScoutState, event: ScoutEvent): ScoutState {
  switch (event.type) {
    case "USER_MESSAGE": {
      const msg = createMessage("user", event.content);
      return {
        ...state,
        messages: [...state.messages, msg],
        status: "resolving_context",
        error: null,
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
        "Scout hit an error handling that request. Please try again or adjust your prompt."
      );
      return {
        ...state,
        messages: [...state.messages, errorMessage],
        status: "error",
        error: event.error,
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

    case "RESET": {
      return { ...initialState };
    }

    default:
      return state;
  }
}

export function useScoutState(initialMessages?: ScoutMessage[]) {
  const [state, dispatch] = useReducer(reducer, {
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

  const setError = useCallback(
    (error: string) => dispatch({ type: "ERROR", error }),
    []
  );

	const setStatus = useCallback(
		(status: ScoutStatus) => dispatch({ type: "SET_STATUS", status }),
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
    reset,
  };
}

