import { afterEach, describe, expect, it } from "vitest";
import {
  buildOpenAIWebSearchResult,
  extractOpenAIResponseSources,
  webSearch,
} from "../services/webSearchService";

const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
const originalGeminiApiKey = process.env.GEMINI_API_KEY;

afterEach(() => {
  if (originalOpenAiApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAiApiKey;
  if (originalGeminiApiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalGeminiApiKey;
});

describe("webSearchService source extraction", () => {
  it("preserves provider-supplied citation titles and authoritative URLs", () => {
    const sources = extractOpenAIResponseSources({
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "The county publishes its permit requirements online.",
              annotations: [
                {
                  type: "url_citation",
                  title: "Travis County permit guidance",
                  url: "https://www.traviscountytx.gov/tnr/development-services",
                },
                {
                  type: "url_citation",
                  title: "Duplicate citation",
                  url: "https://www.traviscountytx.gov/tnr/development-services",
                },
              ],
            },
          ],
        },
      ],
    });

    expect(sources).toEqual([
      {
        title: "Travis County permit guidance",
        url: "https://www.traviscountytx.gov/tnr/development-services",
        type: "url_citation",
      },
    ]);
  });

  it("does not turn generated prose or unsafe annotation schemes into links", () => {
    const sources = extractOpenAIResponseSources({
      output_text: "A model-mentioned URL is not provider citation metadata: https://example.com",
      output: [
        {
          content: [
            {
              text: "Unsafe citation",
              annotations: [
                {
                  type: "url_citation",
                  title: "Unsafe",
                  url: "javascript:alert(1)",
                },
              ],
            },
          ],
        },
      ],
    });

    expect(sources).toEqual([]);
  });

  it("rejects generated web prose when provider citation metadata is absent", () => {
    const result = buildOpenAIWebSearchResult({
      output_text: "A generated answer that mentions https://example.com in prose.",
      output: [{ type: "message", content: [{ type: "output_text", annotations: [] }] }],
    });

    expect(result).toEqual({
      success: false,
      provider: "openai-web-search",
      error: "Web search returned no valid provider citation metadata",
    });
  });

  it("accepts content only when the provider returned a valid citation", () => {
    const result = buildOpenAIWebSearchResult({
      output_text: "The county publishes its permit requirements online.",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              annotations: [
                {
                  type: "url_citation",
                  title: "Official county permits",
                  url: "https://example.gov/permits",
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result).toEqual({
      success: true,
      content: "The county publishes its permit requirements online.",
      provider: "openai-web-search",
      sources: [
        {
          title: "Official county permits",
          url: "https://example.gov/permits",
          type: "url_citation",
          provider: "openai-web-search",
        },
      ],
    });
  });

  it("does not treat a configured plain Gemini model as web search", async () => {
    delete process.env.OPENAI_API_KEY;
    process.env.GEMINI_API_KEY = "configured-but-not-grounded";

    await expect(webSearch("current permit rules", 5)).resolves.toEqual({
      success: false,
      error: "Citation-capable web search is not configured",
    });
  });
});
