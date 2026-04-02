// LLM Provider abstraction for multi-model and fallback (PHASE 3)
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateAIResponse as generateVertexAIResponse } from "../ai/vertexClient";
import { generateGeminiTextWithFallback } from "../ai/geminiFallback";
// import { OpenAI } from "openai"; // Uncomment if OpenAI is used

export type LLMModel = "gemini" | "openai";

export interface LLMProvider {
  name: LLMModel;
  id?: string;
  isConfigured(): boolean;
  generate(prompt: string, options?: any): Promise<string>;
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
  async generate(prompt: string) {
    const { text } = await generateGeminiTextWithFallback(this.genAI, prompt);
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

  async generate(prompt: string) {
    // vertexClient enforces fail-safe messaging on error.
    return generateVertexAIResponse(prompt);
  }
}

// Example OpenAI provider (scaffold)
// export class OpenAIProvider implements LLMProvider {
//   name: LLMModel = "openai";
//   private openai: OpenAI;
//   constructor(apiKey: string) {
//     this.openai = new OpenAI({ apiKey });
//   }
//   isConfigured() {
//     return !!process.env.OPENAI_API_KEY;
//   }
//   async generate(prompt: string) {
//     const result = await this.openai.chat.completions.create({
//       model: "gpt-4",
//       messages: [{ role: "user", content: prompt }],
//     });
//     return result.choices[0].message.content;
//   }
// }

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

const DEFAULT_PROVIDER_ORDER = ["vertex", "gemini"] as const;

const UNUSABLE_PROVIDER_OUTPUT_PATTERNS = [
  /^scout is thinking\.? please try again in a moment\.?$/i,
  /^scout is thinking\.?$/i,
];

function readEnvNumber(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(raw)));
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

function normalizeProviderOrderToken(token: string): "vertex" | "gemini" | null {
  const normalized = token.trim().toLowerCase();
  if (normalized === "vertex" || normalized === "vertex-gemini") return "vertex";
  if (normalized === "gemini" || normalized === "gemini-api") return "gemini";
  return null;
}

function readProviderOrder(): Array<"vertex" | "gemini"> {
  const configured = String(process.env.SCOUT_LLM_PROVIDER_ORDER || "")
    .split(",")
    .map((token) => normalizeProviderOrderToken(token))
    .filter((token): token is "vertex" | "gemini" => Boolean(token));

  if (configured.length === 0) {
    return [...DEFAULT_PROVIDER_ORDER];
  }

  const deduped: Array<"vertex" | "gemini"> = [];
  for (const token of configured) {
    if (!deduped.includes(token)) deduped.push(token);
  }

  for (const fallbackToken of DEFAULT_PROVIDER_ORDER) {
    if (!deduped.includes(fallbackToken)) deduped.push(fallbackToken);
  }

  return deduped;
}

export function buildScoutLlmProviders(): LLMProvider[] {
  const providers: LLMProvider[] = [];
  const order = readProviderOrder();
  for (const token of order) {
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
  providers: LLMProvider[]
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
      const text = await provider.generate(prompt);
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
  return {
    text: "TradeScout can still route the strongest next step across Community, Direct Connect, Exchange, and local operating tools.",
    provider: "fallback",
  };
}
