import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildPublicLandingHtml } from "../publicLandingHtml";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("landing SEO contracts", () => {
  it("self-canonicalizes stable landing variants and noindexes only aliases/query variants", () => {
    const source = read("client/src/pages/landing.tsx");

    expect(source).toContain('pathOnly.startsWith("/lp/")');
    expect(source).toContain('pathOnly.startsWith("/landing/")');
    expect(source).toContain('const hasQueryParams = rawLocation.includes("?")');
    expect(source).toContain(
      "const shouldIndexLandingPage = !isAliasLandingPath && !hasQueryParams"
    );
    expect(source).toContain("canonical={canonicalLandingUrl}");
    expect(source).toContain("noIndex={!shouldIndexLandingPage}");
  });

  it("keeps the server-rendered public landing fallback aligned with locked copy", () => {
    const source = read("server/publicLandingHtml.ts");

    expect(source).toContain("Connection Without Compromise");
    expect(source).toContain("Start a Request");
    expect(source).toContain("/tradescout-logo-circle.png");
    expect(source).not.toContain("Find Any Local Business Near You");
    expect(source).not.toContain("Ask Scout");
    expect(source).not.toContain("Scout interprets");
    expect(source).not.toContain("Scout routes");
    expect(source).not.toContain("Get started with Scout");
    expect(source).not.toContain("Direct Connect");
  });

  it("renders locked landing copy into the server HTML body", async () => {
    const templateHtml = `<!doctype html>
<html>
  <head><title>TradeScout</title></head>
  <body>
    <div id="ts-boot-fallback"></div>
    <div id="root"></div>
  </body>
</html>`;

    const html = await buildPublicLandingHtml({
      origin: "https://www.thetradescout.com",
      templateHtml,
      requestPath: "/",
    });

    expect(html).toContain("<h1>Connection Without Compromise</h1>");
    expect(html).toContain('alt="TradeScout logo"');
    expect(html).toContain(">Start a Request</a>");
    expect(html).not.toContain("Find Any Local Business Near You");
    expect(html).not.toContain("Ask Scout");
    expect(html).not.toContain("Scout routes");
    expect(html).not.toContain("Direct Connect");
  });
});
