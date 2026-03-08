import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiModelCandidates } from "./modelConfig";

function isRetryableModelError(error: unknown): boolean {
  const status = Number((error as any)?.status || 0);
  const message = String((error as any)?.message || "")
    .trim()
    .toLowerCase();
  if (status === 404 || status === 400) return true;
  if (message.includes("not found")) return true;
  if (message.includes("not supported")) return true;
  if (message.includes("model")) return true;
  return false;
}

export async function generateGeminiTextWithFallback(
  gemini: GoogleGenerativeAI,
  prompt: string
): Promise<{ text: string; model: string }> {
  const candidates = getGeminiModelCandidates();
  let lastError: unknown = null;

  for (const modelName of candidates) {
    try {
      const model = gemini.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (text && text.trim().length > 0) {
        return { text, model: modelName };
      }
      lastError = new Error(`Empty response from model: ${modelName}`);
    } catch (error) {
      lastError = error;
      if (!isRetryableModelError(error)) {
        throw error;
      }
      console.warn(`[Gemini] Model ${modelName} failed, trying next fallback model`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("All Gemini model fallbacks failed");
}
