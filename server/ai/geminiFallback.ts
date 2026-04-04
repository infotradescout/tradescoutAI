import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiModelCandidates } from "./modelConfig";

export type GeminiGenerationOptions = {
  thinking_level?: "low" | "medium" | "high";
};

type GeminiErrorKind = "model_unavailable" | "rate_limited" | "transient" | "fatal";

const DEFAULT_RATE_LIMIT_RETRIES = 2;
const DEFAULT_TRANSIENT_RETRIES = 1;
const DEFAULT_BACKOFF_MS = 300;
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 30_000;
const DEFAULT_MODEL_UNAVAILABLE_TTL_MS = 60 * 60 * 1000;
const MAX_BACKOFF_MS = 2000;
const MAX_MODEL_UNAVAILABLE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RATE_LIMIT_COOLDOWN_MS = 10 * 60 * 1000;

const modelUnavailableUntilMs = new Map<string, number>();
let rateLimitCooldownUntilMs = 0;

export class GeminiRateLimitError extends Error {
  readonly status = 429;
  readonly models: string[];
  readonly failures: number;
  readonly cooldownRemainingMs: number;

  constructor(models: string[], failures: number, cooldownRemainingMs = 0) {
    super("Gemini rate limit exceeded across fallback models");
    this.name = "GeminiRateLimitError";
    this.models = models;
    this.failures = failures;
    this.cooldownRemainingMs = Math.max(0, cooldownRemainingMs);
  }
}

function readEnvNumber(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(raw)));
}

function normalizeErrorMessage(error: unknown): string {
  return String((error as any)?.message || "")
    .trim()
    .toLowerCase();
}

function extractErrorStatus(error: unknown): number {
  const direct = Number((error as any)?.status);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const nested = Number((error as any)?.response?.status);
  if (Number.isFinite(nested) && nested > 0) return nested;
  return 0;
}

function classifyGeminiError(error: unknown): GeminiErrorKind {
  const status = extractErrorStatus(error);
  const message = normalizeErrorMessage(error);

  if (
    status === 429 ||
    message.includes("too many requests") ||
    message.includes("rate limit") ||
    message.includes("quota") ||
    message.includes("resource exhausted")
  ) {
    return "rate_limited";
  }

  if (
    status === 404 ||
    message.includes("model not found") ||
    message.includes("not supported for generatecontent") ||
    message.includes("not supported")
  ) {
    return "model_unavailable";
  }

  if (
    status === 400 &&
    message.includes("model") &&
    (message.includes("not found") ||
      message.includes("unsupported") ||
      message.includes("invalid"))
  ) {
    return "model_unavailable";
  }

  if (
    status === 408 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    message.includes("timeout") ||
    message.includes("temporarily unavailable") ||
    message.includes("deadline exceeded")
  ) {
    return "transient";
  }

  return "fatal";
}

function summarizeError(error: unknown): string {
  const status = extractErrorStatus(error);
  const message = normalizeErrorMessage(error);
  if (!message) return status ? `status=${status}` : "unknown error";
  const clipped = message.length > 180 ? `${message.slice(0, 177)}...` : message;
  return status ? `status=${status} ${clipped}` : clipped;
}

