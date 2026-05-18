// LLM Provider abstraction for multi-model and fallback (PHASE 3)
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { generateAIResponse as generateVertexAIResponse } from "../ai/vertexClient";
import { generateGeminiTextWithFallback, type GeminiGenerationOptions } from "../ai/geminiFallback";

export type LLMModel = "gemini" | "openai";
export type ScoutLlmModelTier = "fast" | "standard" | "reasoning";
export type ScoutLlmResponseFormat = "text" | "scout_synthesis_json";

export type LLMGenerationOptions = GeminiGenerationOptions & {
  modelTier?: ScoutLlmModelTier;
  responseFormat?: ScoutLlmResponseFormat;
  promptCacheKey?: string;
  maxOutputTokens?: number;
  temperature?: number;
};

export interface LLMProvider {
  name: LLMModel;
  id?: string;
  isConfigured(): boolean;
  generate(prompt: string, options?: LLMGenerationOptions): Promise<string>;
}

export class GeminiProvider implements LLMProvider {
  name: LLMModel = "gemini";
  id = "gemini-api";
  private genAI: GoogleGenerativeAI;
  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }
  isConfigured() {
    return !!process.env.GEMINI_API_KEY;
  }
  async generate(prompt: string, options?: LLMGenerationOptions) {
    const { text } = await generateGeminiTextWithFallback(this.genAI, prompt, options);
    return text;
  }
}

export class VertexGeminiProvider implements LLMProvider {
  // Keep name as "gemini" to preserve downstream response shape.
  name: LLMModel = "gemini";
  id = "vertex-gemini";

  isConfigured() {
    const project = String(process.env.GOOGLE_PROJECT_ID || "").trim();
    const location = String(process.env.GOOGLE_VERTEX_LOCATION || "").trim();
    return Boolean(project && location);
  }

  async generate(prompt: string, options?: LLMGenerationOptions) {
    // vertexClient enforces fail-safe messaging on error.
    return generateVertexAIResponse(prompt, options);
  }
}

const SCOUT_SYNTHESIS_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: true,
  required: ["message"],
  properties: {
    intent: { type: "string" },
    message: { type: "string" },
    suggestedActions: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

export class OpenAIResponsesProvider implements LLMProvider {
  name: LLMModel = "openai";
  id = "openai-responses";
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  isConfigured() {
    return String(process.env.OPENAI_API_KEY || "").trim().length > 0;
  }

  async generate(prompt: string, options?: LLMGenerationOptions) {
    const model = selectOpenAIModel(options?.modelTier);
    const request: any = {
      model,
      input: prompt,
      max_output_tokens:
        options?.maxOutputTokens ??
        readEnvNumber(
          "SCOUT_OPENAI_MAX_OUTPUT_TOKENS",
          options?.responseFormat === "scout_synthesis_json" ? 700 : 900,
          100,
          4000
        ),
      prompt_cache_key: options?.promptCacheKey || buildOpenAIPromptCacheKey(options),
      store: false,
      stream: false,
      truncation: "auto",
    };

    const textConfig = buildOpenAITextConfig(options);
    if (textConfig) request.text = textConfig;

    const reasoning = buildOpenAIReasoningConfig(model, options);
    if (reasoning) request.reasoning = reasoning;

    const temperature = readOptionalEnvNumber("SCOUT_OPENAI_TEMPERATURE", options?.temperature);
    if (temperature !== null) request.temperature = temperature;

    const serviceTier = normalizeOpenAIServiceTier(process.env.SCOUT_OPENAI_SERVICE_TIER);
    if (serviceTier) request.service_tier = serviceTier;

    const response = await this.openai.responses.create(request, {
      timeout: readEnvNumber("SCOUT_OPENAI_TIMEOUT_MS", 20_000, 1000, 120_000),
    });
    const text = extractOpenAIResponseText(response);
    if (!text) {
      throw new Error("OpenAI Responses API returned empty output");
    }
    return text;
  }
}

type ProviderRuntimeState = {
  consecutiveFailures: number;
  totalFailures: number;
  totalSuccesses: number;
  cooldownUntilMs: number;
  skippedDueToCooldown: number;
  lastError: string | null;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
};

const providerRuntimeState = new Map<string, ProviderRuntimeState>();

type ProviderOrderToken = "openai" | "vertex" | "gemini";

const DEFAULT_PROVIDER_ORDER = ["openai", "vertex", "gemini"] as const;

const UNUSABLE_PROVIDER_OUTPUT_PATTERNS = [
  /^scout is thinking\.? please try again in a moment\.?$/i,
  /^scout is thinking\.?$/i,
];

function readEnvNumber(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(raw)));
}

function readEnvString(name: string, fallback: string): string {
  const raw = String(process.env[name] || "").trim();
  return raw.length > 0 ? raw : fallback;
}

