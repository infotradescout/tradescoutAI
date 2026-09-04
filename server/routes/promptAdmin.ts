import { logAdminAction } from "../services/adminAnalytics";
import express from "express";
import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { reloadSystemPrompt, getPromptStatus } from "../services/promptService";
import type { AuthenticatedUser } from "../types";
import { runtimePaths } from "../runtimePaths";
import { isAuthenticated, isSuperAdmin } from "../auth";

const router = express.Router();

const PROMPT_PATH = path.join(runtimePaths.scoutManualCache, "system_prompt.md");

router.use(isAuthenticated, isSuperAdmin);

/**
 * GET /api/prompt-admin - Retrieve current system prompt
 */
router.get("/", (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(PROMPT_PATH)) {
      const status = getPromptStatus();
      return res.json({
        content: "",
        status: {
          ...status,
          exists: false,
          promptPath: PROMPT_PATH,
        },
        message: "System prompt file not found yet. Save a prompt to initialize it.",
      });
    }

    const content = fs.readFileSync(PROMPT_PATH, "utf8");
    const status = getPromptStatus();

    res.json({
      content,
      status,
      message: "System prompt retrieved successfully",
    });
  } catch (error) {
    console.error("[PromptAdmin] Error reading prompt:", error);
    res.status(500).json({ error: "Failed to read system prompt" });
  }
});

/**
 * POST /api/prompt-admin - Update system prompt (hot reload)
 */
router.post("/", (req: Request, res: Response) => {
  try {
    const { content } = (req.body ?? {}) as any;
    const user = (req as any).user as AuthenticatedUser;

    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "Invalid or empty prompt content" });
    }

    // Validate content has required sections
    if (
      !content.includes("DATA SOURCE HIERARCHY") &&
      !content.includes("1. DATA SOURCE HIERARCHY")
    ) {
      console.warn("[PromptAdmin] Warning: prompt missing DATA SOURCE HIERARCHY section");
    }

    // Write to disk
    fs.mkdirSync(path.dirname(PROMPT_PATH), { recursive: true });
    fs.writeFileSync(PROMPT_PATH, content, "utf8");

    // Hot reload
    reloadSystemPrompt();

    logAdminAction("update_prompt", user, { length: content.length });
    console.log(`[PromptAdmin] System prompt updated by ${user.id} (${content.length} bytes)`);

    res.json({
      ok: true,
      message: "System prompt updated and reloaded",
      updatedBy: user.id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[PromptAdmin] Error updating prompt:", error);
    res.status(500).json({ error: "Failed to update system prompt" });
  }
});

/**
 * GET /api/prompt-admin/status - Get prompt loading status
 */
router.get("/status", (req: Request, res: Response) => {
  try {
    const status = getPromptStatus();
    res.json({ status });
  } catch (error) {
    console.error("[PromptAdmin] Error getting status:", error);
    res.status(500).json({ error: "Failed to get prompt status" });
  }
});

/**
 * POST /api/prompt-admin/reload - Force reload prompt from disk
 */
router.post("/reload", (req: Request, res: Response) => {
  try {
    const user = (req as any).user as AuthenticatedUser;

    reloadSystemPrompt();
    logAdminAction("reload_prompt", user, {});
    console.log(`[PromptAdmin] Prompt force-reloaded by ${user.id}`);

    res.json({
      ok: true,
      message: "System prompt reloaded from disk",
      reloadedBy: user.id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[PromptAdmin] Error reloading prompt:", error);
    res.status(500).json({ error: "Failed to reload prompt" });
  }
});

export default router;
