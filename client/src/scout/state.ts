import { useReducer } from "react";

export type ScoutRole = "user" | "assistant";

export interface ScoutMessage {
  id: string;
  role: ScoutRole;
  content: string;
  timestamp: string;
  suggestedActions?: string[];
}

export type ScoutStatus = "idle" | "sending" | "thinking" | "error";

export interface ScoutState {
  status: ScoutStatus;
  messages: ScoutMessage[];
  error: string | null;
}

export type ScoutEvent =
  | { type: "USER_MESSAGE"; content: string }
  | { type: "SERVER_RESPONSE"; message: Omit<ScoutMessage, "id"> }
  | { type: "ERROR"; message: string }
  | { type: "RESET" };

export function createInitialScoutState(): ScoutState {
  return {
    status: "idle",
    messages: [],
    error: null,
  };
}

export function scoutReducer(state: ScoutState, event: ScoutEvent): ScoutState {
  switch (event.type) {
    case "USER_MESSAGE": {
      const now = new Date().toISOString();
      const userMessage: ScoutMessage = {
        id: `u-${now}`,
        role: "user",
        content: event.content,
        timestamp: now,
      };
      return {
        ...state,
        status: "sending",
        error: null,
        messages: [...state.messages, userMessage],
      };
    }
    case "SERVER_RESPONSE": {
      const now = new Date().toISOString();
      const assistantMessage: ScoutMessage = {
        id: `a-${now}`,
        role: "assistant",
        content: event.message.content,
        timestamp: event.message.timestamp || now,
        suggestedActions: event.message.suggestedActions,
      };
      return {
        ...state,
        status: "idle",
        error: null,
        messages: [...state.messages, assistantMessage],
      };
    }
    case "ERROR": {
      return {
        ...state,
        status: "error",
        error: event.message,
      };
    }
    case "RESET": {
      return createInitialScoutState();
    }
    default:
      return state;
  }
}

export function useScoutState() {
  return useReducer(scoutReducer, undefined, createInitialScoutState);
}
