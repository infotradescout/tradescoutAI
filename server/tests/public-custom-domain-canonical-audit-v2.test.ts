import { describe, expect, it, vi } from "vitest";
import {
  createThrottledCanonicalAuditFetch,
  runPublicCustomDomainCanonicalAuditV2,
} from "../services/publicCustomDomainCanonicalAuditV2";
import type { PublicCustomDomainCanonicalAuditTarget } from "../services/publicCustomDomainCanonicalAudit";

function headers(values: Record<string, string> = {}) {
  const normalized = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value])
  );
  return {
    get: (name: string) => normalized[name.toLowerCase()] || null,
  };
}

function response(args: {
  status: number;
  url: string;
  location?: string;
  retryAfter?: string;
}) {
  return {
    status: args.status,
    url: args.url,
    headers: headers({
      ...(args.location ? { location: args.location } : {}),
      ...(args.retryAfter ? { "retry-after": args.retryAfter } : {}),
    }),
    text: async () => "",
  };
}

const target: PublicCustomDomainCanonicalAuditTarget = {
  profileSlug: "jw-stone",
  businessSlug: "jw-stone",
  sourceKind: "vanity_root",
  sourceUrl: "https://www.thetradescout.com/jw-stone",
  expectedCanonicalUrl: "https://jwstonelogistics.com/",
};

describe("public custom-domain canonical audit v2", () => {
  it("retries a temporary rate limit and returns the later response", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        response({ status: 429, url: target.sourceUrl, retryAfter: "1" })
      )
      .mockResolvedValueOnce(
        response({
          status: 301,
          url: target.sourceUrl,
          location: target.expectedCanonicalUrl,
        })
      );
    const sleep = vi.fn(async () => undefined);
    const throttled = createThrottledCanonicalAuditFetch({
      fetchImpl,
      requestIntervalMs: 0,
      maxRetries: 1,
      sleep,
    });

    const result = await throttled(target.sourceUrl, { redirect: "manual" });

    expect(result.status).toBe(301);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it("records a persistent 429 as unavailable instead of a redirect failure", async () => {
    const result = await runPublicCustomDomainCanonicalAuditV2({
      targets: [target],
      fetchImpl: async () => response({ status: 429, url: target.sourceUrl }),
      requestIntervalMs: 0,
      maxRetries: 0,
      concurrency: 1,
      persist: false,
      now: () => new Date("2026-08-25T22:00:00.000Z"),
    });

    expect(result.status).toBe("completed");
    expect(result.verifiedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.unavailableCount).toBe(1);
    expect(result.results[0]).toMatchObject({
      status: "unavailable",
      httpStatus: null,
      checks: null,
      failedChecks: [],
    });
    expect(result.results[0].detail).toContain("HTTP 429");
  });

  it("keeps an incorrect permanent redirect classified as a production failure", async () => {
    const result = await runPublicCustomDomainCanonicalAuditV2({
      targets: [target],
      fetchImpl: async () =>
        response({
          status: 301,
          url: target.sourceUrl,
          location: "https://www.thetradescout.com/u/jw-stone",
        }),
      requestIntervalMs: 0,
      maxRetries: 0,
      concurrency: 1,
      persist: false,
      now: () => new Date("2026-08-25T22:00:00.000Z"),
    });

    expect(result.verifiedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.unavailableCount).toBe(0);
    expect(result.results[0].status).toBe("production_failed");
    expect(result.results[0].failedChecks).toContain("locationMatchesCanonical");
    expect(result.results[0].failedChecks).toContain("locationHostMatchesCanonical");
  });
});
