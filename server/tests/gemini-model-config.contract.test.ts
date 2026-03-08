import { afterEach, describe, expect, it } from "vitest";
import { getGeminiModelCandidates, getGeminiModelName } from "../ai/modelConfig";

const ORIGINAL_GEMINI_MODEL = process.env.GEMINI_MODEL;
const ORIGINAL_GEMINI_MODEL_FALLBACKS = process.env.GEMINI_MODEL_FALLBACKS;

afterEach(() => {
  process.env.GEMINI_MODEL = ORIGINAL_GEMINI_MODEL;
  process.env.GEMINI_MODEL_FALLBACKS = ORIGINAL_GEMINI_MODEL_FALLBACKS;
});

describe("gemini model config sanitization", () => {
  it("removes unsupported gemini-3.* candidates and strips models/ prefixes", () => {
    process.env.GEMINI_MODEL =
      "gemini-3.1-flash-lite,models/gemini-3.1-pro,models/gemini-2.5-flash";
    process.env.GEMINI_MODEL_FALLBACKS = "models/gemini-3.1-flash,gemini-2.0-flash";

    const selected = getGeminiModelName();
    const candidates = getGeminiModelCandidates();

    expect(selected).toBe("gemini-2.5-flash");
    expect(candidates.some((model) => model.includes("gemini-3."))).toBe(false);
    expect(candidates.some((model) => model.startsWith("models/"))).toBe(false);
  });
});
