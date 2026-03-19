/**
 * Unit tests for Scout response extraction and sanitization
 */

import { describe, it, expect } from "vitest";
import { extractUserMessage, extractMetadata } from "./extractUserMessage";

describe("extractUserMessage", () => {
  describe("plain string input", () => {
    it("should pass through clean strings", () => {
      const input = "Here's a helpful answer to your question.";
      const result = extractUserMessage(input);
      expect(result.message).toBe(input);
      expect(result.isClean).toBe(true);
      expect(result.hadLeakage).toBe(false);
    });

    it("should truncate strings longer than 700 chars", () => {
      const long = "A".repeat(800);
      const result = extractUserMessage(long);
      expect(result.message.length).toBeLessThanOrEqual(703); // "A"s + "…"
      expect(result.message.endsWith("...")).toBe(true);
      expect(result.isClean).toBe(true);
    });

    it("should reject strings that start with JSON", () => {
      const input = '{"intent": "find_contractor", "message": "Here is the answer"}';
      const result = extractUserMessage(input);
      expect(result.hadLeakage).toBe(true);
      expect(result.message).not.toContain("intent");
      expect(result.message).toContain("Here is the answer");
    });

    it("should reject strings containing step-by-step markers", () => {
      const input = "Step 1: First, understand the problem. Step 2: Find contractors.";
      const result = extractUserMessage(input);
      expect(result.hadLeakage).toBe(true);
      expect(result.message).not.toContain("Step 1");
    });

    it("should reject strings containing reasoning keywords", () => {
      const inputs = [
        "Analysis: The user is looking for contractors.",
        "Reasoning: We need to search the database.",
        "Decision: I will show available contractors.",
      ];
      for (const input of inputs) {
        const result = extractUserMessage(input);
        expect(result.hadLeakage).toBe(true);
        expect(result.message).not.toContain(input.split(":")[0]);
      }
    });

    it("should handle empty or whitespace-only strings", () => {
      const result1 = extractUserMessage("");
      const result2 = extractUserMessage("   ");
      expect(result1.message).toContain("one clear next step");
      expect(result2.message).toContain("one clear next step");
      expect(result1.isClean).toBe(false);
      expect(result2.isClean).toBe(false);
    });
  });

  describe("JSON object input", () => {
    it("should extract message from standard message field", () => {
      const input = { message: "Here is your answer" };
      const result = extractUserMessage(input);
      expect(result.message).toBe("Here is your answer");
      expect(result.isClean).toBe(true);
    });

    it("should extract from final_answer if message missing", () => {
      const input = { final_answer: "The final answer is here" };
      const result = extractUserMessage(input);
      expect(result.message).toBe("The final answer is here");
      expect(result.isClean).toBe(true);
    });

    it("should extract from response if message and final_answer missing", () => {
      const input = { response: "This is the response" };
      const result = extractUserMessage(input);
      expect(result.message).toBe("This is the response");
      expect(result.isClean).toBe(true);
    });

    it("should extract from answer field as fallback", () => {
      const input = { answer: "Here's an answer" };
      const result = extractUserMessage(input);
      expect(result.message).toBe("Here's an answer");
      expect(result.isClean).toBe(true);
    });

    it("should block objects with intent field", () => {
      const input = {
        intent: "find_contractor",
        message: "Here is a helpful response",
      };
      const result = extractUserMessage(input);
      expect(result.hadLeakage).toBe(true);
      expect(result.leakageFields).toContain("intent");
      expect(result.message).toContain("helpful response");
    });

    it("should block objects with thought_flow field", () => {
      const input = {
        thought_flow: ["Step 1", "Step 2"],
        message: "Final answer",
      };
      const result = extractUserMessage(input);
      expect(result.hadLeakage).toBe(true);
      expect(result.leakageFields).toContain("thought_flow");
    });

    it("should block objects with reasoning field", () => {
      const input = {
        reasoning: "The user asked about contractors...",
        message: "Here's what I found",
      };
      const result = extractUserMessage(input);
      expect(result.hadLeakage).toBe(true);
      expect(result.leakageFields).toContain("reasoning");
    });

    it("should block objects with decision field", () => {
      const input = {
        decision: "Showing contractors in Harris County",
        message: "Here are the results",
      };
      const result = extractUserMessage(input);
      expect(result.hadLeakage).toBe(true);
      expect(result.leakageFields).toContain("decision");
    });

    it("should block objects with analysis field", () => {
      const input = {
        analysis: "This is a complex query",
        message: "Response message",
      };
      const result = extractUserMessage(input);
      expect(result.hadLeakage).toBe(true);
      expect(result.leakageFields).toContain("analysis");
    });

    it("should handle null or undefined fields gracefully", () => {
      const input = {
        intent: undefined,
        message: "Safe message",
      };
      const result = extractUserMessage(input);
      expect(result.message).toBe("Safe message");
      expect(result.isClean).toBe(true);
    });

    it("should return fallback for empty or missing message fields", () => {
      const result = extractUserMessage({});
      expect(result.message).toContain("one clear next step");
      expect(result.isClean).toBe(false);
    });

    it("should use custom fallback when provided", () => {
      const customFallback = "Custom fallback message";
      const result = extractUserMessage({}, customFallback);
      expect(result.message).toBe(customFallback);
    });
  });

  describe("edge cases", () => {
    it("should handle null input", () => {
      const result = extractUserMessage(null as any);
      expect(result.message).toContain("one clear next step");
      expect(result.isClean).toBe(false);
    });

    it("should handle boolean input", () => {
      const result = extractUserMessage(true as any);
      expect(result.message).toContain("one clear next step");
      expect(result.isClean).toBe(false);
    });

    it("should handle number input", () => {
      const result = extractUserMessage(42 as any);
      expect(result.message).toContain("one clear next step");
      expect(result.isClean).toBe(false);
    });

    it("should collect multiple leakage fields", () => {
      const input = {
        intent: "find_contractor",
        reasoning: "The user asked about...",
        thought_flow: ["Step 1"],
        message: "Safe message",
      };
      const result = extractUserMessage(input);
      expect(result.hadLeakage).toBe(true);
      expect(result.leakageFields?.length).toBe(3);
      expect(result.leakageFields).toContain("intent");
      expect(result.leakageFields).toContain("reasoning");
      expect(result.leakageFields).toContain("thought_flow");
    });

    it("should normalize whitespace in clean messages", () => {
      const input = "  Here is an answer  \n  with weird spacing  ";
      const result = extractUserMessage(input);
      expect(result.message).toBe("Here is an answer\nwith weird spacing");
      expect(result.isClean).toBe(true);
    });
  });

  describe("pattern detection", () => {
    it("should detect JSON-like structures at start", () => {
      const withMessage = extractUserMessage('{ "message": "test" }');
      expect(withMessage.hadLeakage).toBe(true);
      expect(withMessage.message).toBe("test");

      const withIntentOnly = extractUserMessage('{"intent": "find"}');
      expect(withIntentOnly.hadLeakage).toBe(true);

      const genericJson = extractUserMessage('  {  "test": "value"  }');
      expect(genericJson.isClean).toBe(true);
      expect(genericJson.message).toContain('"test": "value"');
    });

    it("should detect reasoning keywords case-insensitively", () => {
      const cases = [
        "ANALYSIS: The user wants contractors",
        "Analysis: Some text",
        "REASONING: Decision logic",
        "reasoning: more text",
      ];
      for (const input of cases) {
        const result = extractUserMessage(input);
        expect(result.hadLeakage).toBe(true);
      }
    });
  });
});

