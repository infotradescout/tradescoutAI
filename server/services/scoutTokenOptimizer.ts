/**
 * Scout Token Optimizer
 *
 * Reduces token usage (and therefore API costs) by:
 * 1. Compressing knowledge context
 * 2. Removing redundant information
 * 3. Summarizing long content
 * 4. Selective inclusion of sources
 *
 * Goal: Reduce tokens by 30-50% without losing quality
 */

export interface TokenStats {
  originalTokens: number;
  optimizedTokens: number;
  reduction: string;
  compressionRatio: number;
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Remove duplicate sentences
 */
export function removeDuplicateSentences(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const sentence of sentences) {
    const normalized = sentence.trim().toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(sentence);
    }
  }

  return unique.join(" ");
}

/**
 * Remove redundant phrases
 */
export function removeRedundantPhrases(text: string): string {
  const redundantPatterns = [
    /please note that /gi,
    /it is important to /gi,
    /it should be noted that /gi,
    /in addition to this /gi,
    /furthermore, /gi,
    /moreover, /gi,
    /in conclusion, /gi,
    /to summarize, /gi,
  ];

  let optimized = text;
  for (const pattern of redundantPatterns) {
    optimized = optimized.replace(pattern, "");
  }

  return optimized;
}

/**
 * Compress whitespace
 */
export function compressWhitespace(text: string): string {
  return text
    .replace(/\n\n+/g, "\n") // Multiple newlines to single
    .replace(/\s+/g, " ") // Multiple spaces to single
    .trim();
}

/**
 * Summarize long paragraphs (keep first sentence + key points)
 */
export function summarizeLongContent(text: string, maxLength: number = 500): string {
  if (text.length <= maxLength) {
    return text;
  }

  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  let summary = "";

  for (const sentence of sentences) {
    if ((summary + sentence).length <= maxLength) {
      summary += sentence;
    } else {
      break;
    }
  }

  return summary.trim();
}

/**
 * Remove unnecessary qualifiers
 */
export function removeUnnecessaryQualifiers(text: string): string {
  const qualifiers = [
    /\b(very|really|quite|somewhat|rather|fairly|pretty|somewhat|arguably)\b/gi,
    /\b(in my opinion|I think|I believe|it seems|it appears)\b/gi,
    /\b(possibly|probably|maybe|perhaps|allegedly)\b/gi,
  ];

  let optimized = text;
  for (const qualifier of qualifiers) {
    optimized = optimized.replace(qualifier, "");
  }

  return optimized;
}

/**
 * Extract only relevant knowledge for a query
 */
export function extractRelevantKnowledgeOnly(
  knowledge: string,
  query: string,
  maxLength: number = 1000
): string {
  const queryTerms = query.toLowerCase().split(/\s+/);
  const lines = knowledge.split("\n");
  const relevantLines: string[] = [];

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    const matchCount = queryTerms.filter((term) => lowerLine.includes(term)).length;

    if (matchCount > 0) {
      relevantLines.push(line);
    }
  }

  // If no relevant lines found, return first part
  if (relevantLines.length === 0) {
    return knowledge.substring(0, maxLength);
  }

  let result = relevantLines.join("\n");
  if (result.length > maxLength) {
    result = result.substring(0, maxLength) + "...";
  }

  return result;
}

/**
 * Optimize a knowledge section for token efficiency
 */
