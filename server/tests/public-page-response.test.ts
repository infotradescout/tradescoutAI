import { describe, expect, it, vi } from "vitest";
import { sendPublicPageNotFound, sendPublicPageRenderFailure } from "../utils/publicPageResponse";

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
