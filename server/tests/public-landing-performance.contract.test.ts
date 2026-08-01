import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public landing performance contract", () => {
  it("builds the public landing independently from the full application shell", () => {
    const viteConfig = read("vite.config.ts");
    const landingHtml = read("client/landing.html");
    const server = read("server/index.ts");

    expect(viteConfig).toContain('landing: path.resolve(__dirname, "client", "landing.html")');
    expect(landingHtml).toContain('src="/src/landing-main.tsx"');
    expect(landingHtml).not.toContain("fonts.googleapis.com");
    expect(landingHtml).not.toContain("fonts.gstatic.com");
    expect(server).toContain('path.join(publicDistPath, "landing.html")');
  });

  it("keeps one canonical homepage and permanently redirects its aliases", () => {
    const landingRenderer = read("server/publicLandingHtml.ts");
    const server = read("server/index.ts");
    const sitemapGenerator = read("scripts/generate-sitemap.mjs");

    expect(landingRenderer).toContain('return "/";');
    expect(server).toContain('requestPath === "/landing" || requestPath === "/lp"');
    expect(server).toContain("return res.redirect(301");
    expect(sitemapGenerator).not.toContain("{ path: '/landing'");
  });
});