function computeBackoffMs(baseMs: number, attemptIndex: number): number {
  const delay = baseMs * (attemptIndex + 1);
  return Math.min(MAX_BACKOFF_MS, Math.max(baseMs, delay));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowMs(): number {
  return Date.now();
}

function getRateLimitCooldownRemainingMs(): number {
  return Math.max(0, rateLimitCooldownUntilMs - nowMs());
}

function setRateLimitCooldown(ms: number): void {
  if (ms <= 0) return;
  rateLimitCooldownUntilMs = Math.max(rateLimitCooldownUntilMs, nowMs() + ms);
}

function markModelTemporarilyUnavailable(modelName: string, ttlMs: number): void {
  if (!modelName || ttlMs <= 0) return;
  modelUnavailableUntilMs.set(modelName, nowMs() + ttlMs);
}

function isModelTemporarilyUnavailable(modelName: string): boolean {
  const until = modelUnavailableUntilMs.get(modelName);
  if (!until) return false;
  if (until <= nowMs()) {
    modelUnavailableUntilMs.delete(modelName);
    return false;
  }
  return true;
}

export function __resetGeminiFallbackStateForTests(): void {
  modelUnavailableUntilMs.clear();
  rateLimitCooldownUntilMs = 0;
}

export function getGeminiFallbackRuntimeState(): {
  rateLimitCooldownRemainingMs: number;
  temporarilyUnavailableModelCount: number;
} {
  return {
    rateLimitCooldownRemainingMs: getRateLimitCooldownRemainingMs(),
    temporarilyUnavailableModelCount: modelUnavailableUntilMs.size,
  };
}

export async function generateGeminiTextWithFallback(
  gemini: GoogleGenerativeAI,
  prompt: string,
  options?: GeminiGenerationOptions
): Promise<{ text: string; model: string }> {
  const candidates = getGeminiModelCandidates();
  const maxRateLimitRetries = readEnvNumber(
    "GEMINI_RATE_LIMIT_RETRIES",
    DEFAULT_RATE_LIMIT_RETRIES,
    0,
    5
  );
  const maxTransientRetries = readEnvNumber(
    "GEMINI_TRANSIENT_RETRIES",
    DEFAULT_TRANSIENT_RETRIES,
    0,
    3
  );
  const backoffMs = readEnvNumber("GEMINI_RETRY_BACKOFF_MS", DEFAULT_BACKOFF_MS, 100, 2000);
  const rateLimitCooldownMs = readEnvNumber(
    "GEMINI_RATE_LIMIT_COOLDOWN_MS",
    DEFAULT_RATE_LIMIT_COOLDOWN_MS,
    0,
    MAX_RATE_LIMIT_COOLDOWN_MS
  );
  const unavailableModelTtlMs = readEnvNumber(
    "GEMINI_MODEL_UNAVAILABLE_TTL_MS",
    DEFAULT_MODEL_UNAVAILABLE_TTL_MS,
    0,
    MAX_MODEL_UNAVAILABLE_TTL_MS
  );

  let lastError: unknown = null;
  let sawRateLimit = false;
  let sawNonRateLimitError = false;
  let rateLimitFailures = 0;
  const rateLimitedModels = new Set<string>();
  const cooldownRemainingMs = getRateLimitCooldownRemainingMs();
  if (cooldownRemainingMs > 0) {
    throw new GeminiRateLimitError([], 0, cooldownRemainingMs);
  }

  const eligibleCandidates = candidates.filter(
    (modelName) => !isModelTemporarilyUnavailable(modelName)
  );
  const modelsToTry = eligibleCandidates.length > 0 ? eligibleCandidates : candidates;

  for (const modelName of modelsToTry) {
    const model = gemini.getGenerativeModel({ model: modelName });
    let attempt = 0;

    while (true) {
      try {
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          ...(options?.thinking_level
            ? {
                generationConfig: {
                  thinking_level: options.thinking_level,
                },
              }
            : {}),
        } as any);
        const text = result.response.text();
        if (text && text.trim().length > 0) {
          return { text, model: modelName };
        }

        lastError = new Error(`Empty response from model: ${modelName}`);
        if (attempt >= maxTransientRetries) {
          break;
        }
        await wait(computeBackoffMs(backoffMs, attempt));
        attempt += 1;
        continue;
      } catch (error) {
        lastError = error;
        const kind = classifyGeminiError(error);

        if (kind === "model_unavailable") {
          markModelTemporarilyUnavailable(modelName, unavailableModelTtlMs);
          console.warn(
            `[Gemini] Model unavailable: ${modelName}; trying next candidate (${summarizeError(error)})`
          );
          break;
        }

        if (kind === "rate_limited") {
          sawRateLimit = true;
          rateLimitFailures += 1;
          rateLimitedModels.add(modelName);
          if (attempt < maxRateLimitRetries) {
            const delay = computeBackoffMs(backoffMs, attempt);
            console.warn(
              `[Gemini] Rate-limited on ${modelName}; retrying in ${delay}ms (attempt ${attempt + 1}/${maxRateLimitRetries + 1})`
            );
            await wait(delay);
            attempt += 1;
            continue;
          }
          console.warn(
            `[Gemini] Rate-limit retries exhausted for ${modelName}; trying next candidate`
          );
          break;
        }

        if (kind === "transient") {
          sawNonRateLimitError = true;
          if (attempt < maxTransientRetries) {
            const delay = computeBackoffMs(backoffMs, attempt);
            console.warn(
              `[Gemini] Transient error on ${modelName}; retrying in ${delay}ms (${summarizeError(error)})`
            );
            await wait(delay);
            attempt += 1;
            continue;
          }
          console.warn(
            `[Gemini] Transient retries exhausted for ${modelName}; trying next candidate`
          );
          break;
        }

        throw error;
      }
    }
  }

  if (sawRateLimit && !sawNonRateLimitError) {
    setRateLimitCooldown(rateLimitCooldownMs);
    throw new GeminiRateLimitError(
      Array.from(rateLimitedModels),
      rateLimitFailures,
      getRateLimitCooldownRemainingMs()
    );
  }

  throw lastError instanceof Error ? lastError : new Error("All Gemini model fallbacks failed");
}