function readOptionalEnvNumber(name: string, fallback?: number): number | null {
  const envRaw = process.env[name];
  const candidate = envRaw === undefined ? fallback : Number(envRaw);
  if (candidate === undefined || candidate === null) return null;
  if (!Number.isFinite(Number(candidate))) return null;
  return Number(candidate);
}

function selectOpenAIModel(tier: ScoutLlmModelTier = "standard"): string {
  const defaultModel = readEnvString("SCOUT_OPENAI_MODEL_DEFAULT", "gpt-5.4-mini");
  if (tier === "fast") {
    return readEnvString("SCOUT_OPENAI_MODEL_FAST", "gpt-5.4-nano");
  }
  if (tier === "reasoning") {
    return readEnvString("SCOUT_OPENAI_MODEL_REASONING", "gpt-5.5");
  }
  return readEnvString("SCOUT_OPENAI_MODEL_STANDARD", defaultModel);
}

function buildOpenAIPromptCacheKey(options?: LLMGenerationOptions): string {
  const tier = options?.modelTier || "standard";
  const format = options?.responseFormat || "text";
  return `scout:${tier}:${format}`;
}

function buildOpenAITextConfig(options?: LLMGenerationOptions): Record<string, unknown> | null {
  if (options?.responseFormat !== "scout_synthesis_json") {
    return null;
  }

  return {
    format: {
      type: "json_schema",
      name: "scout_synthesis_response",
      description:
        "A compact Scout response object that preserves the user-facing message and routing suggestions.",
      schema: SCOUT_SYNTHESIS_RESPONSE_SCHEMA,
      strict: false,
    },
  };
}

function supportsOpenAIReasoning(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return normalized.startsWith("gpt-5") || normalized.startsWith("o");
}

function normalizeOpenAIReasoningEffort(
  raw: string | undefined,
  fallback: "minimal" | "low" | "medium" | "high"
): "minimal" | "low" | "medium" | "high" {
  const normalized = String(raw || "")
    .trim()
    .toLowerCase();
  if (
    normalized === "minimal" ||
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high"
  ) {
    return normalized;
  }
  return fallback;
}

function buildOpenAIReasoningConfig(
  model: string,
  options?: LLMGenerationOptions
): { effort: "minimal" | "low" | "medium" | "high" } | null {
  if (!supportsOpenAIReasoning(model)) return null;
  const tier = options?.modelTier || "standard";
  const tierFallback =
    options?.thinking_level === "high"
      ? "high"
      : options?.thinking_level === "medium"
        ? "medium"
        : tier === "fast"
          ? "minimal"
          : tier === "reasoning"
            ? "medium"
            : "low";
  const envName = `SCOUT_OPENAI_REASONING_EFFORT_${tier.toUpperCase()}`;
  return {
    effort: normalizeOpenAIReasoningEffort(process.env[envName], tierFallback),
  };
}

function normalizeOpenAIServiceTier(
  value: string | undefined
): "auto" | "default" | "flex" | "scale" | "priority" | null {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (
    normalized === "auto" ||
    normalized === "default" ||
    normalized === "flex" ||
    normalized === "scale" ||
    normalized === "priority"
  ) {
    return normalized;
  }
  return null;
}

