import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { generateGeminiTextWithFallback } from "../ai/geminiFallback";

export interface WebSearchResult {
  success: boolean;
  content?: string;
  provider?: string;
  error?: string;
  sources?: Array<{ title?: string; url?: string }>;
}

/**
 * Web search using OpenAI Responses API with built-in web_search tool.
 * This provides real-time web search results with source attribution.
 */
async function webSearchWithOpenAI(query: string, nResults = 5): Promise<WebSearchResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { success: false, error: "OPENAI_API_KEY not configured" };
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Use the Responses API with web_search tool
    const response = await client.responses.create({
      model: "gpt-5",
      input: `Search the web for: "${query}"\n\nProvide ${nResults} relevant findings with sources. Format: 1. [Finding] (Source: URL)`,
      tools: [
        {
          type: "web_search",
          web_search: {
            max_results: nResults,
          },
        },
      ],
    });

    const text = extractOpenAIResponseText(response);
    if (!text) {
      return { success: false, error: "Empty web search response from OpenAI" };
    }

    return {
      success: true,
      content: text,
      provider: "openai-web-search",
    };
  } catch (error: any) {
    console.error("[Web Search] OpenAI web search failed:", error?.message);
    return { success: false, error: error?.message || "OpenAI web search failed" };
  }
}

/**
 * Fallback web search using Gemini with web capability.
 * Returns summarized text; callers should indicate that content is from the wider internet.
 */
async function webSearchWithGemini(query: string, nResults = 5): Promise<WebSearchResult> {
  if (!process.env.GEMINI_API_KEY) {
    return { success: false, error: "GEMINI_API_KEY not configured" };
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const prompt = `Search the open web for: ${query}\nReturn ${nResults} concise findings with sources when possible.`;
    const { text, model } = await generateGeminiTextWithFallback(genAI, prompt);
    if (!text) {
      return { success: false, error: "Empty web search response from Gemini" };
    }
    return { success: true, content: text, provider: `gemini:${model}` };
  } catch (error: any) {
    console.error("[Web Search] Gemini web search failed:", error?.message);
    return { success: false, error: error?.message || "Gemini web search failed" };
  }
}

/**
 * Primary web search function with intelligent fallback.
 * Tries OpenAI first (real web search), falls back to Gemini if needed.
 */
export async function webSearch(query: string, nResults = 5): Promise<WebSearchResult> {
  // Try OpenAI first if configured
  if (process.env.OPENAI_API_KEY) {
    const result = await webSearchWithOpenAI(query, nResults);
    if (result.success) {
      return result;
    }
    console.warn("[Web Search] OpenAI search failed, falling back to Gemini");
  }

  // Fall back to Gemini
  return webSearchWithGemini(query, nResults);
}

/**
 * Extract text from OpenAI Responses API response.
 */
function extractOpenAIResponseText(response: any): string {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const chunks: string[] = [];
  const output = Array.isArray(response?.output) ? response.output : [];
  for (const item of output) {
    if (item?.type === "response.output_text.delta" && typeof item?.delta === "string") {
      chunks.push(item.delta);
    }
    if (item?.type === "response.output_text" && typeof item?.text === "string") {
      chunks.push(item.text);
    }
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string") chunks.push(part.text);
      if (typeof part?.refusal === "string") chunks.push(part.refusal);
    }
  }

  return chunks.join("\n").trim();
}
