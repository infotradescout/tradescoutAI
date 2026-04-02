import { afterEach, describe, expect, it } from "vitest";
import {
  __resetGeminiFallbackStateForTests,
  getGeminiFallbackRuntimeState,
  GeminiRateLimitError,
  generateGeminiTextWithFallback,
} from "../ai/geminiFallback";

type HandlerContext = {
  model: string;
  prompt: string;
  attempt: number;
};

type Handler = (ctx: HandlerContext) => Promise<string> | string;

function createGeminiStub(
  handlers: Record<string, Handler>,
  defaultHandler?: Handler
): {
  gemini: any;
  calls: string[];
  countFor: (model: string) => number;
} {
  const calls: string[] = [];
  const counts = new Map<string, number>();
  const fallbackHandler: Handler = defaultHandler
    ? defaultHandler
    : async () => {
        throw {
          status: 404,
          message: "model not found for this operation",
        };
      };

  return {
    gemini: {
      getGenerativeModel: ({ model }: { model: string }) => ({
        generateContent: async (prompt: string) => {
          const nextAttempt = (counts.get(model) || 0) + 1;
          counts.set(model, nextAttempt);
          calls.push(model);

          const handler = handlers[model] || fallbackHandler;
          const text = await handler({ model, prompt, attempt: nextAttempt });
          return {
            response: {
              text: () => text,
            },
          };
        },
      }),
    },
    calls,
    countFor: (model: string) => counts.get(model) || 0,
  };
}

const envSnapshot = {
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  GEMINI_MODEL_FALLBACKS: process.env.GEMINI_MODEL_FALLBACKS,
  GEMINI_RATE_LIMIT_RETRIES: process.env.GEMINI_RATE_LIMIT_RETRIES,
  GEMINI_TRANSIENT_RETRIES: process.env.GEMINI_TRANSIENT_RETRIES,
  GEMINI_RETRY_BACKOFF_MS: process.env.GEMINI_RETRY_BACKOFF_MS,
  GEMINI_RATE_LIMIT_COOLDOWN_MS: process.env.GEMINI_RATE_LIMIT_COOLDOWN_MS,
  GEMINI_MODEL_UNAVAILABLE_TTL_MS: process.env.GEMINI_MODEL_UNAVAILABLE_TTL_MS,
};

afterEach(() => {
  process.env.GEMINI_MODEL = envSnapshot.GEMINI_MODEL;
  process.env.GEMINI_MODEL_FALLBACKS = envSnapshot.GEMINI_MODEL_FALLBACKS;
  process.env.GEMINI_RATE_LIMIT_RETRIES = envSnapshot.GEMINI_RATE_LIMIT_RETRIES;
  process.env.GEMINI_TRANSIENT_RETRIES = envSnapshot.GEMINI_TRANSIENT_RETRIES;
  process.env.GEMINI_RETRY_BACKOFF_MS = envSnapshot.GEMINI_RETRY_BACKOFF_MS;
  process.env.GEMINI_RATE_LIMIT_COOLDOWN_MS = envSnapshot.GEMINI_RATE_LIMIT_COOLDOWN_MS;
  process.env.GEMINI_MODEL_UNAVAILABLE_TTL_MS = envSnapshot.GEMINI_MODEL_UNAVAILABLE_TTL_MS;
  __resetGeminiFallbackStateForTests();
});

