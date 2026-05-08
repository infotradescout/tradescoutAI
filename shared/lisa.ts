export type LisaRuntimeMode = "tradescout_local" | "json_file" | "remote";

export type LisaFeedPriority = "critical" | "high" | "medium" | "low";

export type LisaFeedSourceKind =
  | "scout_interactions"
  | "scout_intelligence"
  | "objectives"
  | "homescout_listings"
  | "observations"
  | "bot_visibility"
  | "bot_crawl_signals"
  | "scout_intelligence";

export type LisaTruthStatus = "current" | "stale" | "superseded" | "suppressed";

export type LisaScopeType = "global" | "county" | "category" | "surface" | "partner";

export interface LisaFeedItem {
  routingTags?: string[];
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
  valueNumeric?: number;
  valueText?: string;
  trendDirection?: "up" | "down" | "stable";
  trendMagnitude?: number;
  conflictStatus?: "no_conflict" | "resolved" | "unresolved";
  routingTags?: string[];
  provenance?: string[];
  governanceNotes?: string[];
  scoutingReportJson?: string;
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
