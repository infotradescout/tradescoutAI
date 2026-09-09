import express from "express";
import request from "supertest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { profilesRouter } from "../routes/profiles";

describe("public core sitemap response", () => {
  it("generates identical sitemap files across build dates without inventing modification dates", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tradescout-sitemap-"));
    try {
      const scripts = path.join(directory, "scripts");
      const publicDirectory = path.join(directory, "client/public");
      fs.mkdirSync(scripts, { recursive: true });
      fs.mkdirSync(publicDirectory, { recursive: true });
      const generator = path.join(scripts, "generate-sitemap-core.mjs");
      fs.copyFileSync(path.resolve("scripts/generate-sitemap-core.mjs"), generator);
      const seed = `<urlset>
        <url><loc>https://www.thetradescout.com/</loc><lastmod>2024-01-02</lastmod></url>
        <url><loc>https://www.thetradescout.com/pensacola</loc></url>
        <url><loc>https://www.thetradescout.com/jw-stone</loc><lastmod>2024-04-05</lastmod></url>
      </urlset>`;
      const generate = (date: string, existing: string | null) => {
        const sitemap = path.join(publicDirectory, "sitemap.xml");
        if (existing === null) {
          if (fs.existsSync(sitemap)) fs.unlinkSync(sitemap);
        } else fs.writeFileSync(sitemap, existing);
        const result = spawnSync(
          process.execPath,
          [
            "--input-type=module",
            "-e",
            `
          const OriginalDate = Date;
          const instant = ${JSON.stringify(date)};
          globalThis.Date = class extends OriginalDate {
            constructor(...args) { super(...(args.length ? args : [instant])); }
            static now() { return new OriginalDate(instant).valueOf(); }
          };
          await import(${JSON.stringify(pathToFileURL(generator).href)});
        `,
          ],
          { encoding: "utf8", timeout: 10000, windowsHide: true }
        );
        expect(result.status, result.stderr).toBe(0);
        return {
          sitemap: fs.readFileSync(sitemap, "utf8"),
          index: fs.readFileSync(path.join(publicDirectory, "sitemap-index.xml"), "utf8"),
        };
      };
      const first = generate("2026-09-08T23:59:59Z", seed);
      expect(generate("2026-09-09T00:00:01Z", seed)).toEqual(first);
      expect(generate("2030-01-01T00:00:00Z", first.sitemap)).toEqual(first);
      expect(first.index).not.toContain("<lastmod>");
      expect(
        [...first.sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((match) => match[1])
      ).toEqual(["2024-01-02", "2024-04-05"]);
      expect(first.index).toContain("<loc>https://www.thetradescout.com/sitemap-core.xml</loc>");
      const fresh = generate("2026-09-08T23:59:59Z", null);
      expect(generate("2026-09-09T00:00:01Z", null)).toEqual(fresh);
      expect(fresh.sitemap).not.toContain("<lastmod>");
    } finally {
      expect(path.dirname(directory)).toBe(path.resolve(os.tmpdir()));
      expect(path.basename(directory)).toMatch(/^tradescout-sitemap-/);
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("submits the existing discovery destinations and excludes the retired contractor alias", async () => {
    const app = express();
    app.use(profilesRouter);
    const response = await request(app).get("/sitemap-core.xml");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/xml");
    const urls = Array.from(
      response.text.matchAll(/<loc>([^<]+)<\/loc>/g),
      (match) => new URL(match[1]).pathname
    );
    for (const route of [
      "/find-local-businesses",
      "/tangipahoa",
      "/for-businesses",
      "/trade-up-for-trade-schools",
    ]) {
      expect(urls).toContain(route);
    }
    expect(urls).not.toContain("/contractors/apply");
    expect(urls).not.toContain("/landing");
    expect(urls.some((url) => url === "/exchange" || url.startsWith("/exchange/"))).toBe(false);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