describe("extractMetadata", () => {
  it("should extract intent from object", () => {
    const input = { intent: "find_contractor", message: "Safe" };
    const metadata = extractMetadata(input);
    expect(metadata.intent).toBe("find_contractor");
  });

  it("should extract confidence from object", () => {
    const input = { confidence: 0.95, message: "Safe" };
    const metadata = extractMetadata(input);
    expect(metadata.confidence).toBe(0.95);
  });

  it("should extract resolvedContext from object", () => {
    const input = {
      resolvedContext: { stage: "CONTRACT" },
      message: "Safe",
    };
    const metadata = extractMetadata(input);
    expect(metadata.resolvedContext).toEqual({ stage: "CONTRACT" });
  });

  it("should return empty object for string input", () => {
    const metadata = extractMetadata("test string");
    expect(metadata).toEqual({});
  });

  it("should return empty object for null/undefined", () => {
    const metadata1 = extractMetadata(null as any);
    const metadata2 = extractMetadata(undefined as any);
    expect(metadata1).toEqual({});
    expect(metadata2).toEqual({});
  });

  it("should handle missing optional fields", () => {
    const input = { message: "Safe message" };
    const metadata = extractMetadata(input);
    expect(metadata.intent).toBeUndefined();
    expect(metadata.confidence).toBeUndefined();
  });
});

describe("integration scenarios", () => {
  it("should handle a realistic LLM response with all fields", () => {
    const llmResponse = {
      intent: "find_contractors",
      thought_flow: [
        "User is asking about roofing",
        "They're in Harris County",
        "I should show vetted roofers",
      ],
      decision: "Showing top 5 roofers in Harris County with ratings > 4.5",
      message: "I found 5 highly-rated roofers in your area. Here they are...",
      suggestedActions: ["Compare these roofers side-by-side", "Save my favorites"],
      confidence: 0.92,
    };

    const result = extractUserMessage(llmResponse);

    // Should block due to reasoning fields
    expect(result.hadLeakage).toBe(true);
    expect(result.leakageFields).toContain("intent");
    expect(result.leakageFields).toContain("thought_flow");
    expect(result.leakageFields).toContain("decision");

    // Should flag leakage fields while still preserving safe final message text
    expect(result.message).toContain("found 5");
  });

  it("should handle a clean LLM response with safe message", () => {
    const llmResponse = {
      message: "I found 5 highly-rated roofers in your area ready to help.",
      suggestedActions: ["Compare these", "Save"],
      confidence: 0.92,
    };

    const result = extractUserMessage(llmResponse);

    // Should be clean
    expect(result.hadLeakage).toBe(false);
    expect(result.isClean).toBe(true);

    // Should preserve message
    expect(result.message).toBe("I found 5 highly-rated roofers in your area ready to help.");
  });

  it("should handle length-limited clean response", () => {
    const longMessage = "A".repeat(750);
    const llmResponse = {
      message: longMessage,
      confidence: 0.85,
    };

    const result = extractUserMessage(llmResponse);

    // Should still be clean
    expect(result.hadLeakage).toBe(false);

    // Should be truncated with ellipsis
    expect(result.message.length).toBeLessThanOrEqual(703);
    expect(result.message.endsWith("...")).toBe(true);
  });
});
