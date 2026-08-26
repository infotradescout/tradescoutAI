import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  auditProductionDebt,
  scanProductionDebtSource,
} from "../../scripts/audit-production-debt.mjs";

const temporaryRoots: string[] = [];
afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
function rulesFor(content: string): string[] {
  return scanProductionDebtSource("server/services/synthetic.ts", content).map(
    (finding: { rule: string }) => finding.rule
  );
}
describe("production-debt bounded static audit", () => {
  it("detects explicit runtime placeholders in synthetic source", () => {
    expect(rulesFor("// For now, we'll simulate a successful response\nreturn { ok: true };"))
      .toContain("explicit-runtime-placeholder");
  });
  it("detects random-backed domain and health data but ignores ID entropy", () => {
    expect(rulesFor("const current_value = Math.random() * 80;"))
      .toContain("random-backed-runtime-data");
    expect(rulesFor('const id = Math.random().toString(36).slice(2);'))
      .not.toContain("random-backed-runtime-data");
  });
  it("detects log-only operational claims without a durable provider", () => {
    expect(rulesFor('console.log("mission queued successfully");'))
      .toContain("log-only-operational-claim");
    expect(rulesFor('await db.insert(events).values(event);\nconsole.log("mission queued");'))
      .not.toContain("log-only-operational-claim");
  });
  it("detects process-local operational success state", () => {
    expect(rulesFor('private assignments = new Map();\nregister() { return { success: true }; }'))
      .toContain("in-memory-success-state");
  });
  it("permits explicitly disclosed process-local diagnostics", () => {
    expect(rulesFor('private reports = [];\ngetStats() { return { scope: "process_local", durable: false }; }'))
      .not.toContain("in-memory-success-state");
  });
  it("scans synthetic fixture roots and excludes tests", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "production-debt-audit-"));
    temporaryRoots.push(root);
    fs.mkdirSync(path.join(root, "server/services"), { recursive: true });
    fs.writeFileSync(path.join(root, "server/services/runtime.ts"),
      "const healthScore = Math.random() * 100;\n", "utf8");
    fs.writeFileSync(path.join(root, "server/services/runtime.test.ts"),
      "// For now, we'll simulate a successful response\n", "utf8");
    const result = auditProductionDebt(root);
    expect(result.filesScanned).toBe(1);
    expect(result.findings.map((finding: { rule: string }) => finding.rule))
      .toEqual(["random-backed-runtime-data"]);
    expect(result.semanticCoverage).toBe("bounded_static_signatures_only");
  });
  it("keeps the minimum-release audit hard gate and documentation wired", () => {
    const runner = fs.readFileSync(
      path.resolve(process.cwd(), "scripts/run-minimum-release-contract.mjs"), "utf8");
    const docs = fs.readFileSync(
      path.resolve(process.cwd(), "docs/release/MINIMUM_RELEASE_CONTRACT.md"), "utf8");
    expect(runner).toContain('"3-production-debt-audit"');
    expect(runner).toContain('run("npm", ["run", "audit:production-debt"]');
    expect(docs).toContain("## Production-debt hard gate");
    expect(docs).toContain("no bypass flag");
    expect(docs).toContain("bounded static signatures");
  });
});
