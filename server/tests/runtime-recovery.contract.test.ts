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
  });

  it("missing hashed assets remain explicitly non-cacheable on the server", () => {
    const source = read("server/index.ts");

    expect(source).toContain('if (reqPath.startsWith("/assets"))');
    expect(source).toContain('res.setHeader("Cache-Control", "no-store")');
    expect(source).toContain('res.setHeader("CDN-Cache-Control", "no-store")');
    expect(source).toContain('res.setHeader("Surrogate-Control", "no-store")');
  });

  it("keeps giveaway rules available as a static fallback for legal links", () => {
    const source = read("client/public/giveaway-rules/index.html");

    expect(source).toContain("TradeScout Direct Connect Giveaway Official Rules");
    expect(source).toContain("https://www.thetradescout.com/giveaway-rules");
    expect(source).toContain("Alternative Method of Entry - AMOE");
    expect(source).toContain("Maximum of one (1) entry per person, per day");
  });
});
