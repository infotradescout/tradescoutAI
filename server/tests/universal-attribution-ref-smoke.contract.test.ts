import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("universal attribution ref smoke contract", () => {
  it("defines separated production statuses for fail-closed and valid-ref outcomes", () => {
    const script = read("scripts/universal-attribution-ref-smoke.mjs");

    expect(script).toContain("fail-closed production pass");
    expect(script).toContain("valid-ref blocked");
    expect(script).toContain("valid-ref complete");
  });

  it("documents the same status model in affiliate runbook", () => {
    const doc = read("docs/runbooks/AFFILIATE_CERTIFICATION_RUNBOOK.md");

    expect(doc).toContain("P6 Universal Attribution Click Session Smoke");
    expect(doc).toContain("fail-closed production pass");
    expect(doc).toContain("valid-ref blocked");
    expect(doc).toContain("valid-ref complete");
  });
});
