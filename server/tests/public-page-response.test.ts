import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { sendPublicPageNotFound, sendPublicPageRenderFailure } from "../utils/publicPageResponse";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

function responseDouble() {
  const headers = new Map<string, string>();
  const response: any = {
    setHeader: vi.fn((name: string, value: string) => headers.set(name, value)),
    status: vi.fn(() => response),
    type: vi.fn(() => response),
    send: vi.fn(() => response),
  };
  return { headers, response };
}

describe("public discovery terminal responses", () => {
  it("returns a non-cacheable, non-indexable 404 for unavailable content", () => {
    const { headers, response } = responseDouble();
    sendPublicPageNotFound(response);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.type).toHaveBeenCalledWith("text/plain");
    expect(headers.get("Cache-Control")).toContain("no-store");
    expect(headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("returns a non-cacheable, non-indexable 500 for rendering failures", () => {
    const { headers, response } = responseDouble();
    sendPublicPageRenderFailure(response);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(headers.get("Cache-Control")).toContain("no-store");
    expect(headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });
});

describe("Phase C indexability contract — terminal responses vs sitemap", () => {
  it("terminal 404/500 responses remain non-indexable (baseline — must stay passing)", () => {
    const { headers: notFoundHeaders, response: notFoundResponse } = responseDouble();
    sendPublicPageNotFound(notFoundResponse);
    expect(notFoundHeaders.get("X-Robots-Tag")).toBe("noindex, nofollow");

    const { headers: failureHeaders, response: failureResponse } = responseDouble();
    sendPublicPageRenderFailure(failureResponse);
    expect(failureHeaders.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("sitemap emitters must not list URLs that resolve to terminal public-page responses", () => {
    const profilesSource = read("server/routes/profiles.ts");

    expect(profilesSource).toContain("assertSitemapUrlIsIndexEligible");
    expect(profilesSource).toMatch(
      /sendPublicPageNotFound|X-Robots-Tag.*noindex|excludeTerminalPublicPageUrls/
    );
  });

  it("documents the live homescout 404 sitemap breach fixture", async () => {
    const fixtures = await import("./fixtures/phase-c-indexability-contract.fixtures");

    expect(fixtures.PHASE_C_DEAD_HOMESCOUT_LISTING_ID).toBe("999d5c07-5779-4b74-86ed-bb2e47f7f5db");
  });

  it("documents crawl-2 live observation: X-Robots-Tag absent on sampled public URLs", async () => {
    const fixtures = await import("./fixtures/phase-c-indexability-contract.fixtures");
    const contract = read(
      "artifacts/evidence/2026-07-25-search-index-recovery/phase-c-indexability-contract.md"
    );

    expect(fixtures.PHASE_C_LIVE_X_ROBOTS_TAG_ABSENT_ON_PUBLIC).toBe(true);
    expect(contract).toContain("X-Robots-Tag live observation");
  });
});
