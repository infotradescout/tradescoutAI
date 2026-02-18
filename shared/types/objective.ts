export type ObjectiveStatus = "active" | "paused" | "completed" | "abandoned";

export type ObjectiveIntentClass =
  | "unknown"
  | "knowledge"
  | "local_advice"
  | "work_request"
  | "marketplace_buy"
  | "marketplace_sell"
  | "community_post"
  | "event"
  | "safety_report"
  | "account"
  | "admin"
  | "other";

export type Objective = {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  status: ObjectiveStatus;
  intentClass: ObjectiveIntentClass;
  title: string;
  summary: string | null;
  confidence: number;
  context: Record<string, unknown> | null;
  linkedObjectType: string | null;
  linkedObjectId: string | null;
};
