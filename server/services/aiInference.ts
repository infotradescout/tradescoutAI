/**
 * AI Inference Service
 * Phase 3d-A: OpenAI integration for Scout claim inference
 *
 * Contract:
 * - Provides generic OpenAI Responses API interface
 * - Used by Scout onboarding to infer claims from free-form text
 * - Returns structured JSON responses
 */

import OpenAI from "openai";

// Simple inline logger (avoids circular dependency)
const logger = {
  info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ""),
  error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ""),
  warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ""),
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export interface AIInferenceRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface AIInferenceResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

function readEnvNumber(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(raw)));
}

function selectInferenceModel(requested?: string): string {
  const explicit = String(requested || "").trim();
  if (explicit) return explicit;
  const fast = String(process.env.SCOUT_OPENAI_MODEL_FAST || "").trim();
  if (fast) return fast;
  const defaultModel = String(process.env.SCOUT_OPENAI_MODEL_DEFAULT || "").trim();
  return defaultModel || "gpt-5.4-nano";
}

function extractResponseText(response: any): string {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const chunks: string[] = [];
  const output = Array.isArray(response?.output) ? response.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string") chunks.push(part.text);
      if (typeof part?.refusal === "string") chunks.push(part.refusal);
    }
  }
  return chunks.join("\n").trim();
}

/**
 * Call OpenAI for structured inference
 * Returns raw text content (caller handles JSON parsing)
 */
export async function callAIInference(req: AIInferenceRequest): Promise<AIInferenceResponse> {
  if (!process.env.OPENAI_API_KEY) {
    logger.error("[AI_INFERENCE] OPENAI_API_KEY not configured");
    throw new Error("AI inference not available");
  }

  try {
    const model = selectInferenceModel(req.model);
    const request: any = {
      model,
      instructions: req.systemPrompt,
      input: req.userPrompt,
      max_output_tokens: req.maxTokens ?? 500,
      store: false,
      stream: false,
      truncation: "auto",
      text: {
        format: { type: "json_object" },
      },
    };

    if (typeof req.temperature === "number" && Number.isFinite(req.temperature)) {
      request.temperature = req.temperature;
    }

    if (model.trim().toLowerCase().startsWith("gpt-5")) {
      request.reasoning = { effort: "minimal" };
    }

    const response = await openai.responses.create(request, {
      timeout: readEnvNumber("SCOUT_OPENAI_TIMEOUT_MS", 20_000, 1000, 120_000),
    });

    const content = extractResponseText(response);
    const usage = (response as any).usage;
    const inputTokens = Number(usage?.input_tokens || 0);
    const outputTokens = Number(usage?.output_tokens || 0);
    const totalTokens = Number(usage?.total_tokens || inputTokens + outputTokens);

    logger.info("[AI_INFERENCE] Inference completed", {
      model: response.model || model,
      promptTokens: inputTokens || undefined,
      completionTokens: outputTokens || undefined,
      totalTokens: totalTokens || undefined,
    });

    return {
      content,
      usage: usage
        ? {
            promptTokens: inputTokens,
            completionTokens: outputTokens,
            totalTokens,
          }
        : undefined,
    };
  } catch (error) {
    logger.error("[AI_INFERENCE] OpenAI API error", { error });
    throw error;
  }
}
