/**
 * Lightweight Scout Authority Check for Community CTAs
 *
 * Used by CommunityCTA component to gate actions (Direct Connect, Message, Apply)
 * through Scout authority before rendering.
 *
 * Returns: COMPLY | DEFER | BLOCK with minimal explanation
 */

import type { Express, Request, Response } from "express";
import { selectAction, inferSituation, type ScoutAction } from "../scout/governor";
import { getScoutControlState } from "../services/scoutControlState";

type CTAAction = "direct_connect" | "message" | "apply";
type CTAContext = "trade_deal" | "community_post" | "contractor_profile";

interface CTACheckRequest {
  action: CTAAction;
  context: CTAContext;
  contextId: string;
  scope?: string; // county FIPS
}

interface CTACheckResponse {
  allowed: boolean;
  action: ScoutAction; // COMPLY | DEFER | BLOCK
  ctaMode: "show" | "ask_scout" | "hide";
  explanation: string;
  label?: string; // Optional visual label for UI
}

/**
 * Check if CTA action is allowed through Scout authority
 */
export async function checkCTAAuthority(
  req: CTACheckRequest,
  userId?: string
): Promise<CTACheckResponse> {
  // Construct minimal situation for Governor
  const situation = await inferSituation({
    message: `User wants to ${req.action} on ${req.context}`,
    user: userId ? { id: parseInt(userId), role: "user" as const } : undefined,
    history: [],
    countyCode: req.scope,
  });

  const controls = await getScoutControlState();
  const { action, authorityProof } = selectAction(situation, controls);

  let result: CTACheckResponse;

  if (action === "COMPLY") {
    result = {
      allowed: true,
      action: "COMPLY",
      ctaMode: "show",
      explanation: "Action approved",
    };
  } else if (action === "DEFER") {
    result = {
      allowed: false,
      action: "DEFER",
      ctaMode: "ask_scout",
      explanation: authorityProof.hasProof
        ? "Scout suggests gathering more context"
        : "Insufficient authority to proceed",
      label: "Review local summary first",
    };
  } else if (action === "BLOCK") {
    result = {
      allowed: false,
      action: "BLOCK",
      ctaMode: "hide",
      explanation: "This action may lead to regret in this context",
      label: "Not recommended",
    };
  } else {
    // REDIRECT → treat as DEFER for CTA purposes
    result = {
      allowed: false,
      action: "DEFER",
      ctaMode: "ask_scout",
      explanation: "Scout suggests exploring alternatives first",
      label: "Consider alternatives",
    };
  }

  return result;
}

/**
 * Express route handler
 */
export function setupScoutCTACheckRoutes(app: Express) {
  app.post("/api/scout/cta-check", async (req: Request, res: Response) => {
    try {
      const { action, context, contextId, scope } = req.body;

      if (!action || !context || !contextId) {
        return res.status(400).json({
          error: "Missing required fields: action, context, contextId",
        });
      }

      const userId = (req.user as any)?.id;

      const result = await checkCTAAuthority({ action, context, contextId, scope }, userId);

      return res.json(result);
    } catch (error) {
      console.error("[Scout CTA Check] Error:", error);

      // Fail safe: route to Scout when authority check cannot complete
      return res.json({
        allowed: false,
        action: "DEFER",
        ctaMode: "ask_scout",
        explanation: "Authority check unavailable. Review local summary before action.",
        label: "Review local summary first",
      });
    }
  });
}