function extractOpenAIResponseText(response: any): string {
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

function nowMs(): number {
  return Date.now();
}

function getProviderId(provider: LLMProvider, index: number): string {
  const explicit = String(provider.id || "").trim();
  if (explicit) return explicit;
  return `${provider.name}-${index + 1}`;
}

function getOrCreateRuntimeState(providerId: string): ProviderRuntimeState {
  const existing = providerRuntimeState.get(providerId);
  if (existing) return existing;
  const created: ProviderRuntimeState = {
    consecutiveFailures: 0,
    totalFailures: 0,
    totalSuccesses: 0,
    cooldownUntilMs: 0,
    skippedDueToCooldown: 0,
    lastError: null,
    lastFailureAt: null,
    lastSuccessAt: null,
  };
  providerRuntimeState.set(providerId, created);
  return created;
}

function isProviderInCooldown(state: ProviderRuntimeState): boolean {
  return state.cooldownUntilMs > nowMs();
}

function markProviderSuccess(state: ProviderRuntimeState): void {
  state.consecutiveFailures = 0;
  state.cooldownUntilMs = 0;
  state.totalSuccesses += 1;
  state.lastSuccessAt = new Date().toISOString();
}

function markProviderFailure(
  providerId: string,
  state: ProviderRuntimeState,
  error: unknown,
  failureThreshold: number,
  cooldownMs: number
): void {
  state.consecutiveFailures += 1;
  state.totalFailures += 1;
  state.lastFailureAt = new Date().toISOString();
  state.lastError = String((error as any)?.message || error || "unknown error").slice(0, 280);

  if (state.consecutiveFailures >= failureThreshold) {
    state.cooldownUntilMs = nowMs() + cooldownMs;
    state.consecutiveFailures = 0;
    console.warn(
      `[LLM Fallback] ${providerId} entered cooldown for ${cooldownMs}ms after ${failureThreshold} consecutive failures`
    );
  }
}

function isUsableProviderOutput(text: string): boolean {
  const trimmed = String(text || "").trim();
  if (!trimmed) return false;
  return !UNUSABLE_PROVIDER_OUTPUT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function extractFallbackIntent(prompt: string): string {
  const cleaned = String(prompt || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return "your local request";
  }

  const shortened = cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
  return `"${shortened}"`;
}

function normalizeProviderOrderToken(token: string): ProviderOrderToken | null {
  const normalized = token.trim().toLowerCase();
  if (normalized === "openai" || normalized === "openai-responses") return "openai";
  if (normalized === "vertex" || normalized === "vertex-gemini") return "vertex";
  if (normalized === "gemini" || normalized === "gemini-api") return "gemini";
  return null;
}

function readProviderOrder(): ProviderOrderToken[] {
  const configured = String(process.env.SCOUT_LLM_PROVIDER_ORDER || "")
    .split(",")
    .map((token) => normalizeProviderOrderToken(token))
    .filter((token): token is ProviderOrderToken => Boolean(token));

  if (configured.length === 0) {
    return [...DEFAULT_PROVIDER_ORDER];
  }

  const deduped: ProviderOrderToken[] = [];
  for (const token of configured) {
    if (!deduped.includes(token)) deduped.push(token);
  }

  return deduped;
}

export function buildScoutLlmProviders(): LLMProvider[] {
  const providers: LLMProvider[] = [];
  const order = readProviderOrder();
  for (const token of order) {
    if (token === "openai") {
      providers.push(new OpenAIResponsesProvider(process.env.OPENAI_API_KEY || ""));
      continue;
    }
    if (token === "vertex") {
      providers.push(new VertexGeminiProvider());
      continue;
    }
    if (token === "gemini") {
      providers.push(new GeminiProvider(process.env.GEMINI_API_KEY || ""));
    }
  }
  return providers;
}

export function getLlmProviderFailoverRuntimeState(): {
  order: string[];
  providers: Array<{
    id: string;
    inCooldown: boolean;
    cooldownRemainingMs: number;
    consecutiveFailures: number;
    totalFailures: number;
    totalSuccesses: number;
    skippedDueToCooldown: number;
    lastError: string | null;
    lastFailureAt: string | null;
    lastSuccessAt: string | null;
  }>;
} {
  const now = nowMs();
  const providers = Array.from(providerRuntimeState.entries())
    .map(([id, state]) => ({
      id,
      inCooldown: state.cooldownUntilMs > now,
      cooldownRemainingMs: Math.max(0, state.cooldownUntilMs - now),
      consecutiveFailures: state.consecutiveFailures,
      totalFailures: state.totalFailures,
      totalSuccesses: state.totalSuccesses,
      skippedDueToCooldown: state.skippedDueToCooldown,
      lastError: state.lastError,
      lastFailureAt: state.lastFailureAt,
      lastSuccessAt: state.lastSuccessAt,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    order: readProviderOrder(),
    providers,
  };
}

export function __resetLlmProviderFailoverStateForTests(): void {
  providerRuntimeState.clear();
}

export async function generateWithFallback(
  prompt: string,
  providers: LLMProvider[],
  options?: LLMGenerationOptions
): Promise<{ text: string; provider: string }> {
  const failureThreshold = readEnvNumber("SCOUT_LLM_PROVIDER_FAILURE_THRESHOLD", 3, 1, 10);
  const cooldownMs = readEnvNumber("SCOUT_LLM_PROVIDER_COOLDOWN_MS", 120_000, 1000, 3_600_000);

  for (let index = 0; index < providers.length; index += 1) {
    const provider = providers[index];
    if (!provider.isConfigured()) continue;
    const providerId = getProviderId(provider, index);
    const state = getOrCreateRuntimeState(providerId);

    if (isProviderInCooldown(state)) {
      state.skippedDueToCooldown += 1;
      continue;
    }

    try {
      const text = await provider.generate(prompt, options);
      if (!isUsableProviderOutput(text)) {
        throw new Error("provider returned unusable placeholder output");
      }
      markProviderSuccess(state);
      return { text, provider: provider.name };
    } catch (e) {
      markProviderFailure(providerId, state, e, failureThreshold, cooldownMs);
      // Log error and try next
      console.error(`[LLM Fallback] ${providerId} failed:`, e);
    }
  }
  // Deterministic non-LLM safety net to avoid blank/dead-end responses in production.
  const intent = extractFallbackIntent(prompt);
  return {
    text: `TradeScout can still help route ${intent} across Community, Direct Connect, Exchange, and local operating tools while language systems recover.`,
    provider: "fallback",
  };
}
