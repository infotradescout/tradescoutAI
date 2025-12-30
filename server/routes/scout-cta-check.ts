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
import { db } from "../db";

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

// In-memory cache: {key: {result, timestamp}}
const cache = new Map<string, { result: CTACheckResponse; timestamp: number }>();
const CACHE_TTL_MS = 30000; // 30 seconds

function getCacheKey(req: CTACheckRequest, userId?: string): string {
  return `${userId || "anon"}:${req.action}:${req.context}:${req.contextId}:${req.scope || "global"}`;
}

function getCached(key: string): CTACheckResponse | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  
  return entry.result;
}

function setCache(key: string, result: CTACheckResponse): void {
  cache.set(key, { result, timestamp: Date.now() });
  
  // Simple cache cleanup: remove entries older than 2x TTL
  if (cache.size > 1000) {
    const cutoff = Date.now() - (CACHE_TTL_MS * 2);
    for (const [k, v] of cache.entries()) {
      if (v.timestamp < cutoff) cache.delete(k);
    }
  }
}

/**
 * Check if CTA action is allowed through Scout authority
 */
export async function checkCTAAuthority(req: CTACheckRequest, userId?: string): Promise<CTACheckResponse> {
  const cacheKey = getCacheKey(req, userId);
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  // Construct minimal situation for Governor
  const situation = await inferSituation({
    userQuery: `User wants to ${req.action} on ${req.context}`,
    user: userId ? { id: userId } : undefined,
    context: {
      source: req.context,
      contextId: req.contextId,
      scope: req.scope,
      action: req.action,
    },
  });
  
  const { action, authorityProof } = selectAction(situation);
  
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
      explanation: authorityProof.reasoning || "Scout recommends gathering more context first",
      label: "Ask Scout first",
    };
  } else if (action === "BLOCK") {
    result = {
      allowed: false,
      action: "BLOCK",
      ctaMode: "hide",
      explanation: authorityProof.reasoning || "This action may lead to regret in this context",
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
  
  setCache(cacheKey, result);
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
          error: "Missing required fields: action, context, contextId" 
        });
      }
      
      const userId = (req.user as any)?.id;
      
      const result = await checkCTAAuthority(
        { action, context, contextId, scope },
        userId
      );
      
      return res.json(result);
    } catch (error) {
      console.error("[Scout CTA Check] Error:", error);
      
      // Fail open: allow action on error (safety over UX breakage)
      return res.json({
        allowed: true,
        action: "COMPLY",
        ctaMode: "show",
        explanation: "Check failed, allowing action",
      });
    }
  });
}
