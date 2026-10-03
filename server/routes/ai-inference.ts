import type { Request, Response } from "express";
import { callAIInference } from "../services/aiInference.js";
import { logger } from "../services/logger";

/** Auth and rate limiting remain on the registration in routes.ts. */
export async function handleAIInference(req: Request, res: Response) {
  try {
    const { systemPrompt, userPrompt, temperature, maxTokens } = req.body;

    // HTTP callers cannot bypass the server's workload model selection.
    if (Object.prototype.hasOwnProperty.call(req.body, "model")) {
      return res.status(400).json({ error: "Inference model is configured by the server" });
    }
    if (!systemPrompt || !userPrompt) {
      return res.status(400).json({ error: "systemPrompt and userPrompt are required" });
    }

    const result = await callAIInference({ systemPrompt, userPrompt, temperature, maxTokens });
    res.json(result);
  } catch (error: any) {
    logger.error("[API] AI inference error", { error: error.message });
    res.status(500).json({ error: "AI inference failed" });
  }
}
