import OpenAI from "openai";

export interface WebSearchResult {
  success: boolean;
  content?: string;
  provider?: string;
  error?: string;
  sources?: WebSearchSource[];
}

export interface WebSearchSource {
  title?: string;
  url?: string;
  type?: string;
  provider?: string;
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
          type: "web_search_preview",
          search_context_size: nResults <= 3 ? "low" : nResults <= 6 ? "medium" : "high",
        },
      ],
    });

    return buildOpenAIWebSearchResult(response);
  } catch (error: any) {
    console.error("[Web Search] OpenAI web search failed:", error?.message);
    return { success: false, error: error?.message || "OpenAI web search failed" };
  }
}

/**
 * Citation-capable web search. Plain model generation is deliberately not a
 * fallback: a prompt asking a model to search does not prove that browsing or
 * grounding occurred.
 */
export async function webSearch(query: string, nResults = 5): Promise<WebSearchResult> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      success: false,
      error: "Citation-capable web search is not configured",
    };
  }
  return webSearchWithOpenAI(query, nResults);
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

/**
 * Accept a web-search response only when the provider returned both content
 * and machine-readable citation metadata. Generated prose URLs are never
 * promoted into evidence.
 */
export function buildOpenAIWebSearchResult(response: unknown): WebSearchResult {
  const provider = "openai-web-search";
  const content = extractOpenAIResponseText(response);
  if (!content) {
    return { success: false, provider, error: "Empty web search response from OpenAI" };
  }

  const sources = extractOpenAIResponseSources(response).map((source) => ({
    ...source,
    provider,
  }));
  if (sources.length === 0) {
    return {
      success: false,
      provider,
      error: "Web search returned no valid provider citation metadata",
    };
  }

  return { success: true, content, provider, sources };
}

function normalizeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;

  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

/**
 * Read only provider-supplied URL citations from the Responses API payload.
 * URLs mentioned in generated prose are deliberately not parsed into links.
 */
export function extractOpenAIResponseSources(response: unknown): WebSearchSource[] {
  const output = Array.isArray((response as any)?.output) ? (response as any).output : [];
  const sources: WebSearchSource[] = [];
  const seenUrls = new Set<string>();

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      const annotations = Array.isArray(part?.annotations) ? part.annotations : [];
      for (const annotation of annotations) {
        if (annotation?.type !== "url_citation") continue;
        const url = normalizeHttpUrl(annotation?.url);
        if (!url || seenUrls.has(url)) continue;

        const title =
          typeof annotation?.title === "string" && annotation.title.trim().length > 0
            ? annotation.title.trim()
            : url;
        seenUrls.add(url);
        sources.push({ title, url, type: "url_citation" });
      }
    }
  }

  return sources;
}
