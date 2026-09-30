import { afterEach, describe, expect, it, vi } from "vitest";
import type { LLMProvider } from "../services/llmProvider";
import {
  __resetLlmProviderFailoverStateForTests,
  buildScoutLlmProviders,
  generateWithFallback,
  getLlmProviderFailoverRuntimeState,
} from "../services/llmProvider";

const { openAiOptions, chatCreate } = vi.hoisted(() => ({
  openAiOptions: vi.fn(),
  chatCreate: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: chatCreate } };
    constructor(options: unknown) {
      openAiOptions(options);
    }
  },
}));

const ENV_SNAPSHOT = {
  SCOUT_LLM_PROVIDER_FAILURE_THRESHOLD: process.env.SCOUT_LLM_PROVIDER_FAILURE_THRESHOLD,
  SCOUT_LLM_PROVIDER_COOLDOWN_MS: process.env.SCOUT_LLM_PROVIDER_COOLDOWN_MS,
  SCOUT_LLM_PROVIDER_ORDER: process.env.SCOUT_LLM_PROVIDER_ORDER,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};

function restoreEnv(name: keyof typeof ENV_SNAPSHOT): void {
  const value = ENV_SNAPSHOT[name];
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

afterEach(() => {
  vi.unstubAllEnvs();
  openAiOptions.mockClear();
  chatCreate.mockReset();
  restoreEnv("SCOUT_LLM_PROVIDER_FAILURE_THRESHOLD");
  restoreEnv("SCOUT_LLM_PROVIDER_COOLDOWN_MS");
  restoreEnv("SCOUT_LLM_PROVIDER_ORDER");
  restoreEnv("OPENAI_API_KEY");
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

  it("prefers OpenAI Responses by default while keeping Gemini fallbacks", () => {
    delete process.env.SCOUT_LLM_PROVIDER_ORDER;
    const providers = buildScoutLlmProviders();
    expect(providers.map((p) => p.id)).toEqual(["openai-responses", "vertex-gemini", "gemini-api"]);
  });

  it("does not call OpenAI unless OPENAI_API_KEY is configured", async () => {
    delete process.env.OPENAI_API_KEY;
    let openAiCalls = 0;

    const providers: LLMProvider[] = [
      {
        name: "openai",
        id: "openai-responses",
        isConfigured: () => Boolean(process.env.OPENAI_API_KEY),
        generate: async () => {
          openAiCalls += 1;
          return "OpenAI response";
        },
      },
      createProvider("gemini-api", {
        generate: async () => "Gemini fallback response",
      }),
    ];

    const result = await generateWithFallback("route this", providers);
    expect(result.provider).toBe("gemini");
    expect(result.text).toBe("Gemini fallback response");
    expect(openAiCalls).toBe(0);
  });

  it("contextual fallback includes the user prompt when all providers fail", async () => {
    const providers: LLMProvider[] = [
      createProvider("vertex-gemini", {
        generate: async () => {
          throw new Error("vertex unavailable");
        },
      }),
      createProvider("gemini-api", {
        generate: async () => {
          throw new Error("gemini unavailable");
        },
      }),
    ];

    const result = await generateWithFallback("find me a roofer in Travis County", providers);
    expect(result.provider).toBe("fallback");
    expect(result.text).toContain("find me a roofer in Travis County");
    expect(result.text).toContain("TradeScout can still help route");
    expect(result.text).toContain("while language systems recover");
  });

  it("contextual fallback truncates long prompts to 120 characters", async () => {
    const longPrompt = "a".repeat(200);
    const providers: LLMProvider[] = [
      createProvider("vertex-gemini", {
        generate: async () => {
          throw new Error("vertex unavailable");
        },
      }),
    ];

    const result = await generateWithFallback(longPrompt, providers);
    expect(result.provider).toBe("fallback");
    // extractFallbackIntent slices to 117 chars then appends '...' = 120 chars inside quotes
    expect(result.text).toContain(`"${"a".repeat(117)}..."`);
  });

  it("contextual fallback uses generic phrase when prompt is empty", async () => {
    const providers: LLMProvider[] = [
      createProvider("vertex-gemini", {
        generate: async () => {
          throw new Error("vertex unavailable");
        },
      }),
    ];

    const result = await generateWithFallback("", providers);
    expect(result.provider).toBe("fallback");
    expect(result.text).toContain("your local request");
  });
});

function configureNeon() {
  vi.stubEnv("SCOUT_LLM_PROVIDER_ORDER", "neon");
  vi.stubEnv("NEON_AI_GATEWAY_BASE_URL", "https://br-test-api.ai.c-2.us-east-1.aws.neon.tech/");
  vi.stubEnv("NEON_AI_GATEWAY_TOKEN", "test-neon-token");
  vi.stubEnv("SCOUT_NEON_MODEL_DEFAULT", "test-catalog-model");
  for (const name of [
    "SCOUT_NEON_MODEL_FAST",
    "SCOUT_NEON_MODEL_STANDARD",
    "SCOUT_NEON_MODEL_REASONING",
    "SCOUT_NEON_MAX_OUTPUT_TOKENS",
    "SCOUT_NEON_TIMEOUT_MS",
    "SCOUT_NEON_TEMPERATURE",
  ])
    vi.stubEnv(name, undefined);
}

describe("optional Neon AI Gateway", () => {
  it("does not select Neon just because credentials are injected", () => {
    configureNeon();
    vi.stubEnv("SCOUT_LLM_PROVIDER_ORDER", undefined);
    expect(buildScoutLlmProviders().map((provider) => provider.id)).toEqual([
      "openai-responses",
      "vertex-gemini",
      "gemini-api",
    ]);
    expect(openAiOptions).not.toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "test-neon-token" })
    );
  });

  it("uses the bare branch host plus /v1, explicit model and bounded chat request", async () => {
    configureNeon();
    chatCreate.mockResolvedValue({
      choices: [{ message: { content: " Local routing is ready. " } }],
    });
    const providers = buildScoutLlmProviders();
    expect(providers.map((provider) => provider.id)).toEqual(["neon-ai-gateway"]);
    expect(openAiOptions).toHaveBeenCalledWith({
      apiKey: "test-neon-token",
      baseURL: "https://br-test-api.ai.c-2.us-east-1.aws.neon.tech/v1",
      maxRetries: 0,
    });
    expect(await generateWithFallback("route this", providers)).toEqual({
      provider: "neon",
      text: "Local routing is ready.",
    });
    expect(chatCreate).toHaveBeenCalledWith(
      {
        model: "test-catalog-model",
        messages: [{ role: "user", content: "route this" }],
        max_tokens: 900,
        stream: false,
      },
      { timeout: 20_000 }
    );
  });

  it("selects configured tiers, preserves synthesis format and clamps cost controls", async () => {
    configureNeon();
    vi.stubEnv("SCOUT_NEON_MODEL_REASONING", "test-reasoning-model");
    vi.stubEnv("SCOUT_NEON_TIMEOUT_MS", "900000");
    chatCreate.mockResolvedValue({ choices: [{ message: { content: '{"message":"Ready"}' } }] });
    await generateWithFallback("JSON route this", buildScoutLlmProviders(), {
      modelTier: "reasoning",
      responseFormat: "scout_synthesis_json",
      maxOutputTokens: 100_000,
      temperature: 99,
    });
    expect(chatCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "test-reasoning-model",
        max_tokens: 4000,
        temperature: 2,
        response_format: {
          type: "json_schema",
          json_schema: expect.objectContaining({
            name: "scout_synthesis_response",
            schema: expect.objectContaining({ required: ["message"] }),
            strict: false,
          }),
        },
      }),
      { timeout: 120_000 }
    );
  });

  it("supports text content blocks without returning reasoning or tool data", async () => {
    configureNeon();
    chatCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: [
              { type: "thinking", text: "internal" },
              { type: "text", text: "Local" },
              { type: "tool_use", input: { secret: "unused" } },
              { type: "text", text: "routing" },
            ],
          },
        },
      ],
    });
    expect(await generateWithFallback("route", buildScoutLlmProviders())).toEqual({
      provider: "neon",
      text: "Local\nrouting",
    });
  });

  it.each(["NEON_AI_GATEWAY_BASE_URL", "NEON_AI_GATEWAY_TOKEN", "SCOUT_NEON_MODEL_DEFAULT"])(
    "fails explicit Neon selection when %s is absent",
    (name) => {
      configureNeon();
      vi.stubEnv(name, " ");
      expect(() => buildScoutLlmProviders()).toThrow(`missing ${name}`);
      expect(chatCreate).not.toHaveBeenCalled();
    }
  );

  it.each([
    "not-a-url",
    "http://br-test-api.ai.us-east-1.aws.neon.tech",
    "https://br-test-api.ai.us-east-1.aws.neon.tech/v1",
    "https://br-test-api.ai.us-east-1.aws.neon.tech/ai-gateway",
    "https://br-test-api.ai.us-east-1.aws.neon.tech?token=secret",
    "https://user:secret@br-test-api.ai.us-east-1.aws.neon.tech",
    "https://br-test-api.ai.us-east-1.aws.neon.tech.evil.example",
  ])("rejects an invalid gateway host without echoing it", (baseURL) => {
    configureNeon();
    vi.stubEnv("NEON_AI_GATEWAY_BASE_URL", baseURL);
    expect(() => buildScoutLlmProviders()).toThrow(
      "NEON_AI_GATEWAY_BASE_URL must be a bare HTTPS Neon branch gateway host"
    );
    expect(chatCreate).not.toHaveBeenCalled();
  });

  it.each(["rate_limit", "empty", "placeholder"])(
    "uses the existing fallback/cooldown after Neon %s output",
    async (failure) => {
      configureNeon();
      vi.stubEnv("SCOUT_LLM_PROVIDER_ORDER", "neon-ai-gateway,gemini,neon");
      vi.stubEnv("SCOUT_LLM_PROVIDER_FAILURE_THRESHOLD", "1");
      vi.stubEnv("SCOUT_LLM_PROVIDER_COOLDOWN_MS", "60000");
      if (failure === "rate_limit")
        chatCreate.mockRejectedValue(new Error("gateway rate limited (429)"));
      else
        chatCreate.mockResolvedValue({
          choices: [
            {
              message: {
                content:
                  failure === "empty" ? [] : "Scout is thinking. Please try again in a moment.",
              },
            },
          ],
        });
      const providers = buildScoutLlmProviders();
      expect(providers.map((provider) => provider.id)).toEqual(["neon-ai-gateway", "gemini-api"]);
      providers[1] = createProvider("test-fallback", { generate: () => "Local routing is ready." });
      for (let attempt = 0; attempt < 2; attempt += 1) {
        expect(await generateWithFallback("route this", providers)).toEqual({
          provider: "gemini",
          text: "Local routing is ready.",
        });
      }
      expect(chatCreate).toHaveBeenCalledTimes(1);
      expect(
        getLlmProviderFailoverRuntimeState().providers.find(
          (provider) => provider.id === "neon-ai-gateway"
        )
      ).toMatchObject({ inCooldown: true, totalFailures: 1, skippedDueToCooldown: 1 });
    }
  );
});
