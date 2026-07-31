import { afterEach, describe, expect, it } from "vitest";
import {
  OpenAIResponsesBusinessProfileAnalyzer,
  containsForbiddenProfileInference,
  createConfiguredBusinessProfileAnalyzer,
  enrichBusinessProfileFromEvidence,
  normalizeBusinessProfileEnrichment,
} from "../services/businessProfileEnrichmentService";

const originalPublicWebUrl = process.env.PUBLIC_WEB_URL;
const originalOpenAiKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  if (originalPublicWebUrl === undefined) delete process.env.PUBLIC_WEB_URL;
  else process.env.PUBLIC_WEB_URL = originalPublicWebUrl;
  if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAiKey;
});

describe("business profile Selective Intelligence enrichment", () => {
  it("uses Responses structured output, web evidence, and only accessible images", async () => {
    process.env.PUBLIC_WEB_URL = "https://preview.tradescout.example/some/path";
    let capturedRequest: any;
    let capturedOptions: any;
    const analyzer = new OpenAIResponsesBusinessProfileAnalyzer({
      responses: {
        async create(request, options) {
          capturedRequest = request;
          capturedOptions = options;
          return {
            output_text: JSON.stringify({
              description: {
                text: "Custom furniture and built-in woodwork.",
                sourceUrls: ["https://maker.example/work"],
              },
              about: { text: "", sourceUrls: [] },
              services: [
                {
                  name: "Custom furniture",
                  sourceUrls: ["https://preview.tradescout.example/objects/project.jpg"],
                },
              ],
            }),
          };
        },
      },
    });

    const raw = await analyzer.analyze({
      businessName: "Maker Works",
      links: ["https://maker.example/work"],
      photoUrls: [
        "/objects/project.jpg",
        "/objects/../../api/private",
        "/objects/%252e%252e/api/private",
        "/api/private-photo",
        "/uploads/not-owned.jpg",
        "javascript:alert(1)",
      ],
    });
    const normalized = normalizeBusinessProfileEnrichment(
      raw,
      {
        businessName: "Maker Works",
        links: ["https://maker.example/work"],
        photoUrls: ["/objects/project.jpg"],
      },
      analyzer.id
    );

    expect(capturedRequest).toMatchObject({
      store: false,
      stream: false,
      tools: [{ type: "web_search_preview" }],
      text: {
        format: {
          type: "json_schema",
          name: "business_profile_enrichment",
          strict: true,
        },
      },
    });
    const serializedInput = JSON.stringify(capturedRequest.input);
    expect(capturedRequest.instructions).toContain("untrusted evidence");
    expect(serializedInput).toContain("https://preview.tradescout.example/objects/project.jpg");
    expect(serializedInput).not.toContain("https://preview.tradescout.example/api/private");
    expect(serializedInput).not.toContain("/api/private-photo");
    expect(serializedInput).not.toContain("/uploads/not-owned.jpg");
    expect(capturedOptions.timeout).toBeGreaterThanOrEqual(1_000);
    expect(normalized).toMatchObject({
      source: "selective_intelligence_profile_enrichment",
      analyzer: "openai_responses",
      description: { text: "Services include Custom furniture." },
      services: [{ name: "Custom furniture" }],
    });
  });

  it("drops uncited, unsupported, and prohibited semantics inside allowed strings", () => {
    const source = "https://maker.example/work";
    const normalized = normalizeBusinessProfileEnrichment(
      {
        description: {
          text: "Licensed, insured, 5-star service from $99.",
          sourceUrls: [source],
        },
        about: {
          text: "Contact us at 850-555-0100. Located in Pensacola.",
          sourceUrls: [source],
        },
        services: [
          { name: "$99 emergency repair", sourceUrls: [source] },
          { name: "Verified plumbing", sourceUrls: [source] },
          { name: "Cabinet refacing", sourceUrls: [source] },
          { name: "Uncited roofing", sourceUrls: ["https://other.example/"] },
        ],
        license: "LIC-123",
        insurance: true,
        reviews: [{ rating: 5 }],
        pricing: "$99",
        contact: "850-555-0100",
        category: "Contractor",
        location: "Pensacola",
        ownership: "Jane Doe",
      },
      { businessName: "Maker", links: [source], photoUrls: [] },
      "adversarial_test"
    );

    expect(containsForbiddenProfileInference("Top-rated and insured from $99")).toBe(true);
    expect(normalized).toEqual({
      source: "selective_intelligence_profile_enrichment",
      analyzer: "adversarial_test",
      description: {
        text: "Services include Cabinet refacing.",
        sourceUrls: [source],
      },
      services: [{ name: "Cabinet refacing", sourceUrls: [source] }],
    });
    expect(JSON.stringify(normalized)).not.toMatch(
      /license|insured|rating|\$99|850-555|Pensacola|Jane Doe|Contractor/i
    );
  });

  it("rejects ownership, location, longevity, availability, and award variants", () => {
    const source = "https://maker.example/work";
    const forbiddenVariants = [
      "A family-owned plumbing company serving Chicago since 1985, available 24/7.",
      "An award-winning five-star team.",
      "Chicago’s neighborhood plumber.",
      "We serve customers throughout chicago and nearby suburbs.",
      "Providing plumbing services for 25 years.",
      "Emergency appointments around the clock.",
      "Rated five out of five by customers.",
      "Winner of the 2025 neighborhood choice honor.",
      "Run by a father-and-son team.",
      "A plumbing contractor specializing in residential plumbing.",
      "State-authorized and fully covered",
      "Chicago-based plumbing company",
      "Jobs begin at ninety-nine dollars",
      "Customers consistently praise the work",
      "Open weekdays",
      "A family business with a decade in the trade",
    ];
    const normalized = normalizeBusinessProfileEnrichment(
      {
        description: {
          text: "A family-owned plumbing company serving Chicago since 1985, available 24/7.",
          sourceUrls: [source],
        },
        about: {
          text: "An award-winning five-star team.",
          sourceUrls: [source],
        },
        services: [
          { name: "Twenty years of experience", sourceUrls: [source] },
          ...forbiddenVariants.map((name) => ({ name, sourceUrls: [source] })),
          { name: "Residential drain cleaning", sourceUrls: [source] },
        ],
      },
      { businessName: "Maker", links: [source], photoUrls: [] },
      "adversarial_test"
    );

    forbiddenVariants.forEach((value) => {
      expect(containsForbiddenProfileInference(value)).toBe(true);
    });
    expect(containsForbiddenProfileInference("Residential drain cleaning")).toBe(false);
    expect(normalized).toEqual({
      source: "selective_intelligence_profile_enrichment",
      analyzer: "adversarial_test",
      description: {
        text: "Services include Residential drain cleaning.",
        sourceUrls: [source],
      },
      services: [{ name: "Residential drain cleaning", sourceUrls: [source] }],
    });
  });

  it("fails soft and never auto-configures network analysis in tests", async () => {
    process.env.OPENAI_API_KEY = "must-not-be-used";
    expect(createConfiguredBusinessProfileAnalyzer()).toBeNull();

    const result = await enrichBusinessProfileFromEvidence(
      {
        businessName: "Maker",
        links: ["https://maker.example/work"],
        photoUrls: [],
      },
      {
        id: "failing",
        async analyze() {
          throw new Error("inference unavailable");
        },
      }
    );
    expect(result).toBeNull();
  });
});
