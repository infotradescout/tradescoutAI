import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
const css = read("client/src/components/layout/CoreApplicationTheme.css");
const shell = read("client/src/components/layout/AppShell.tsx");

describe("core-only dark surfaces", () => {
  it("removes the draft's blanket utility remapping instead of flattening scrims and media", () => {
    expect(shell).not.toContain('[class~="bg-');
    expect(shell).not.toContain('[class~="border-');
    expect(css).not.toMatch(/\[class[~*|^$]?=/);
    expect(css).not.toMatch(/(?:^|\n)\s*(?:body|:root|html|\.app-root)\b/);
  });

  it("uses distinct opaque surfaces from the existing brand palette", () => {
    expect(css).toContain("--surface-frame: var(--ts-surface-strong);");
    expect(css).toContain("--surface-card: var(--ts-surface);");
    expect(css).toContain("--surface-intermediate: var(--ts-surface-hover);");
    expect(css).toContain("--surface-input: var(--ts-input-bg);");
    expect(css).not.toMatch(/--surface-(?:frame|card|intermediate|input):[^;]*transparent/);
    expect(css).not.toMatch(/#[a-f0-9]{3,8}\b/i);
    expect(css).toContain("color-scheme: dark");
  });

  it("keeps every style selector within the explicit app-owned DOM scope", () => {
    const selectors = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/[^{}]+\{/g) || [];
    for (const opening of selectors) {
      if (opening.trim().startsWith("@media")) continue;
      for (const selector of opening.replace(/\{$/, "").split(",")) {
        expect(selector.trim().startsWith('[data-ts-core-ui="true"]')).toBe(true);
      }
    }
  });

  it("keeps keyboard focus and readable labels instead of relying on orange text alone", () => {
    expect(css).toContain("outline: 2px solid var(--theme-accent-primary) !important");
    expect(css).toContain('.ts-product-nav-link[aria-current="page"] {\n  color: var(--text-primary)');
    expect(css).toContain("prefers-reduced-motion: reduce");
    const navigator = read("client/src/components/navigation/ProductNavigator.tsx");
    expect(navigator).toContain('data-ts-core-ui="true"');
    expect(navigator).toContain("DialogContent");
    expect(navigator).toContain("onOpenAutoFocus");
    expect(navigator).not.toContain("<details");
  });
});
