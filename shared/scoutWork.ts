export const SCOUT_WORK_KINDS = ["requests", "supply_runs", "home_projects", "scout_actions"] as const;
export type ScoutWorkKind = (typeof SCOUT_WORK_KINDS)[number];
export type ScoutWorkState = "attention" | "active" | "complete" | "closed" | "unknown";

export interface ScoutWorkItem {
  id: string;
  kind: ScoutWorkKind;
  title: string;
  state: ScoutWorkState;
  statusLabel: string;
  detail: string;
  updatedAt: string | null;
  nextAction: { label: string; to: string };
}

export interface ScoutWorkSection {
  kind: ScoutWorkKind;
  label: string;
  availability: "ready" | "unavailable";
  items: ScoutWorkItem[];
  hasMore: boolean;
  workspace: string;
}

export interface ScoutWorkOverview {
  contractVersion: "scout_work.v1";
  ownerId: string;
  checkedAt: string;
  partial: boolean;
  sections: ScoutWorkSection[];
}
