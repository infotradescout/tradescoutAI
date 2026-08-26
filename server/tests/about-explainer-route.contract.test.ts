import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(repoRoot, relativePath), "utf8").replace(/\r\n/g, "\n");
}

describe("TradeScout About explainer route", () => {
  const aboutSource = read("client/src/pages/about.tsx");
  const explainerSource = read("client/src/pages/about-explainer-content.tsx");
  const explainerStyles = read("client/public/about-explainer.css");
  const routesSource = read("client/src/AppRoutes.tsx");

  it("keeps /about routed to the complete native explainer", () => {
    expect(routesSource).toContain('<Route path="/about">');
    expect(aboutSource).toContain("AboutExplainerContent");
    expect(aboutSource).toContain('href="/about-explainer.css"');
    expect(aboutSource).toContain("createPortal");
    expect(aboutSource).not.toContain("<iframe");
    expect(aboutSource).not.toContain("chatgpt.site");
    expect(aboutSource).toContain('canonical="https://www.thetradescout.com/about"');
    expect(explainerStyles).toContain(":host {");
  });

  it("keeps the defining product claims and major systems in the native copy", () => {
    expect(explainerSource).toContain("Connection Without Compromise.");
    expect(explainerSource).toContain("Recommendations drive TradeScout.");
    expect(explainerSource).toContain("Community Verification Score (CVS)");
    expect(explainerSource).toContain("HomeID");
    expect(explainerSource).toContain("Selective Inheritance");
    expect(explainerSource).toContain("Trade-Up For Trade Schools");
  });

  it("keeps expandable summaries readable at phone widths", () => {
    expect(explainerStyles).toContain(".content-section > summary strong { grid-column: 1;");
    expect(explainerStyles).toContain(".content-section > summary small { grid-column: 1;");
    expect(explainerStyles).toContain("grid-column: 2;");
    expect(explainerStyles).toContain("grid-row: 1 / span 2;");
    expect(explainerStyles).toContain(
      ".explainer-stack[open] > summary::after { transform: rotate(225deg); }"
    );
    expect(explainerStyles).toContain(
      ".content-section[open] > summary::after { transform: rotate(225deg); }"
    );
    expect(explainerStyles).toContain('.explainer-stack > summary::after {\n  content: "";');
    expect(explainerStyles).toContain('.content-section > summary::after {\n  content: "";');
    expect(explainerStyles).toContain(
      ".public-tool-grid details[open] summary::after { top: 8px; transform: rotate(225deg); }"
    );
    expect(explainerStyles).not.toContain('.public-tool-grid summary::after { content: "+"');
  });

  it("removes the unsupported legacy About claims", () => {
    const nativeAbout = `${aboutSource}\n${explainerSource}`;

    expect(nativeAbout).not.toContain("15,000+");
    expect(nativeAbout).not.toContain("250,000+");
    expect(nativeAbout).not.toContain("$50M+");
    expect(nativeAbout).not.toContain("Mike Rowe Works Foundation");
    expect(nativeAbout).not.toContain("socialIntegration");
    expect(nativeAbout).not.toContain("Social publishing and external auto-sharing");
    expect(nativeAbout).not.toContain("Dependable end-to-end automatic publishing");
  });
});
