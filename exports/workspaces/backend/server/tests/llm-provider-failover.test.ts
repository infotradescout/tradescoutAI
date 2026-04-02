import { afterEach, describe, expect, it } from "vitest";
import type { LLMProvider } from "../services/llmProvider";
import {
  __resetLlmProviderFailoverStateForTests,
  buildScoutLlmProviders,
  generateWithFallback,
  getLlmProviderFailoverRuntimeState,
} from "../services/llmProvider";

const ENV_SNAPSHOT = {
  SCOUT_LLM_PROVIDER_FAILURE_THRESHOLD: process.env.SCOUT_LLM_PROVIDER_FAILURE_THRESHOLD,
  SCOUT_LLM_PROVIDER_COOLDOWN_MS: process.env.SCOUT_LLM_PROVIDER_COOLDOWN_MS,
  SCOUT_LLM_PROVIDER_ORDER: process.env.SCOUT_LLM_PROVIDER_ORDER,
};

afterEach(() => {
  process.env.SCOUT_LLM_PROVIDER_FAILURE_THRESHOLD =
    ENV_SNAPSHOT.SCOUT_LLM_PROVIDER_FAILURE_THRESHOLD;
  process.env.SCOUT_LLM_PROVIDER_COOLDOWN_MS = ENV_SNAPSHOT.SCOUT_LLM_PROVIDER_COOLDOWN_MS;
  process.env.SCOUT_LLM_PROVIDER_ORDER = ENV_SNAPSHOT.SCOUT_LLM_PROVIDER_ORDER;
  __resetLlmProviderFailoverStateForTests();
});

function createProvider(
  id: string,
  impl: { configured?: boolean; generate: (prompt: string) => Promise<string> | string }
): LLMProvider {
  return {
    name: "gemini",
    id,
    isConfigured: () => impl.configured !== false,
    generate: impl.generate,
  };
}

describe("generateWithFallback provider reliability", () => {
  it("fails over when a provider returns placeholder output", async () => {
    let firstCalls = 0;
    let secondCalls = 0;

    const providers: LLMProvider[] = [
      createProvider("vertex-gemini", {
        generate: async () => {
          firstCalls += 1;
          return "Scout is thinking. Please try again in a moment.";
        },
      }),
      createProvider("gemini-api", {
        generate: async () => {
          secondCalls += 1;
          return "I can route this to Direct Connect now.";
        },
      }),
    ];

    const result = await generateWithFallback("need a roofer", providers);
    expect(result.provider).toBe("gemini");
    expect(result.text).toBe("I can route this to Direct Connect now.");
    expect(firstCalls).toBe(1);
    expect(secondCalls).toBe(1);
  });

  it("cooldowns a repeatedly failing provider and skips it on subsequent turns", async () => {
    process.env.SCOUT_LLM_PROVIDER_FAILURE_THRESHOLD = "2";
    process.env.SCOUT_LLM_PROVIDER_COOLDOWN_MS = "60000";

    let firstCalls = 0;
    let secondCalls = 0;

    const providers: LLMProvider[] = [
      createProvider("vertex-gemini", {
        generate: async () => {
          firstCalls += 1;
          throw new Error("vertex timeout");
        },
      }),
      createProvider("gemini-api", {
        generate: async () => {
          secondCalls += 1;
          return "Local routing is ready.";
        },
      }),
    ];

    await generateWithFallback("prompt-1", providers);
    await generateWithFallback("prompt-2", providers);
    await generateWithFallback("prompt-3", providers);

    expect(firstCalls).toBe(2);
    expect(secondCalls).toBe(3);

    const runtime = getLlmProviderFailoverRuntimeState();
    const vertexState = runtime.providers.find((p) => p.id === "vertex-gemini");
    expect(vertexState?.inCooldown).toBe(true);
    expect((vertexState?.skippedDueToCooldown || 0) >= 1).toBe(true);
  });

  it("respects explicit provider order from env", () => {
    process.env.SCOUT_LLM_PROVIDER_ORDER = "gemini,vertex";
    const providers = buildScoutLlmProviders();
    expect(providers.map((p) => p.id)).toEqual(["gemini-api", "vertex-gemini"]);
  });
});
