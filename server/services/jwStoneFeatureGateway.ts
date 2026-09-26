import { classifyJwStoneFeatureRequest, type FeatureRequest } from "../../shared/jwStoneFeaturePolicy";
export type FeatureGateDecision = { allowed: true } | { allowed: false; status: 403 | 503; code: string; message: string };
/** Base requests never depend on the premium configuration store being available. */
export async function decideJwStoneFeatureAccess(request: FeatureRequest, read: () => Promise<{ enabled: boolean }>): Promise<FeatureGateDecision> {
  if (!classifyJwStoneFeatureRequest(request)) return { allowed: true };
  try {
    if ((await read()).enabled === true) return { allowed: true };
    return { allowed: false, status: 403, code: "JW_STONE_FEATURE_UNAVAILABLE",
      message: "This additional tool is unavailable. The JW Stone website and Direct Connect remain available." };
  } catch {
    return { allowed: false, status: 503, code: "JW_STONE_FEATURE_STATE_UNAVAILABLE",
      message: "This additional tool is temporarily unavailable. The website and Direct Connect remain available." };
  }
}
