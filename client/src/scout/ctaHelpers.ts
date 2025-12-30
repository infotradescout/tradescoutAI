import type { ScoutCluster } from "./state";
import { getCurrentUserRole } from "./roleHelpers";

export type ScoutCtaSource = "trade_deal" | "community_post";

interface TradeDealHint {
  type: "trade_deal";
  id: string;
  ownerUserId?: string;
  canDirectConnect?: boolean;
  canMessage?: boolean;
  label?: string;
}

interface CommunityPostHint {
  type: "community_post";
  id: string;
  authorId?: string;
  canDirectConnect?: boolean;
  canMessage?: boolean;
}

export type ScoutCtaHint = TradeDealHint | CommunityPostHint;

export interface ApplyCtaOptions {
  hints?: ScoutCtaHint[];
}

export function applyCtasToClusters(
  clusters: ScoutCluster[] | undefined,
  options: ApplyCtaOptions = {},
): ScoutCluster[] | undefined {
  if (!clusters || clusters.length === 0) return clusters;

  const { hints = [] } = options;
  if (hints.length === 0) return clusters;

  const role = getCurrentUserRole();
  const isContractor = (role || "").toLowerCase().includes("contractor");

  const hintById = new Map<string, ScoutCtaHint>();
  for (const hint of hints) {
    hintById.set(hint.id, hint);
  }

  return clusters.map((cluster) => {
    const baseId = String(cluster.id || "");
    const hint = hintById.get(baseId);
    if (!hint) return cluster;

    if (hint.type === "trade_deal") {
      return {
        ...cluster,
        ctaSource: "trade_deal",
        ctaContextId: hint.id,
        ctaOwnerUserId: hint.ownerUserId,
        ctaCanDirectConnect: hint.canDirectConnect ?? true,
        ctaCanMessage: hint.canMessage ?? !!hint.ownerUserId,
        ctaDisableDirectConnect: isContractor,
        ctaLabel: hint.label,
      };
    }

    if (hint.type === "community_post") {
      return {
        ...cluster,
        ctaSource: "community_post",
        ctaContextId: hint.id,
        ctaOwnerUserId: hint.authorId,
        ctaCanDirectConnect: hint.canDirectConnect ?? false,
        ctaCanMessage: hint.canMessage ?? !!hint.authorId,
        ctaDisableDirectConnect: isContractor,
      };
    }

    return cluster;
  });
}
