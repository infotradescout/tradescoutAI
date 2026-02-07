/**
 * Scout Governance Policy: recommendation endpoints are intentionally retired.
 *
 * Scout must not recommend/endorse humans. Human users generate trust signals;
 * Scout only governs weighting, risk, and enforcement.
 */

import type { Express } from "express";
import { isAuthenticated, requireOnboardingComplete } from "../auth";

const RETIRED_RESPONSE = {
  message:
    "Scout does not recommend or endorse people. Use Direct Connect and community trust signals instead.",
  code: "SCOUT_RECOMMENDATIONS_RETIRED",
  policy: "human_recommendation_scout_governed",
  nextSteps: {
    directConnect: "/direct-connect",
    community: "/community-feed",
    trustModel: "/trust-model",
  },
};

export function registerScoutRecommendations(app: Express) {
  app.post(
    "/api/scout/recommendations",
    isAuthenticated,
    requireOnboardingComplete,
    async (_req: any, res: any) => {
      res.status(410).json(RETIRED_RESPONSE);
    }
  );

  app.get(
    "/api/scout/recommendations/pending",
    isAuthenticated,
    requireOnboardingComplete,
    async (_req: any, res: any) => {
      res.status(410).json({ ...RETIRED_RESPONSE, recommendations: [] });
    }
  );

  app.post(
    "/api/scout/recommendations/:id/action",
    isAuthenticated,
    requireOnboardingComplete,
    async (_req: any, res: any) => {
      res.status(410).json(RETIRED_RESPONSE);
    }
  );

  app.post(
    "/api/scout/feedback/outcome",
    isAuthenticated,
    requireOnboardingComplete,
    async (_req: any, res: any) => {
      // Keep endpoint for telemetry compatibility, but do not alter recommendation state.
      res.status(200).json({
        message: "Outcome feedback recorded for governance telemetry.",
        learningEnabled: false,
        policy: "human_recommendation_scout_governed",
      });
    }
  );
}
