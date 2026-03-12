import { afterEach, describe, expect, it } from "vitest";
import { getGeminiModelCandidates, getGeminiModelName } from "../ai/modelConfig";

const ORIGINAL_GEMINI_MODEL = process.env.GEMINI_MODEL;
const ORIGINAL_GEMINI_MODEL_FALLBACKS = process.env.GEMINI_MODEL_FALLBACKS;
const ORIGINAL_GEMINI_MODEL_ALLOW_UNLISTED = process.env.GEMINI_MODEL_ALLOW_UNLISTED;

afterEach(() => {
  process.env.GEMINI_MODEL = ORIGINAL_GEMINI_MODEL;
  process.env.GEMINI_MODEL_FALLBACKS = ORIGINAL_GEMINI_MODEL_FALLBACKS;
  process.env.GEMINI_MODEL_ALLOW_UNLISTED = ORIGINAL_GEMINI_MODEL_ALLOW_UNLISTED;
});

describe("gemini model config sanitization", () => {
  it("allows configured 3.1 models and strips models/ prefixes", () => {
    process.env.GEMINI_MODEL =
      "gemini-3.1-flash-lite,models/gemini-3.0-flash-exp,models/gemini-2.5-flash";
    process.env.GEMINI_MODEL_FALLBACKS = "models/gemini-3.1-flash,gemini-2.0-flash";

    const selected = getGeminiModelName();
    const candidates = getGeminiModelCandidates();

    expect(selected).toBe("gemini-3.1-flash-lite");
    expect(candidates).toContain("gemini-3.1-flash-lite");
    expect(candidates).toContain("gemini-3.1-flash");
    expect(candidates).not.toContain("gemini-3.0-flash-exp");
    expect(candidates.some((model) => model.startsWith("models/"))).toBe(false);
  });

  it("drops unlisted models unless explicitly allowed", () => {
    process.env.GEMINI_MODEL_ALLOW_UNLISTED = "false";
    process.env.GEMINI_MODEL = "gemini-2.5-flash,gemini-9.9-experimental";
    process.env.GEMINI_MODEL_FALLBACKS = "gemini-2.0-flash,gemini-alpha-test";

    const candidates = getGeminiModelCandidates();
    expect(candidates).toContain("gemini-2.5-flash");
    expect(candidates).toContain("gemini-2.0-flash");
    expect(candidates).not.toContain("gemini-9.9-experimental");
    expect(candidates).not.toContain("gemini-alpha-test");

    process.env.GEMINI_MODEL_ALLOW_UNLISTED = "true";
    const allowedCandidates = getGeminiModelCandidates();
    expect(allowedCandidates).toContain("gemini-9.9-experimental");
    expect(allowedCandidates).toContain("gemini-alpha-test");
  });
});
