import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type ContextualAggregatesResponse = {
  location: {
    city: string | null;
    state: string | null;
    county: string | null;
  } | null;
  interests: string[];
  activity: {
    auto_dealers?: {
      last_7_days: number | null;
      last_30_days: number | null;
    };
    [key: string]: {
      last_7_days: number | null;
      last_30_days: number | null;
    } | undefined;
  };
  asOf: string;
};

export type ContextualCopyTimeframe = "7d" | "30d";

interface UseContextualCopyOptions {
  stateCode?: string;
  countyFips?: string;
  interest?: string;
  timeframe?: ContextualCopyTimeframe;
  fallback: string;
}

function formatLocationLabel(location: ContextualAggregatesResponse["location"]): string | undefined {
  if (!location) return undefined;
  const { county, state } = location;
  if (county && state) return `${county}, ${state}`;
  if (state) return state;
  return undefined;
}

function formatTimeWindowLabel(timeframe: ContextualCopyTimeframe): string {
  switch (timeframe) {
    case "7d":
      return "the last 7 days";
    case "30d":
      return "the last 30 days";
    default:
      return "recently";
  }
}

export function useContextualCopy(options: UseContextualCopyOptions): {
  line: string;
  isLoading: boolean;
  isError: boolean;
} {
  const { stateCode, countyFips, interest = "auto_dealers", timeframe = "7d", fallback } = options;

  const { data, isLoading, isError } = useQuery<ContextualAggregatesResponse | null>({
    queryKey: [
      "/api/aggregates/context",
      { stateCode: stateCode ?? null, countyFips: countyFips ?? null, interest, timeframe },
    ],
    queryFn: async () => {
      // Only call the API when we have at least some locality hint.
      if (!stateCode && !countyFips) return null;

      const params = new URLSearchParams();
      if (stateCode) params.append("stateCode", stateCode);
      if (countyFips) params.append("countyFips", countyFips);
      params.append("timeframe", timeframe);

      const url = `/api/aggregates/context?${params.toString()}`;
      return apiRequest("GET", url);
    },
    staleTime: 60_000,
    enabled: !!(stateCode || countyFips),
    retry: false,
  });

  if (!data) {
    return { line: fallback, isLoading, isError };
  }

  const locationLabel = formatLocationLabel(data.location);
  const interestKey = interest;
  const series = data.activity?.[interestKey];

  if (!series) {
    return { line: fallback, isLoading, isError };
  }

  const count = timeframe === "7d" ? series.last_7_days : series.last_30_days;

  if (count == null || !locationLabel) {
    return { line: fallback, isLoading, isError };
  }

  const timeWindow = formatTimeWindowLabel(timeframe);

  // Observation-only, no persuasion: describe what has happened in this area.
  const line = `${count} auto businesses in ${locationLabel} joined TradeScout in ${timeWindow}.`;

  return { line, isLoading, isError };
}
