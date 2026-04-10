import type { NextFunction, Request, Response } from "express";
import { getLandingIntentContractForPath } from "../services/crawlerTelemetryService";

export function landingContractHeaders(req: Request, res: Response, next: NextFunction) {
  const method = String(req.method || "").toUpperCase();
  if (method !== "GET") {
    return next();
  }

  const requestPath = String(req.path || "").trim();
  if (!requestPath || requestPath.startsWith("/api/")) {
    return next();
  }

  const contract = getLandingIntentContractForPath(requestPath);
  res.setHeader("X-TradeScout-Intent-Stage", contract.intentStage);
  res.setHeader("X-TradeScout-Audience-Hint", contract.audienceHint);
  res.setHeader("X-TradeScout-Knowledge-Hint", contract.knowledgeHint);
  res.setHeader("X-TradeScout-Action-Hint", contract.actionHint);
  return next();
}
