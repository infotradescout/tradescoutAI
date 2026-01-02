export type UserImpact =
  | "confusing"
  | "frustrating"
  | "trust_breaking"
  | "neutral_incomplete";

export type RiskTag = "legal" | "safety" | "trust" | "operational";

export type ChiefOfStaffStatus = "action_required" | "no_action_required";

export interface ScopeGovernorState {
  scopeFrozen: boolean;
  reasons: string[];
}
