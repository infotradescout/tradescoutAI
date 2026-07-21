import { afterEach, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function runAudit(script: string): { code: number; output: string } {
  try {
    const output = execSync(`node ${script}`, { cwd: ROOT, encoding: "utf8", stdio: "pipe" });
    return { code: 0, output };
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, output: `${e.stdout || ""}${e.stderr || ""}` };
  }
}

describe("theme audit scripts -- regression fixtures for the closed blind spots", () => {
  const fixturePaths: string[] = [];

  afterEach(() => {
    for (const p of fixturePaths.splice(0)) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  });

  it("audit-theme-lock.mjs passes on the real repo with no fixtures present (baseline)", () => {
    const { code } = runAudit("scripts/audit-theme-lock.mjs");
    expect(code).toBe(0);
  });

  it("audit-theme-lock.mjs rejects a raw hex color in an ordinary component file", () => {
    const fixture = path.join(ROOT, "client/src/components/__audit_fixture_hex.tsx");
    fixturePaths.push(fixture);
    fs.writeFileSync(fixture, `export const X = () => <div className="bg-[#17191d]" />;\n`);

    const { code, output } = runAudit("scripts/audit-theme-lock.mjs");
    expect(code).toBe(1);
    expect(output).toContain("Inline hex color");
  });

  it("audit-theme-lock.mjs rejects an unauthorized gradient in an ordinary component file", () => {
    const fixture = path.join(ROOT, "client/src/components/__audit_fixture_gradient.tsx");
    fixturePaths.push(fixture);
    fs.writeFileSync(
      fixture,
      `export const X = () => <div style={{ background: "linear-gradient(90deg, #fff, #000)" }} />;\n`
    );

    const { code, output } = runAudit("scripts/audit-theme-lock.mjs");
    expect(code).toBe(1);
    expect(output).toContain("Unauthorized gradient");
  });

  it("audit-theme-lock.mjs no longer exempts a file just because its name contains 'Scout' (the closed blind spot)", () => {
    // Before the fix, allowedScoutFiles = ["ScoutInput", "scout", "Scout"] matched
    // this filename via a bare substring check and skipped it entirely -- the
    // exact bug that let the real ScoutHome.tsx violations go uncaught.
    const fixture = path.join(ROOT, "client/src/scout/__ScoutAuditAdversarialFixture.tsx");
    fixturePaths.push(fixture);
    fs.writeFileSync(fixture, `export const X = () => <div className="bg-[#123456]" />;\n`);

    const { code, output } = runAudit("scripts/audit-theme-lock.mjs");
    expect(code).toBe(1);
    expect(output).toContain("__ScoutAuditAdversarialFixture.tsx");
  });

  it("ui-surface-audit.mjs now scans client/src/scout/** (the closed blind spot)", () => {
    // Before the fix, this script only ever walked client/src/pages/**, so a
    // raw bg-* class anywhere under client/src/scout/** -- including the real
    // ScoutHome.tsx -- was structurally invisible to it regardless of content.
    const fixture = path.join(ROOT, "client/src/scout/__UiSurfaceAuditFixture.tsx");
    fixturePaths.push(fixture);
    fs.writeFileSync(fixture, `export const X = () => <div className="bg-black/40" />;\n`);

    execSync("node scripts/ui-surface-audit.mjs", { cwd: ROOT, encoding: "utf8" });
    const report = JSON.parse(
      fs.readFileSync(path.join(ROOT, "ui-surface-audit.json"), "utf8")
    ) as { results: Array<{ file: string; hits: Array<{ pattern: string }> }> };
    const hit = report.results.find(
      (r) => r.file === "client/src/scout/__UiSurfaceAuditFixture.tsx"
    );
    expect(hit).toBeTruthy();
    expect(hit?.hits.some((h) => h.pattern === "bg-*")).toBe(true);
  });
});
