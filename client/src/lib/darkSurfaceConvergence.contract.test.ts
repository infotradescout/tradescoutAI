import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("TradeScout core dark surface convergence", () => {
  it("uses an application-only scope instead of styling public profile surfaces", () => {
    const shell = read("client/src/components/layout/AppShell.tsx");

    expect(shell).toContain('document.body.classList.toggle("ts-application-ui-scope", isApplicationUiSurface)');
    expect(shell).toContain("!isPublicProfileSurface");
    expect(shell).toContain("__TS_CUSTOM_DOMAIN_PROFILE_SLUG__");
    expect(shell).toContain('pathOnly === "/jw-stone"');
  });

  it("maps known legacy dark utility surfaces back onto semantic theme layers", () => {
    const shell = read("client/src/components/layout/AppShell.tsx");

    expect(shell).toContain('[class~="bg-white/5"]');
    expect(shell).toContain('[class~="bg-white/10"]');
    expect(shell).toContain('[class~="bg-white/18"]');
    expect(shell).toContain('[class~="bg-zinc-950/95"]');
    expect(shell).toContain('[class~="border-white/10"]');
    expect(shell).toContain('[class~="bg-black/20"]');
    expect(shell).toContain("var(--surface-card)");
    expect(shell).toContain("var(--surface-intermediate)");
    expect(shell).toContain("var(--surface-frame)");
    expect(shell).toContain("var(--border-subtle)");
  });

  it("keeps the dark hierarchy dimensional instead of flattening everything to one color", () => {
    const shell = read("client/src/components/layout/AppShell.tsx");

    expect(shell).toContain("color-mix(in oklab, var(--surface-card) 88%, transparent)");
    expect(shell).toContain("color-mix(in oklab, var(--surface-intermediate) 90%, transparent)");
    expect(shell).toContain("color-mix(in oklab, var(--surface-frame) 72%, transparent)");
  });
});
