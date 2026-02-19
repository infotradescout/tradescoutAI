// LLM Provider abstraction for multi-model and fallback (PHASE 3)
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateAIResponse as generateVertexAIResponse } from "../ai/vertexClient";
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
    const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    return result.response.text();
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

// Demo/Mock provider for development when API keys are unavailable
export class DemoProvider implements LLMProvider {
  name: LLMModel = "gemini";

  isConfigured() {
    return true; // Always available as fallback
  }

  async generate(prompt: string) {
    // Simulate realistic responses for common prompts
    if (prompt.toLowerCase().includes("contractor") || prompt.toLowerCase().includes("builder")) {
      return "Based on your request, I can help you find verified local contractors in your area. TradeScout connects you with skilled professionals for various projects. What type of work are you looking for?";
    }
    if (prompt.toLowerCase().includes("marketplace")) {
      return "TradeScout's marketplace lets you buy, sell, or rent equipment and services locally. You can browse listings, message contractors directly, and complete transactions securely within the platform.";
    }
    if (prompt.toLowerCase().includes("community")) {
      return "TradeScout helps communities connect! You can:\n• Find local talent and contractors\n• Share deals and opportunities\n• Launch community building initiatives\n• Access real-time local intelligence\nWhat aspect interests you most?";
    }
    // Default response
    return "I'm Scout, your TradeScout assistant. I can help you find local contractors, browse marketplace deals, connect with your community, or explore local opportunities. What would you like to know?";
  }
}

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
