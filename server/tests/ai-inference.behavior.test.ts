import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    responses = { create };
  },
}));
import { callAIInference } from "../services/aiInference";

const input = {
  systemPrompt: "Return JSON claim suggestions only.",
  userPrompt: "I need help.",
  temperature: 0.3,
};

describe("claim inference Responses contract", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-not-a-provider-key");
    for (const name of [
      "SCOUT_OPENAI_MODEL_INFERENCE",
      "SCOUT_OPENAI_MODEL_FAST",
      "SCOUT_OPENAI_MODEL_DEFAULT",
      "SCOUT_OPENAI_TIMEOUT_MS",
    ]) {
      vi.stubEnv(name, "");
    }
    create
      .mockReset()
      .mockResolvedValue({ output_text: '{"suggestions":[]}', model: "synthetic-response-model" });
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("preserves the exact default legacy request until the workload is opted in", async () => {
    await callAIInference(input);
    expect(create).toHaveBeenCalledWith(
      {
        model: "gpt-5.4-nano",
        instructions: input.systemPrompt,
        input: input.userPrompt,
        max_output_tokens: 500,
        store: false,
        stream: false,
        truncation: "auto",
        text: { format: { type: "json_object" } },
        temperature: 0.3,
        reasoning: { effort: "minimal" },
      },
      { timeout: 1000 }
    );
    // An unset timeout is checked separately; an explicitly empty env keeps the existing clamp.
  });

  it("opts in inference without changing the shared fast workload setting", async () => {
    vi.stubEnv("SCOUT_OPENAI_MODEL_INFERENCE", " gpt-6-luna ");
    vi.stubEnv("SCOUT_OPENAI_MODEL_FAST", "gpt-5.4-nano");
    await callAIInference(input);
    expect(create.mock.calls[0][0].model).toBe("gpt-6-luna");
    expect(process.env.SCOUT_OPENAI_MODEL_FAST).toBe("gpt-5.4-nano");
  });

  it("preserves trusted internal overrides and legacy environment precedence", async () => {
    vi.stubEnv("SCOUT_OPENAI_MODEL_INFERENCE", "gpt-6-luna");
    vi.stubEnv("SCOUT_OPENAI_MODEL_FAST", "gpt-5.4-nano");
    vi.stubEnv("SCOUT_OPENAI_MODEL_DEFAULT", "gpt-4o-mini");
    await callAIInference({ ...input, model: " gpt-5.4-nano " });
    expect(create.mock.calls[0][0].model).toBe("gpt-5.4-nano");
    vi.stubEnv("SCOUT_OPENAI_MODEL_INFERENCE", " ");
    await callAIInference(input);
    expect(create.mock.calls[1][0].model).toBe("gpt-5.4-nano");
    vi.stubEnv("SCOUT_OPENAI_MODEL_FAST", " ");
    await callAIInference(input);
    expect(create.mock.calls[2][0].model).toBe("gpt-4o-mini");
  });

  it.each(["gpt-6-luna", "gpt-6-sol", "gpt-6.1-sol", "gpt-6-astra"])(
    "emits compatible low-reasoning JSON requests for %s",
    async (model) => {
      await callAIInference({ ...input, model });
      const payload = create.mock.calls[0][0];
      expect(payload).toEqual({
        model,
        instructions: input.systemPrompt,
        input: input.userPrompt,
        max_output_tokens: 500,
        store: false,
        stream: false,
        truncation: "auto",
        text: { format: { type: "json_object" } },
        reasoning: { effort: "low" },
      });
      for (const key of ["temperature", "top_p", "top_logprobs"])
        expect(payload).not.toHaveProperty(key);
    }
  );

  it.each([
    "gpt-6-luna-2099-01-01",
    "gpt-6.9-sol",
    "gpt-6-typo",
    "GPT-6-LUNA",
    "gpt-6luna",
    "gpt-6_luna",
    "GpT-6LuNa",
  ])("rejects unsupported family ID %s before any provider call", async (model) => {
    await expect(callAIInference({ ...input, model })).rejects.toThrow(
      "Unsupported GPT-6 inference model"
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("keeps non-reasoning legacy request shape and omits nonfinite sampling", async () => {
    await callAIInference({
      ...input,
      model: "gpt-4o-mini",
      temperature: Number.NaN,
      maxTokens: 800,
    });
    expect(create.mock.calls[0][0]).toMatchObject({ model: "gpt-4o-mini", max_output_tokens: 800 });
    expect(create.mock.calls[0][0]).not.toHaveProperty("temperature");
    expect(create.mock.calls[0][0]).not.toHaveProperty("reasoning");
  });

  it.each([
    [undefined, 20000],
    ["bad", 20000],
    ["4500", 4500],
    ["200", 1000],
    ["999999", 120000],
  ])("keeps the existing timeout behavior for %s", async (configured, expected) => {
    if (configured === undefined) delete process.env.SCOUT_OPENAI_TIMEOUT_MS;
    else vi.stubEnv("SCOUT_OPENAI_TIMEOUT_MS", configured);
    await callAIInference(input);
    expect(create.mock.calls[0][1]).toEqual({ timeout: expected });
  });

  it("rejects missing credentials without a provider request", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(callAIInference(input)).rejects.toThrow("AI inference not available");
    expect(create).not.toHaveBeenCalled();
  });

  it("returns structured output and usage from Responses", async () => {
    create.mockResolvedValue({
      output_text: ' {"suggestions":[]} ',
      usage: { input_tokens: 30, output_tokens: 20, total_tokens: 50 },
    });
    expect(await callAIInference(input)).toEqual({
      content: '{"suggestions":[]}',
      usage: { promptTokens: 30, completionTokens: 20, totalTokens: 50 },
    });
  });

  it("decodes content-array output and refuses to turn provider failures into success", async () => {
    create.mockResolvedValueOnce({ output: [{ content: [{ text: '{"suggestions":[]}' }] }] });
    expect((await callAIInference(input)).content).toBe('{"suggestions":[]}');
    const failure = new Error("synthetic provider unavailable");
    create.mockRejectedValueOnce(failure);
    await expect(callAIInference(input)).rejects.toBe(failure);
  });
});
