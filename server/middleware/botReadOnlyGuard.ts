import type { NextFunction, Request, Response } from "express";
import { detectActorFromUserAgent } from "../utils/requestActor";

type BotReadOnlyMode = "off" | "report" | "enforce";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function getGuardMode(): BotReadOnlyMode {
  const rawMode = (process.env.BOT_READ_ONLY_MODE || "report").trim().toLowerCase();
  if (rawMode === "off" || rawMode === "enforce") return rawMode;
  return "report";
}

function hasTrustedBypass(req: Request): boolean {
  const configuredToken = process.env.BOT_WRITE_BYPASS_TOKEN;
  if (!configuredToken) return false;
  const requestToken = req.get("x-bot-write-token");
  return Boolean(requestToken && requestToken === configuredToken);
}

export function botReadOnlyGuard(req: Request, res: Response, next: NextFunction) {
  const mode = getGuardMode();
  if (mode === "off") return next();

  if (!WRITE_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  const actor = detectActorFromUserAgent(req.get("User-Agent"));
  if (actor.actorType !== "bot") {
    return next();
  }

  if (hasTrustedBypass(req)) {
    return next();
  }

  const path = req.path || req.originalUrl || "unknown";
  const botName = actor.botName || "UnknownBot";

  if (mode === "report") {
    // Report mode is intentionally non-blocking for safe rollout.
    console.warn(
      `[BotReadOnlyGuard][REPORT] bot write attempt: ${req.method} ${path} (${botName})`
    );
    res.setHeader("X-Bot-Write-Guard", "report");
    return next();
  }

  console.warn(`[BotReadOnlyGuard][BLOCK] blocked bot write: ${req.method} ${path} (${botName})`);
  res.setHeader("X-Bot-Write-Guard", "blocked");
  return res.status(403).json({
    error: "Bot actors are read-only. Write actions require trusted bypass.",
    code: "BOT_READ_ONLY_ENFORCED",
  });
}
