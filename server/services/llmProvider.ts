// LLM Provider abstraction for multi-model and fallback (PHASE 3)
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateAIResponse as generateVertexAIResponse } from "../ai/vertexClient";
import { generateGeminiTextWithFallback } from "../ai/geminiFallback";
// import { OpenAI } from "openai"; // Uncomment if OpenAI is used

export type LLMModel = "gemini" | "openai";

export interface LLMProvider {
  name: LLMModel;
  isConfigured(): boolean;
  generate(prompt: string, options?: any): Promise<string>;
}

export class GeminiProvider implements LLMProvider {
  name: LLMModel = "gemini";
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

export async function generateWithFallback(
  prompt: string,
  providers: LLMProvider[]
): Promise<{ text: string; provider: string }> {
  for (const provider of providers) {
    if (!provider.isConfigured()) continue;
    try {
      const text = await provider.generate(prompt);
      return { text, provider: provider.name };
    } catch (e) {
      // Log error and try next
      console.error(`[LLM Fallback] ${provider.name} failed:`, e);
    }
  }
  throw new Error("All LLM providers failed");
}
