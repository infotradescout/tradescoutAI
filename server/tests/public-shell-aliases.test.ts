import fs from "node:fs";
import path from "node:path";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { PUBLIC_SHELL_ALIASES, resolvePublicShellAlias } from "@shared/publicShellAliases";
import { registerPublicShellAliasRoutes } from "../publicShellAliasRoutes";

const aliases = [
  ["/landing/logo.png", "/tradescout-logo.png"],
  ["/logo.png", "/tradescout-logo.png"],
  ["/tradescout-brand.png", "/tradescout-logo.png"],
  ["/icon-192-maskable.png", "/icon-192.png"],
  ["/icon-512-maskable.png", "/icon-512.png"],
  ["/apple-touch-icon-precomposed.png", "/apple-touch-icon.png"],
] as const;

describe("public shell local dedupe Release A", () => {
  it("resolves only six exact aliases and rejects unsafe variants", () => {
    expect([...PUBLIC_SHELL_ALIASES].sort()).toEqual([...aliases].sort());
    for (const [source, target] of aliases) expect(resolvePublicShellAlias(source)).toBe(target);
    for (const unsafe of [
      "/landing/%2e%2e/logo.png",
      "/landing%2flogo.png",
      "/LANDING/logo.png",
      "/landing/logo.png/extra",
      "/landing/logo.png%00",
    ])
      expect(resolvePublicShellAlias(unsafe)).toBeNull();
  });

  it.each(aliases)("preserves GET and HEAD query compatibility for %s", async (source, target) => {
    const app = express();
    registerPublicShellAliasRoutes(app);
    await request(app)
      .get(`${source}?v=9&host=custom`)
      .set("Host", "profile.example")
      .expect(308)
      .expect("Location", `${target}?v=9&host=custom`);
    await request(app)
      .head(`${source}?v=9`)
      .set("Host", "www.thetradescout.com")
      .expect(308)
      .expect("Location", `${target}?v=9`);
  });

  it("keeps PWA, social, landing, and recognition contracts canonical and compatible", () => {
    const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
    const manifest = read("client/public/manifest.json");
    const webmanifest = read("client/public/site.webmanifest");
    const icons = read("client/src/components/TradeScoutIcons.tsx");
    const community = read("server/publicCommunityPost.ts");
    const worker = read("server/routes/worker-tasks.ts");
    const routes = read("server/routes.ts");
    expect(manifest).not.toContain("-maskable.png");
    expect(webmanifest).not.toContain("-maskable.png");
    expect(icons).toContain('FALLBACK_LOGO_URL = "/tradescout-logo.png?v=8"');
    for (const legacy of ["/tradescout-brand.png", "/logo.png"]) {
      expect(community).toContain(legacy);
      expect(worker).toContain(legacy);
      expect(routes).toContain(legacy);
    }
    expect(read("client/src/pages/landingVariants.ts")).toContain('trust: "/landing/hero.jpg"');
    expect(read("server/publicLandingHtml.ts")).toContain("/tradescout-logo-circle.png");
    expect(read("server/publicProfileHtml.ts")).toContain("/tradescout-logo.png");
  });

  it("keeps canonical PWA dimensions and purposes while retaining legacy duplicates", () => {
    const root = path.resolve(process.cwd(), "client/public");
    const manifests = ["manifest.json", "site.webmanifest"].map((file) =>
      JSON.parse(fs.readFileSync(path.join(root, file), "utf8"))
    );
    const dimensions = (file: string) => {
      const png = fs.readFileSync(path.join(root, file));
      expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
      return [png.readUInt32BE(16), png.readUInt32BE(20)];
    };
    const canonicalDimensions = new Map([
      ["/icon-192.png?v=9", dimensions("icon-192.png")],
      ["/icon-512.png?v=9", dimensions("icon-512.png")],
    ]);
    expect(canonicalDimensions.get("/icon-192.png?v=9")).toEqual([192, 192]);
    expect(canonicalDimensions.get("/icon-512.png?v=9")).toEqual([512, 512]);
    expect(manifests[0].icons).toEqual([
      { src: "/icon-192.png?v=9", sizes: "192x192", type: "image/png", purpose: "any" },
      {
        src: "/icon-192.png?v=9",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/icon-512.png?v=9", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-512.png?v=9",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ]);
    expect(manifests[1].icons).toEqual([
      { src: "/icon-192.png?v=9", sizes: "192x192", type: "image/png", purpose: "any" },
      {
        src: "/icon-512.png?v=9",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ]);
    for (const manifest of manifests) {
      for (const icon of manifest.icons) {
        const [width, height] = canonicalDimensions.get(icon.src) || [];
        expect(icon.sizes).toBe(`${width}x${height}`);
        expect(icon.type).toBe("image/png");
      }
    }
    for (const [legacy, canonical] of [
      ["icon-192-maskable.png", "icon-192.png"],
      ["icon-512-maskable.png", "icon-512.png"],
      ["apple-touch-icon-precomposed.png", "apple-touch-icon.png"],
    ]) {
      expect(fs.existsSync(path.join(root, legacy))).toBe(true);
      expect(fs.readFileSync(path.join(root, legacy))).toEqual(
        fs.readFileSync(path.join(root, canonical))
      );
    }
  });
});
