/**
 * AI Inference Service
 * Phase 3d-A: OpenAI integration for Scout claim inference
 * 
 * Contract:
 * - Provides generic OpenAI chat completion interface
 * - Used by Scout onboarding to infer claims from free-form text
 * - Returns structured JSON responses
 */

import OpenAI from 'openai';

// Simple inline logger (avoids circular dependency)
const logger = {
  info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
  error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
  warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export interface AIInferenceRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface AIInferenceResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Call OpenAI for structured inference
 * Returns raw text content (caller handles JSON parsing)
 */
export async function callAIInference(req: AIInferenceRequest): Promise<AIInferenceResponse> {
  if (!process.env.OPENAI_API_KEY) {
    logger.error('[AI_INFERENCE] OPENAI_API_KEY not configured');
    throw new Error('AI inference not available');
  }

  try {
    const completion = await openai.chat.completions.create({
      model: req.model || 'gpt-4o-mini', // Fast, cost-effective model for structured tasks
      temperature: req.temperature ?? 0.3,
      max_tokens: req.maxTokens ?? 500,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
    });

    const content = completion.choices[0]?.message?.content || '';
    
    logger.info('[AI_INFERENCE] Inference completed', {
      model: completion.model,
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
      totalTokens: completion.usage?.total_tokens,
    });

    return {
      content,
      usage: completion.usage ? {
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
      } : undefined,
    };
  } catch (error) {
    logger.error('[AI_INFERENCE] OpenAI API error', { error });
    throw error;
  }
}
