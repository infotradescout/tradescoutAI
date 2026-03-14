export type LisaRuntimeMode = "tradescout_local" | "json_file" | "remote";

export type LisaFeedPriority = "critical" | "high" | "medium" | "low";

export type LisaFeedSourceKind =
  | "scout_interactions"
  | "objectives"
  | "homescout_listings"
  | "observations"
  | "bot_visibility"
  | "bot_crawl_signals";

export type LisaTruthStatus = "current" | "stale" | "superseded" | "suppressed";

export type LisaScopeType = "global" | "county" | "category" | "surface" | "partner";

export interface LisaFeedItem {
  id: string;
  priority: LisaFeedPriority;
  sourceKind: LisaFeedSourceKind;
  headline: string;
  narrative: string;
  evidence: string[];
  freshnessMinutes: number | null;
  truthStatus?: LisaTruthStatus;
  scopeType?: LisaScopeType;
  scopeRef?: string | null;
  engineVersion?: string;
  supersedesId?: string | null;
}

export interface LisaFeedSummary {
  truthNow: string;
  dataProductionSummary: string;
  llmOptimizationSummary: string;
}

export interface LisaStoredFinding extends LisaFeedItem {
  generatedAt: string;
  provenance?: string[];
  governanceNotes?: string[];
}

export interface LisaFeedResponse {
  generatedAt: string;
  summary: LisaFeedSummary;
  feed: LisaFeedItem[];
  runtime: {
    mode: LisaRuntimeMode;
    source: string;
  };
}
