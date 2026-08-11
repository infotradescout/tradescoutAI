import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("runtime recovery contracts", () => {
  it("ScoutFitters avoids blob URLs so CSP-safe image previews still work", () => {
    const source = read("client/src/pages/marketing/ScoutFitters.tsx");

    expect(source).toContain("async function fileToDataUrl(file: File): Promise<string>");
    expect(source).toContain("reader.readAsDataURL(file)");
    expect(source).not.toContain("URL.createObjectURL(file)");
    expect(source).not.toContain("URL.createObjectURL(logoFile)");
    expect(source).not.toContain("img.src = url");
  });

  it("startup recovery clears client caches and refreshes on stale chunk errors", () => {
    const source = read("client/src/main.tsx");

    expect(source).toContain('const RECOVERY_FLAG = "ts_chunk_recovery_attempted_v1"');
    expect(source).toContain("await resetClientCaches({ clearLocalStorage: false })");
    expect(source).toContain('url.searchParams.set("__fresh", String(Date.now()))');
    expect(source).toContain("window.location.replace(url.toString())");
    expect(source).toContain("Failed to fetch dynamically imported module");
    expect(source).toContain('window.addEventListener("vite:preloadError"');
    expect(source).toContain("event.preventDefault()");
    expect(source).toContain("let chunkRecoveryInFlight = false");
    expect(source).toContain("if (chunkRecoveryInFlight) return");
  });

  it("missing hashed assets remain explicitly non-cacheable on the server", () => {
    const source = read("server/index.ts");

    expect(source).toContain('if (reqPath.startsWith("/assets"))');
    expect(source).toContain('res.setHeader("Cache-Control", "no-store")');
    expect(source).toContain('res.setHeader("CDN-Cache-Control", "no-store")');
    expect(source).toContain('res.setHeader("Surrogate-Control", "no-store")');
    expect(source).toContain("resolveCurrentEntryStylesheet");
    expect(source).toContain('res.setHeader("X-TradeScout-Asset-Recovery", "current-entry-css")');
    expect(source).toContain("resolveCanonicalDuplicatedAssetPath");
    expect(source).toContain('"duplicate-prefix-canonical"');
    expect(source).toContain("return res.redirect(308, canonicalAssetPath)");
  });

  it("never lets one business profile's boot-time provisioning crash the whole server", () => {
    const source = read("server/index.ts");

    // A bad value in any single provisioner (e.g. the "seller" user_role enum
    // bug in Moulding & Millwork's provisioner) must not throw past this
    // point and take down the entire boot sequence before app.listen().
    expect(source).toContain("const provisionProfile = async (label: string");
    expect(source).toContain(
      'await provisionProfile("JR\'s Auto Glass", provisionJrsAutoGlassProfile)'
    );
    expect(source).toContain('await provisionProfile("LA Plumbing", provisionLaPlumbingProfile)');
    expect(source).toContain('await provisionProfile("ISSA Build", provisionIssaBuildProfile)');
    expect(source).toContain('await provisionProfile("ProFab", provisionProFabProfile)');
    expect(source).toContain(
      'await provisionProfile("Moulding & Millwork Supply", provisionMouldingMillworkProfile)'
    );
    expect(source).not.toMatch(/await provisionJrsAutoGlassProfile\(\);/);
    expect(source).not.toMatch(/await provisionMouldingMillworkProfile\(\);/);
  });

  it("keeps giveaway rules available as a static fallback for legal links", () => {
    const source = read("client/public/giveaway-rules/index.html");

    expect(source).toContain("TradeScout Direct Connect Giveaway Official Rules");
    expect(source).toContain("https://www.thetradescout.com/giveaway-rules");
    expect(source).toContain("Alternative Method of Entry - AMOE");
    expect(source).toContain("Maximum of one (1) entry per person, per day");
  });
});