export function optimizeKnowledgeSection(
  section: string,
  maxTokens: number = 500
): { optimized: string; stats: TokenStats } {
  const originalTokens = estimateTokens(section);

  let optimized = section;

  // 1. Remove duplicate sentences
  optimized = removeDuplicateSentences(optimized);

  // 2. Remove redundant phrases
  optimized = removeRedundantPhrases(optimized);

  // 3. Compress whitespace
  optimized = compressWhitespace(optimized);

  // 4. Remove unnecessary qualifiers
  optimized = removeUnnecessaryQualifiers(optimized);

  // 5. Summarize if still too long
  const currentTokens = estimateTokens(optimized);
  if (currentTokens > maxTokens) {
    optimized = summarizeLongContent(optimized, maxTokens * 4); // 4 chars per token
  }

  const optimizedTokens = estimateTokens(optimized);
  const reduction = originalTokens - optimizedTokens;
  const reductionPercent = ((reduction / originalTokens) * 100).toFixed(1);

  return {
    optimized,
    stats: {
      originalTokens,
      optimizedTokens,
      reduction: `${reduction} tokens (${reductionPercent}%)`,
      compressionRatio: originalTokens / optimizedTokens,
    },
  };
}

/**
 * Optimize multiple knowledge sections
 */
export function optimizeAllKnowledgeSections(
  sections: Record<string, string>
): {
  optimized: Record<string, string>;
  totalStats: TokenStats;
} {
  const optimized: Record<string, string> = {};
  let totalOriginal = 0;
  let totalOptimized = 0;

  for (const [key, section] of Object.entries(sections)) {
    const result = optimizeKnowledgeSection(section);
    optimized[key] = result.optimized;
    totalOriginal += result.stats.originalTokens;
    totalOptimized += result.stats.optimizedTokens;
  }

  const reduction = totalOriginal - totalOptimized;
  const reductionPercent = ((reduction / totalOriginal) * 100).toFixed(1);

  return {
    optimized,
    totalStats: {
      originalTokens: totalOriginal,
      optimizedTokens: totalOptimized,
      reduction: `${reduction} tokens (${reductionPercent}%)`,
      compressionRatio: totalOriginal / totalOptimized,
    },
  };
}

/**
 * Build an optimized system prompt
 */
export function buildOptimizedSystemPrompt(
  basePrompt: string,
  knowledgeSections: Record<string, string>
): { prompt: string; stats: TokenStats } {
  // Optimize knowledge sections
  const { optimized: optimizedKnowledge, totalStats: knowledgeStats } =
    optimizeAllKnowledgeSections(knowledgeSections);

  // Build optimized prompt
  let optimizedPrompt = basePrompt;
  for (const [key, section] of Object.entries(optimizedKnowledge)) {
    optimizedPrompt += `\n\n## ${key}\n${section}`;
  }

  // Optimize the prompt itself
  const baseTokens = estimateTokens(basePrompt);
  const finalTokens = estimateTokens(optimizedPrompt);
  const totalReduction = baseTokens + knowledgeStats.originalTokens - finalTokens;
  const totalReductionPercent = (
    (totalReduction / (baseTokens + knowledgeStats.originalTokens)) *
    100
  ).toFixed(1);

  return {
    prompt: optimizedPrompt,
    stats: {
      originalTokens: baseTokens + knowledgeStats.originalTokens,
      optimizedTokens: finalTokens,
      reduction: `${totalReduction} tokens (${totalReductionPercent}%)`,
      compressionRatio:
        (baseTokens + knowledgeStats.originalTokens) / finalTokens,
    },
  };
}

/**
 * Estimate cost savings from token optimization
 */
export function estimateCostSavings(stats: TokenStats): {
  originalCost: number;
  optimizedCost: number;
  savings: number;
  savingsPercent: string;
} {
  // Rough pricing: $0.0005 per 1000 tokens (input)
  const costPerToken = 0.0005 / 1000;

  const originalCost = stats.originalTokens * costPerToken;
  const optimizedCost = stats.optimizedTokens * costPerToken;
  const savings = originalCost - optimizedCost;
  const savingsPercent = ((savings / originalCost) * 100).toFixed(1);

  return {
    originalCost: parseFloat(originalCost.toFixed(4)),
    optimizedCost: parseFloat(optimizedCost.toFixed(4)),
    savings: parseFloat(savings.toFixed(4)),
    savingsPercent,
  };
}
