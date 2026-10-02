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
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

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
  // Trusted service callers only; the HTTP endpoint rejects model overrides.
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
  const inference = String(process.env.SCOUT_OPENAI_MODEL_INFERENCE || "").trim();
  if (inference) return inference;
  const fast = String(process.env.SCOUT_OPENAI_MODEL_FAST || "").trim();
  if (fast) return fast;
  const defaultModel = String(process.env.SCOUT_OPENAI_MODEL_DEFAULT || "").trim();
  return defaultModel || "gpt-5.4-nano";
}

const GPT6_INFERENCE_MODELS = new Set(["gpt-6-luna", "gpt-6-sol", "gpt-6.1-sol", "gpt-6-astra"]);

function inferenceReasoningEffort(model: string): "low" | "minimal" | undefined {
  if (GPT6_INFERENCE_MODELS.has(model)) return "low";
  // Fail before provider work for unknown family members instead of guessing capabilities.
  if (/^gpt-6(?:[.-]|$)/i.test(model)) {
    throw new Error(`Unsupported GPT-6 inference model: ${model}`);
  }
  return model.toLowerCase().startsWith("gpt-5") ? "minimal" : undefined;
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
    const effort = inferenceReasoningEffort(model);
    const request: ResponseCreateParamsNonStreaming = {
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

    // GPT-6 low reasoning does not support sampling controls, including the
    // temperature supplied by the current client. Preserve the legacy baseline.
    if (
      effort !== "low" &&
      typeof req.temperature === "number" &&
      Number.isFinite(req.temperature)
    ) {
      request.temperature = req.temperature;
    }

    if (effort) {
      request.reasoning = { effort };
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
