import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("scout gemini fallback wiring contract", () => {
  it("exposes gemini fallback runtime state on admin system status", () => {
    const source = read("server/routes/scout.ts");
    expect(source).toContain("getGeminiFallbackRuntimeState");
    expect(source).toContain("geminiFallback: getGeminiFallbackRuntimeState()");
    expect(source).toContain("getLlmProviderFailoverRuntimeState");
    expect(source).toContain("llmFailover: getLlmProviderFailoverRuntimeState()");
  });

  it("records fallback reasons for degraded synthesis paths", () => {
    const source = read("server/routes/scout.ts");
    expect(source).toContain('recordFallback("schema_violation")');
    expect(source).toContain('recordFallback("json_parse_error")');
    expect(source).toContain('recordFallback(isRateLimited ? "synthesis_rate_limited"');
    expect(source).toContain("degradationReason?: ScoutDegradationReason");
    expect(source).toContain('degradationReason: "provider_unavailable"');
    expect(source).toContain('degradationReason: "schema_violation"');
  });

  it("keeps intro questions broad and avoids raw system-error copy", () => {
    const source = read("server/routes/scout.ts");
    expect(source).toContain("/what\\s+can\\s+you\\s+do(\\s+for\\s+me)?/i");
    expect(source).toContain("/how\\s+can\\s+you\\s+help(\\s+me)?/i");
    expect(source).not.toContain(
      "I encountered a system error. Please try rephrasing your question."
    );
    expect(source).toContain("buildContextualSynthesisFallbackMessage(knowledge.answer)");
  });
});