describe("generateGeminiTextWithFallback resilience", () => {
  it("skips unavailable model (404) and succeeds on next candidate", async () => {
    process.env.GEMINI_MODEL = "gemini-2.5-flash,gemini-2.0-flash";
    process.env.GEMINI_MODEL_FALLBACKS = "";
    process.env.GEMINI_RATE_LIMIT_RETRIES = "0";
    process.env.GEMINI_TRANSIENT_RETRIES = "0";
    process.env.GEMINI_RETRY_BACKOFF_MS = "1";
    process.env.GEMINI_MODEL_UNAVAILABLE_TTL_MS = "60000";

    const stub = createGeminiStub({
      "gemini-2.5-flash": async () => {
        throw { status: 404, message: "model not found" };
      },
      "gemini-2.0-flash": async () => "ok from fallback model",
    });

    const result = await generateGeminiTextWithFallback(stub.gemini as any, "test prompt");

    expect(result.text).toBe("ok from fallback model");
    expect(result.model).toBe("gemini-2.0-flash");
    expect(stub.countFor("gemini-2.5-flash")).toBe(1);
    expect(stub.countFor("gemini-2.0-flash")).toBe(1);

    const second = await generateGeminiTextWithFallback(stub.gemini as any, "test prompt 2");
    expect(second.text).toBe("ok from fallback model");
    // First model should be skipped due to temporary unavailable cache.
    expect(stub.countFor("gemini-2.5-flash")).toBe(1);
    expect(stub.countFor("gemini-2.0-flash")).toBe(2);
  });

  it("retries on 429 before succeeding on the same model", async () => {
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
    process.env.GEMINI_MODEL_FALLBACKS = "";
    process.env.GEMINI_RATE_LIMIT_RETRIES = "2";
    process.env.GEMINI_TRANSIENT_RETRIES = "0";
    process.env.GEMINI_RETRY_BACKOFF_MS = "1";

    const stub = createGeminiStub({
      "gemini-2.5-flash": async ({ attempt }) => {
        if (attempt < 3) {
          throw { status: 429, message: "Too Many Requests" };
        }
        return "ok after retries";
      },
    });

    const result = await generateGeminiTextWithFallback(stub.gemini as any, "retry prompt");

    expect(result.text).toBe("ok after retries");
    expect(result.model).toBe("gemini-2.5-flash");
    expect(stub.countFor("gemini-2.5-flash")).toBe(3);
  });

  it("throws GeminiRateLimitError when all candidate models are rate-limited", async () => {
    process.env.GEMINI_MODEL = "gemini-2.5-flash,gemini-2.0-flash";
    process.env.GEMINI_MODEL_FALLBACKS = "";
    process.env.GEMINI_RATE_LIMIT_RETRIES = "0";
    process.env.GEMINI_TRANSIENT_RETRIES = "0";
    process.env.GEMINI_RETRY_BACKOFF_MS = "1";
    process.env.GEMINI_RATE_LIMIT_COOLDOWN_MS = "50";

    const stub = createGeminiStub({}, async () => {
      throw { status: 429, message: "quota exceeded" };
    });

    try {
      await generateGeminiTextWithFallback(stub.gemini as any, "quota prompt");
      throw new Error("Expected rate-limit error");
    } catch (error: any) {
      expect(error).toBeInstanceOf(GeminiRateLimitError);
      expect((error as GeminiRateLimitError).status).toBe(429);
      expect((error as GeminiRateLimitError).failures).toBeGreaterThan(0);
      expect(Array.isArray((error as GeminiRateLimitError).models)).toBe(true);
      expect((error as GeminiRateLimitError).cooldownRemainingMs).toBeGreaterThan(0);
    }
  });

  it("short-circuits during active rate-limit cooldown and resumes after cooldown", async () => {
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
    process.env.GEMINI_MODEL_FALLBACKS = "";
    process.env.GEMINI_RATE_LIMIT_RETRIES = "0";
    process.env.GEMINI_TRANSIENT_RETRIES = "0";
    process.env.GEMINI_RETRY_BACKOFF_MS = "1";
    process.env.GEMINI_RATE_LIMIT_COOLDOWN_MS = "30";

    const stub = createGeminiStub({
      "gemini-2.5-flash": async ({ attempt }) => {
        if (attempt === 1) throw { status: 429, message: "Too Many Requests" };
        return "ok after cooldown";
      },
    });

    await expect(
      generateGeminiTextWithFallback(stub.gemini as any, "cooldown prompt")
    ).rejects.toBeInstanceOf(GeminiRateLimitError);
    expect(stub.countFor("gemini-2.5-flash")).toBe(1);
    expect(getGeminiFallbackRuntimeState().rateLimitCooldownRemainingMs).toBeGreaterThan(0);

    await expect(
      generateGeminiTextWithFallback(stub.gemini as any, "cooldown prompt second")
    ).rejects.toBeInstanceOf(GeminiRateLimitError);
    // Should not call provider again while cooldown is active.
    expect(stub.countFor("gemini-2.5-flash")).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 45));

    const result = await generateGeminiTextWithFallback(
      stub.gemini as any,
      "cooldown prompt third"
    );
    expect(result.text).toBe("ok after cooldown");
    expect(stub.countFor("gemini-2.5-flash")).toBe(2);
    expect(getGeminiFallbackRuntimeState().rateLimitCooldownRemainingMs).toBe(0);
  });

  it("fails fast on fatal auth errors without cascading through all models", async () => {
    process.env.GEMINI_MODEL = "gemini-2.5-flash,gemini-2.0-flash";
    process.env.GEMINI_MODEL_FALLBACKS = "";
    process.env.GEMINI_RATE_LIMIT_RETRIES = "0";
    process.env.GEMINI_TRANSIENT_RETRIES = "0";
    process.env.GEMINI_RETRY_BACKOFF_MS = "1";

    const stub = createGeminiStub({
      "gemini-2.5-flash": async () => {
        throw { status: 401, message: "invalid API key" };
      },
      "gemini-2.0-flash": async () => "should not be used",
    });

    await expect(
      generateGeminiTextWithFallback(stub.gemini as any, "auth prompt")
    ).rejects.toMatchObject({ status: 401 });
    expect(stub.countFor("gemini-2.5-flash")).toBe(1);
    expect(stub.countFor("gemini-2.0-flash")).toBe(0);
  });
});
