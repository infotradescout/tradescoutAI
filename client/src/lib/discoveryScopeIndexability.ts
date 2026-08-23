export type DiscoveryScopeRobotsDecision = {
  noIndex: boolean;
  preserveRobots: boolean;
};

export function getDiscoveryScopeRobotsDecision(args: {
  isLoading: boolean;
  hasError: boolean;
  itemCount: number;
}): DiscoveryScopeRobotsDecision {
  // SSR owns the crawl decision until the snapshot-backed request succeeds.
  // A loading or transient error state must never rewrite an indexable SSR
  // response to noindex (or widen an SSR noindex response to index).
  if (args.isLoading || args.hasError) {
    return { noIndex: false, preserveRobots: true };
  }
  return {
    noIndex: !Number.isFinite(args.itemCount) || args.itemCount < 1,
    preserveRobots: false,
  };
}
