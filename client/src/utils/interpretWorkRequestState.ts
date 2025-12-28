import type { WorkRequest } from "@shared/schema";

export type DirectConnectCanonicalState =
  | "Created"
  | "Routing"
  | "Awaiting responses"
  | "In discussion"
  | "Pending outcome"
  | "Resolved"
  | "Abandoned";

export interface InterpretedWorkRequestState {
  state: DirectConnectCanonicalState;
  primaryPhrase: string;
  secondaryPhrase?: string;
}

// Map raw WorkRequest status to the canonical interpretation states
// defined in DIRECT_CONNECT_STATE_VOCABULARY.md. This is an
// interpretation layer only and does not change any underlying data.
export function interpretWorkRequestStateForScout(workRequest: WorkRequest): InterpretedWorkRequestState {
  const rawStatus = (workRequest.status || "open").toLowerCase();

  switch (rawStatus) {
    case "draft":
      return {
        state: "Created",
        primaryPhrase: "This request is set up and ready.",
        secondaryPhrase: "Scout will start routing this through Direct Connect.",
      };
    case "routed":
      return {
        state: "Awaiting responses",
        primaryPhrase: "Waiting for people to respond.",
      };
    case "in_progress":
      return {
        state: "In discussion",
        primaryPhrase: "You're actively coordinating.",
      };
    case "completed":
      return {
        state: "Resolved",
        primaryPhrase: "This worked.",
      };
    case "cancelled":
      return {
        state: "Abandoned",
        primaryPhrase: "This didn't move forward.",
      };
    case "open":
    default:
      return {
        state: "Routing",
        primaryPhrase: "Scout is routing this through Direct Connect.",
        secondaryPhrase: "It's on your Direct Connect board while coordination happens.",
      };
  }
}

export function isActiveCoordinationState(state: DirectConnectCanonicalState): boolean {
  return (
    state === "Created" ||
    state === "Routing" ||
    state === "Awaiting responses" ||
    state === "In discussion" ||
    state === "Pending outcome"
  );
}
