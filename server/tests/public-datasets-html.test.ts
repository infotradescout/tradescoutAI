import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPublicDatasetsCountiesHtml,
  buildPublicDatasetsLandingHtml,
} from "../publicDatasetsHtml";
import { storage } from "../storage";

const templateHtml = `<!doctype html>
<html>
  <head><title>TradeScout</title></head>
  <body><div id="root"></div></body>
</html>`;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("public datasets HTML", () => {
  it("keeps the static datasets landing substantive, canonical, and fact-marked", async () => {
    const html = await buildPublicDatasetsLandingHtml({
      origin: "https://www.thetradescout.com",
      templateHtml,
    });
    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    expect(html).toContain('data-seo-datasets="landing"');
    expect(html).toContain("<h1>Open Datasets</h1>");
    expect(html).toContain(
      '<link rel="canonical" href="https://www.thetradescout.com/datasets" />'
    );
    expect(html).toContain('meta name="robots" content="index, follow');
    expect(bodyText.length).toBeGreaterThanOrEqual(300);
  });

  it("uses the canonical county slug in rendered dataset links", async () => {
    vi.spyOn(storage, "listDirectoryCountiesForSitemap").mockResolvedValue([
      { name: "Tangipahoa County", stateCode: "LA" },
    ] as any);

    const html = await buildPublicDatasetsCountiesHtml({
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    expect(html).toContain('href="/county/la/tangipahoa"');
    expect(html).not.toContain('href="/county/la/tangipahoa-county"');
  });
});
