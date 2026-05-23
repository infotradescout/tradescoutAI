/**
 * useScoutHomeSnapshot
 *
 * Fetches the Scout OS home surface data from /api/scout/home-snapshot
 * given a resolved location. Handles loading, error, and empty states.
 */

import { useState, useEffect } from "react";
import type { ScoutLocation } from "./useScoutLocation";

export interface LocalSnapshot {
  activeListings: number;
  activeListingsDelta: number;
  verifiedPros: number;
  eventsThisWeek: number;
  eventsToday: number;
  communityMembers: number;
  countyName: string;
  stateName: string;
  fips: string | null;
}

export interface TrendingPrompt {
  id: string;
  text: string;
  category: string;
  icon: string;
  intent: string;
  count: number;
}

export interface RecentActivity {
  id: string;
  query: string;
  icon: string;
  timestamp: string;
}

export interface PriceSignal {
  id: string;
  label: string;
  description: string;
  metricKey: string;
  value: number;
  updatedAt: string | null;
  sourceLabel?: string;
  sourceKind?: "homescout_inventory" | "tradedeals_activity" | "completed_job_receipts";
  confidence?: "high" | "medium" | "low";
}

export interface OpportunityMove {
  id: string;
  type: "service_gap" | "underserved_area" | "fast_win" | "partnership_target" | "audit_target";
  title: string;
  whyItMatters: string;
  actionLabel: string;
  prompt: string;
  sourceLabel: string;
  sourceMetricKeys: string[];
  confidence: "high" | "medium";
  updatedAt: string | null;
}

export interface HomeSnapshotData {
  snapshot: LocalSnapshot;
  trendingPrompts: TrendingPrompt[];
  recentActivity: RecentActivity[];
  priceSignals: PriceSignal[];
  opportunityMoves: OpportunityMove[];
  locationResolved: boolean;
  locationSource: "user" | "ip" | "manual" | "default";
}

type FetchStatus = "idle" | "loading" | "success" | "error";

const EMPTY_SNAPSHOT: LocalSnapshot = {
  activeListings: 0,
  activeListingsDelta: 0,
  verifiedPros: 0,
  eventsThisWeek: 0,
  eventsToday: 0,
  communityMembers: 0,
  countyName: "",
  stateName: "",
  fips: null,
};

const DEFAULT_PROMPTS: TrendingPrompt[] = [
  {
    id: "notary",
    text: "Open local request follow-up",
    category: "Local request flow",
    icon: "📄",
    intent: "notary",
    count: 0,
  },
  {
    id: "gas",
    text: "Vehicle service momentum near me",
    category: "Vehicle flow",
    icon: "⛽",
    intent: "gas",
    count: 0,
  },
  {
    id: "events",
    text: "Community activity this week",
    category: "Community flow",
    icon: "🎉",
    intent: "events",
    count: 0,
  },
  {
    id: "contractor",
    text: "Home project flow in progress",
    category: "Home flow",
    icon: "🔨",
    intent: "contractor",
    count: 0,
  },
  {
    id: "marketplace",
    text: "Saved local search to continue",
    category: "Listings flow",
    icon: "🛋",
    intent: "marketplace",
    count: 0,
  },
];

export function useScoutHomeSnapshot(location: ScoutLocation) {
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [data, setData] = useState<HomeSnapshotData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Don't fetch until location is resolved
    if (location.status !== "resolved") return;

    let cancelled = false;
    setStatus("loading");

    const fetch_snapshot = async () => {
      try {
        const params = new URLSearchParams();
        if (location.county) params.set("county", location.county);
        if (location.state) params.set("state", location.state);
        if (location.fips) params.set("fips", location.fips);

        const res = await fetch(`/api/scout/home-snapshot?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: HomeSnapshotData = await res.json();

        if (!cancelled) {
          setData(json);
          setStatus("success");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load local data");
          // Still show something — use defaults with the location name
          setData({
            snapshot: {
              ...EMPTY_SNAPSHOT,
              countyName: location.county || "Your Area",
              stateName: location.state || "",
              fips: location.fips,
            },
            trendingPrompts: DEFAULT_PROMPTS,
            recentActivity: [],
            priceSignals: [],
            opportunityMoves: [],
            locationResolved: false,
            locationSource: "default",
          });
          setStatus("error");
        }
      }
    };

    fetch_snapshot();
    return () => {
      cancelled = true;
    };
  }, [location.county, location.state, location.fips, location.status]);

  return { status, data, error };
}
