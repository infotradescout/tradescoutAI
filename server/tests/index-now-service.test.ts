import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeIndexNowUrls, submitIndexNowUrls } from "../services/indexNowService";

describe("IndexNow publication service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps only canonical public TradeScout URLs and removes fragments", () => {
    expect(
      normalizeIndexNowUrls([
        "/business/jw-stone",
        "https://www.thetradescout.com/business/jw-stone#inventory",
        "https://evil.example/business/jw-stone",
        "/api/private",
      ])
    ).toEqual(["https://www.thetradescout.com/business/jw-stone"]);
  });

  it("submits a deduplicated canonical batch with ownership proof", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const result = await submitIndexNowUrls(
      [
        "/u/jw-stone",
        "https://www.thetradescout.com/u/jw-stone",
        "https://www.thetradescout.com/community/posts/post-123",
      ],
      { fetchImpl: fetchImpl as any, key: "valid-indexnow-key" }
    );

    expect(result).toEqual({ status: "submitted", submittedUrlCount: 2 });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [, request] = fetchImpl.mock.calls[0];
    expect(JSON.parse(request.body)).toEqual({
      host: "www.thetradescout.com",
      key: "valid-indexnow-key",
      keyLocation: "https://www.thetradescout.com/indexnow-key.txt",
      urlList: [
        "https://www.thetradescout.com/u/jw-stone",
        "https://www.thetradescout.com/community/posts/post-123",
      ],
    });
  });

  it("stays disabled when an explicitly supplied key is invalid", async () => {
    const fetchImpl = vi.fn();
    await expect(
      submitIndexNowUrls(["/business/jw-stone"], {
        fetchImpl: fetchImpl as any,
        key: "",
      })
    ).resolves.toEqual({ status: "disabled", submittedUrlCount: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed on non-success responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 400 });
    await expect(
      submitIndexNowUrls(["/business/jw-stone"], {
        fetchImpl: fetchImpl as any,
        key: "valid-indexnow-key",
      })
    ).rejects.toThrow("IndexNow submission failed with HTTP 400");
  });
});
