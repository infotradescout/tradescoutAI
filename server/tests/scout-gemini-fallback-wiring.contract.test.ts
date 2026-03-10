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
  });

  it("records fallback reasons for degraded synthesis paths", () => {
    const source = read("server/routes/scout.ts");
    expect(source).toContain('recordFallback("schema_violation")');
    expect(source).toContain('recordFallback("json_parse_error")');
    expect(source).toContain('recordFallback(isRateLimited ? "synthesis_rate_limited"');
  });
});
