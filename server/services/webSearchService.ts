import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateGeminiTextWithFallback } from "../ai/geminiFallback";

export interface WebSearchResult {
  success: boolean;
  content?: string;
  provider?: string;
  error?: string;
}

/**
 * Lightweight web search utility using Gemini with web capability.
 * Returns summarized text; callers should indicate that content is from the wider internet.
 */
export async function webSearch(query: string, nResults = 5): Promise<WebSearchResult> {
  if (!process.env.GEMINI_API_KEY) {
    return { success: false, error: "GEMINI_API_KEY not configured" };
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const prompt = `Search the open web for: ${query}\nReturn ${nResults} concise findings with sources when possible.`;
    const { text, model } = await generateGeminiTextWithFallback(genAI, prompt);
    if (!text) {
      return { success: false, error: "Empty web search response" };
    }
    return { success: true, content: text, provider: `gemini:${model}` };
  } catch (error: any) {
    return { success: false, error: error?.message || "Web search failed" };
  }
}
