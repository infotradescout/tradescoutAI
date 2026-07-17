import type { NormalizedScoutRequest } from "../../shared/types/scout";
import { normalizeScoutLaunchContext } from "../../shared/scoutLaunchContext";

type NormalizeInput = {
  message: string;
  userId?: string;
  isAuthenticated?: boolean;
  userRole?: string;
  countyCode?: string;
  stateCode?: string;
  countyFips?: string;
  history?: Array<{ role?: string; content?: string }>;
  intent?: string;
  launchContext?: unknown;
  sessionId?: string;
};

export function normalizeScoutRequest(input: NormalizeInput): NormalizedScoutRequest {
  const history = Array.isArray(input.history)
    ? input.history
        .filter((item) => item && typeof item.content === "string")
        .map((item) => {
          const role: "user" | "assistant" = item.role === "assistant" ? "assistant" : "user";
          return {
            role,
            content: String(item.content || "").trim(),
          };
        })
        .filter((item) => item.content.length > 0)
    : [];

  return {
    message: String(input.message || "").trim(),
    userId: input.userId,
    isAuthenticated: Boolean(input.isAuthenticated || input.userId),
    userRole: typeof input.userRole === "string" ? input.userRole : undefined,
    countyCode: typeof input.countyCode === "string" ? input.countyCode : undefined,
    stateCode: typeof input.stateCode === "string" ? input.stateCode : undefined,
    countyFips: typeof input.countyFips === "string" ? input.countyFips : undefined,
    history,
    intent: typeof input.intent === "string" ? input.intent : undefined,
    launchContext: normalizeScoutLaunchContext(input.launchContext),
    sessionId: typeof input.sessionId === "string" ? input.sessionId : undefined,
  };
}
