import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPublicDatasetsCountiesHtml } from "../publicDatasetsHtml";
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
