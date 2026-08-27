import { afterEach, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const UI_AUDIT_DIR = path.join(ROOT, "artifacts", "ui-surface-audit");
const UI_AUDIT_ARTIFACTS = [
  path.join(UI_AUDIT_DIR, "ui-surface-audit.json"),
  path.join(UI_AUDIT_DIR, "ui-surface-audit.md"),
];

type ArtifactSnapshot = { existed: true; content: Buffer } | { existed: false };

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
  let artifactSnapshots: Map<string, ArtifactSnapshot> | null = null;

  const snapshotUiAuditArtifacts = () => {
    artifactSnapshots = new Map<string, ArtifactSnapshot>(
      UI_AUDIT_ARTIFACTS.map((artifactPath): [string, ArtifactSnapshot] => [
        artifactPath,
        fs.existsSync(artifactPath)
          ? { existed: true, content: fs.readFileSync(artifactPath) }
          : { existed: false },
      ])
    );
  };

  afterEach(() => {
    for (const p of fixturePaths.splice(0)) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    if (artifactSnapshots) {
      for (const [artifactPath, snapshot] of artifactSnapshots) {
        if (snapshot.existed) {
          fs.writeFileSync(artifactPath, snapshot.content);
        } else if (fs.existsSync(artifactPath)) {
          fs.unlinkSync(artifactPath);
        }
      }
      artifactSnapshots = null;
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
    snapshotUiAuditArtifacts();
    fs.writeFileSync(fixture, `export const X = () => <div className="bg-black/40" />;\n`);

    execSync("node scripts/ui-surface-audit.mjs", { cwd: ROOT, encoding: "utf8" });
    const report = JSON.parse(
      fs.readFileSync(path.join(UI_AUDIT_DIR, "ui-surface-audit.json"), "utf8")
    ) as { results: Array<{ file: string; hits: Array<{ pattern: string }> }> };
    const hit = report.results.find(
      (r) => r.file === "client/src/scout/__UiSurfaceAuditFixture.tsx"
    );
    expect(hit).toBeTruthy();
    expect(hit?.hits.some((h) => h.pattern === "bg-*")).toBe(true);
    expect(fs.existsSync(path.join(ROOT, "ui-surface-audit.json"))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, "ui-surface-audit.md"))).toBe(false);
  });
});

describe("client/src/scout/ -- zero-tolerance clean zone (Lane 2)", () => {
  it("has no forbidden hex/gradient values across the whole directory except the one documented, out-of-scope exception", () => {
    // ScoutThread.tsx's progress-bar gradient stop (#ea580c) has no existing
    // token equivalent and resolving it would mean inventing a new token,
    // which Lane 1/2 both explicitly exclude -- see scripts/audit-theme-lock.mjs's
    // HEX_AND_GRADIENT_EXCEPTIONS. Every other file under client/src/scout/
    // must have zero exceptions: this test fails the moment a new one is
    // added without a deliberate, reviewed change here.
    const auditSource = fs.readFileSync(path.join(ROOT, "scripts/audit-theme-lock.mjs"), "utf8");
    const exceptionBlockMatch = auditSource.match(
      /HEX_AND_GRADIENT_EXCEPTIONS = \[([\s\S]*?)\n  \];/
    );
    expect(exceptionBlockMatch).toBeTruthy();
    const exceptionBlock = exceptionBlockMatch![1];

    const scoutFiles = fs
      .readdirSync(path.join(ROOT, "client/src/scout"))
      .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
    const exemptedScoutFiles = scoutFiles.filter((f) => exceptionBlock.includes(`file: "${f}"`));
    expect(exemptedScoutFiles).toEqual(["ScoutThread.tsx"]);
  });

  it("ScoutHome.tsx specifically has zero raw surface/border/text-hierarchy classes left (Lane 2 deliverable)", () => {
    const source = fs.readFileSync(path.join(ROOT, "client/src/scout/ScoutHome.tsx"), "utf8");
    expect(source).not.toMatch(/\b(zinc|slate|gray|neutral|stone)-\d+\b/);
    expect(source).not.toMatch(/\btext-white\b/);
    expect(source).not.toMatch(/\bbg-black\b|\bbg-white\b/);
    expect(source).not.toMatch(/#[0-9a-fA-F]{6}/);
    // Semantic multi-hue status/category coding (toneClasses, iconClass maps)
    // is intentionally out of scope -- it represents distinct content
    // categories, not page chrome, matching the same pattern already
    // accepted in the already-wired ScoutOS.tsx (emerald-50/emerald-700).
    expect(source).toContain("bg-[var(--surface-card)]");
    expect(source).toContain("border-[var(--border-primary)]");
  });
});
